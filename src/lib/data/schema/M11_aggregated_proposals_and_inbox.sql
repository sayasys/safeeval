-- M11: aggregated_proposals + architect_inbox_queue for the feedback-loop
-- Phase 2 aggregation cron.
--
-- Spec: docs/memos/2026-05-28-classifier-feedback-loop-scoping.md sections 8
-- (aggregation loop) and 14 Q3 (coverage_gap real-time routing -- Steven chose
-- Option A: route-to-steven priority for coverage_gap edits).
--
-- Architectural placement: the daily aggregation cron (src/lib/feedback/
-- aggregation.ts) groups pending classifier_edits rows by their shape, and for
-- each cluster exceeding the surfacing threshold writes one row to
-- aggregated_proposals AND one row to architect_inbox_queue. The inbox queue is
-- the cross-track routing substrate -- the actual delivery to the architect
-- track (handoff/board/inbox/architect.md or the orchestrator queue) is an
-- operator-side pickup; this migration just lands the durable queue table the
-- cron writes to.
--
-- Apply order: requires M1 (evaluations) and M8 (classifier_edits). The
-- aggregated_proposals rows summarize classifier_edits clusters; the FK from
-- architect_inbox_queue.proposal_id references aggregated_proposals.id.
--
-- proposal_status reuses the propagation_status closed set from
-- docs/08-v5-ontology.md section 3.16 (mirrored in src/lib/feedback/types.ts
-- PROPAGATION_STATUSES). A freshly surfaced proposal defaults to 'aggregated'
-- (its edits have been clustered into a proposal awaiting architect
-- adjudication); the terminal states 'applied_to_prompt' / 'applied_to_vocab'
-- / 'dismissed' are written when the architect adjudicates. 'pending' is
-- retained in the CHECK for forward-compatibility but is not a proposal's
-- initial state (an edit is 'pending'; a proposal starts 'aggregated').
--
-- priority reuses the escalation vocabulary from the parallel-cowork-tracks
-- memo (route-to-steven | default-accept). coverage_gap clusters route to
-- Steven per section 14 Q3 Option A; all other clusters default-accept.
--
-- Reversible via the -- DOWN section at the bottom of this file.

CREATE TABLE aggregated_proposals (
  id                    SERIAL PRIMARY KEY,

  -- Deterministic hash of the cluster shape. Computed application-side
  -- (src/lib/feedback/aggregation.ts computeClusterSignature) as a SHA-256
  -- over the tuple (field_path, change_type, before_value, after_value,
  -- rationale_tag). NOT UNIQUE: the same cluster shape can legitimately
  -- surface again on a later cron run once new edits accumulate (the prior
  -- run's edits were marked 'aggregated' and no longer re-enter the window),
  -- so a UNIQUE constraint would wrongly reject the next cycle's proposal.
  cluster_signature     TEXT NOT NULL,

  -- The cluster shape. field_path mirrors the classifier_edits closed set
  -- (docs/08-v5-ontology.md section 3.15) plus the indexed reason_codes[N]
  -- form; the aggregation cron preserves the original indexed path.
  field_path            TEXT NOT NULL,
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

  -- Cluster metrics. edit_count is the number of edits in the cluster;
  -- distinct_editors is the number of distinct editor_id values contributing.
  -- The surfacing threshold (section 8.1: edit_count >= 5 AND
  -- distinct_editors >= 3) is enforced application-side, not by a CHECK,
  -- because the threshold is operator-tunable (feedback_config) without a
  -- schema change.
  edit_count            INTEGER NOT NULL CHECK (edit_count > 0),
  distinct_editors      INTEGER NOT NULL CHECK (distinct_editors > 0),

  -- The rolling window the cluster was computed over.
  window_start          TIMESTAMPTZ NOT NULL,
  window_end            TIMESTAMPTZ NOT NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Workflow state. Reuses the propagation_status closed set (ontology
  -- section 3.16 / PROPAGATION_STATUSES). Default 'aggregated' -- see header.
  proposal_status       TEXT NOT NULL
    DEFAULT 'aggregated'
    CHECK (proposal_status IN (
      'pending',
      'aggregated',
      'applied_to_prompt',
      'applied_to_vocab',
      'dismissed'
    )),

  -- Architect adjudication outcome. NULL until the architect acts.
  adjudicated_at        TIMESTAMPTZ,
  adjudication_notes    TEXT
);

CREATE TABLE architect_inbox_queue (
  id                    SERIAL PRIMARY KEY,
  proposal_id           INTEGER NOT NULL
                          REFERENCES aggregated_proposals(id) ON DELETE CASCADE,

  -- Source track of the proposal. Defaults to 'feedback' (this cron). The
  -- column exists so the architect's pickup routine can differentiate the
  -- feedback-loop stream from the OSINT-discovery stream (both surface
  -- route-to-steven proposals to the same architect queue per scoping memo
  -- section 16).
  source_track          TEXT NOT NULL DEFAULT 'feedback',

  -- Escalation priority. route-to-steven (coverage_gap clusters per section
  -- 14 Q3 Option A) vs default-accept (all other clusters per section 14 Q1).
  priority              TEXT NOT NULL
    CHECK (priority IN ('route-to-steven', 'default-accept')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Operator-side pickup bookkeeping. NULL until the architect-track pickup
  -- routine processes the entry.
  processed_at          TIMESTAMPTZ,
  processed_outcome     TEXT
);

-- Indexes per the query shapes the cron writes and the architect pickup reads.
CREATE INDEX idx_aggregated_proposals_cluster_signature
  ON aggregated_proposals (cluster_signature);

CREATE INDEX idx_aggregated_proposals_status
  ON aggregated_proposals (proposal_status, created_at DESC);

CREATE INDEX idx_aggregated_proposals_field_tag
  ON aggregated_proposals (field_path, rationale_tag, created_at DESC);

CREATE INDEX idx_architect_inbox_queue_proposal_id
  ON architect_inbox_queue (proposal_id);

-- Unprocessed-queue scan: the architect pickup routine selects rows where
-- processed_at IS NULL ordered by priority then arrival. A partial index keeps
-- the hot scan small as processed rows accumulate.
CREATE INDEX idx_architect_inbox_queue_unprocessed
  ON architect_inbox_queue (priority, created_at DESC)
  WHERE processed_at IS NULL;

-- Row-level security. aggregated_proposals and architect_inbox_queue are
-- operator/architect-facing aggregate surfaces; they do not carry per-customer
-- rows in the single-tenant portfolio deployment (the cron summarizes the
-- 'self' tenant's edits). RLS is enabled for parity with the data-track
-- convention; the permissive policy below admits the service-role connection
-- the cron uses. A multi-tenant Phase 2 (deferred) would partition these by
-- customer_id the same way classifier_edits inherits isolation through its FK.
ALTER TABLE aggregated_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE architect_inbox_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY aggregated_proposals_service_access ON aggregated_proposals
  USING (true);

CREATE POLICY architect_inbox_queue_service_access ON architect_inbox_queue
  USING (true);

-- DOWN (reversal):
-- DROP POLICY IF EXISTS architect_inbox_queue_service_access ON architect_inbox_queue;
-- DROP POLICY IF EXISTS aggregated_proposals_service_access ON aggregated_proposals;
-- ALTER TABLE architect_inbox_queue DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE aggregated_proposals DISABLE ROW LEVEL SECURITY;
-- DROP INDEX IF EXISTS idx_architect_inbox_queue_unprocessed;
-- DROP INDEX IF EXISTS idx_architect_inbox_queue_proposal_id;
-- DROP INDEX IF EXISTS idx_aggregated_proposals_field_tag;
-- DROP INDEX IF EXISTS idx_aggregated_proposals_status;
-- DROP INDEX IF EXISTS idx_aggregated_proposals_cluster_signature;
-- DROP TABLE IF EXISTS architect_inbox_queue;
-- DROP TABLE IF EXISTS aggregated_proposals;
