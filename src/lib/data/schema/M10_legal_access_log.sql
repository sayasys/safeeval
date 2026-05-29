-- M10: legal-audience report access audit log (report-gen Phase 3)
--
-- Spec: docs/memos/2026-05-28-report-generator-implementation-spec.md section 7
--       (auth gate), extended by the Phase 3 dispatch (manual ops-runbook gate
--       at MVP; compliance posture Decision 2).
-- Runbook: docs/runbooks/legal-report-access.md.
-- Gate implementation: src/lib/report-generators/legal-auth-gate.ts
--       (requireLegalAccess writes one row here per access attempt).
--
-- Every legal-audience report access attempt -- GRANTED or DENIED -- writes a
-- row here. The denied rows are the security-review surface ("user X attempted
-- legal access at time T"); the granted rows are the chain-of-custody record
-- the legal audience report itself documents. The gate fails closed on the
-- grant path: if this write fails, access is not granted.
--
-- Phase 3 only writes audience='legal'; the column is constrained to a set
-- that is extensible for future audiences adopting the same audit-gate pattern.
--
-- Apply order: requires M1 (evaluations table). Independent of M2-M9 / M11.
-- Reversible via the -- DOWN section at the bottom of this file.

CREATE TABLE legal_access_log (
  id                    BIGSERIAL PRIMARY KEY,

  -- auth_user_id of the caller. Nullable: an unauthenticated attempt that
  -- somehow reaches the gate (the middleware normally blocks it with a 401)
  -- is itself worth recording, with a null user_id.
  user_id               UUID,

  evaluation_id         BIGINT NOT NULL
                          REFERENCES evaluations(id) ON DELETE CASCADE,

  -- Always 'legal' in Phase 3; extensible for future audited audiences.
  audience              TEXT NOT NULL DEFAULT 'legal'
                          CHECK (audience IN ('legal')),

  -- True when the pii_reviewer role check passed and the report was served.
  granted               BOOLEAN NOT NULL,

  -- Populated on a denied access (e.g. the presented role); null on grant.
  denied_reason         TEXT,

  accessed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Deferred audit field; the route does not yet thread the caller IP through
  -- to the gate. Left nullable so the column lands now and a later phase can
  -- populate it without a migration.
  ip_address            INET
);

-- Per-user audit history ("everything user X has accessed / attempted").
CREATE INDEX idx_legal_access_log_user_id
  ON legal_access_log (user_id);

-- Per-evaluation access trail ("who has read the legal report for case N").
CREATE INDEX idx_legal_access_log_evaluation_id
  ON legal_access_log (evaluation_id);

-- Time-ordered scans for security review and retention sweeps.
CREATE INDEX idx_legal_access_log_accessed_at
  ON legal_access_log (accessed_at DESC);

-- Denied-access review surface; a partial-ready btree on the grant flag keeps
-- "show me the denials" queries cheap.
CREATE INDEX idx_legal_access_log_granted
  ON legal_access_log (granted);

-- DOWN (reversal):
-- DROP INDEX IF EXISTS idx_legal_access_log_granted;
-- DROP INDEX IF EXISTS idx_legal_access_log_accessed_at;
-- DROP INDEX IF EXISTS idx_legal_access_log_evaluation_id;
-- DROP INDEX IF EXISTS idx_legal_access_log_user_id;
-- DROP TABLE IF EXISTS legal_access_log;
