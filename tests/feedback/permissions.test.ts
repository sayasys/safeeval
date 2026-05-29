// Permission matrix tests.
//
// Coverage: canEdit() returns the expected allow/deny for every
// (editor_role, field_path) combination per the permission matrix in
// docs/08-v5-ontology.md section 3.17. The matrix is the load-bearing
// security property of the feedback module; this test pins it.

import { describe, it, expect } from 'vitest';
import {
  canEdit,
  EDITOR_ROLE_PERMISSIONS,
  EDITOR_ROLES,
  FIELD_PATHS,
  type EditorRole,
  type FieldPath,
} from '../../src/lib/feedback';

// Per docs/08-v5-ontology.md section 3.17 permission matrix.
// Map of (role, field_path) -> expected canEdit result. Roles and field
// paths not listed default to false (deny). Roles outside EDITOR_ROLES
// return false. Field paths outside FIELD_PATHS return false.
const EXPECTED: Record<EditorRole, Record<FieldPath, boolean>> = {
  senior_reviewer: {
    'l1.category': true,
    'l2.subcategory': true,
    'l3.method': false,
    'l3.tactic': false,
    'l3.target': false,
    'l3.overlap': false,
    'reason_codes': true,
    'disposition.action': true,
    'evidence.aggregate_score': true,
    'evidence.component_scores.target': true,
    'evidence.component_scores.lure': true,
    'evidence.component_scores.trust': true,
    'evidence.component_scores.extract': true,
    'evidence.component_scores.evade': true,
    'persona.claimed': false,
  },
  policy_lead: {
    'l1.category': true,
    'l2.subcategory': true,
    'l3.method': true,
    'l3.tactic': true,
    'l3.target': true,
    'l3.overlap': true,
    'reason_codes': true,
    'disposition.action': true,
    'evidence.aggregate_score': true,
    'evidence.component_scores.target': true,
    'evidence.component_scores.lure': true,
    'evidence.component_scores.trust': true,
    'evidence.component_scores.extract': true,
    'evidence.component_scores.evade': true,
    'persona.claimed': true,
  },
  qa_reviewer: {
    'l1.category': false,
    'l2.subcategory': false,
    'l3.method': false,
    'l3.tactic': false,
    'l3.target': false,
    'l3.overlap': false,
    'reason_codes': false,
    'disposition.action': false,
    'evidence.aggregate_score': false,
    'evidence.component_scores.target': false,
    'evidence.component_scores.lure': false,
    'evidence.component_scores.trust': false,
    'evidence.component_scores.extract': false,
    'evidence.component_scores.evade': false,
    'persona.claimed': false,
  },
};

describe('canEdit() permission matrix', () => {
  for (const role of EDITOR_ROLES) {
    for (const fieldPath of FIELD_PATHS) {
      const expected = EXPECTED[role][fieldPath];
      const verdict = expected ? 'allow' : 'deny';
      it(`${verdict}: ${role} editing ${fieldPath}`, () => {
        expect(canEdit(role, fieldPath)).toBe(expected);
      });
    }
  }
});

describe('canEdit() indexed reason_codes normalization', () => {
  it('senior_reviewer allowed on reason_codes[0]', () => {
    expect(canEdit('senior_reviewer', 'reason_codes[0]')).toBe(true);
  });

  it('senior_reviewer allowed on reason_codes[12]', () => {
    expect(canEdit('senior_reviewer', 'reason_codes[12]')).toBe(true);
  });

  it('policy_lead allowed on reason_codes[3]', () => {
    expect(canEdit('policy_lead', 'reason_codes[3]')).toBe(true);
  });

  it('qa_reviewer denied on reason_codes[0]', () => {
    expect(canEdit('qa_reviewer', 'reason_codes[0]')).toBe(false);
  });
});

describe('canEdit() unknown inputs', () => {
  it('returns false for an unknown editor_role', () => {
    expect(canEdit('admin' as never, 'l1.category')).toBe(false);
  });

  it('returns false for an unknown field_path', () => {
    expect(canEdit('senior_reviewer', 'audit_metadata.cache_key')).toBe(false);
  });

  it('returns false for an unknown field_path (typo of l1.category)', () => {
    expect(canEdit('policy_lead', 'l1.cateogry')).toBe(false);
  });
});

describe('EDITOR_ROLE_PERMISSIONS structural invariants', () => {
  it('every key is a valid EditorRole', () => {
    for (const role of Object.keys(EDITOR_ROLE_PERMISSIONS)) {
      expect(EDITOR_ROLES).toContain(role);
    }
  });

  it('every value is a Set', () => {
    for (const role of EDITOR_ROLES) {
      expect(EDITOR_ROLE_PERMISSIONS[role]).toBeInstanceOf(Set);
    }
  });

  it('every permitted field_path is in the FIELD_PATHS closed set', () => {
    for (const role of EDITOR_ROLES) {
      for (const fieldPath of EDITOR_ROLE_PERMISSIONS[role]) {
        expect(FIELD_PATHS).toContain(fieldPath);
      }
    }
  });

  it('qa_reviewer has an empty permission set (flag-only role)', () => {
    expect(EDITOR_ROLE_PERMISSIONS.qa_reviewer.size).toBe(0);
  });

  it('policy_lead has the largest permission set (everything except audit_metadata)', () => {
    expect(EDITOR_ROLE_PERMISSIONS.policy_lead.size).toBe(FIELD_PATHS.length);
  });

  it('senior_reviewer is a proper subset of policy_lead', () => {
    for (const fieldPath of EDITOR_ROLE_PERMISSIONS.senior_reviewer) {
      expect(EDITOR_ROLE_PERMISSIONS.policy_lead.has(fieldPath)).toBe(true);
    }
    expect(EDITOR_ROLE_PERMISSIONS.senior_reviewer.size).toBeLessThan(
      EDITOR_ROLE_PERMISSIONS.policy_lead.size,
    );
  });
});
