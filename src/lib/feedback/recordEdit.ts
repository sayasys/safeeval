// recordEdit() -- Phase 1 entry point for classifier-edits feedback loop.
//
// Spec: docs/memos/2026-05-28-classifier-feedback-loop-scoping.md sections
// 2 (notation grammar), 6 (permission matrix), 7.1 (pipeline), 7.2 (auth
// gate).
//
// Phase 1 lands the validation pipeline + auth gate stub. The actual
// INSERT into classifier_edits is gated behind a future Phase 2 db-client
// shim; this Phase 1 implementation returns a synthetic edit_id when the
// SAFEEVAL_FEEDBACK_ENABLED flag is unset and Phase 2 is not wired. The
// validation logic itself is fully exercised regardless of the flag --
// closed-set rejection and EditorRoleGateError firing are Phase 1
// observable behaviors.
//
// Pipeline (mirrors scoping memo section 7.1):
//   1. Validate the input against the notation grammar. Throw
//      MalformedNotationError on any failure with a structured `reason`
//      field naming the violation.
//   2. Consult the auth gate. Throw EditorRoleGateError if the role is
//      not permitted to edit the field per the permission matrix
//      (docs/08-v5-ontology.md section 3.17).
//   3. Insert into classifier_edits via the db-client (Phase 2). Phase 1
//      returns a synthetic edit_id and propagation_status 'pending'.

import { canEdit } from './permissions';
import {
  type EditorRole,
  type RecordEditInput,
  type RecordEditResult,
  EDITOR_ROLES,
  isFieldPath,
  isRationaleTag,
  isEditorRole,
  normalizeFieldPath,
} from './types';

// Structured violation tags. Surfacing the violation type lets a future
// reviewer UI render the rejection inline against the offending field
// rather than as opaque "input invalid" text.
export type NotationViolation =
  | 'missing_evaluation_id'
  | 'missing_field_path'
  | 'unknown_field_path'
  | 'missing_change_type'
  | 'invalid_change_type'
  | 'missing_rationale_tag'
  | 'unknown_rationale_tag'
  | 'rationale_text_required_for_other'
  | 'change_type_nullness_violation'
  | 'missing_editor_context'
  | 'missing_editor_id'
  | 'missing_editor_role'
  | 'unknown_editor_role';

export class MalformedNotationError extends Error {
  override readonly name = 'MalformedNotationError';
  readonly reason: NotationViolation;
  readonly detail: string;
  constructor(reason: NotationViolation, detail: string) {
    super(
      `Malformed classifier-edit notation: ${reason}. ${detail} ` +
        `Notation grammar reference: docs/memos/2026-05-28-classifier-` +
        `feedback-loop-scoping.md section 2. Closed-set vocabularies: ` +
        `docs/08-v5-ontology.md sections 3.15, 3.16, 3.17.`,
    );
    this.reason = reason;
    this.detail = detail;
  }
}

// Phase 2 stub. The Phase 3 dispatch replaces this with a token-validation
// routine consulting a reviewer_role_grants table (scoping memo section
// 7.2). The signature is stable across the upgrade: callers pass
// editor_context.role today and the gate trusts the caller's assertion.
// Phase 3 will reject any editor_context whose role does not match the
// authenticated token's grants.
//
// Phase 1 boundary: the gate fires on every edit whose (role, field_path)
// pair is denied by the permission matrix in
// docs/08-v5-ontology.md section 3.17. The matrix lives in code as
// EDITOR_ROLE_PERMISSIONS in permissions.ts; the lockstep verifier
// checkEditorRoleLockstep asserts the doc table matches.
export class EditorRoleGateError extends Error {
  override readonly name = 'EditorRoleGateError';
  readonly editor_role: EditorRole;
  readonly field_path: string;
  constructor(editor_role: EditorRole, field_path: string) {
    super(
      `Editor role '${editor_role}' is not authorized to edit field_path ` +
        `'${field_path}'. See docs/08-v5-ontology.md section 3.17 for the ` +
        `permission matrix. Phase 1 stub: the role is passed via the ` +
        `editor_context object and the gate trusts the caller's assertion; ` +
        `Phase 3 will replace this stub with a token-validation routine ` +
        `consulting a reviewer_role_grants table.`,
    );
    this.editor_role = editor_role;
    this.field_path = field_path;
  }
}

function validateNotation(input: RecordEditInput): void {
  if (typeof input.evaluation_id !== 'string' || input.evaluation_id.length === 0) {
    throw new MalformedNotationError(
      'missing_evaluation_id',
      'evaluation_id must be a non-empty string.',
    );
  }
  if (typeof input.field_path !== 'string' || input.field_path.length === 0) {
    throw new MalformedNotationError(
      'missing_field_path',
      'field_path must be a non-empty string drawn from the closed-set vocabulary.',
    );
  }
  if (!isFieldPath(input.field_path)) {
    throw new MalformedNotationError(
      'unknown_field_path',
      `field_path '${input.field_path}' is not in the closed-set vocabulary. ` +
        `audit_metadata.* and pii_redaction_log are explicitly NOT editable.`,
    );
  }
  if (typeof input.change_type !== 'string' || input.change_type.length === 0) {
    throw new MalformedNotationError(
      'missing_change_type',
      'change_type must be one of remove / add / modify.',
    );
  }
  if (
    input.change_type !== 'remove' &&
    input.change_type !== 'add' &&
    input.change_type !== 'modify'
  ) {
    throw new MalformedNotationError(
      'invalid_change_type',
      `change_type '${input.change_type}' is not one of remove / add / modify.`,
    );
  }
  // change_type / before / after nullness invariants. Matches the M8 CHECK
  // constraint at the database layer.
  if (input.change_type === 'add' && input.before_value !== null && input.before_value !== undefined) {
    throw new MalformedNotationError(
      'change_type_nullness_violation',
      'change_type=add implies before_value must be null.',
    );
  }
  if (input.change_type === 'remove' && input.after_value !== null && input.after_value !== undefined) {
    throw new MalformedNotationError(
      'change_type_nullness_violation',
      'change_type=remove implies after_value must be null.',
    );
  }
  if (
    input.change_type === 'modify' &&
    (input.before_value === null ||
      input.before_value === undefined ||
      input.after_value === null ||
      input.after_value === undefined)
  ) {
    throw new MalformedNotationError(
      'change_type_nullness_violation',
      'change_type=modify requires both before_value and after_value to be non-null.',
    );
  }
  if (typeof input.rationale_tag !== 'string' || input.rationale_tag.length === 0) {
    throw new MalformedNotationError(
      'missing_rationale_tag',
      'rationale_tag must be a non-empty string drawn from the closed-set vocabulary.',
    );
  }
  if (!isRationaleTag(input.rationale_tag)) {
    throw new MalformedNotationError(
      'unknown_rationale_tag',
      `rationale_tag '${input.rationale_tag}' is not in the closed-set vocabulary. ` +
        `Use 'other' with a free-text rationale_text as the escape valve.`,
    );
  }
  if (
    input.rationale_tag === 'other' &&
    (typeof input.rationale_text !== 'string' || input.rationale_text.length === 0)
  ) {
    throw new MalformedNotationError(
      'rationale_text_required_for_other',
      `rationale_tag='other' requires rationale_text to be a non-empty string.`,
    );
  }
  if (!input.editor_context || typeof input.editor_context !== 'object') {
    throw new MalformedNotationError(
      'missing_editor_context',
      'editor_context must be an object with editor_id and role.',
    );
  }
  if (
    typeof input.editor_context.editor_id !== 'string' ||
    input.editor_context.editor_id.length === 0
  ) {
    throw new MalformedNotationError(
      'missing_editor_id',
      'editor_context.editor_id must be a non-empty string.',
    );
  }
  if (
    typeof input.editor_context.role !== 'string' ||
    input.editor_context.role.length === 0
  ) {
    throw new MalformedNotationError(
      'missing_editor_role',
      'editor_context.role must be a non-empty string from the closed-set vocabulary.',
    );
  }
  if (!isEditorRole(input.editor_context.role)) {
    throw new MalformedNotationError(
      'unknown_editor_role',
      `editor_context.role '${input.editor_context.role}' is not in the closed-set vocabulary. ` +
        `Permitted roles: ${(EDITOR_ROLES as readonly string[]).join(', ')}.`,
    );
  }
}

// Phase 1 in-memory edit_id counter. Phase 2 replaces this with a real
// SERIAL allocation from the classifier_edits insert; until then the
// counter lets tests assert monotonic edit_ids without needing a database.
// Module-level state is acceptable here because Phase 1 has no production
// callers -- the surface exists for the API contract and for testing.
let nextSyntheticEditId = 1;

export function recordEdit(input: RecordEditInput): RecordEditResult {
  // Step 1: validate notation grammar. Throws MalformedNotationError on
  // any closed-set or shape violation.
  validateNotation(input);

  // Step 2: consult the auth gate. The closed-set validator above
  // guarantees editor_context.role is a known EditorRole before this
  // point, so the cast is safe.
  const role = input.editor_context.role;
  if (!canEdit(role, input.field_path)) {
    throw new EditorRoleGateError(role, input.field_path);
  }

  // Step 3: insert. Phase 1 stub: return a synthetic edit_id. Phase 2
  // wires the actual classifier_edits INSERT via a db-client shim. The
  // synthetic counter is sufficient for Phase 1 because the only callers
  // are tests; production callers are gated on Phase 2's wire-up.
  //
  // The normalized field path is computed here for parity with how the
  // aggregation cron (Phase 2) will read the row -- reason_codes[i]
  // round-trips through the database with its index preserved; only the
  // permission and closed-set checks normalize.
  void normalizeFieldPath(input.field_path);

  const edit_id = nextSyntheticEditId++;
  return { edit_id, propagation_status: 'pending' };
}

// Test seam: reset the synthetic edit_id counter. Production callers do
// not use this; the tests call it in beforeEach() so edit-id assertions
// are stable across runs.
export function _resetSyntheticEditIdCounterForTests(): void {
  nextSyntheticEditId = 1;
}
