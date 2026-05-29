-- M1: create evaluations table + indexes + extensions
--
-- Spec: docs/memos/2026-05-28-data-track-implementation-spec.md section 2.
-- The persistence layer stores the sanitized v5 envelope as JSONB plus
-- hoisted audit-metadata columns for indexable lookup. Bright-line and
-- disposition columns mirror the closed vocabularies from
-- docs/04-enforcement-design.md.
--
-- Apply order: M1 -> M2 -> M3.
-- Reversible via the DOWN section at the bottom of this file.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE evaluations (
  id                              BIGSERIAL PRIMARY KEY,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Multi-tenancy placeholder. NOT NULL with default; dormant in the
  -- single-tenant portfolio deployment. RLS policy in M2 reads it via
  -- current_setting('app.current_customer_id').
  customer_id                     TEXT NOT NULL DEFAULT 'self',

  -- Sanitized v5 envelope (PII redacted). Canonical record; JSONB allows
  -- schema evolution without column-level migrations on the envelope content.
  envelope                        JSONB NOT NULL,

  -- Audit-metadata hoisted from the envelope for indexable lookup. The
  -- engine computes these; the persistence layer copies them out as columns.
  -- Source-of-truth field names per tests/schema/v5-envelope.schema.json
  -- (top-level on the envelope, not nested under audit_metadata).
  cache_key                       TEXT NOT NULL,
  ontology_version                TEXT NOT NULL,
  schema_version                  TEXT NOT NULL,
  stage1_prompt_hash              TEXT,
  stage2_prompt_hash              TEXT,
  stage3_prompt_hash              TEXT,
  stage4_prompt_hash              TEXT,

  -- Disposition + score hoisted for dashboard / query use. CHECK mirrors
  -- the closed 4-verb vocabulary from docs/04-enforcement-design.md.
  disposition                     TEXT NOT NULL
    CHECK (disposition IN ('allow','safe_completion','human_review','block')),
  aggregate_score                 NUMERIC(4,3),

  -- Sanitization audit trail (shape per RedactionLog in src/lib/data/types.ts).
  pii_redaction_log               JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- KMS-encrypted unredacted payload. NULL until persistence is wired up in
  -- Phase 2 + Phase 3. Envelope-encryption flow: payload encrypted with a
  -- per-row Data Encryption Key (DEK, AES-256-GCM); DEK encrypted with the
  -- AWS KMS Customer Master Key. The BYTEA carries a length-prefixed bundle
  -- (version byte + ciphertext + IV + auth_tag); the encrypted DEK and the
  -- KMS key ARN are recorded separately for key-rotation audit.
  unredacted_payload_kms_ciphertext   BYTEA,
  unredacted_payload_encrypted_dek    BYTEA,
  unredacted_payload_kms_key_id       TEXT
);

-- Indexes per spec section 2.
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

-- Trigram full-text on the sanitized prompt text. By construction the
-- envelope's input text has been redacted before this row is written; the
-- index is safe to expose to the reviewer role.
CREATE INDEX idx_evaluations_envelope_trgm
  ON evaluations USING gin ((envelope #>> '{input,text}') gin_trgm_ops);

-- DOWN (reversal):
-- DROP INDEX IF EXISTS idx_evaluations_envelope_trgm;
-- DROP INDEX IF EXISTS idx_evaluations_cache_key;
-- DROP INDEX IF EXISTS idx_evaluations_customer_created_at;
-- DROP INDEX IF EXISTS idx_evaluations_replay;
-- DROP INDEX IF EXISTS idx_evaluations_disposition_created_at;
-- DROP INDEX IF EXISTS idx_evaluations_created_at;
-- DROP TABLE IF EXISTS evaluations;
-- DROP EXTENSION IF EXISTS pg_trgm;
