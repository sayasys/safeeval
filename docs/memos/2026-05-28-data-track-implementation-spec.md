# Data track implementation spec -- Compliance-ready tier

**Status:** engineering brief, ready for VS Code commit. Consumes the adjudicated scoping memo as input; does not re-author scope decisions.
**Date:** 2026-05-28
**Author:** `safeeval-data` (Cowork), via `design:design-handoff` skill (engineering-handoff variant).
**Companion to:** `docs/memos/2026-05-28-data-track-scoping.md` (scope tier adjudicated to Compliance-ready in commit `be30894`; encryption-at-rest adjudicated to AWS KMS in commit `f62c34c`; PII sanitization spec at scoping memo section 4 is the input vocabulary), `docs/memos/2026-05-24-parallel-cowork-tracks.md` (parallel-tracks framework; data track registered in the sixth atomic amendment in flight), `docs/07-v5-schema.md` (envelope shape the persistence layer wraps), `src/lib/safeeval-v5.js` (engine emitting the audit-metadata fields the schema hoists out).
**Scope:** translate the Compliance-ready scope tier into an engineering-grade implementation specification. The deliverable a VS Code session can execute against without further design adjudication. Module layout, schema DDL, sanitization pipeline signatures, KMS integration, persistence write path, two-key access tier, test plan, env vars, migration sequencing, acceptance criteria. No re-litigation of scope.

## 1. Module layout

New directory `src/lib/data/` carries the persistence layer. The directory is the sole-writer artifact set for the data track; nothing outside this directory writes to it, and the engine code in `src/lib/safeeval-v5.js` does not import from it (the engine remains persistence-agnostic; the API route layer wires the engine output into the persistence write path).

```
src/lib/data/
  db-client.ts          -- Supabase client wrapper; pooled connections; tenant scoping
  sanitizer.ts          -- PII redaction pipeline (Presidio + regex fallback)
  persistence.ts        -- envelope write path orchestration
  kms.ts                -- AWS KMS envelope-encryption wrapper
  types.ts              -- shared types (Envelope, RedactionLog, PersistResult)
  schema/
    001_create_evaluations.sql        -- M1: table + indexes + extension
    002_rls_and_roles.sql             -- M2: row-level security + pii_reviewer role
    003_customer_id_backfill.sql      -- M3: backfill default customer_id (no-op)
    README.md                         -- migration ordering + reversal notes
```

Module ownership:

- `db-client.ts` -- thin wrapper around `@supabase/supabase-js` exposing a typed query surface. Sole importer of the Supabase client; the rest of the data layer talks to Postgres through this module. Reason: a single chokepoint where the service-role key is bound and where row-level-security context (`app.current_customer_id`) is set before queries fire.
- `sanitizer.ts` -- sole owner of the redaction pipeline. Exposes `sanitize(envelope) -> {sanitized_envelope, redaction_log}`. Wraps the Presidio subprocess call and the regex fallback layer. Sole consumer of the Presidio binary.
- `persistence.ts` -- orchestrator. Imports `sanitizer.ts`, `kms.ts`, `db-client.ts`. Sole entry point the API route layer calls. Exposes `persistEvaluation(envelope, raw_input) -> {evaluation_id}`.
- `kms.ts` -- sole owner of AWS KMS SDK calls. Exposes `encryptEnvelope(plaintext) -> ciphertext_bundle` and `decryptEnvelope(ciphertext_bundle) -> plaintext`.
- `types.ts` -- type definitions shared across the data layer. No business logic.
- `schema/` -- SQL migration files; ordering enforced by the three-digit prefix; reversal scripts inline in each file as a commented-out `DOWN` section.

TypeScript is intentional even though the rest of the project is JavaScript: the data layer is structurally typed (envelope shape, redaction-log shape, KMS ciphertext bundle), and the type discipline catches schema-drift bugs at compile time. The TypeScript surface is internal to `src/lib/data/`; the API route imports a JavaScript-compatible wrapper that re-exports `persistEvaluation` with PropTypes-style validation, so callers outside the data layer continue to use the project's existing JS conventions.

## 2. Postgres schema -- concrete DDL

The full DDL for migration M1 (`schema/001_create_evaluations.sql`):

```sql
-- M1: create evaluations table + indexes + extensions
-- Reversible via the DOWN section at the bottom of this file.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE evaluations (
  id                              BIGSERIAL PRIMARY KEY,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Multi-tenancy placeholder. NOT NULL with default; dormant in
  -- single-tenant portfolio deployment.
  customer_id                     TEXT NOT NULL DEFAULT 'self',

  -- Sanitized v5 envelope. Canonical record; JSONB allows schema evolution
  -- without column-level migrations on the envelope content.
  envelope                        JSONB NOT NULL,

  -- Audit-metadata hoisted from envelope for indexing. Engine computes
  -- these; persistence layer does not.
  cache_key                       TEXT NOT NULL,
  ontology_version                TEXT NOT NULL,
  schema_version                  TEXT NOT NULL,
  stage1_prompt_hash              TEXT,
  stage2_prompt_hash              TEXT,
  stage3_prompt_hash              TEXT,
  stage4_prompt_hash              TEXT,

  -- Disposition + score hoisted for dashboard / query use. CHECK constraint
  -- mirrors the closed 4-verb vocabulary from docs/04-enforcement-design.md.
  disposition                     TEXT NOT NULL
    CHECK (disposition IN ('allow','safe_completion','human_review','block')),
  aggregate_score                 NUMERIC(4,3),

  -- Sanitization audit trail (per scoping memo section 4.4).
  pii_redaction_log               JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- KMS-encrypted unredacted payload. NULL until reviewer escalation
  -- forces materialization. Encrypted with envelope-encryption flow:
  -- payload encrypted with a data encryption key (DEK); DEK encrypted
  -- with the AWS KMS customer master key. See section 4 below.
  unredacted_payload_kms_ciphertext   BYTEA,
  unredacted_payload_encrypted_dek    BYTEA,
  unredacted_payload_kms_key_id       TEXT
);

-- Indexes per scoping memo section 5; rationale documented in scoping memo.
CREATE INDEX idx_evaluations_created_at
  ON evaluations (created_at DESC);

CREATE INDEX idx_evaluations_disposition_created_at
  ON evaluations (disposition, created_at DESC);

CREATE INDEX idx_evaluations_replay
  ON evaluations (ontology_version, stage2_prompt_hash);

CREATE INDEX idx_evaluations_customer_created_at
  ON evaluations (customer_id, created_at DESC);

CREATE INDEX idx_evaluations_cache_key
  ON evaluations (cache_key);

-- Trigram full-text on sanitized envelope text fields. Scoped to the
-- prompt_sanitized field which is, by construction, redacted.
CREATE INDEX idx_evaluations_envelope_trgm
  ON evaluations USING gin ((envelope->>'prompt_sanitized') gin_trgm_ops);

-- DOWN (reversal):
-- DROP INDEX IF EXISTS idx_evaluations_envelope_trgm;
-- DROP INDEX IF EXISTS idx_evaluations_cache_key;
-- DROP INDEX IF EXISTS idx_evaluations_customer_created_at;
-- DROP INDEX IF EXISTS idx_evaluations_replay;
-- DROP INDEX IF EXISTS idx_evaluations_disposition_created_at;
-- DROP INDEX IF EXISTS idx_evaluations_created_at;
-- DROP TABLE IF EXISTS evaluations;
-- DROP EXTENSION IF EXISTS pg_trgm;
```

Migration M2 (`schema/002_rls_and_roles.sql`) lands the row-level-security policies and the `pii_reviewer` role:

```sql
-- M2: row-level security + pii_reviewer role
-- Reversible via the DOWN section at the bottom of this file.

-- Roles. CREATE ROLE is idempotent via the IF NOT EXISTS DO block.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reviewer') THEN
    CREATE ROLE reviewer NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pii_reviewer') THEN
    CREATE ROLE pii_reviewer NOLOGIN;
  END IF;
END $$;

-- Enable RLS on evaluations.
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- Tenant-isolation policy. Reads `app.current_customer_id` set by the
-- db-client.ts wrapper before queries fire.
CREATE POLICY evaluations_tenant_isolation ON evaluations
  USING (customer_id = current_setting('app.current_customer_id', true));

-- Default reviewer grant: sees sanitized columns only. The KMS-ciphertext
-- columns are NOT in this grant; reviewer cannot read them at all.
GRANT SELECT (
  id, created_at, customer_id, envelope,
  cache_key, ontology_version, schema_version,
  stage1_prompt_hash, stage2_prompt_hash, stage3_prompt_hash, stage4_prompt_hash,
  disposition, aggregate_score, pii_redaction_log
) ON evaluations TO reviewer;

-- pii_reviewer grant: SELECT on the KMS-ciphertext columns ONLY. The
-- decryption itself happens in kms.ts via AWS KMS Decrypt; Postgres
-- never has the plaintext.
GRANT SELECT (
  id,
  unredacted_payload_kms_ciphertext,
  unredacted_payload_encrypted_dek,
  unredacted_payload_kms_key_id
) ON evaluations TO pii_reviewer;

-- View for reviewer convenience: joins sanitized envelope view with
-- ciphertext columns visible only when the querying role has pii_reviewer.
-- Uses security_barrier so the view itself is RLS-aware.
CREATE VIEW evaluations_reviewer_view
  WITH (security_barrier = true)
  AS SELECT
    id, created_at, customer_id, envelope,
    cache_key, ontology_version, schema_version,
    stage1_prompt_hash, stage2_prompt_hash, stage3_prompt_hash, stage4_prompt_hash,
    disposition, aggregate_score, pii_redaction_log,
    CASE WHEN pg_has_role(current_user, 'pii_reviewer', 'USAGE')
         THEN unredacted_payload_kms_ciphertext
         ELSE NULL
    END AS unredacted_payload_kms_ciphertext
  FROM evaluations;

GRANT SELECT ON evaluations_reviewer_view TO reviewer, pii_reviewer;

-- DOWN (reversal):
-- DROP VIEW IF EXISTS evaluations_reviewer_view;
-- REVOKE ALL ON evaluations FROM pii_reviewer;
-- REVOKE ALL ON evaluations FROM reviewer;
-- DROP POLICY IF EXISTS evaluations_tenant_isolation ON evaluations;
-- ALTER TABLE evaluations DISABLE ROW LEVEL SECURITY;
-- DROP ROLE IF EXISTS pii_reviewer;
-- DROP ROLE IF EXISTS reviewer;
```

Migration M3 (`schema/003_customer_id_backfill.sql`) is a no-op on the empty portfolio table but lands the convention:

```sql
-- M3: backfill customer_id='self' for any pre-existing rows.
-- No-op against an empty table; provides the convention for future tenants.
-- Reversible via the DOWN section at the bottom of this file.

UPDATE evaluations SET customer_id = 'self' WHERE customer_id IS NULL;

-- Defensive: assert the NOT NULL constraint holds (will already be true
-- from M1's DEFAULT; this is belt-and-suspenders).
ALTER TABLE evaluations ALTER COLUMN customer_id SET NOT NULL;

-- DOWN (reversal):
-- No reversal needed; UPDATE was idempotent and NOT NULL already in place.
```

The three-migration split is intentional: M1 is the structural change (table + indexes), M2 is the security policy (orthogonal to structure, riskier to roll back if a downstream consumer relies on the view), M3 is operational hygiene (backfill convention). Each is reversible; M2's reversal is destructive only to the policy surface, not to the data.

## 3. Sanitization pipeline -- concrete signatures

`sanitizer.ts` exposes a single public function:

```typescript
// src/lib/data/sanitizer.ts

import type { V5Envelope, RedactionLog } from './types';

export interface SanitizeResult {
  sanitized_envelope: V5Envelope;
  redaction_log: RedactionLog;
}

export async function sanitize(envelope: V5Envelope): Promise<SanitizeResult>;
```

Internal pipeline (private to the module):

```typescript
// Private helpers, not exported.

async function detectPresidioEntities(text: string): Promise<DetectedEntity[]>;
function detectRegexEntities(text: string): DetectedEntity[];
function mergeDetections(a: DetectedEntity[], b: DetectedEntity[]): DetectedEntity[];
function assignPlaceholders(
  entities: DetectedEntity[]
): { placeholders: PlaceholderMap; ordered_entities: DetectedEntity[] };
function applyRedactions(
  text: string,
  placeholders: PlaceholderMap
): string;
function buildRedactionLog(
  entities: DetectedEntity[],
  sanitizer_version: string
): RedactionLog;
```

Pipeline flow:

1. Extract text-bearing fields from the envelope. The envelope carries the original prompt under `prompt` and structured fields the engine emits; the sanitizer redacts only fields containing user-supplied free text. The list of redacted fields is closed-set: `prompt`, `conversation_turns[].text` (if present), `claimed_identity_text` (if present). All other envelope fields are passed through unchanged.

2. For each redacted field, run detection in parallel:
   - **Presidio** (subprocess call to `presidio_analyzer` via the Python sidecar; see section 4.7 of scoping memo for the sidecar-vs-subprocess decision; this spec adopts the subprocess variant for portfolio-deployment simplicity). Recognizers enabled: `EMAIL_ADDRESS`, `PHONE_NUMBER`, `US_SSN`, `CREDIT_CARD`, `IBAN_CODE`, `PERSON`, `LOCATION` (for street addresses), `US_BANK_NUMBER`. Disabled: `IP_ADDRESS` (handled at telemetry layer), `URL` (not PII), `MEDICAL_LICENSE` (out of vocabulary).
   - **Regex fallback** for the explicitly-formatted variants. Patterns:
     - `EMAIL`: `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g`
     - `PHONE`: `/(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g` (NANP) and `/\+\d{1,3}[-.\s]?\d{4,14}/g` (E.164)
     - `SSN`: `/\b\d{3}-\d{2}-\d{4}\b/g` and `/\b\d{9}\b/g` (raw nine-digit, lower precision)
     - `CREDIT_CARD`: `/\b(?:\d[ -]?){13,19}\b/g` followed by Luhn-checksum validation
     - `IBAN`: `/\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b/g` followed by mod-97 checksum
     - `OTP_CODE`: `/(?:\b(?:otp|code|verification|2fa|verify)[\s:]+)(\d{4,8})\b/gi` (context-anchored)

3. Merge detections. Where Presidio and regex overlap on the same span, prefer Presidio's classification (it carries the confidence score; regex matches are credited at `confidence: 1.0` for explicitly-formatted entities, `confidence: null` otherwise).

4. Assign placeholders. Per-evaluation, per-type sequence. Co-reference preservation is keyed on the canonicalized entity value (lowercased for emails; digit-only for phones/SSNs/CCs/IBANs; case-preserved for names/addresses). The map is local to the evaluation; discarded after `sanitize()` returns.

```typescript
// Canonical example:
// Input:  "Send to alice@example.com, then call ALICE@example.com to confirm."
// After:  "Send to <EMAIL_1>, then call <EMAIL_1> to confirm."
//         (canonicalization collapses case differences on the email)
//
// Input:  "Email alice@example.com and bob@example.com"
// After:  "Email <EMAIL_1> and <EMAIL_2>"
```

5. Apply redactions to each field. Iterate right-to-left to preserve offsets during in-place replacement.

6. Build the redaction log. Shape per scoping memo section 4.4 (`version`, `redactions[]`, `total_redactions`, `sanitizer_version`). Offsets in the log are into the original (raw) field text, not the sanitized output.

7. Return `{sanitized_envelope, redaction_log}`.

The sanitizer is stateless across evaluations. The Presidio subprocess is process-pooled (max 4 concurrent workers; configurable via `PRESIDIO_POOL_SIZE`); the worker pool initialization happens lazily on first call and survives for the lifetime of the Node process.

## 4. KMS integration

`kms.ts` wraps AWS KMS via the AWS SDK v3 (`@aws-sdk/client-kms`). The flow is envelope encryption: the app generates a per-row Data Encryption Key (DEK), encrypts the unredacted payload with the DEK (AES-256-GCM), and encrypts the DEK with the AWS KMS Customer Master Key (CMK). The encrypted DEK plus the AES-GCM ciphertext are stored together; decryption reverses (KMS Decrypt on the encrypted DEK, then AES-GCM Decrypt with the recovered DEK).

```typescript
// src/lib/data/kms.ts

import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';

export interface CiphertextBundle {
  ciphertext: Buffer;          // AES-256-GCM ciphertext of the payload
  encrypted_dek: Buffer;       // KMS-encrypted DEK
  kms_key_id: string;          // CMK ARN used; recorded for key-rotation audit
  iv: Buffer;                  // AES-GCM initialization vector (12 bytes)
  auth_tag: Buffer;            // AES-GCM authentication tag (16 bytes)
}

export async function encryptEnvelope(plaintext: string): Promise<CiphertextBundle>;
export async function decryptEnvelope(bundle: CiphertextBundle): Promise<string>;
```

Encryption flow:

1. Call `GenerateDataKeyCommand` on the configured KMS key (`AWS_KMS_KEY_ID`). KMS returns `Plaintext` (the DEK, 32 bytes for AES-256) and `CiphertextBlob` (the KMS-encrypted DEK).
2. Generate a 12-byte random IV via `crypto.randomBytes(12)`.
3. AES-256-GCM encrypt the plaintext payload using the DEK and IV. Capture the auth tag.
4. Zero the DEK in memory (`dek.fill(0)`) before returning.
5. Return the bundle. Store `ciphertext`, `encrypted_dek`, `iv`, `auth_tag` concatenated into `unredacted_payload_kms_ciphertext` BYTEA (with a 1-byte version prefix + length-prefixed sections for forward compatibility), and `kms_key_id` separately in `unredacted_payload_kms_key_id`.

Decryption flow (reverses):

1. Parse the BYTEA bundle into `{ciphertext, encrypted_dek, iv, auth_tag}` using the version prefix.
2. Call `DecryptCommand` on the encrypted DEK. KMS returns the plaintext DEK. (CloudTrail logs this API call; that is the audit trail surface.)
3. AES-256-GCM decrypt with the recovered DEK, IV, and auth tag.
4. Zero the DEK.
5. Return the plaintext.

KMS key creation (CloudFormation snippet; deliverable as `scripts/kms-key-setup.yaml`):

```yaml
# CloudFormation template: scripts/kms-key-setup.yaml
# Run via: aws cloudformation create-stack \
#   --stack-name safeeval-kms \
#   --template-body file://scripts/kms-key-setup.yaml \
#   --capabilities CAPABILITY_NAMED_IAM
AWSTemplateFormatVersion: '2010-09-09'
Description: SafeEval KMS key for unredacted payload envelope encryption

Resources:
  SafeEvalKmsKey:
    Type: AWS::KMS::Key
    Properties:
      Description: SafeEval unredacted-payload envelope encryption
      EnableKeyRotation: true
      KeyPolicy:
        Version: '2012-10-17'
        Statement:
          - Sid: EnableIAMUserPermissions
            Effect: Allow
            Principal:
              AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:root'
            Action: 'kms:*'
            Resource: '*'
          - Sid: AllowApplicationEncrypt
            Effect: Allow
            Principal:
              AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:role/safeeval-app-role'
            Action:
              - kms:GenerateDataKey
              - kms:Encrypt
            Resource: '*'
          - Sid: AllowPiiReviewerDecrypt
            Effect: Allow
            Principal:
              AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:role/safeeval-pii-reviewer-role'
            Action:
              - kms:Decrypt
            Resource: '*'

  SafeEvalKmsKeyAlias:
    Type: AWS::KMS::Alias
    Properties:
      AliasName: alias/safeeval-unredacted-payload
      TargetKeyId: !Ref SafeEvalKmsKey

Outputs:
  KmsKeyArn:
    Value: !GetAtt SafeEvalKmsKey.Arn
    Export:
      Name: SafeEvalKmsKeyArn
```

CloudTrail audit-trail wiring is documented but not implemented in this spec: the AWS KMS Decrypt API call is logged automatically when CloudTrail is enabled in the account; the trail surface is the `pii_reviewer` access detection mechanism. The data track owns the CloudTrail-query runbook as a follow-on artifact; this spec asserts the dependency (CloudTrail must be enabled for the decrypt audit trail to exist) and does not implement the alerting / dashboard layer on top.

## 5. Persistence write path

`persistence.ts` orchestrates engine output through sanitization, KMS encryption, and the Postgres insert. Concrete sequence:

```typescript
// src/lib/data/persistence.ts

import { sanitize } from './sanitizer';
import { encryptEnvelope } from './kms';
import { dbClient } from './db-client';
import type { V5Envelope, PersistResult } from './types';

export async function persistEvaluation(
  envelope: V5Envelope,
  raw_input: string,
  options: { customer_id?: string } = {}
): Promise<PersistResult> {
  const customer_id = options.customer_id ?? 'self';

  // Step 1: sanitize. Fail-stop on sanitizer errors.
  const { sanitized_envelope, redaction_log } = await sanitize(envelope);

  // Step 2: encrypt raw input. Fail-stop on KMS unreachable -- DO NOT
  // write a sanitized row without the unredacted backup, because that
  // would silently drop reviewer-escalation capacity.
  let ciphertext_bundle;
  try {
    ciphertext_bundle = await encryptEnvelope(raw_input);
  } catch (err) {
    throw new PersistError(
      'KMS unreachable; refusing to persist sanitized envelope without unredacted backup',
      { cause: err, code: 'KMS_UNREACHABLE' }
    );
  }

  // Step 3: insert. Single INSERT; the BYTEA columns are populated atomically.
  const { id } = await dbClient.insertEvaluation({
    customer_id,
    envelope: sanitized_envelope,
    cache_key: envelope.audit_metadata.cache_key,
    ontology_version: envelope.audit_metadata.ontology_version,
    schema_version: envelope.audit_metadata.schema_version,
    stage1_prompt_hash: envelope.audit_metadata.stage1_prompt_hash,
    stage2_prompt_hash: envelope.audit_metadata.stage2_prompt_hash,
    stage3_prompt_hash: envelope.audit_metadata.stage3_prompt_hash,
    stage4_prompt_hash: envelope.audit_metadata.stage4_prompt_hash,
    disposition: envelope.disposition,
    aggregate_score: envelope.aggregate_score,
    pii_redaction_log: redaction_log,
    unredacted_payload_kms_ciphertext: serializeCiphertextBundle(ciphertext_bundle),
    unredacted_payload_encrypted_dek: ciphertext_bundle.encrypted_dek,
    unredacted_payload_kms_key_id: ciphertext_bundle.kms_key_id,
  });

  return { evaluation_id: id };
}
```

Error handling strategy:

- **Sanitizer failure** (Presidio subprocess crash, regex exception): throw `PersistError` with code `SANITIZER_FAILURE`. Caller (API route) returns HTTP 503; the engine result is not persisted; the engine's classification response is still returned to the client (the engine's correctness does not depend on persistence).
- **KMS unreachable** (network failure, IAM denial, key disabled): throw `PersistError` with code `KMS_UNREACHABLE`. Refuse to write the sanitized row without the unredacted backup. Reason: writing the sanitized row without ciphertext creates a permanent gap in reviewer-escalation capacity for that row -- the row is in the corpus but cannot be escalated for `human_review` resolution because the raw input is gone. The right behavior is to fail the write and rely on the engine's classification response being returned to the client (so the user sees the disposition); the persistence failure is logged for operational follow-up but does not block the user-visible response path.
- **Database unreachable**: throw `PersistError` with code `DB_UNREACHABLE`. Same caller behavior as `KMS_UNREACHABLE`: log, return engine result to client, do not block.
- **Constraint violation** (CHECK constraint on disposition, NOT NULL violation): throw `PersistError` with code `INVALID_ENVELOPE`. This is a developer error (engine emitted an envelope that violates the schema contract); the API route logs and returns HTTP 500. Caught by integration tests in a healthy build.

The persistence write is fire-and-forget from the API route's perspective: the route invokes `persistEvaluation` in a `void` context (or via `Promise.allSettled` alongside the response write) so persistence latency does not affect user-visible response time. The caller pattern is documented in the API route's accompanying handoff brief (separate from this spec) and is the integration point where the data layer meets the engine layer.

## 6. Two-key access tier

Default reviewers use the `reviewer` role; PII reviewers use `pii_reviewer`. The split is enforced at three layers (defense in depth):

1. **Postgres GRANT.** `reviewer` has SELECT on sanitized columns; the three KMS-ciphertext columns are NOT in the grant. `pii_reviewer` has SELECT on the KMS-ciphertext columns ONLY (not the sanitized ones; the `evaluations_reviewer_view` is the surface that joins both for convenience). See migration M2 above.

2. **AWS KMS Key Policy.** The CMK policy (section 4 above) allows `kms:Decrypt` only to the `safeeval-pii-reviewer-role` IAM role. A Postgres user with `pii_reviewer` role but without the IAM credential cannot decrypt -- they can see the ciphertext, but `decryptEnvelope()` will fail with an IAM denial. This is the second key in the two-key scheme: the database role grants access to the ciphertext; the IAM role grants access to the decryption capability.

3. **Application-layer check in `decryptEnvelope`.** Defensive: the function asserts that `process.env.SAFEEVAL_REVIEWER_MODE === 'pii_reviewer'` before invoking the KMS Decrypt call. Reason: prevents a misconfigured deployment from accidentally decrypting on the default request path; the env var is set only in the dedicated `pii_reviewer` deployment (a separate Vercel deployment or a manually-invoked CLI tool, not the public-facing app). This is belt-and-suspenders against the layer-1 and layer-2 controls.

SQL surface for the `pii_reviewer` query path:

```sql
-- Run as pii_reviewer role.
-- Returns sanitized envelope + ciphertext bundle for a specific evaluation_id.
SELECT id, envelope, pii_redaction_log,
       unredacted_payload_kms_ciphertext,
       unredacted_payload_encrypted_dek,
       unredacted_payload_kms_key_id
  FROM evaluations
  WHERE id = $1
    AND customer_id = current_setting('app.current_customer_id', true);
```

The reviewer then passes the ciphertext bundle to `decryptEnvelope()` in a `pii_reviewer`-mode application context; the plaintext is returned to the reviewer's terminal and never persisted.

## 7. Tests -- Vitest plan

The data layer is the first TypeScript surface in the project and the first surface with an integration-test requirement (Postgres + KMS). Vitest is the recommended test runner (Jest-compatible API, native TS support, faster than Jest). Test files live in `src/lib/data/__tests__/`.

**Unit tests** (no external services; pure functions):

- `sanitizer.test.ts`
  - `sanitize` redacts each PII type in the vocabulary with a representative input (one test per type).
  - Co-reference preservation: same email twice -> same placeholder.
  - Co-reference distinctness: two distinct emails -> sequential placeholders.
  - Canonicalization: `Alice@example.com` and `alice@example.com` collapse to one placeholder.
  - Redaction log shape conforms to the documented schema (validated against a JSON schema).
  - Offsets in the redaction log point at the original (raw) text, not the sanitized text.
  - Determinism: same input twice -> identical output and identical redaction log.
  - Empty input -> empty redaction log, no errors.
  - Input with no PII -> envelope passed through unchanged, redaction log shows zero redactions.
  - Regex-only path (when Presidio is unavailable): tests gated on `PRESIDIO_DISABLED=1`.

- `kms.test.ts`
  - `encryptEnvelope` + `decryptEnvelope` roundtrip preserves the plaintext exactly (using `aws-sdk-mock` or `@aws-sdk/client-kms` mocked).
  - Ciphertext bundle serialization roundtrip preserves all fields.
  - `decryptEnvelope` rejects when `SAFEEVAL_REVIEWER_MODE !== 'pii_reviewer'`.
  - DEK is zeroed in memory after use (assert via a debug hook).

- `persistence.test.ts`
  - `persistEvaluation` calls `sanitize`, `encryptEnvelope`, `dbClient.insertEvaluation` in that order (verified via mocks).
  - KMS failure throws `PersistError` with code `KMS_UNREACHABLE`; no insert call is made.
  - Sanitizer failure throws `PersistError` with code `SANITIZER_FAILURE`.
  - Constraint violation surfaces as `PersistError` with code `INVALID_ENVELOPE`.

**Integration tests** (require local Supabase via Docker; gated on `INTEGRATION=1`):

- `persistence.integration.test.ts`
  - `docker compose up` brings up a local Postgres + a mocked KMS endpoint (LocalStack).
  - End-to-end write: engine fixture envelope -> `persistEvaluation` -> SELECT verifies sanitized envelope landed.
  - Round-trip: read back the row; audit-metadata fields match the input envelope byte-for-byte.
  - RLS enforcement: query as `reviewer` cannot see the KMS-ciphertext columns; query as `pii_reviewer` can.
  - Migrations M1 + M2 + M3 apply cleanly to an empty database; reversal (DOWN scripts) leaves an empty database.

**Edge-case tests**:

- Envelope with `prompt` containing 4096 distinct emails: sanitizer handles without OOM (memory ceiling tested at 100MB).
- Envelope with malformed `audit_metadata` (missing required field): `persistEvaluation` throws `INVALID_ENVELOPE` before any side effect.
- Envelope with very long `prompt` (1MB): write succeeds; trigram index handles without timeout.
- Sanitizer false-positive: a URL that matches the email regex is correctly classified by Presidio as non-PII (regression test for a class of bug that was the most painful in prior PII pipelines).

Test budget: roughly 40 unit tests + 8 integration tests. CI runs unit tests on every push; integration tests run nightly (gated on `INTEGRATION=1` to keep PR CI fast).

## 8. Environment variables

New required env vars (additions to `.env.example`):

```bash
# --- Supabase (Postgres) ---
# Supabase project URL. Format: https://<project-ref>.supabase.co
SUPABASE_URL=https://your-project-ref.supabase.co
# Service-role key (not the anon key). Used by db-client.ts to bypass RLS
# for tenant-context setting via current_setting('app.current_customer_id').
# DO NOT commit. Lives only in Vercel env + local .env.local.
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# --- AWS KMS ---
# AWS region hosting the KMS key.
AWS_REGION=us-east-1
# KMS key ID or ARN. Read by kms.ts on every encrypt; recorded in the
# unredacted_payload_kms_key_id column for key-rotation audit.
AWS_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/...
# AWS credentials for the app role. In Vercel, set via the AWS integration
# (preferred) or as explicit env vars (fallback).
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key

# --- Sanitizer ---
# Max concurrent Presidio subprocess workers. Default 4.
PRESIDIO_POOL_SIZE=4
# Set to 1 to disable Presidio and use regex-only sanitization. Falls back
# to lower-precision detection; acceptable only for development.
PRESIDIO_DISABLED=0

# --- Reviewer mode ---
# Set to 'pii_reviewer' ONLY in the dedicated reviewer deployment. Default
# (unset or any other value) disables decryption attempts at the
# application layer. Defense-in-depth against accidental decryption on
# the public request path.
SAFEEVAL_REVIEWER_MODE=
```

These additions append to the existing `.env.example`; the existing `ANTHROPIC_API_KEY` and `EVAL_API_SECRET` blocks are unchanged. The Vercel project must have these new env vars set before the persistence write path is exercised; the API route should detect missing env vars at startup and log a degraded-mode warning rather than crashing (the engine continues to serve classifications even when persistence is misconfigured).

## 9. Migration sequencing

Three migrations, in strict order, each reversible:

1. **M1 -- `001_create_evaluations.sql`**: creates the `evaluations` table, all indexes, and the `pg_trgm` extension. Reversal drops the table, indexes, and extension (extension drop is optional if other tables use it; the DOWN section guards with `IF EXISTS`). Safe to apply against an empty database; idempotent re-runs require dropping the table first.

2. **M2 -- `002_rls_and_roles.sql`**: creates the `reviewer` and `pii_reviewer` roles (idempotent via DO block), enables RLS on `evaluations`, creates the tenant-isolation policy, the GRANT statements for both roles, and the `evaluations_reviewer_view`. Reversal revokes grants, drops the view, drops the policy, disables RLS, and drops the roles. Note: roles are global to the cluster; dropping them is safe only if no other database uses them.

3. **M3 -- `003_customer_id_backfill.sql`**: UPDATEs any rows with NULL `customer_id` to `'self'` (no-op on the portfolio table, which is empty at first migration time). Re-asserts the NOT NULL constraint. Reversal is a no-op; the UPDATE is idempotent and the constraint is already in M1.

Migration ordering is enforced by the three-digit prefix and documented in `schema/README.md`. The data track owns the migration runner; recommended runner is `node scripts/run-migrations.js` (a thin wrapper around the Supabase CLI's migration tool, or a hand-rolled `pg` script if Supabase CLI is not adopted). The runner records applied migrations in a `schema_migrations` table (standard pattern) so re-runs are safe.

Apply order: M1 -> M2 -> M3. Reversal order: M3 -> M2 -> M1.

## 10. Acceptance criteria

The implementation is done when:

1. **Pre-flight lockstep GREEN.** `node scripts/check-lockstep.js` exits 0. The persistence layer does not lockstep with `src/lib/safeeval.js` or `src/lib/safeeval-v5.js` (it is a downstream consumer), but the lockstep validator must not regress on the existing surfaces.

2. **All new tests pass.** Unit tests (40 tests) green on every push; integration tests (8 tests) green on the nightly CI run.

3. **Envelope round-trip preserves audit-metadata byte-for-byte.** A fixture envelope passed through `persistEvaluation` and then SELECTed back produces audit-metadata fields (`cache_key`, `ontology_version`, `schema_version`, `stage1_prompt_hash` through `stage4_prompt_hash`) identical to the input envelope's fields. Verified by `persistence.integration.test.ts`.

4. **Sanitization is deterministic across runs.** The same input envelope produces the same sanitized envelope and the same redaction log on repeated calls. Verified by `sanitizer.test.ts` determinism check.

5. **KMS decrypt requires `pii_reviewer` role.** Attempting to call `decryptEnvelope()` when `SAFEEVAL_REVIEWER_MODE !== 'pii_reviewer'` throws. Verified by `kms.test.ts`. Additionally, the IAM policy on the KMS key restricts `kms:Decrypt` to the `safeeval-pii-reviewer-role` ARN; verified manually during deployment by attempting decryption from the default app role and confirming an AccessDenied response.

6. **Migrations apply and reverse cleanly.** M1 -> M2 -> M3 applies to an empty database with no errors. Reversing M3 -> M2 -> M1 leaves an empty database with no leftover artifacts. Verified by `migrations.integration.test.ts`.

7. **ASCII-safe.** All new `.ts`, `.js`, and `.sql` files pass the project's ASCII check (no em dashes, smart quotes, or non-ASCII characters in code; markdown under `docs/` may stay UTF-8 per project policy).

8. **`.env.example` updated.** New env vars documented; no values committed.

9. **`CLAUDE.md` updated** to mention the new `src/lib/data/` directory and the data-layer test commands. (Brief update; the data track will eventually author a `docs/data/README.md` that takes the bulk of the documentation load.)

## 11. Out of scope -- deferred to follow-on briefs

Explicitly out of scope of this implementation spec; each defers to a separately-dispatched brief:

- **S3 Parquet archive tier.** The scoping memo section 7.3 Full scope-tier work. Defer until live-DB ceiling pressure or fine-tuning corpus crystallization, per the scoping memo's section 3.C reasoning.

- **Retention / aging job.** Same as above; depends on the archive tier existing.

- **Multi-tenancy beyond placeholder `customer_id`.** The column is in the schema; the RLS policy is in place; the application layer sets `app.current_customer_id` from a hardcoded `'self'`. A real second tenant requires: (a) a tenant-management surface (signup / API key issuance), (b) per-tenant SUPABASE configuration, (c) a billing / quota layer. None of these are required for the portfolio deployment.

- **Admin UI.** No web UI for browsing evaluations is in scope. Reviewers query via psql or a SQL workbench (TablePlus, DBeaver). An admin UI is a future data-track dispatch.

- **Analytical query layer.** Dashboards, recurring reports, materialized views for common queries. The schema supports these (the indexes are sized for the common queries), but the queries themselves are downstream work.

- **CloudTrail alerting / dashboards.** The KMS Decrypt calls are logged automatically when CloudTrail is enabled in the AWS account; the data track owns the follow-on runbook for monitoring those logs and alerting on anomalous access patterns. This spec asserts the dependency (CloudTrail must be on) and does not implement the alerting surface.

- **Cross-evaluation entity linkage.** The placeholder convention is per-evaluation by design (scoping memo section 4.3); cross-evaluation linkage requires the two-key access tier and a separate analytical surface, neither of which is in scope here.

## 12. Open questions for Steven -- escalation field convention

Per the fifth atomic amendment to the parallel-tracks memo (closure-report escalation-field convention). All questions in this section are downstream of the adjudicated scoping memo, so most carry `default-accept` recommendations. Two carry `route-to-steven` because they would change the architecture if Steven decided differently.

1. *(escalation: default-accept, rec: TypeScript)* **TypeScript vs. JavaScript for `src/lib/data/`.** Recommend TypeScript per section 1 above (structural typing on envelope and ciphertext bundle catches schema-drift at compile time). Alternative: JavaScript with PropTypes-style validation, consistent with the rest of the project. If Steven prefers JS-everywhere, the impact is reduced type safety but no architectural change.

2. *(escalation: default-accept, rec: subprocess)* **Presidio subprocess vs. sidecar service.** Recommend subprocess for portfolio deployment simplicity per section 3 above. Alternative: deploy Presidio as a sidecar HTTP service (cleaner separation, scales independently, adds an operational surface). If the production deployment ever materializes, the sidecar becomes the right shape; for portfolio scale, subprocess is sufficient.

3. *(escalation: route-to-steven, reason: choice between fail-stop and degrade-and-log on KMS unreachable affects whether reviewer escalation capacity can silently degrade -- this is a safety property the scoping memo's two-key access tier promises)* **Fail-stop vs. degrade-and-log on KMS unreachable.** Recommend fail-stop per section 5 above (refuse to persist sanitized envelope without the unredacted backup, because that creates a permanent gap in reviewer-escalation capacity for the affected row). Alternative: degrade-and-log (persist the sanitized envelope, log the KMS failure, accept that the row cannot be escalated to `pii_reviewer`). The fail-stop choice has the property that the corpus is either complete (sanitized + unredacted) or absent; the degrade-and-log choice creates a class of rows that are partially-persisted, which is structurally hard to audit. Recommend fail-stop; flag because the choice is reviewer-escalation-capacity material.

4. *(escalation: default-accept, rec: Vitest)* **Vitest vs. Jest.** Recommend Vitest per section 7 above (native TypeScript, faster, Jest-compatible API). Alternative: Jest with `ts-jest`. The choice does not affect the architecture; switching is a one-config-file change.

5. *(escalation: route-to-steven, reason: env-var-only AWS credentials in Vercel is a step down from IAM role assumption via the Vercel AWS integration -- the choice affects what Steven is willing to demonstrate as the credential-management posture for a hiring reader)* **AWS credential management in Vercel.** Recommend the Vercel AWS integration (IAM role assumption; no long-lived credentials in env vars). Alternative: explicit `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` env vars (simpler setup, weaker posture -- the credentials are long-lived and live in env vars). The CloudFormation template in section 4 assumes role-based access; if Steven prefers env-var credentials for the portfolio deployment, the IAM principals in the key policy change from role ARNs to user ARNs. Flag because the choice is portfolio-visible (the hiring reader can infer the posture from the `.env.example` shape).

**Two `route-to-steven` (Q3 KMS-unreachable behavior, Q5 AWS credential management) pause auto-chaining; three `default-accept` (Q1 TS, Q2 Presidio subprocess, Q4 Vitest) proceed with tentative recommendations.**
