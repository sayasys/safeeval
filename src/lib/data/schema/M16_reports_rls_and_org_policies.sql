-- M16: tenant-isolation RLS for reports + the M12 org tables
--      (organizations / users / memberships).
--
-- Spec: handoff brief 0077 (2026-05-31). Closes the RLS gaps the cross-track
-- compliance audit found:
--   * docs/audits/2026-05-30-compl-track-audit-findings.md COMPL-1, COMPL-2,
--     COMPL-4
--   * docs/audits/2026-05-30-cross-track-audit-summary.md item R8, Pattern 1
--
-- WHY THIS MIGRATION (defensive scaffolding, not a runtime behavior change).
-- The app's db-client connects with the Supabase service role, which BYPASSES
-- RLS, so none of these policies fire at runtime today. They are nonetheless
-- the correct schema-side state: the moment a non-service-role auth surface
-- lands (the separate engineering dispatch named in brief 0077 -- the
-- app_set_organization_context SECURITY DEFINER RPC + a withOrganizationContext
-- that throws on a missing GUC), these policies are what actually enforce
-- tenant isolation. Authoring them now means the engineering follow-up has
-- correct policies to switch on rather than having to design them under
-- multi-tenant pressure. The gap is not exploitable in the current
-- single-tenant portfolio deployment (one real org, service-role bypass) but
-- converts to CRITICAL the day a second real tenant lands -- hence P1.
--
-- WHAT THIS LANDS:
--   1. reports (M4)         -- RLS enable + transitive org-isolation policy. The
--                              reports table has NO organization_id column; it
--                              inherits org scope through its evaluation_id FK
--                              (M12 header lines 24-27 record this explicitly).
--                              The policy therefore mirrors M12's classifier_edits
--                              policy shape exactly: an EXISTS subquery joining
--                              back to evaluations on the org GUC.
--   2. organizations (M12)  -- self-read policy: a tenant sees only its own org
--                              row (id = the org GUC). M12 ENABLE'd RLS but
--                              deferred the policy ("Phase 2 access is service-
--                              role only ... org-scoped row policies are deferred
--                              to a later phase", M12:65-67). This is that phase.
--   3. users (M12)          -- a tenant sees only users who are members of the
--                              current org (EXISTS join through memberships).
--   4. memberships (M12)    -- a tenant sees only memberships in the current org
--                              (organization_id = the org GUC) -- the same direct
--                              shape M13/M15 org-scoped tables use.
--
-- NOT IN SCOPE (verified during this migration, recorded here so the COMPL-4
-- question does not re-open):
--   * M11 aggregated_proposals + architect_inbox_queue. COMPL-4 flagged these
--     as "RLS status unverified." Verified: both tables ENABLE RLS *and already
--     carry a policy* (M11:162-169, permissive `USING (true)` for the cron's
--     service-role connection). Critically they have NO organization_id /
--     customer_id column -- they are system-global aggregate surfaces that
--     summarize the single tenant's edits (M11:155-161). They are therefore
--     neither in the COMPL-2 "enabled-but-no-policy" gap nor org-scopable
--     without first adding a tenant column. A future multi-tenant partition of
--     these surfaces is a schema change of its own (add organization_id, then
--     swap the permissive policy for an org filter); it is deliberately left
--     out of M16.
--
-- THE GUC + DEFAULT-DENY CONTRACT.
-- Every policy reads current_setting('app.current_organization_id', true). The
-- second argument (missing_ok = true) makes current_setting return NULL rather
-- than raising when the GUC is unset. NULL::uuid is NULL, and `col = NULL` /
-- `col = NULL::uuid` evaluate to NULL (not TRUE), so a row is never admitted
-- when the GUC is absent -- i.e. an unset org context is default-deny, returning
-- zero rows on every policy-bound table. This is identical to the M12 / M15
-- contract and is the property brief 0077's smoke test asserts.
--
-- Apply order: requires M1 (evaluations), M4 (reports), M12 (organizations /
-- users / memberships). The runner (scripts/run-migrations.js) applies files in
-- numeric prefix order, so M16 applies AFTER the existing M1--M15 chain in every
-- environment. The policy bodies reference table + column names, not ordinals.
--
-- Reversible via the trailing -- DOWN section. No data is migrated, so there is
-- nothing to reconstruct on reversal; DOWN simply drops the four policies and
-- disables RLS on the three tables that M16 enabled it on (reports). RLS on
-- organizations / users / memberships was enabled by M12, so M16's DOWN leaves
-- those ENABLE flags in place (dropping only the policies M16 added) -- reversing
-- M16 must not silently undo M12's posture.

-- ---------------------------------------------------------------------------
-- 1. reports -- transitive org isolation through the evaluation_id FK.
--    Mirrors M12's classifier_edits_tenant_isolation EXISTS-join shape exactly.
-- ---------------------------------------------------------------------------
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_tenant_isolation ON reports
  USING (EXISTS (
    SELECT 1 FROM evaluations e
    WHERE e.id = reports.evaluation_id
      AND e.organization_id = current_setting('app.current_organization_id', true)::uuid
  ));

-- ---------------------------------------------------------------------------
-- 2. organizations -- a tenant reads only its own org row. RLS already ENABLE'd
--    by M12 (M12:83); M16 adds the deferred policy.
-- ---------------------------------------------------------------------------
CREATE POLICY organizations_tenant_isolation ON organizations
  USING (id = current_setting('app.current_organization_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 3. users -- a tenant reads only users who are members of the current org.
--    A user row is admitted iff a membership ties that user to the org GUC.
--    RLS already ENABLE'd by M12 (M12:60).
-- ---------------------------------------------------------------------------
CREATE POLICY users_tenant_isolation ON users
  USING (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = users.id
      AND m.organization_id = current_setting('app.current_organization_id', true)::uuid
  ));

-- ---------------------------------------------------------------------------
-- 4. memberships -- a tenant reads only memberships in the current org. Direct
--    organization_id filter (the column exists on the table). RLS already
--    ENABLE'd by M12 (M12:107).
-- ---------------------------------------------------------------------------
CREATE POLICY memberships_tenant_isolation ON memberships
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- DOWN (reversal):
-- -- Drops the four policies M16 added. RLS on organizations / users /
-- -- memberships was ENABLE'd by M12, so it is left enabled here -- only the
-- -- reports ENABLE (which M16 introduced) is reversed. No data to restore.
--
-- DROP POLICY IF EXISTS memberships_tenant_isolation ON memberships;
-- DROP POLICY IF EXISTS users_tenant_isolation ON users;
-- DROP POLICY IF EXISTS organizations_tenant_isolation ON organizations;
-- DROP POLICY IF EXISTS reports_tenant_isolation ON reports;
-- ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
