-- M13: custom patterns + custom L3 classifiers -- org-composable typology overlay
--
-- Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md section 3
-- (the memo calls this the "M12 migration"; see the numbering note below).
--
-- NUMBERING CORRECTION (the only deviation from the memo's literal text).
-- The memo names this migration M12_custom_patterns_and_classifiers.sql, written
-- when the memo author believed M11 was the schema HEAD. Since the memo was
-- drafted, the SaaS Phase 2 multi-tenancy work landed as M12
-- (M12_organizations_and_memberships.sql -- itself a renumbering of what the SaaS
-- memo called "M6"). The schema HEAD at implementation time is therefore M12, so
-- this file is numbered M13: the next available slot. The migration runner
-- (scripts/run-migrations.js) applies files in numeric prefix order, so M13
-- applies AFTER the existing M1--M12 chain in every environment. The migration's
-- content is independent of the number -- the FK clauses reference table names
-- (organizations, users), not migration ordinals (scoping memo section 13 Q1).
--
-- What this lands (memo section 3):
--   * org_patterns               -- named org-defined typology compositions.
--   * pattern_components          -- the closed-set / org-custom tags composing a
--                                   pattern (group_name closed set per ontology
--                                   section 3).
--   * org_custom_l3_classifiers   -- single org-added tags in one of the L3
--                                   groups, with the proposed->shadow->live->
--                                   retired lifecycle (memo section 6).
--   * org_custom_l3_examples      -- positive / negative examples per classifier.
--   * RLS org-quarantine policies on all four (memo section 3.5 + section 7):
--     direct organization_id filter on the two parent tables, transitive
--     EXISTS-subquery filter on the two child tables.
--
-- Apply order: requires M12 (organizations, users). Every FK either references
-- organizations(id) / users(id) (M12) or a parent table created above.
-- Reversible via the trailing DOWN section (memo section 3.6).
--
-- Threat-model summary (memo sections 7 + 11; recorded here so the migration
-- carries its own security rationale):
--   * Cross-org bleed (R3) is defended in depth: every src/lib/data/custom-patterns
--     query filters on organization_id at the application layer (the load-bearing
--     line of defense), and these RLS policies are the structural backstop -- a
--     dropped application-layer filter degrades to "I cannot see my own data,"
--     never "I can see another org's data."
--   * The definition-as-prompt-injection threat (R1) is NOT a schema concern: the
--     definition prose is stored as inert DATA here. The Phase 4 inference path
--     (out of scope for this migration) feeds it through the three-layer defensive
--     scaffold (Layer 1 framing + Layer 2 JSON schema + Layer 3
--     INSTRUCTION_LEAKAGE_PATTERNS post-check) that src/lib/osint/classify.ts
--     established. The INSTRUCTION_LEAKAGE_PATTERNS regex set is maintained on a
--     quarterly architect-track cadence, out-of-band on novel patterns (memo Q12).
--   * The 40--600 char definition CHECK and the 2000 char example CHECK are the
--     structural defense against smuggling a full policy document into a single
--     field (memo sections 3.3 / 3.4 / 5.3).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. org_patterns -- named org-defined typology compositions (memo 3.1).
--    typology is closed-set-validated at the application layer against
--    docs/08-v5-ontology.md section 3.9 (a CHECK cannot read the doc vocabulary,
--    so the persistence layer validates and a lockstep verifier guards it).
--    match_mode is the schema-level expression of the Steven-locked decision:
--    subset is the default; weighted is the Phase 5 advanced opt-in.
-- ---------------------------------------------------------------------------
CREATE TABLE org_patterns (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL
    CHECK (name ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{0,79}$'),
  typology               TEXT NOT NULL,                 -- closed-set per docs/08-v5-ontology.md section 3.9
  match_mode             TEXT NOT NULL DEFAULT 'subset'
    CHECK (match_mode IN ('subset', 'weighted')),
  status                 TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX idx_org_patterns_organization_id ON org_patterns (organization_id);
CREATE INDEX idx_org_patterns_typology ON org_patterns (typology);

ALTER TABLE org_patterns ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. pattern_components -- one row per tag composed into a pattern (memo 3.2).
--    group_name is the closed L3-group vocabulary (method/tactic/target/
--    context_marker/overlap/risk_marker per ontology sections 3.1--3.8). The
--    checkCustomPatternGroupsLockstep verifier (scripts/check-lockstep.js)
--    guards this CHECK against the canonical L3_GROUP_NAMES constant. weight is
--    consulted only when the parent's match_mode = 'weighted' (Phase 5).
-- ---------------------------------------------------------------------------
CREATE TABLE pattern_components (
  id                     SERIAL PRIMARY KEY,
  pattern_id             UUID NOT NULL REFERENCES org_patterns(id) ON DELETE CASCADE,
  group_name             TEXT NOT NULL
    CHECK (group_name IN ('method', 'tactic', 'target', 'context_marker', 'overlap', 'risk_marker')),
  tag_id                 TEXT NOT NULL,                 -- closed-set or org-custom tag name
  tag_source             TEXT NOT NULL
    CHECK (tag_source IN ('closed_set', 'org_custom')),
  weight                 REAL NOT NULL DEFAULT 1.0
    CHECK (weight >= 0.0 AND weight <= 1.0),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pattern_id, group_name, tag_id)
);

CREATE INDEX idx_pattern_components_pattern_id ON pattern_components (pattern_id);

ALTER TABLE pattern_components ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. org_custom_l3_classifiers -- org-added single L3 tags (memo 3.3).
--    tag_name mirrors architect-owned closed-set L3 tag-name shape (snake_case,
--    ASCII, <= 40). definition prose is bounded 40--600 (1--3 sentences). status
--    is the four-state lifecycle (proposed -> shadow -> live -> retired);
--    transitions are enforced at the application layer (memo section 6).
-- ---------------------------------------------------------------------------
CREATE TABLE org_custom_l3_classifiers (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_name             TEXT NOT NULL
    CHECK (group_name IN ('method', 'tactic', 'target', 'context_marker', 'overlap', 'risk_marker')),
  tag_name               TEXT NOT NULL
    CHECK (tag_name ~ '^[a-z][a-z0-9_]{0,39}$'),
  definition             TEXT NOT NULL
    CHECK (length(definition) BETWEEN 40 AND 600),
  status                 TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'shadow', 'live', 'retired')),
  shadow_started_at      TIMESTAMPTZ,
  promoted_at            TIMESTAMPTZ,
  retired_at             TIMESTAMPTZ,
  created_by_user_id     UUID NOT NULL REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, group_name, tag_name)
);

CREATE INDEX idx_org_custom_l3_classifiers_organization_id ON org_custom_l3_classifiers (organization_id);
CREATE INDEX idx_org_custom_l3_classifiers_status ON org_custom_l3_classifiers (status);

ALTER TABLE org_custom_l3_classifiers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. org_custom_l3_examples -- positive / negative examples per classifier
--    (memo 3.4). The application layer requires >= 2 of each kind before a
--    classifier may leave 'proposed'. The 2000-char cap is the smuggling
--    defense (memo section 3.4).
-- ---------------------------------------------------------------------------
CREATE TABLE org_custom_l3_examples (
  id                     SERIAL PRIMARY KEY,
  classifier_id          UUID NOT NULL REFERENCES org_custom_l3_classifiers(id) ON DELETE CASCADE,
  kind                   TEXT NOT NULL
    CHECK (kind IN ('positive', 'negative')),
  text                   TEXT NOT NULL
    CHECK (length(text) BETWEEN 1 AND 2000),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_custom_l3_examples_classifier_id ON org_custom_l3_examples (classifier_id);
CREATE INDEX idx_org_custom_l3_examples_classifier_kind ON org_custom_l3_examples (classifier_id, kind);

ALTER TABLE org_custom_l3_examples ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5. RLS org-quarantine policies (memo 3.5). Direct organization_id filter on
--    the two parent tables; transitive EXISTS-subquery filter on the two child
--    tables (index-efficient against each parent's organization_id index). The
--    GUC app.current_organization_id is set by the auth middleware before any
--    query fires; it matches the M12 evaluations / classifier_edits policy shape.
-- ---------------------------------------------------------------------------
CREATE POLICY org_patterns_tenant_isolation ON org_patterns
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

CREATE POLICY org_custom_l3_classifiers_tenant_isolation ON org_custom_l3_classifiers
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

CREATE POLICY pattern_components_tenant_isolation ON pattern_components
  USING (EXISTS (
    SELECT 1 FROM org_patterns p
    WHERE p.id = pattern_components.pattern_id
      AND p.organization_id = current_setting('app.current_organization_id', true)::uuid
  ));

CREATE POLICY org_custom_l3_examples_tenant_isolation ON org_custom_l3_examples
  USING (EXISTS (
    SELECT 1 FROM org_custom_l3_classifiers c
    WHERE c.id = org_custom_l3_examples.classifier_id
      AND c.organization_id = current_setting('app.current_organization_id', true)::uuid
  ));

-- DOWN (reversal):
-- -- Drops the policies first, then the tables in child-before-parent order so
-- -- the FK chain unwinds cleanly (memo section 3.6). No data is migrated INTO
-- -- these tables from existing tables, so there is no backfill to reverse; any
-- -- rows created post-apply are lost on DOWN. The DOWN path is reserved for
-- -- emergency rollback of an in-progress release, not routine operation.
--
-- DROP POLICY IF EXISTS org_custom_l3_examples_tenant_isolation ON org_custom_l3_examples;
-- DROP POLICY IF EXISTS pattern_components_tenant_isolation ON pattern_components;
-- DROP POLICY IF EXISTS org_custom_l3_classifiers_tenant_isolation ON org_custom_l3_classifiers;
-- DROP POLICY IF EXISTS org_patterns_tenant_isolation ON org_patterns;
-- DROP TABLE IF EXISTS org_custom_l3_examples;
-- DROP TABLE IF EXISTS org_custom_l3_classifiers;
-- DROP TABLE IF EXISTS pattern_components;
-- DROP TABLE IF EXISTS org_patterns;
