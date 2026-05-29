-- M5: drop the KMS-encrypted unredacted-payload columns + pii_reviewer role
--
-- Source decision: docs/memos/2026-05-28-pii-zero-storage-scoping.md (Tier A).
-- Steven adjudicated Tier A: drop the three KMS columns, the pii_reviewer
-- role, and the unredacted-access view BEFORE Phase 3 KMS implementation
-- lands. The columns are NULL on every row in the live table today (Phase 1
-- wired sanitization but Phase 3 KMS was never implemented), so the drop
-- loses no data. SafeEval's new posture is "we don't store PII" -- the
-- sanitized envelope is the single source of truth.
--
-- The compl posture memo (docs/memos/compl/2026-05-28-pii-access-posture.md)
-- Decision 1 (AWS KMS) is reversed by this migration. Decision 2 (legal-
-- audience role check on report generation) is preserved -- it gates the
-- report-generator's legal audience for routing-vs-security decoupling and
-- audit-trail reasons that hold independent of the KMS column.
--
-- Apply order: requires M1 + M2. The view must drop before the columns
-- (otherwise Postgres rejects the column drop), and the role's grants must
-- drop before the role.
-- Reversible via the DOWN section at the bottom of this file.

-- 1. Drop the view that branches on pii_reviewer. The CASCADE is unnecessary
--    here -- nothing depends on this view -- but IF EXISTS keeps the
--    migration idempotent if M2 was never applied.
DROP VIEW IF EXISTS evaluations_reviewer_view;

-- 2. Revoke grants on evaluations from pii_reviewer before dropping the role.
--    Postgres refuses to drop a role that still owns privileges.
REVOKE ALL ON evaluations FROM pii_reviewer;

-- 3. Drop the role.
DROP ROLE IF EXISTS pii_reviewer;

-- 4. Drop the three KMS columns from evaluations. The columns are NULL on
--    every row today; no data loss.
ALTER TABLE evaluations
  DROP COLUMN IF EXISTS unredacted_payload_kms_ciphertext,
  DROP COLUMN IF EXISTS unredacted_payload_encrypted_dek,
  DROP COLUMN IF EXISTS unredacted_payload_kms_key_id;

-- DOWN (reversal): recreates the three columns, the pii_reviewer role, and
-- the conditional view exactly as M1/M2 defined them. The recreated columns
-- are NULLable (matching M1's original DDL) and unpopulated; running DOWN
-- restores the schema surface but cannot recover ciphertext that was never
-- written.
-- ALTER TABLE evaluations
--   ADD COLUMN unredacted_payload_kms_ciphertext BYTEA,
--   ADD COLUMN unredacted_payload_encrypted_dek BYTEA,
--   ADD COLUMN unredacted_payload_kms_key_id TEXT;
-- DO $$ BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pii_reviewer') THEN
--     CREATE ROLE pii_reviewer NOLOGIN;
--   END IF;
-- END $$;
-- GRANT SELECT (
--   id,
--   unredacted_payload_kms_ciphertext,
--   unredacted_payload_encrypted_dek,
--   unredacted_payload_kms_key_id
-- ) ON evaluations TO pii_reviewer;
-- CREATE VIEW evaluations_reviewer_view
--   WITH (security_barrier = true)
--   AS SELECT
--     id, created_at, customer_id, envelope,
--     cache_key, ontology_version, schema_version,
--     stage1_prompt_hash, stage2_prompt_hash, stage3_prompt_hash, stage4_prompt_hash,
--     disposition, aggregate_score, pii_redaction_log,
--     CASE WHEN pg_has_role(current_user, 'pii_reviewer', 'USAGE')
--          THEN unredacted_payload_kms_ciphertext
--          ELSE NULL
--     END AS unredacted_payload_kms_ciphertext,
--     CASE WHEN pg_has_role(current_user, 'pii_reviewer', 'USAGE')
--          THEN unredacted_payload_encrypted_dek
--          ELSE NULL
--     END AS unredacted_payload_encrypted_dek,
--     CASE WHEN pg_has_role(current_user, 'pii_reviewer', 'USAGE')
--          THEN unredacted_payload_kms_key_id
--          ELSE NULL
--     END AS unredacted_payload_kms_key_id
--   FROM evaluations;
-- GRANT SELECT ON evaluations_reviewer_view TO reviewer, pii_reviewer;
