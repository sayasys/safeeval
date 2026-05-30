// Pattern composer client-validation -- coverage (Phase 3 UI).
//
// Exercises the pure validators in src/app/app/patterns/validation.ts. These run
// in the live form (inline feedback + submit gate); the persistence layer
// re-validates and is the source of truth, but the validators must mirror it so
// the customer sees an actionable message before the round-trip.

import { describe, it, expect } from 'vitest';
import {
  validatePatternName,
  validateTypology,
  validateComponents,
  validatePatternForm,
  isPatternFormValid,
  TYPOLOGY_MAX_LENGTH,
  type PatternComponentSelection,
} from '../../src/app/app/patterns/validation';

const okComponents: PatternComponentSelection[] = [
  { group_name: 'tactic', tag_id: 'trust_love', tag_source: 'closed_set' },
];

describe('validatePatternName', () => {
  it('accepts a friendly mixed-case name with spaces and hyphens', () => {
    expect(validatePatternName('Romance-crypto cross-pollination')).toBeNull();
  });

  it('rejects an empty name', () => {
    expect(validatePatternName('')).toBeTruthy();
    expect(validatePatternName('   ')).toBeTruthy();
  });

  it('rejects a name that does not start alphanumeric', () => {
    expect(validatePatternName('-leading-hyphen')).toBeTruthy();
  });

  it('rejects a name over 80 characters', () => {
    expect(validatePatternName('a'.repeat(81))).toBeTruthy();
  });

  it('rejects disallowed punctuation', () => {
    expect(validatePatternName('bad/name')).toBeTruthy();
  });
});

describe('validateTypology', () => {
  it('accepts a non-empty free-form typology', () => {
    expect(validateTypology('investment_fraud')).toBeNull();
  });

  it('rejects an empty typology', () => {
    expect(validateTypology('')).toBeTruthy();
    expect(validateTypology('   ')).toBeTruthy();
  });

  it('rejects a typology over the max length', () => {
    expect(validateTypology('x'.repeat(TYPOLOGY_MAX_LENGTH + 1))).toBeTruthy();
  });
});

describe('validateComponents', () => {
  it('accepts at least one well-formed component', () => {
    expect(validateComponents(okComponents)).toBeNull();
  });

  it('rejects an empty component list (a wildcard-everything pattern)', () => {
    expect(validateComponents([])).toBeTruthy();
  });

  it('rejects a component in an unknown group', () => {
    expect(
      validateComponents([
        { group_name: 'not_a_group' as PatternComponentSelection['group_name'], tag_id: 'x', tag_source: 'closed_set' },
      ]),
    ).toBeTruthy();
  });

  it('rejects a component missing its tag_id', () => {
    expect(
      validateComponents([{ group_name: 'tactic', tag_id: '', tag_source: 'closed_set' }]),
    ).toBeTruthy();
  });
});

describe('validatePatternForm / isPatternFormValid', () => {
  it('returns no errors for a fully valid form', () => {
    const values = {
      name: 'Romance-crypto cross-pollination',
      typology: 'investment_fraud',
      components: okComponents,
    };
    expect(validatePatternForm(values)).toEqual({});
    expect(isPatternFormValid(values)).toBe(true);
  });

  it('collects every field error at once', () => {
    const errors = validatePatternForm({ name: '', typology: '', components: [] });
    expect(errors.name).toBeTruthy();
    expect(errors.typology).toBeTruthy();
    expect(errors.components).toBeTruthy();
    expect(isPatternFormValid({ name: '', typology: '', components: [] })).toBe(false);
  });
});
