// Write-path orchestrator for SafeEval persistence (Phase 2).
//
// Spec: docs/memos/2026-05-28-data-track-implementation-spec.md section 5.
// Q3 adjudication: docs/memos/compl/2026-05-28-pii-access-posture.md (fail-stop
// on any sub-step error; no partial writes).
//
// Sequence:
//   1. Sanitize the engine envelope (PII redaction). Phase 1.
//   2. Encrypt the raw input via KMS. Phase 3 deferral: Phase 2 either stores
//      null (kms.skip === true, the default) or throws KMSNotImplementedError
//      (kms.skip === false). DO NOT write a fake ciphertext: that would create
//      a reviewer-escalation gap that Q3 explicitly forbids.
//   3. Insert into the evaluations table via the Supabase db-client.
//
// Fail-stop. If any step throws, the persist is aborted; no partial state is
// written. The error carries a typed code naming the step that failed plus
// the envelope's stage2_prompt_hash (when available) for log correlation.
//
// Field reconciliation. The JSON Schema (tests/schema/v5-envelope.schema.json)
// hoists these audit-metadata fields to the top level of the envelope; the
// implementation spec drafted earlier referenced a nested envelope.audit_metadata
// object that does not exist. This module maps the JSON-Schema top-level names
// onto the spec-named DB columns. See FIELD_RECONCILIATION below.

import { sanitize } from './sanitizer';
import { getClient, type DbClientSurface, type InsertEvaluationRow } from './db-client';
import type { V5Envelope, DispositionAction } from './types';

// FIELD_RECONCILIATION
//   JSON-Schema envelope path                  -> DB column
//   ---------------------------------------------------------------
//   envelope.cache_key                         -> cache_key
//   envelope.ontology_version                  -> ontology_version
//   envelope.schema_version                    -> schema_version
//   envelope.stage1_prompt_hash                -> stage1_prompt_hash
//   envelope.stage2_prompt_hash                -> stage2_prompt_hash
//   envelope.stage3_prompt_hash                -> stage3_prompt_hash
//   envelope.stage4_prompt_hash                -> stage4_prompt_hash
//   envelope.disposition.action  (nested)      -> disposition
//   envelope.evidence.aggregate_score (nested) -> aggregate_score
//   (sanitizer output)                         -> envelope (JSONB)
//   (sanitizer output)                         -> pii_redaction_log (JSONB)
//   (Phase 3 KMS output, null in Phase 2)      -> unredacted_payload_kms_ciphertext
//   (Phase 3 KMS output, null in Phase 2)      -> unredacted_payload_encrypted_dek
//   (Phase 3 KMS output, null in Phase 2)      -> unredacted_payload_kms_key_id

export type PersistErrorCode =
  | 'SANITIZER_FAILURE'
  | 'KMS_NOT_IMPLEMENTED'
  | 'DB_FAILURE'
  | 'INVALID_ENVELOPE';

export interface PersistErrorContext {
  step: 'sanitize' | 'kms' | 'insert' | 'validate';
  code: PersistErrorCode;
  cache_key?: string | undefined;
  stage2_prompt_hash?: string | undefined;
}

export class PersistError extends Error {
  override readonly name = 'PersistError';
  readonly code: PersistErrorCode;
  readonly step: PersistErrorContext['step'];
  readonly cache_key: string | undefined;
  readonly stage2_prompt_hash: string | undefined;
  readonly cause_message: string | undefined;

  constructor(message: string, context: PersistErrorContext, cause?: unknown) {
    super(message);
    this.code = context.code;
    this.step = context.step;
    this.cache_key = context.cache_key;
    this.stage2_prompt_hash = context.stage2_prompt_hash;
    this.cause_message = cause instanceof Error ? cause.message : undefined;
  }
}

// Phase 2 stub. Throws when callers opt into real KMS by passing kms.skip=false.
// Phase 3 replaces the throw with a real call into kms.ts.
export class KMSNotImplementedError extends Error {
  override readonly name = 'KMSNotImplementedError';
  constructor() {
    super(
      'KMS integration is deferred to Phase 3. Pass options.kms.skip = true to ' +
        'persist with a null ciphertext column, or wait for the Phase 3 dispatch.',
    );
  }
}

export interface PersistOptions {
  customer_id?: string;
  kms?: {
    // Default true in Phase 2: persistence writes a null ciphertext column.
    // When Phase 3 lands and a caller opts in (skip=false), the real KMS path
    // fires; until then, skip=false explicitly throws KMSNotImplementedError so
    // no caller silently writes fake ciphertext.
    skip?: boolean;
  };
  // Test seam: allow tests to inject a mock db-client without poking the
  // module-level singleton. Production callers do not pass this.
  dbClient?: DbClientSurface;
}

export interface PersistResult {
  evaluation_id: string;
}

export async function persistEvaluation(
  envelope: V5Envelope,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rawInput: string,
  options: PersistOptions = {},
): Promise<PersistResult> {
  const customer_id = options.customer_id ?? 'self';
  const kmsSkip = options.kms?.skip ?? true;

  // ---------------------------------------------------------------
  // Step 0: validate the envelope's required hoist fields.
  // M1 DDL marks cache_key, ontology_version, schema_version, and disposition
  // NOT NULL; missing any of these is a developer error (engine contract
  // violation), not a runtime failure to retry.
  // ---------------------------------------------------------------
  const cache_key = envelope.cache_key;
  const ontology_version = envelope.ontology_version;
  const schema_version = envelope.schema_version;
  const disposition_action = envelope.disposition?.action as DispositionAction | undefined;

  if (typeof cache_key !== 'string' || cache_key.length === 0) {
    throw new PersistError(
      'envelope.cache_key missing or empty; cannot persist',
      { step: 'validate', code: 'INVALID_ENVELOPE' },
    );
  }
  if (typeof ontology_version !== 'string' || ontology_version.length === 0) {
    throw new PersistError(
      'envelope.ontology_version missing or empty; cannot persist',
      { step: 'validate', code: 'INVALID_ENVELOPE', cache_key },
    );
  }
  if (typeof schema_version !== 'string' || schema_version.length === 0) {
    throw new PersistError(
      'envelope.schema_version missing or empty; cannot persist',
      { step: 'validate', code: 'INVALID_ENVELOPE', cache_key },
    );
  }
  if (!isValidDisposition(disposition_action)) {
    throw new PersistError(
      `envelope.disposition.action missing or not in closed vocabulary: ${String(disposition_action)}`,
      { step: 'validate', code: 'INVALID_ENVELOPE', cache_key },
    );
  }

  // ---------------------------------------------------------------
  // Step 1: sanitize. Fail-stop on any sanitizer error.
  // ---------------------------------------------------------------
  let sanitized_envelope: V5Envelope;
  let redaction_log: unknown;
  try {
    const result = await sanitize(envelope);
    sanitized_envelope = result.sanitized_envelope;
    redaction_log = result.redaction_log;
  } catch (err) {
    throw new PersistError(
      'sanitize() failed; no partial write performed',
      {
        step: 'sanitize',
        code: 'SANITIZER_FAILURE',
        cache_key,
        stage2_prompt_hash: envelope.stage2_prompt_hash,
      },
      err,
    );
  }

  // ---------------------------------------------------------------
  // Step 2: KMS. Phase 2 stub.
  //   - kms.skip === true (default): store null ciphertext.
  //   - kms.skip === false: throw KMSNotImplementedError. Phase 3 replaces this
  //     branch with a real call to kms.encryptEnvelope(rawInput).
  // No silent fake-ciphertext path; see Q3 adjudication.
  // The rawInput parameter is intentionally unused in Phase 2; Phase 3 will
  // pass it through to kms.encryptEnvelope().
  // ---------------------------------------------------------------
  let unredacted_payload_kms_ciphertext: Buffer | null = null;
  let unredacted_payload_encrypted_dek: Buffer | null = null;
  let unredacted_payload_kms_key_id: string | null = null;

  if (!kmsSkip) {
    throw new KMSNotImplementedError();
  }
  // Reference rawInput so strict noUnusedParameters / lint does not flag it.
  void rawInput;

  // ---------------------------------------------------------------
  // Step 3: INSERT via db-client. Fail-stop on DB errors.
  // ---------------------------------------------------------------
  const row: InsertEvaluationRow = {
    customer_id,
    envelope: sanitized_envelope,
    cache_key,
    ontology_version,
    schema_version,
    stage1_prompt_hash: envelope.stage1_prompt_hash ?? null,
    stage2_prompt_hash: envelope.stage2_prompt_hash ?? null,
    stage3_prompt_hash: envelope.stage3_prompt_hash ?? null,
    stage4_prompt_hash: envelope.stage4_prompt_hash ?? null,
    disposition: disposition_action,
    aggregate_score: extractAggregateScore(envelope),
    pii_redaction_log: redaction_log,
    unredacted_payload_kms_ciphertext,
    unredacted_payload_encrypted_dek,
    unredacted_payload_kms_key_id,
  };

  const client = options.dbClient ?? getClient();
  try {
    const { evaluation_id } = await client.withCustomerContext(customer_id, () =>
      client.insertEvaluation(row),
    );
    return { evaluation_id };
  } catch (err) {
    if (err instanceof PersistError) throw err;
    throw new PersistError(
      'insertEvaluation failed; no row was persisted',
      {
        step: 'insert',
        code: 'DB_FAILURE',
        cache_key,
        stage2_prompt_hash: envelope.stage2_prompt_hash,
      },
      err,
    );
  }
}

function isValidDisposition(value: unknown): value is DispositionAction {
  return value === 'allow' || value === 'safe_completion' || value === 'human_review' || value === 'block';
}

function extractAggregateScore(envelope: V5Envelope): number | null {
  const evidence = envelope.evidence;
  if (!evidence || typeof evidence !== 'object') return null;
  const raw = (evidence as { aggregate_score?: unknown }).aggregate_score;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
}
