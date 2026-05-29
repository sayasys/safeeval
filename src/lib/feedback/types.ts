// Classifier-edits feedback loop -- Phase 1 type definitions.
//
// Spec: docs/memos/2026-05-28-classifier-feedback-loop-scoping.md
//
// Phase 1 lands the three closed-set vocabularies (FieldPath, RationaleTag,
// EditorRole), the recordEdit() API entry point, the permission matrix, the
// EditorRoleGateError stub, and the M8 classifier_edits migration. Daily
// aggregation cron, LLM-assisted free-text clustering, fine-tuning corpus
// export, and reviewer UI are all out of scope for Phase 1 per the scoping
// memo Standard tier / Phase 2 deferral list.
//
// The three closed-set arrays below mirror docs/08-v5-ontology.md sections
// 3.15 (field_path), 3.16 (rationale_tag), and 3.17 (editor_role)
// byte-for-byte. The lockstep verifiers in scripts/check-lockstep.js assert
// set equality between the doc tables and these arrays; either-side drift
// fails the build. Reason this surface is module-local rather than baked
// into the engine ontology_version: the feedback vocabulary is a
// downstream consumer concept (reviewer overrides of classifier output),
// not an envelope-emitted field, and the engine surface stays pure per
// the scoping memo section 7 architectural invariant.

// Closed-set editor-role vocabulary. Three entries match ontology section
// 3.17 exactly. qa_reviewer is flag-only in Phase 1 (no direct edit
// capability; submits proposals to the senior_reviewer queue per the
// permission matrix). The qa_proposed_edits surface is deferred to the
// Standard tier per scoping memo section 6.
export const EDITOR_ROLES = [
  'senior_reviewer',
  'policy_lead',
  'qa_reviewer',
] as const;
export type EditorRole = (typeof EDITOR_ROLES)[number];

// Closed-set field_path vocabulary. 15 editable fields per ontology section
// 3.15. reason_codes is listed once as `reason_codes` here; callers pass
// indexed paths like `reason_codes[2]` at runtime, which the validator
// normalizes to `reason_codes` for the permission check. audit_metadata.*
// and pii_redaction_log are explicitly NOT editable per the scoping memo
// section 4 ("Explicitly NOT editable") and are not included in this set.
export const FIELD_PATHS = [
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
  'persona.claimed',
] as const;
export type FieldPath = (typeof FIELD_PATHS)[number];

// Closed-set rationale_tag vocabulary. 18 entries match ontology section
// 3.16 exactly. The `other` escape valve costs the reviewer a free-text
// elaboration (validated mandatory in recordEdit()); `coverage_gap` is
// structurally distinct from `other` and fires the real-time architect
// notification per Steven's adjudication (scoping memo section 14 Q3,
// Option A).
export const RATIONALE_TAGS = [
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
  'other',
] as const;
export type RationaleTag = (typeof RATIONALE_TAGS)[number];

// Workflow state per the propagation_status column. Vocabulary mirrors the
// OSINT memo's proposal_status shape (scoping memo section 3); state
// transitions are documented in the M8 migration header. Phase 1 only
// writes 'pending'; the daily aggregation cron (Phase 2) drives the
// transitions to 'aggregated' and beyond.
export const PROPAGATION_STATUSES = [
  'pending',
  'aggregated',
  'applied_to_prompt',
  'applied_to_vocab',
  'dismissed',
] as const;
export type PropagationStatus = (typeof PROPAGATION_STATUSES)[number];

// The change_type column on classifier_edits. 'add' implies before_value is
// null; 'remove' implies after_value is null; 'modify' requires both to be
// non-null. The M8 CHECK constraint enforces these invariants at the
// database layer; recordEdit() enforces them at the API layer.
export const CHANGE_TYPES = ['remove', 'add', 'modify'] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

// Editor identity passed to recordEdit(). Phase 1 stub: editor_id is a
// placeholder for future auth; for now it holds the role name from the
// caller's context. Phase 3 replaces this with a token-validation routine
// consulting a reviewer_role_grants table (scoping memo section 7.2).
export interface EditorContext {
  editor_id: string;
  role: EditorRole;
}

// Input shape for recordEdit(). The validator parses each input against
// the closed-set vocabularies and rejects malformed records before any
// database side effect. The notation grammar mirrors the scoping memo
// section 2 form:
//   classifier <field_path>, changed <before> to <after>, because <tag>
// rationale_text is optional UNLESS rationale_tag = 'other', in which
// case it is mandatory (the escape-valve discipline; without it the
// closed-set vocabulary becomes vestigial).
export interface RecordEditInput {
  evaluation_id: string;
  field_path: string;
  change_type: ChangeType;
  before_value: unknown;
  after_value: unknown;
  rationale_tag: string;
  rationale_text?: string;
  editor_context: EditorContext;
}

// Successful recordEdit() return shape. propagation_status is always
// 'pending' at insert time; the aggregation cron (Phase 2) advances it.
export interface RecordEditResult {
  edit_id: number;
  propagation_status: 'pending';
}

// Persisted classifier_edits row shape. Matches the M8 DDL. The
// before_value / after_value columns are JSONB; their TypeScript shape is
// unknown because the field type varies by field_path (enum strings for
// L1 / L2 / disposition; numbers for component scores; strings for reason
// codes; etc.).
export interface ClassifierEdit {
  id: number;
  evaluation_id: string;
  editor_id: string;
  editor_role: EditorRole;
  field_path: string;
  change_type: ChangeType;
  before_value: unknown;
  after_value: unknown;
  rationale_tag: RationaleTag;
  rationale_text: string | null;
  created_at: string;
  propagation_status: PropagationStatus;
}

// Helper: is a candidate string in the closed-set field-path vocabulary?
// Normalizes reason_codes[i] -> reason_codes before the membership check
// so callers can pass indexed paths without the validator rejecting them.
export function isFieldPath(candidate: string): candidate is FieldPath {
  const normalized = normalizeFieldPath(candidate);
  return (FIELD_PATHS as readonly string[]).includes(normalized);
}

export function isRationaleTag(candidate: string): candidate is RationaleTag {
  return (RATIONALE_TAGS as readonly string[]).includes(candidate);
}

export function isEditorRole(candidate: string): candidate is EditorRole {
  return (EDITOR_ROLES as readonly string[]).includes(candidate);
}

// Normalize an indexed reason-code path to the bare 'reason_codes' form
// for permission and closed-set membership checks. Other field paths pass
// through unchanged. The aggregation cron preserves the original indexed
// path; only the permission gate and closed-set vocabulary check
// normalize.
export function normalizeFieldPath(fieldPath: string): string {
  if (fieldPath.startsWith('reason_codes[') && fieldPath.endsWith(']')) {
    return 'reason_codes';
  }
  return fieldPath;
}
