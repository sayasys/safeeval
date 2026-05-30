-- M15: evaluation-check log + reviewer-feedback persistence for the
--      shadow -> live promotion lifecycle (custom L3 classifiers).
--
-- Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
-- section 6.3 (the precision-proxy promotion gate) + section 11 R5 (the
-- distinct-reviewer calibration-attack mitigation). Phase 4 dispatch brief
-- (2026-05-30): "Shadow -> live promotion + feedback loop integration."
--
-- WHY A NEW MIGRATION (not a column on M13/M14).
-- The promotion gate (memo 6.3) needs two facts the existing schema cannot
-- supply:
--   1. HOW MANY TIMES a classifier has been evaluated against an incoming input
--      (the "volume condition" N -- default 50). The agnostic-output envelope is
--      not persisted per-classifier-check anywhere; the inference pass (Phase 4)
--      records each check here.
--   2. The reviewer feedback that confirms or corrects a classifier's shadow
--      verdict (the "feedback condition" M -- default 10 -- plus the precision
--      proxy = confirmations / (confirmations + corrections) and the
--      distinct-reviewer floor >= 2 from R5).
--
-- The memo (6.3) frames the precision proxy as reading "the existing
-- feedback-loop aggregator with an additional grouping dimension." In practice
-- the M8 classifier_edits table keys edits to closed-set field paths on an
-- evaluation row -- it has NO notion of an org-custom classifier id, and its
-- editor_role closed set is the architect-track reviewer vocabulary, not the
-- per-org reviewer identity the distinct-reviewer floor counts. Bending M8 to
-- carry custom-classifier feedback would overload its closed sets and entangle
-- the architect feedback loop with the per-org promotion gate. A dedicated,
-- org-scoped pair of tables is the simplest shape that supports the
-- precision-proxy calculation (Phase 4 dispatch brief: "choose the simplest
-- shape that supports the precision-proxy calculation").
--
-- WHAT THIS LANDS:
--   * custom_l3_match_log       -- one row per (classifier, incoming evaluation)
--                                  check, recording matched / confidence / how
--                                  (LLM inference vs bright-line shortcut). The
--                                  COUNT of rows for a classifier is the volume
--                                  condition N.
--   * custom_l3_match_feedback  -- one row per reviewer feedback event on a
--                                  classifier verdict (confirm | correct), with
--                                  the reviewer identity. COUNT is the feedback
--                                  condition M; DISTINCT reviewer_id is the R5
--                                  floor; confirm / (confirm + correct) is the
--                                  precision proxy.
--   * RLS org-quarantine policies on both (direct organization_id filter -- both
--     tables carry organization_id, so no transitive EXISTS subquery is needed).
--
-- Apply order: requires M12 (organizations), M13 (org_custom_l3_classifiers),
-- and M1 (evaluations). The migration runner (scripts/run-migrations.js) applies
-- files in numeric prefix order, so M15 applies AFTER the existing M1--M14 chain
-- in every environment. The FK clauses reference table names, not ordinals.
--
-- Reversible via the trailing DOWN section. No data is migrated INTO these
-- tables from existing tables, so there is no backfill to reverse; any rows
-- created post-apply are lost on DOWN. The DOWN path is reserved for emergency
-- rollback of an in-progress release, not routine operation.
--
-- Closed-set vocabularies introduced here (kept in lockstep with the TypeScript
-- MATCH_VIA / FEEDBACK_VERDICTS constants by checkPromotionFeedbackVocabularyLockstep
-- in scripts/check-lockstep.js):
--   * custom_l3_match_log.via       IN ('inference', 'bright_line')
--   * custom_l3_match_feedback.verdict IN ('confirm', 'correct')

-- ---------------------------------------------------------------------------
-- 1. custom_l3_match_log -- one row each time a shadow/live classifier is checked
--    against an incoming evaluation. evaluation_id is nullable + ON DELETE SET
--    NULL so the log row survives the M1 evaluation row's 90-day TTL reap (the
--    promotion gate's volume count must not decay just because the underlying
--    evaluation aged out). `via` records whether the verdict came from the LLM
--    inference pass or the deterministic bright-line substring shortcut (memo
--    5.5; the Phase 4 reconciliation decision treats bright-line indicators as
--    case-insensitive substring matches).
-- ---------------------------------------------------------------------------
CREATE TABLE custom_l3_match_log (
  id                     BIGSERIAL PRIMARY KEY,
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  classifier_id          UUID NOT NULL REFERENCES org_custom_l3_classifiers(id) ON DELETE CASCADE,
  evaluation_id          BIGINT REFERENCES evaluations(id) ON DELETE SET NULL,
  matched                BOOLEAN NOT NULL,
  confidence             REAL NOT NULL DEFAULT 0.0
    CHECK (confidence >= 0.0 AND confidence <= 1.0),
  via                    TEXT NOT NULL DEFAULT 'inference'
    CHECK (via IN ('inference', 'bright_line')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_custom_l3_match_log_organization_id ON custom_l3_match_log (organization_id);
CREATE INDEX idx_custom_l3_match_log_classifier_id ON custom_l3_match_log (classifier_id);

ALTER TABLE custom_l3_match_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. custom_l3_match_feedback -- one row per reviewer feedback event on a
--    classifier verdict. match_log_id is nullable + ON DELETE SET NULL so a
--    feedback row outlives the specific check it referenced (the precision proxy
--    aggregates over the classifier, not over individual log rows). reviewer_id
--    is TEXT (the per-org reviewer identity; the route layer binds it from the
--    session, mirroring the M8 editor_id stub convention). verdict is the closed
--    confirm/correct set: 'confirm' = the reviewer left the matched verdict in
--    place; 'correct' = the reviewer marked it a false positive.
-- ---------------------------------------------------------------------------
CREATE TABLE custom_l3_match_feedback (
  id                     BIGSERIAL PRIMARY KEY,
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  classifier_id          UUID NOT NULL REFERENCES org_custom_l3_classifiers(id) ON DELETE CASCADE,
  match_log_id           BIGINT REFERENCES custom_l3_match_log(id) ON DELETE SET NULL,
  reviewer_id            TEXT NOT NULL,
  verdict                TEXT NOT NULL
    CHECK (verdict IN ('confirm', 'correct')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_custom_l3_match_feedback_organization_id ON custom_l3_match_feedback (organization_id);
CREATE INDEX idx_custom_l3_match_feedback_classifier_id ON custom_l3_match_feedback (classifier_id);

ALTER TABLE custom_l3_match_feedback ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. RLS org-quarantine policies (memo 3.5 + 7). Both tables carry
--    organization_id directly, so a direct filter -- no transitive EXISTS
--    subquery -- mirrors the M13 org_patterns / org_custom_l3_classifiers shape.
--    The GUC app.current_organization_id is set by the auth middleware before any
--    query fires.
-- ---------------------------------------------------------------------------
CREATE POLICY custom_l3_match_log_tenant_isolation ON custom_l3_match_log
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

CREATE POLICY custom_l3_match_feedback_tenant_isolation ON custom_l3_match_feedback
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- DOWN (reversal):
-- -- Drops the policies first, then the tables in child-before-parent order
-- -- (custom_l3_match_feedback references custom_l3_match_log, so feedback drops
-- -- first). No backfill to reverse; rows created post-apply are lost on DOWN.
--
-- DROP POLICY IF EXISTS custom_l3_match_feedback_tenant_isolation ON custom_l3_match_feedback;
-- DROP POLICY IF EXISTS custom_l3_match_log_tenant_isolation ON custom_l3_match_log;
-- DROP TABLE IF EXISTS custom_l3_match_feedback;
-- DROP TABLE IF EXISTS custom_l3_match_log;
