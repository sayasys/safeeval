-- M8: create classifier_edits table for the feedback-loop module
--
-- Spec: docs/memos/2026-05-28-classifier-feedback-loop-scoping.md section 3.
-- Closed-set vocabularies: docs/08-v5-ontology.md sections 3.15 (field_path),
-- 3.16 (rationale_tag), 3.17 (editor_role).
--
-- Architectural placement: classifier_edits is the supervision-signal
-- substrate. Reviewers override classifier outputs by inserting rows; the
-- aggregation cron (Phase 2) clusters consistent disagreement into
-- amendment proposals routed to the architect track; the eventual
-- fine-tuning corpus export (Phase 2) reads (input, original_output,
-- corrected_output, rationale) tuples for stage-specialized model
-- training. The table is downstream-consumer; it never feeds back into
-- the engine envelope.
--
-- Apply order: requires M1 (evaluations table). M2 (RLS) is not a strict
-- dependency but is applied earlier per numeric order; the RLS policy
-- below mirrors the M2 tenant-isolation pattern.
--
-- TTL: 90 days inherited via ON DELETE CASCADE on evaluation_id. The
-- data-track's aging job (data-track spec section 7.2) deletes the
-- evaluation row; the cascade reaps the classifier_edits rows. No
-- separate edit-TTL job ships in Phase 1, matching the reports-table
-- pattern from M4.
--
-- Reversible via the -- DOWN section at the bottom of this file.

CREATE TABLE classifier_edits (
  id                    BIGSERIAL PRIMARY KEY,
  evaluation_id         BIGINT NOT NULL
                          REFERENCES evaluations(id) ON DELETE CASCADE,

  -- Editor identity. Phase 1 stub: editor_id stores the role name from
  -- the caller's editor_context (mirrors the LegalAccessGateError
  -- unredacted_access=true stub in src/lib/report-generators/index.ts:84
  -- / Phase 2 commit 2632a66). Phase 3 will replace this with a real
  -- token-validation routine consulting reviewer_role_grants.
  editor_id             TEXT NOT NULL,
  editor_role           TEXT NOT NULL
    CHECK (editor_role IN (
      'senior_reviewer',
      'policy_lead',
      'qa_reviewer'
    )),

  -- The edit itself. field_path / change_type / before / after /
  -- rationale_tag are the load-bearing supervision-signal fields;
  -- rationale_text is the pattern-discovery signal per Steven's hybrid
  -- framing (scoping memo section 2 adjudication).
  --
  -- field_path holds either a bare closed-set name from
  -- docs/08-v5-ontology.md section 3.15 OR an indexed reason-code path
  -- of the form 'reason_codes[N]' where N is a non-negative integer.
  -- The CHECK constraint enforces this shape at the database layer; the
  -- API-layer validator (src/lib/feedback/recordEdit.ts) enforces the
  -- closed-set membership before any INSERT reaches the table.
  field_path            TEXT NOT NULL
    CHECK (
      field_path IN (
        'l1.category',
        'l2.subcategory',
        'l3.method',
        'l3.tactic',
        'l3.target',
        'l3.overlap',
        'reason_codes',
        'disposition.action',
        'evidence.aggregate_score',
        'evidence.component_scores.target',
        'evidence.component_scores.lure',
        'evidence.component_scores.trust',
        'evidence.component_scores.extract',
        'evidence.component_scores.evade',
        'persona.claimed'
      )
      OR field_path ~ '^reason_codes\[[0-9]+\]$'
    ),

  change_type           TEXT NOT NULL
    CHECK (change_type IN ('remove', 'add', 'modify')),

  before_value          JSONB,
  after_value           JSONB,

  rationale_tag         TEXT NOT NULL
    CHECK (rationale_tag IN (
      'wrong_l1_category',
      'wrong_l2_subcategory',
      'wrong_l3_method',
      'wrong_l3_tactic',
      'wrong_l3_target',
      'wrong_l3_overlap',
      'missing_reason_code',
      'extra_reason_code',
      'false_bright_line_fire',
      'missed_bright_line',
      'discriminator_boundary_unclear',
      'severity_mismatch',
      'disposition_too_lenient',
      'disposition_too_strict',
      'component_score_off',
      'persona_misidentified',
      'coverage_gap',
      'other'
    )),

  -- The escape-valve discipline: rationale_text MUST be populated when
  -- rationale_tag = 'other'. Without this constraint reviewers would use
  -- 'other' as a free-pass and the closed-set vocabulary would become
  -- vestigial (scoping memo section 5 + R1 mitigation discussion).
  rationale_text        TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Workflow state column; vocabulary mirrors the OSINT memo's
  -- proposal_status shape per scoping memo section 3.
  propagation_status    TEXT NOT NULL
    DEFAULT 'pending'
    CHECK (propagation_status IN (
      'pending',
      'aggregated',
      'applied_to_prompt',
      'applied_to_vocab',
      'dismissed'
    )),

  -- Application-layer assertion #1: rationale_text NOT NULL when
  -- rationale_tag = 'other'.
  CHECK (
    rationale_tag <> 'other'
    OR (rationale_text IS NOT NULL AND length(rationale_text) > 0)
  ),

  -- Application-layer assertion #2: change_type / before / after nullness
  -- invariants.
  CHECK (
    (change_type = 'add'    AND before_value IS NULL                                ) OR
    (change_type = 'remove' AND after_value  IS NULL                                ) OR
    (change_type = 'modify' AND before_value IS NOT NULL AND after_value IS NOT NULL)
  )
);

-- Indexes per the five most-frequent query shapes the aggregation cron +
-- the architect's adjudication queue hit. The composite at the end
-- carries the aggregation hot path.
CREATE INDEX idx_classifier_edits_evaluation_id
  ON classifier_edits (evaluation_id);

CREATE INDEX idx_classifier_edits_editor_role
  ON classifier_edits (editor_role);

CREATE INDEX idx_classifier_edits_rationale_tag
  ON classifier_edits (rationale_tag);

CREATE INDEX idx_classifier_edits_created_at
  ON classifier_edits (created_at DESC);

CREATE INDEX idx_classifier_edits_propagation_status
  ON classifier_edits (propagation_status, created_at DESC);

-- Aggregation hot path: GROUP BY (field_path, change_type, before_value,
-- after_value, rationale_tag) within a rolling 14-day window. The
-- (field_path, rationale_tag, created_at) composite carries most of the
-- work; histogram aggregation in pure SQL does the rest.
CREATE INDEX idx_classifier_edits_aggregation
  ON classifier_edits (field_path, rationale_tag, created_at DESC);

-- Row-level security inheriting from the data-track tenant-isolation
-- convention. classifier_edits inherits its customer_id via the
-- evaluations FK; the policy joins against evaluations to enforce
-- isolation.
ALTER TABLE classifier_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY classifier_edits_tenant_isolation ON classifier_edits
  USING (EXISTS (
    SELECT 1 FROM evaluations e
    WHERE e.id = classifier_edits.evaluation_id
      AND e.customer_id = current_setting('app.current_customer_id', true)
  ));

-- DOWN (reversal):
-- DROP POLICY IF EXISTS classifier_edits_tenant_isolation ON classifier_edits;
-- ALTER TABLE classifier_edits DISABLE ROW LEVEL SECURITY;
-- DROP INDEX IF EXISTS idx_classifier_edits_aggregation;
-- DROP INDEX IF EXISTS idx_classifier_edits_propagation_status;
-- DROP INDEX IF EXISTS idx_classifier_edits_created_at;
-- DROP INDEX IF EXISTS idx_classifier_edits_rationale_tag;
-- DROP INDEX IF EXISTS idx_classifier_edits_editor_role;
-- DROP INDEX IF EXISTS idx_classifier_edits_evaluation_id;
-- DROP TABLE IF EXISTS classifier_edits;
