// Editor-role permission matrix per docs/08-v5-ontology.md section 3.17 and
// the scoping memo (docs/memos/2026-05-28-classifier-feedback-loop-scoping.md)
// section 6.
//
// The matrix is the load-bearing security property of the feedback module:
// which editor_role can edit which field_path. canEdit() is consulted from
// recordEdit() before any database side effect; a denied edit throws
// EditorRoleGateError (defined in recordEdit.ts and re-exported from the
// module index).
//
// Phase 1 boundary: the role passed to canEdit() comes from the caller's
// editor_context object. There is no real authentication -- the caller
// asserts the role and the gate trusts the assertion. Phase 3 replaces this
// with a token-validation routine consulting a reviewer_role_grants table
// (scoping memo section 7.2). The signature of canEdit() is stable across
// the upgrade; only the auth wiring upstream changes.
//
// Lockstep coverage: scripts/check-lockstep.js / checkEditorRoleLockstep
// asserts the section 3.17 permission-matrix table matches the
// EDITOR_ROLE_PERMISSIONS constant below. Either-side drift fails the
// build.

import {
  type EditorRole,
  type FieldPath,
  EDITOR_ROLES,
  FIELD_PATHS,
  normalizeFieldPath,
} from './types';

// Per the scoping memo section 6 permission matrix:
//
//                            senior_reviewer   policy_lead   qa_reviewer
// l1.category                allow             allow         deny
// l2.subcategory             allow             allow         deny
// l3.method                  deny              allow         deny
// l3.tactic                  deny              allow         deny
// l3.target                  deny              allow         deny
// l3.overlap                 deny              allow         deny
// reason_codes[i]            allow             allow         deny
// disposition.action         allow             allow         deny
// evidence.aggregate_score   allow             allow         deny
// evidence.component_scores.*  allow           allow         deny
// persona.claimed            deny              allow         deny
//
// audit_metadata.* is structurally not editable and is not in FIELD_PATHS;
// the closed-set membership check in recordEdit() rejects audit_metadata
// edits before this matrix is consulted.
//
// qa_reviewer is flag-only in Phase 1: it has no entries in this matrix
// (empty set), so canEdit() returns false for every field. The
// qa_proposed_edits queue surface is deferred to the Standard tier per
// scoping memo section 11.2.
export const EDITOR_ROLE_PERMISSIONS: Record<EditorRole, ReadonlySet<FieldPath>> = {
  senior_reviewer: new Set<FieldPath>([
    'l1.category',
    'l2.subcategory',
    'reason_codes',
    'disposition.action',
    'evidence.aggregate_score',
    'evidence.component_scores.target',
    'evidence.component_scores.lure',
    'evidence.component_scores.trust',
    'evidence.component_scores.extract',
    'evidence.component_scores.evade',
  ]),
  policy_lead: new Set<FieldPath>([
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
  ]),
  qa_reviewer: new Set<FieldPath>(),
};

// Returns true if the given role is permitted to edit the given field path.
// Normalizes indexed reason_codes paths (reason_codes[3]) to the bare
// 'reason_codes' form before the membership check. Unknown roles or unknown
// field paths return false; closed-set membership is the validator's
// responsibility (recordEdit() rejects unknown fields with
// MalformedNotationError before reaching this gate).
export function canEdit(role: EditorRole, fieldPath: string): boolean {
  const normalized = normalizeFieldPath(fieldPath);
  if (!(FIELD_PATHS as readonly string[]).includes(normalized)) return false;
  if (!(EDITOR_ROLES as readonly string[]).includes(role)) return false;
  const allowed = EDITOR_ROLE_PERMISSIONS[role];
  return allowed.has(normalized as FieldPath);
}
