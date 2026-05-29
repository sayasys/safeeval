// Write-path orchestrator for SafeEval persistence.
//
// Spec: docs/memos/2026-05-28-data-track-implementation-spec.md section 5.
// Q3 adjudication: docs/memos/compl/2026-05-28-pii-access-posture.md (fail-stop
// on any sub-step error; no partial writes).
// PII zero-storage Tier A: docs/memos/2026-05-28-pii-zero-storage-scoping.md.
// The KMS branch was dropped per Tier A -- SafeEval does not store unredacted
// PII; the sanitized envelope is the single source of truth.
//
// Sequence:
//   1. Sanitize the engine envelope (PII redaction).
//   2. Insert into the evaluations table via the Supabase db-client.
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
import {
  generateReport,
  IMPLEMENTED_AUDIENCES,
  type ImplementedAudience,
  type GenerateReportOptions,
} from '../report-generators';

const PREGEN_FLAG = 'SAFEEVAL_PREGEN_REPORTS';

export function pregenReportsEnabled(): boolean {
  return process.env[PREGEN_FLAG] === 'true';
}

// Audiences pre-generated on block/human_review. Legal is excluded by
// design: the legal-audience auth-gate refuses any call without
// unredacted_access=true, so firing it from the background hook would burn
// API budget for guaranteed gate-refusal. Phase 3 wires the legal-audience
// auth-gate on the READ path, at which point the legal report can be pre-
// generated unconditionally if Steven wants the pay-once / amortize-reads
// behavior described in the implementation spec section 4.3. Phase 2 keeps
// the four non-legal audiences only.
const PREGEN_AUDIENCES: readonly ImplementedAudience[] =
  IMPLEMENTED_AUDIENCES.filter((a) => a !== 'legal');

async function pregenOneReport(
  evaluation_id: string,
  audience: ImplementedAudience,
  client: DbClientSurface,
): Promise<void> {
  try {
    const opts: GenerateReportOptions = {
      source: 'pre_gen',
      dbClient: client,
    };
    await generateReport(evaluation_id, audience, opts);
  } catch (err) {
    // Fire-and-forget semantics per spec section 4.1. The data-track post-
    // write hook surfaces failures on the observation channel; persistence
    // itself never throws on a report-gen failure. console.error mirrors
    // the wire-up.ts pattern.
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `pregen report failed (evaluation_id=${evaluation_id}, audience=${audience}):`,
      message,
    );
  }
}

function triggerPregenReports(
  evaluation_id: string,
  disposition: DispositionAction,
  client: DbClientSurface,
): void {
  if (!pregenReportsEnabled()) return;
  if (disposition !== 'block' && disposition !== 'human_review') return;
  // Fire-and-forget. Each per-audience call has its own try-catch so a
  // single audience failure does not cancel the rest.
  for (const audience of PREGEN_AUDIENCES) {
    void pregenOneReport(evaluation_id, audience, client);
  }
}

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

export type PersistErrorCode =
  | 'SANITIZER_FAILURE'
  | 'DB_FAILURE'
  | 'INVALID_ENVELOPE';

export interface PersistErrorContext {
  step: 'sanitize' | 'insert' | 'validate';
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

export interface PersistOptions {
  customer_id?: string;
  // Test seam: allow tests to inject a mock db-client without poking the
  // module-level singleton. Production callers do not pass this.
  dbClient?: DbClientSurface;
}

export interface PersistResult {
  evaluation_id: string;
}

export async function persistEvaluation(
  envelope: V5Envelope,
  // rawInput is retained on the signature for caller compatibility but is
  // intentionally unused: Tier A (PII zero-storage) removed the KMS branch
  // that previously consumed it. See module header.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rawInput: string,
  options: PersistOptions = {},
): Promise<PersistResult> {
  const customer_id = options.customer_id ?? 'self';

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

  // Reference rawInput so strict noUnusedParameters / lint does not flag it.
  void rawInput;

  // ---------------------------------------------------------------
  // Step 2: INSERT via db-client. Fail-stop on DB errors.
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
  };

  const client = options.dbClient ?? getClient();
  try {
    const { evaluation_id } = await client.withCustomerContext(customer_id, () =>
      client.insertEvaluation(row),
    );
    // Post-write hook: pre-generate reports for block / human_review when
    // SAFEEVAL_PREGEN_REPORTS=true. Fire-and-forget; never blocks the
    // caller and never converts a successful persist into a failure.
    triggerPregenReports(evaluation_id, disposition_action, client);
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
