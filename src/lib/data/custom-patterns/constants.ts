// Tunable constants for the custom patterns + custom L3 classifiers feature.
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 5, 6, 9 + the section 13 adjudication batch. These are surfaced as
// named exports (rather than inlined) so they are configurable from one place;
// the architect can override the gating defaults per-org via environment flags
// in a later phase.

// ---------------------------------------------------------------------------
// Shadow -> live promotion gating (memo section 6.3, Q4).
// Steven-adjudicated defaults: 0.7 threshold / 50 evaluations / 10 feedback
// events / >= 2 distinct reviewers.
// ---------------------------------------------------------------------------

// precision_proxy = confirmations / (confirmations + corrections). At or above
// this value the in-app surface shows the "Ready to promote" banner.
export const PRECISION_PROXY_THRESHOLD = 0.7;

// Volume condition: the classifier must have been evaluated against at least
// this many incoming evaluations before the promotion gate considers it.
export const PROMOTION_VOLUME_N = 50;

// Feedback condition: the classifier must have accumulated at least this many
// classifier-edits feedback events touching its verdict.
export const PROMOTION_FEEDBACK_M = 10;

// Calibration-attack mitigation (memo section 11 R5): a promotion must draw on
// feedback from at least this many DISTINCT reviewers. promoteToLive enforces
// this directly against the reviewer-id set it is handed.
export const MIN_DISTINCT_REVIEWERS = 2;

// ---------------------------------------------------------------------------
// Caps (memo Q9 + Q10).
// ---------------------------------------------------------------------------

// Per-org cap on classifiers in 'live' status (Q9). promoteToLive throws
// OrgClassifierCapExceededError when promoting would exceed this.
export const LIVE_CLASSIFIER_CAP = 25;

// Inference concurrency cap per evaluation (Q10). Phase 1 does not implement the
// inference path; the constant is recorded here so the Phase 4 additional-pass
// implementation reads it from one place. The latency floor is
// ceil(liveClassifierCount / INFERENCE_CONCURRENCY_CAP) * single_call_latency.
export const INFERENCE_CONCURRENCY_CAP = 10;

// ---------------------------------------------------------------------------
// Lifecycle preconditions (memo sections 5.4 / 6.2).
// ---------------------------------------------------------------------------

// A classifier needs at least this many examples of EACH kind (positive and
// negative) before it can leave 'proposed' and enter 'shadow'.
export const MIN_EXAMPLES_PER_KIND = 2;

// ---------------------------------------------------------------------------
// Field validation bounds (mirror the M13 CHECK constraints; memo sections
// 3.1 / 3.3 / 3.4 / 5.2 / 5.3). The application layer validates BEFORE the DB so
// callers get a typed error rather than a raw constraint-violation message.
// ---------------------------------------------------------------------------

// org_patterns.name CHECK.
export const PATTERN_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,79}$/;

// org_custom_l3_classifiers.tag_name CHECK (snake_case, ASCII, 1--40).
export const TAG_NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

// org_custom_l3_classifiers.definition CHECK (length 40--600).
export const DEFINITION_MIN_LENGTH = 40;
export const DEFINITION_MAX_LENGTH = 600;

// org_custom_l3_examples.text CHECK (length 1--2000).
export const EXAMPLE_MIN_LENGTH = 1;
export const EXAMPLE_MAX_LENGTH = 2000;

// pattern_components.weight CHECK (0.0--1.0).
export const WEIGHT_MIN = 0.0;
export const WEIGHT_MAX = 1.0;
