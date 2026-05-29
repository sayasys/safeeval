// Public surface of the classifier-edits feedback module.
//
// Spec: docs/memos/2026-05-28-classifier-feedback-loop-scoping.md
//
// Phase 1 exports the closed-set vocabularies, the recordEdit() entry
// point, the permission matrix, and the two error types. The aggregation
// cron, fine-tuning corpus export, qa_proposed_edits flow, and reviewer
// UI are all out of scope for Phase 1.

export {
  EDITOR_ROLES,
  FIELD_PATHS,
  RATIONALE_TAGS,
  PROPAGATION_STATUSES,
  CHANGE_TYPES,
  isFieldPath,
  isRationaleTag,
  isEditorRole,
  normalizeFieldPath,
  type EditorRole,
  type FieldPath,
  type RationaleTag,
  type PropagationStatus,
  type ChangeType,
  type EditorContext,
  type RecordEditInput,
  type RecordEditResult,
  type ClassifierEdit,
} from './types';

export {
  EDITOR_ROLE_PERMISSIONS,
  canEdit,
} from './permissions';

export {
  recordEdit,
  MalformedNotationError,
  EditorRoleGateError,
  type NotationViolation,
} from './recordEdit';
