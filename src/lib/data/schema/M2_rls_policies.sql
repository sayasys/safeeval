-- M2: row-level security policies + reviewer / pii_reviewer roles
--
-- Spec: docs/memos/2026-05-28-data-track-implementation-spec.md section 6.
-- Two-key access tier: the reviewer role can read sanitized columns and
-- the redaction log; the pii_reviewer role gates the KMS-ciphertext columns
-- needed for unredacted-payload escalation. Decryption requires both the
-- DB-side pii_reviewer grant AND the AWS IAM role with kms:Decrypt
-- permission (configured separately; see scripts/kms-key-setup.yaml in a
-- later phase).
--
-- Apply order: requires M1.
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

-- Tenant-isolation policy. Reads app.current_customer_id set by the
-- db-client wrapper (Phase 2) before queries fire.
CREATE POLICY evaluations_tenant_isolation ON evaluations
  USING (customer_id = current_setting('app.current_customer_id', true));

-- Default reviewer grant: sees sanitized columns and the redaction log.
-- The KMS-ciphertext columns are NOT in this grant; reviewer cannot read
-- them at all.
GRANT SELECT (
  id, created_at, customer_id, envelope,
  cache_key, ontology_version, schema_version,
  stage1_prompt_hash, stage2_prompt_hash, stage3_prompt_hash, stage4_prompt_hash,
  disposition, aggregate_score, pii_redaction_log
) ON evaluations TO reviewer;

-- pii_reviewer grant: SELECT on the KMS-ciphertext columns ONLY. The
-- decryption itself happens via AWS KMS Decrypt in kms.ts (Phase 3);
-- Postgres never has the plaintext.
GRANT SELECT (
  id,
  unredacted_payload_kms_ciphertext,
  unredacted_payload_encrypted_dek,
  unredacted_payload_kms_key_id
) ON evaluations TO pii_reviewer;

-- Convenience view: joins sanitized columns with the ciphertext columns,
-- exposed conditionally on the querying role. security_barrier makes the
-- view RLS-aware.
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
    END AS unredacted_payload_kms_ciphertext,
    CASE WHEN pg_has_role(current_user, 'pii_reviewer', 'USAGE')
         THEN unredacted_payload_encrypted_dek
         ELSE NULL
    END AS unredacted_payload_encrypted_dek,
    CASE WHEN pg_has_role(current_user, 'pii_reviewer', 'USAGE')
         THEN unredacted_payload_kms_key_id
         ELSE NULL
    END AS unredacted_payload_kms_key_id
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
