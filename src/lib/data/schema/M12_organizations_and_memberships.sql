-- M12: multi-tenancy -- organizations / users / memberships + customer_id rename
--
-- Spec: docs/memos/2026-05-28-saas-conversion-scoping.md section 4 (the memo
-- calls this the "M6 migration"; see the numbering note below).
--
-- NUMBERING CORRECTION (the only deviation from the memo's literal text).
-- The memo names this migration M6_organizations.sql, written when the schema
-- HEAD was M5. Since then migrations M7 (threat_signals), M8 (classifier_edits),
-- M9, M10 (legal_access_log), and M11 (aggregated_proposals) shipped on top of
-- the empty M6 slot. The runner (scripts/run-migrations.js) applies files in
-- numeric prefix order, so an M6 file inserted now would sort BEFORE M7--M11 and
-- create an out-of-order apply hazard on any database already at M11. This file
-- is therefore numbered M12 so it applies AFTER the existing chain in every
-- environment. It fills the role the memo calls "M6".
--
-- What this lands (memo sections 4.1--4.6):
--   * users          -- queryable mirror of the auth provider's user records.
--   * organizations  -- tenant root; plan_tier closed set; created_by FK to users.
--   * memberships    -- (organization, user, role) with the closed role set
--                       owner|admin|member|reviewer (memo section 6).
--   * Renames evaluations.customer_id -> organization_id (TEXT 'self' literal ->
--     UUID FK) and the dormant threat_signals.customer_id the same way (M7's own
--     header asks for this promotion). Swaps the two tenant-isolation RLS
--     policies (evaluations, classifier_edits) from app.current_customer_id to
--     app.current_organization_id (memo section 4.6). reports (M4) has no
--     customer_id column -- it inherits org-scoping transitively through its
--     evaluation_id FK, so it needs no change here.
--
-- Backfill rule (memo section 4.4 + Steven's adjudication):
--   * A system user (UUID ...0001) and a shared "Portfolio self" organization
--     (UUID ...0010, slug portfolio-self) are created. Every legacy
--     customer_id = 'self' row points at that single shared org -- those rows
--     are the pre-multi-tenancy single-tenant evaluations.
--   * Any legacy customer_id = 'personal-<auth_user_id>' literal (none are
--     written by the current code, which always defaults to 'self'; this branch
--     is forward-defensive) gets a per-user "Personal" organization with the
--     user as owner.
--   * A catch-all maps any remaining unmatched literal to the Portfolio self
--     org so the post-backfill SET NOT NULL can never fail.
--
-- Apply order: requires M1 (evaluations), M7 (threat_signals), M8
-- (classifier_edits policy). Reversible via the trailing reversal section.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. users -- queryable mirror of the auth provider's user records (memo 4.2).
--    id mirrors the provider's user_id (auth_user_id in src/lib/auth/types.ts);
--    no provider-specific naming. Kept in sync via an auth webhook (Phase 3+).
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id                     UUID PRIMARY KEY,
  email                  TEXT NOT NULL UNIQUE,
  display_name           TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. organizations -- tenant root (memo 4.1). plan_tier is a closed set whose
--    CHECK mirrors the docs section 7 vocabulary; created_by_user_id FKs the
--    creating user. RLS enabled; Phase 2 access is service-role only (the
--    db-client uses the service key, which bypasses RLS), so org-scoped row
--    policies are deferred to a later phase rather than authored here.
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  slug                   TEXT NOT NULL UNIQUE
    CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  plan_tier              TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_tier IN ('free', 'pro', 'enterprise')),
  created_by_user_id     UUID NOT NULL REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON organizations (slug);
CREATE INDEX idx_organizations_plan_tier ON organizations (plan_tier);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. memberships -- (organization, user, role) join (memo 4.3). role is the
--    closed set owner|admin|member|reviewer (memo section 6); the CHECK is the
--    SQL half of the checkOrgRoleLockstep verifier (the other half is the
--    ORG_ROLES constant in src/lib/auth/types.ts). NOTE: pii_reviewer is NOT a
--    membership role -- it is an auth-provider app_metadata value consumed by
--    the legal-access-log gate, a separate concern (memo + adjudication).
-- ---------------------------------------------------------------------------
CREATE TABLE memberships (
  id                     SERIAL PRIMARY KEY,
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                   TEXT NOT NULL
    CHECK (role IN ('owner', 'admin', 'member', 'reviewer')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_memberships_organization_id ON memberships (organization_id);
CREATE INDEX idx_memberships_user_id ON memberships (user_id);
CREATE INDEX idx_memberships_role ON memberships (role);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. Backfill seed: the system user + the shared "Portfolio self" org. Fixed
--    UUIDs per memo 4.4 so re-applying (or a fresh environment) is stable.
--    ON CONFLICT keeps this idempotent.
-- ---------------------------------------------------------------------------
INSERT INTO users (id, email, display_name)
  VALUES ('00000000-0000-0000-0000-000000000001'::uuid,
          'system@safeeval.vercel.app',
          'SafeEval System')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, slug, plan_tier, created_by_user_id)
  VALUES ('00000000-0000-0000-0000-000000000010'::uuid,
          'Portfolio self',
          'portfolio-self',
          'free',
          '00000000-0000-0000-0000-000000000001'::uuid)
  ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. evaluations.customer_id -> organization_id (memo 4.4).
--    Add the new column nullable, backfill, then enforce NOT NULL + FK.
-- ---------------------------------------------------------------------------
ALTER TABLE evaluations
  ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- 5a. Legacy single-tenant rows ('self') -> the shared Portfolio self org.
UPDATE evaluations
   SET organization_id = '00000000-0000-0000-0000-000000000010'::uuid
 WHERE customer_id = 'self';

-- 5b. Forward-defensive: any 'personal-<auth_user_id>' literal gets a per-user
--     Personal org with the user as owner. No such rows exist under the current
--     code (persistEvaluation always defaults customer_id to 'self'); this
--     branch honors the adjudicated backfill rule for completeness.
DO $$
DECLARE
  r            RECORD;
  v_user_id    UUID;
  v_org_id     UUID;
BEGIN
  FOR r IN
    SELECT DISTINCT customer_id
      FROM evaluations
     WHERE customer_id LIKE 'personal-%'
  LOOP
    v_user_id := substring(r.customer_id FROM 'personal-(.*)')::uuid;

    INSERT INTO users (id, email, display_name)
      VALUES (v_user_id,
              v_user_id::text || '@personal.safeeval.local',
              'Personal')
      ON CONFLICT (id) DO NOTHING;

    INSERT INTO organizations (name, slug, plan_tier, created_by_user_id)
      VALUES ('Personal',
              'personal-' || v_user_id::text,
              'free',
              v_user_id)
      ON CONFLICT (slug) DO NOTHING;

    SELECT id INTO v_org_id
      FROM organizations
     WHERE slug = 'personal-' || v_user_id::text;

    INSERT INTO memberships (organization_id, user_id, role)
      VALUES (v_org_id, v_user_id, 'owner')
      ON CONFLICT (organization_id, user_id) DO NOTHING;

    UPDATE evaluations
       SET organization_id = v_org_id
     WHERE customer_id = r.customer_id;
  END LOOP;
END $$;

-- 5c. Catch-all: anything still unmapped points at Portfolio self so the
--     NOT NULL below cannot fail on an unexpected legacy literal.
UPDATE evaluations
   SET organization_id = '00000000-0000-0000-0000-000000000010'::uuid
 WHERE organization_id IS NULL;

ALTER TABLE evaluations
  ALTER COLUMN organization_id SET NOT NULL;

-- 5d. Swap the evaluations tenant-isolation policy to the organization GUC
--     (memo 4.6). Create the new policy before dropping customer_id so the old
--     policy's reference to customer_id is gone before the column is.
DROP POLICY IF EXISTS evaluations_tenant_isolation ON evaluations;
CREATE POLICY evaluations_tenant_isolation ON evaluations
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- 5e. Swap the classifier_edits tenant-isolation policy (M8) -- it joins back to
--     evaluations on the renamed column + the renamed GUC.
DROP POLICY IF EXISTS classifier_edits_tenant_isolation ON classifier_edits;
CREATE POLICY classifier_edits_tenant_isolation ON classifier_edits
  USING (EXISTS (
    SELECT 1 FROM evaluations e
    WHERE e.id = classifier_edits.evaluation_id
      AND e.organization_id = current_setting('app.current_organization_id', true)::uuid
  ));

-- 5f. Drop the old column + its index; add the equivalent organization index.
DROP INDEX IF EXISTS idx_evaluations_customer_created_at;
ALTER TABLE evaluations DROP COLUMN customer_id;
CREATE INDEX idx_evaluations_organization_created_at
  ON evaluations (organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. threat_signals.customer_id -> organization_id. M7's header explicitly asks
--    to "Promote to UUID FK when M6 lands." The column is dormant (no RLS, no
--    index, no FK depends on it), so the rename is mechanical. Renamed for
--    naming consistency so the codebase carries no customer_id-means-org alias.
-- ---------------------------------------------------------------------------
ALTER TABLE threat_signals
  ADD COLUMN organization_id UUID REFERENCES organizations(id);

UPDATE threat_signals
   SET organization_id = '00000000-0000-0000-0000-000000000010'::uuid
 WHERE customer_id = 'self' OR organization_id IS NULL;

ALTER TABLE threat_signals
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE threat_signals DROP COLUMN customer_id;

-- DOWN (reversal):
-- -- Reverses every step in inverse order. Re-creates the customer_id columns
-- -- from organization_id (Portfolio self org -> 'self'), restores the two GUC
-- -- policies to app.current_customer_id, and drops the three new tables. Data
-- -- created post-migration is not reconstructed.
--
-- -- 6'. threat_signals: restore customer_id.
-- ALTER TABLE threat_signals ADD COLUMN customer_id TEXT NOT NULL DEFAULT 'self';
-- ALTER TABLE threat_signals DROP COLUMN organization_id;
--
-- -- 5f'. evaluations: restore customer_id column + index.
-- DROP INDEX IF EXISTS idx_evaluations_organization_created_at;
-- ALTER TABLE evaluations ADD COLUMN customer_id TEXT NOT NULL DEFAULT 'self';
-- UPDATE evaluations e SET customer_id = CASE
--   WHEN o.slug = 'portfolio-self' THEN 'self'
--   ELSE o.slug
-- END FROM organizations o WHERE o.id = e.organization_id;
-- CREATE INDEX idx_evaluations_customer_created_at ON evaluations (customer_id, created_at DESC);
--
-- -- 5e'. Restore the classifier_edits policy to the customer_id GUC.
-- DROP POLICY IF EXISTS classifier_edits_tenant_isolation ON classifier_edits;
-- CREATE POLICY classifier_edits_tenant_isolation ON classifier_edits
--   USING (EXISTS (SELECT 1 FROM evaluations e WHERE e.id = classifier_edits.evaluation_id AND e.customer_id = current_setting('app.current_customer_id', true)));
--
-- -- 5d'. Restore the evaluations policy to the customer_id GUC.
-- DROP POLICY IF EXISTS evaluations_tenant_isolation ON evaluations;
-- CREATE POLICY evaluations_tenant_isolation ON evaluations
--   USING (customer_id = current_setting('app.current_customer_id', true));
--
-- -- 5'. Drop organization_id from evaluations.
-- ALTER TABLE evaluations DROP COLUMN organization_id;
--
-- -- 3'/2'/1'. Drop the new tables (memberships FKs first, then organizations, then users).
-- DROP TABLE IF EXISTS memberships;
-- DROP TABLE IF EXISTS organizations;
-- DROP TABLE IF EXISTS users;
-- DROP EXTENSION IF EXISTS pgcrypto;
