// recordEdit() validation + auth-gate tests.
//
// Coverage:
//   - happy path: senior_reviewer editing a permitted field returns edit_id + 'pending'
//   - happy path: policy_lead editing a permitted field returns edit_id + 'pending'
//   - happy path: indexed reason_codes path is normalized for the permission check
//   - happy path: rationale_tag='other' with rationale_text succeeds
//   - happy path: change_type='add' with before_value=null succeeds
//   - happy path: change_type='remove' with after_value=null succeeds
//   - reject: unknown field_path
//   - reject: unknown rationale_tag
//   - reject: rationale_tag='other' without rationale_text
//   - reject: change_type=add with non-null before_value
//   - reject: change_type=remove with non-null after_value
//   - reject: change_type=modify with null before_value or after_value
//   - reject: unknown editor_role
//   - reject: missing editor_context
//   - reject: senior_reviewer trying to edit l3.method (auth-gate fires)
//   - reject: policy_lead trying to edit audit_metadata (not in closed set)
//   - reject: qa_reviewer trying to edit any field (flag-only role)
//   - EditorRoleGateError carries editor_role and field_path properties
//   - MalformedNotationError carries reason and detail properties

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordEdit,
  EditorRoleGateError,
  MalformedNotationError,
  type RecordEditInput,
} from '../../src/lib/feedback';
import { _resetSyntheticEditIdCounterForTests } from '../../src/lib/feedback/recordEdit';

function baseInput(): RecordEditInput {
  return {
    evaluation_id: 'eval_123',
    field_path: 'l1.category',
    change_type: 'modify',
    before_value: 'privacy_abuse',
    after_value: 'deceptive_fraud',
    rationale_tag: 'wrong_l1_category',
    editor_context: {
      editor_id: 'sr-alice',
      role: 'senior_reviewer',
    },
  };
}

describe('recordEdit() happy paths', () => {
  beforeEach(() => {
    _resetSyntheticEditIdCounterForTests();
  });

  it('senior_reviewer editing l1.category succeeds and returns edit_id=1 + pending', () => {
    const result = recordEdit(baseInput());
    expect(result.edit_id).toBe(1);
    expect(result.propagation_status).toBe('pending');
  });

  it('subsequent calls return monotonically increasing edit_ids', () => {
    const a = recordEdit(baseInput());
    const b = recordEdit(baseInput());
    const c = recordEdit(baseInput());
    expect(a.edit_id).toBe(1);
    expect(b.edit_id).toBe(2);
    expect(c.edit_id).toBe(3);
  });

  it('policy_lead editing l3.method succeeds (senior_reviewer would be denied)', () => {
    const result = recordEdit({
      ...baseInput(),
      field_path: 'l3.method',
      before_value: 'phishing',
      after_value: 'vishing',
      rationale_tag: 'wrong_l3_method',
      editor_context: { editor_id: 'pl-bob', role: 'policy_lead' },
    });
    expect(result.edit_id).toBeGreaterThan(0);
    expect(result.propagation_status).toBe('pending');
  });

  it('indexed reason_codes path is normalized for the permission check', () => {
    const result = recordEdit({
      ...baseInput(),
      field_path: 'reason_codes[2]',
      change_type: 'add',
      before_value: null,
      after_value: 'impersonation_authority_figure',
      rationale_tag: 'missing_reason_code',
    });
    expect(result.edit_id).toBeGreaterThan(0);
  });

  it("rationale_tag='other' with non-empty rationale_text succeeds", () => {
    const result = recordEdit({
      ...baseInput(),
      rationale_tag: 'other',
      rationale_text: 'this case needs a new closed-set entry for charity_fraud',
    });
    expect(result.edit_id).toBeGreaterThan(0);
  });

  it("change_type='add' with before_value=null succeeds", () => {
    const result = recordEdit({
      ...baseInput(),
      field_path: 'reason_codes[0]',
      change_type: 'add',
      before_value: null,
      after_value: 'urgency_lever',
      rationale_tag: 'missing_reason_code',
    });
    expect(result.edit_id).toBeGreaterThan(0);
  });

  it("change_type='remove' with after_value=null succeeds", () => {
    const result = recordEdit({
      ...baseInput(),
      field_path: 'reason_codes[3]',
      change_type: 'remove',
      before_value: 'synthetic_identity_construction',
      after_value: null,
      rationale_tag: 'extra_reason_code',
    });
    expect(result.edit_id).toBeGreaterThan(0);
  });
});

describe('recordEdit() notation validation', () => {
  it('rejects unknown field_path with unknown_field_path reason', () => {
    expect(() =>
      recordEdit({
        ...baseInput(),
        field_path: 'audit_metadata.cache_key',
      }),
    ).toThrow(MalformedNotationError);
    try {
      recordEdit({
        ...baseInput(),
        field_path: 'audit_metadata.cache_key',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(e.reason).toBe('unknown_field_path');
      expect(e.detail).toContain('audit_metadata.cache_key');
    }
  });

  it('rejects pii_redaction_log as a field_path (explicitly NOT editable)', () => {
    expect(() =>
      recordEdit({
        ...baseInput(),
        field_path: 'pii_redaction_log',
      }),
    ).toThrow(/unknown_field_path/);
  });

  it('rejects unknown rationale_tag with unknown_rationale_tag reason', () => {
    try {
      recordEdit({
        ...baseInput(),
        rationale_tag: 'this_tag_does_not_exist',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(e.reason).toBe('unknown_rationale_tag');
    }
  });

  it("rejects rationale_tag='other' without rationale_text", () => {
    try {
      recordEdit({
        ...baseInput(),
        rationale_tag: 'other',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(e.reason).toBe('rationale_text_required_for_other');
    }
  });

  it("rejects rationale_tag='other' with empty rationale_text", () => {
    try {
      recordEdit({
        ...baseInput(),
        rationale_tag: 'other',
        rationale_text: '',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(e.reason).toBe('rationale_text_required_for_other');
    }
  });

  it("rejects change_type='add' with non-null before_value", () => {
    try {
      recordEdit({
        ...baseInput(),
        change_type: 'add',
        before_value: 'something',
        after_value: 'something_else',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(e.reason).toBe('change_type_nullness_violation');
    }
  });

  it("rejects change_type='remove' with non-null after_value", () => {
    try {
      recordEdit({
        ...baseInput(),
        change_type: 'remove',
        before_value: 'something',
        after_value: 'something_else',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(e.reason).toBe('change_type_nullness_violation');
    }
  });

  it("rejects change_type='modify' with null before_value", () => {
    try {
      recordEdit({
        ...baseInput(),
        change_type: 'modify',
        before_value: null,
        after_value: 'after',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(e.reason).toBe('change_type_nullness_violation');
    }
  });

  it("rejects change_type='modify' with null after_value", () => {
    try {
      recordEdit({
        ...baseInput(),
        change_type: 'modify',
        before_value: 'before',
        after_value: null,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(e.reason).toBe('change_type_nullness_violation');
    }
  });

  it('rejects unknown editor_role', () => {
    try {
      recordEdit({
        ...baseInput(),
        editor_context: { editor_id: 'rogue', role: 'rogue_role' as never },
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(e.reason).toBe('unknown_editor_role');
    }
  });

  it('rejects missing evaluation_id', () => {
    try {
      recordEdit({ ...baseInput(), evaluation_id: '' });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(e.reason).toBe('missing_evaluation_id');
    }
  });

  it('rejects missing editor_context', () => {
    const input = { ...baseInput() } as Partial<RecordEditInput>;
    delete input.editor_context;
    try {
      recordEdit(input as RecordEditInput);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(e.reason).toBe('missing_editor_context');
    }
  });

  it('rejects missing editor_id', () => {
    try {
      recordEdit({
        ...baseInput(),
        editor_context: { editor_id: '', role: 'senior_reviewer' },
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(e.reason).toBe('missing_editor_id');
    }
  });

  it('rejects invalid change_type', () => {
    try {
      recordEdit({
        ...baseInput(),
        change_type: 'frobnicate' as never,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(e.reason).toBe('invalid_change_type');
    }
  });
});

describe('recordEdit() auth gate (EditorRoleGateError)', () => {
  it('senior_reviewer editing l3.method throws EditorRoleGateError', () => {
    expect(() =>
      recordEdit({
        ...baseInput(),
        field_path: 'l3.method',
        before_value: 'phishing',
        after_value: 'vishing',
        rationale_tag: 'wrong_l3_method',
      }),
    ).toThrow(EditorRoleGateError);
  });

  it('senior_reviewer editing l3.target throws EditorRoleGateError', () => {
    expect(() =>
      recordEdit({
        ...baseInput(),
        field_path: 'l3.target',
        before_value: 'general_individual',
        after_value: 'elderly_individual',
        rationale_tag: 'wrong_l3_target',
      }),
    ).toThrow(EditorRoleGateError);
  });

  it('senior_reviewer editing persona.claimed throws EditorRoleGateError', () => {
    expect(() =>
      recordEdit({
        ...baseInput(),
        field_path: 'persona.claimed',
        before_value: 'authority',
        after_value: 'lawyer',
        rationale_tag: 'persona_misidentified',
      }),
    ).toThrow(EditorRoleGateError);
  });

  it('qa_reviewer cannot edit ANY field (flag-only role)', () => {
    expect(() =>
      recordEdit({
        ...baseInput(),
        editor_context: { editor_id: 'qa-charlie', role: 'qa_reviewer' },
      }),
    ).toThrow(EditorRoleGateError);
  });

  it('EditorRoleGateError carries editor_role and field_path properties', () => {
    try {
      recordEdit({
        ...baseInput(),
        field_path: 'l3.method',
        before_value: 'phishing',
        after_value: 'vishing',
        rationale_tag: 'wrong_l3_method',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EditorRoleGateError);
      const e = err as EditorRoleGateError;
      expect(e.editor_role).toBe('senior_reviewer');
      expect(e.field_path).toBe('l3.method');
      expect(e.name).toBe('EditorRoleGateError');
      expect(e.message).toContain('senior_reviewer');
      expect(e.message).toContain('l3.method');
      expect(e.message).toContain('section 3.17');
    }
  });

  it('EditorRoleGateError name is the literal string', () => {
    try {
      recordEdit({
        ...baseInput(),
        editor_context: { editor_id: 'qa-x', role: 'qa_reviewer' },
      });
      throw new Error('expected throw');
    } catch (err) {
      const e = err as EditorRoleGateError;
      expect(e.name).toBe('EditorRoleGateError');
    }
  });
});

describe('MalformedNotationError shape', () => {
  it('carries reason and detail properties', () => {
    try {
      recordEdit({
        ...baseInput(),
        field_path: 'audit_metadata.cache_key',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedNotationError);
      const e = err as MalformedNotationError;
      expect(typeof e.reason).toBe('string');
      expect(typeof e.detail).toBe('string');
      expect(e.detail.length).toBeGreaterThan(0);
      expect(e.name).toBe('MalformedNotationError');
      expect(e.message).toContain('docs/08-v5-ontology.md');
    }
  });
});
