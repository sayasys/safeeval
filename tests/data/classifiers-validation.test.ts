// Custom L3 classifier definition form -- validation coverage (Phase 2 UI).
//
// Drives the pure validators in src/app/app/classifiers/validation.ts. These
// run in the node vitest environment (no DOM): the form's inline feedback and
// submit gate are thin wrappers over these functions, so exercising them
// directly is the meaningful unit boundary without a React renderer.

import { describe, it, expect } from 'vitest';
import {
  validateGroupName,
  validateTagName,
  validateDefinition,
  validateExampleText,
  validateExampleList,
  validateBrightLineIndicator,
  validateConflictTag,
  validateOptionalList,
  validateClassifierForm,
  isFormValid,
  DEFINITION_MIN_LENGTH,
  DEFINITION_MAX_LENGTH,
  EXAMPLE_MAX_LENGTH,
  BRIGHT_LINE_MAX_LENGTH,
  BRIGHT_LINE_INDICATORS_MAX,
  CONFLICTS_WITH_MAX,
  type ClassifierFormValues,
} from '../../src/app/app/classifiers/validation';

function validValues(overrides: Partial<ClassifierFormValues> = {}): ClassifierFormValues {
  return {
    group_name: 'tactic',
    tag_name: 'loyalty_token_promo',
    definition: 'd'.repeat(DEFINITION_MIN_LENGTH + 5),
    positives: ['fires on this', 'and this'],
    negatives: ['not this', 'nor this'],
    ...overrides,
  };
}

describe('validateGroupName', () => {
  it('accepts a closed-set group', () => {
    expect(validateGroupName('method')).toBeNull();
    expect(validateGroupName('risk_marker')).toBeNull();
  });
  it('rejects empty and out-of-set values', () => {
    expect(validateGroupName('')).toBeTruthy();
    expect(validateGroupName('bogus_group')).toBeTruthy();
  });
});

describe('validateTagName', () => {
  it('accepts snake_case ASCII within length', () => {
    expect(validateTagName('synthetic_celebrity_endorsement')).toBeNull();
    expect(validateTagName('a')).toBeNull();
  });
  it('rejects empty', () => {
    expect(validateTagName('')).toBe('Enter a tag name.');
  });
  it('rejects uppercase, hyphens, and leading digits', () => {
    expect(validateTagName('Bad_Tag')).toBeTruthy();
    expect(validateTagName('bad-tag')).toBeTruthy();
    expect(validateTagName('1tag')).toBeTruthy();
  });
  it('rejects over 40 characters', () => {
    expect(validateTagName('a'.repeat(41))).toBeTruthy();
    expect(validateTagName('a'.repeat(40))).toBeNull();
  });
});

describe('validateDefinition', () => {
  it('accepts a definition at the bounds', () => {
    expect(validateDefinition('d'.repeat(DEFINITION_MIN_LENGTH))).toBeNull();
    expect(validateDefinition('d'.repeat(DEFINITION_MAX_LENGTH))).toBeNull();
  });
  it('rejects too short and too long', () => {
    expect(validateDefinition('d'.repeat(DEFINITION_MIN_LENGTH - 1))).toBeTruthy();
    expect(validateDefinition('d'.repeat(DEFINITION_MAX_LENGTH + 1))).toBeTruthy();
  });
});

describe('validateExampleText', () => {
  it('accepts a normal example', () => {
    expect(validateExampleText('a representative input')).toBeNull();
  });
  it('rejects empty and over-length', () => {
    expect(validateExampleText('')).toBe('Example cannot be empty.');
    expect(validateExampleText('x'.repeat(EXAMPLE_MAX_LENGTH + 1))).toBeTruthy();
  });
});

describe('validateExampleList', () => {
  it('accepts at least two non-empty rows', () => {
    expect(validateExampleList(['a', 'b'], 'positive')).toBeNull();
  });
  it('requires at least two filled rows', () => {
    expect(validateExampleList(['a'], 'positive')).toBe(
      'Add at least 2 positive examples.',
    );
    expect(validateExampleList(['a', '', '   '], 'positive')).toBeTruthy();
  });
  it('reports an over-length filled row', () => {
    expect(validateExampleList(['a', 'x'.repeat(EXAMPLE_MAX_LENGTH + 1)], 'negative')).toBeTruthy();
  });
});

// --- Optional fields (memo 5.5 / 5.6), backfilled in M14 -------------------

describe('validateBrightLineIndicator', () => {
  it('accepts a normal phrase and treats empty as not-an-error (optional)', () => {
    expect(validateBrightLineIndicator('trust me bro')).toBeNull();
    expect(validateBrightLineIndicator('')).toBeNull();
  });
  it('accepts a phrase at the length bound and rejects one over it', () => {
    expect(validateBrightLineIndicator('x'.repeat(BRIGHT_LINE_MAX_LENGTH))).toBeNull();
    expect(validateBrightLineIndicator('x'.repeat(BRIGHT_LINE_MAX_LENGTH + 1))).toBeTruthy();
  });
  it('rejects non-ASCII characters', () => {
    // U+2014 (em dash) is non-ASCII; built from a char code so the source file
    // itself stays ASCII-safe.
    const emDash = String.fromCharCode(0x2014);
    expect(validateBrightLineIndicator(`urgent${emDash}now`)).toBeTruthy();
  });
});

describe('validateConflictTag', () => {
  it('accepts a snake_case tag and treats empty as not-an-error (optional)', () => {
    expect(validateConflictTag('pig_butchering')).toBeNull();
    expect(validateConflictTag('')).toBeNull();
  });
  it('rejects uppercase, hyphens, and over-length names', () => {
    expect(validateConflictTag('Pig_Butchering')).toBeTruthy();
    expect(validateConflictTag('pig-butchering')).toBeTruthy();
    expect(validateConflictTag('a'.repeat(41))).toBeTruthy();
  });
});

describe('validateOptionalList', () => {
  it('accepts an empty list and ignores blank rows', () => {
    expect(validateOptionalList([], 5, 'items', validateConflictTag)).toBeNull();
    expect(validateOptionalList(['', '   '], 5, 'items', validateConflictTag)).toBeNull();
  });
  it('rejects more than the cap of non-empty rows', () => {
    const tooMany = Array.from({ length: CONFLICTS_WITH_MAX + 1 }, (_, i) => `tag_${i}`);
    expect(validateOptionalList(tooMany, CONFLICTS_WITH_MAX, 'tags', validateConflictTag)).toBeTruthy();
  });
  it('reports the first invalid non-empty entry', () => {
    expect(
      validateOptionalList(['ok_tag', 'Bad-Tag'], CONFLICTS_WITH_MAX, 'tags', validateConflictTag),
    ).toBeTruthy();
  });
});

describe('validateClassifierForm / isFormValid', () => {
  it('returns no errors for a fully valid form', () => {
    expect(validateClassifierForm(validValues())).toEqual({});
    expect(isFormValid(validValues())).toBe(true);
  });
  it('treats the optional fields as valid when absent or empty', () => {
    expect(validateClassifierForm(validValues({ bright_line_indicators: [], conflicts_with: [] }))).toEqual({});
    expect(
      validateClassifierForm(
        validValues({ bright_line_indicators: ['trust me bro'], conflicts_with: ['pig_butchering'] }),
      ),
    ).toEqual({});
  });
  it('surfaces an invalid optional entry as a field error', () => {
    const errors = validateClassifierForm(
      validValues({
        bright_line_indicators: [`urgent${String.fromCharCode(0x2014)}now`],
        conflicts_with: ['Bad-Tag'],
      }),
    );
    expect(Object.keys(errors).sort()).toEqual(['bright_line_indicators', 'conflicts_with'].sort());
    expect(isFormValid(validValues({ conflicts_with: ['Bad-Tag'] }))).toBe(false);
  });
  it('collects every offending field', () => {
    const errors = validateClassifierForm(
      validValues({
        group_name: '',
        tag_name: 'Bad-Tag',
        definition: 'short',
        positives: ['only one'],
        negatives: [],
      }),
    );
    expect(Object.keys(errors).sort()).toEqual(
      ['definition', 'group_name', 'negatives', 'positives', 'tag_name'].sort(),
    );
    expect(isFormValid(validValues({ tag_name: '' }))).toBe(false);
  });
});
