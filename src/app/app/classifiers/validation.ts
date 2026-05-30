// Client-side validation for the custom L3 classifier definition form
// (Phase 2 UI). Pure functions, no React, no DOM -- so they are unit-testable
// in the node vitest environment and shared between the live form (inline
// per-keystroke feedback) and the submit gate.
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 5 (definition flow). These mirror the Phase 1 schema-layer CHECK
// constraints (src/lib/data/custom-patterns/constants.ts) so the customer gets
// an actionable message BEFORE the round-trip; the persistence layer re-validates
// and is the source of truth.

import {
  TAG_NAME_PATTERN,
  DEFINITION_MIN_LENGTH,
  DEFINITION_MAX_LENGTH,
  MIN_EXAMPLES_PER_KIND,
  L3_GROUP_NAMES,
  ASCII_PRINTABLE_PATTERN,
  BRIGHT_LINE_MAX_LENGTH,
  BRIGHT_LINE_INDICATORS_MAX,
  CONFLICTS_WITH_MAX,
} from '../../../lib/data/custom-patterns';
import type { L3GroupName } from '../../../lib/data/custom-patterns';

// Per-example client cap. The persistence layer accepts up to 2000 chars; the
// form holds customers to a tighter 500 so examples stay representative rather
// than pasted documents (memo section 5.4).
export const EXAMPLE_MAX_LENGTH = 500;
export const EXAMPLE_MIN_LENGTH = 1;

export {
  DEFINITION_MIN_LENGTH,
  DEFINITION_MAX_LENGTH,
  MIN_EXAMPLES_PER_KIND,
  BRIGHT_LINE_MAX_LENGTH,
  BRIGHT_LINE_INDICATORS_MAX,
  CONFLICTS_WITH_MAX,
};

export const TAG_NAME_HELP =
  'Tag names must be snake_case, ASCII only, 1-40 characters. Example: synthetic_celebrity_endorsement.';

// Returns an error string, or null when the value is valid. null = OK keeps the
// call sites terse: `const err = validateTagName(v); if (err) ...`.

export function validateGroupName(value: string): string | null {
  if (!value) return 'Choose which L3 group this tag belongs to.';
  if (!L3_GROUP_NAMES.includes(value as L3GroupName)) {
    return 'Choose a valid L3 group.';
  }
  return null;
}

export function validateTagName(value: string): string | null {
  if (!value) return 'Enter a tag name.';
  if (!TAG_NAME_PATTERN.test(value)) return TAG_NAME_HELP;
  return null;
}

export function validateDefinition(value: string): string | null {
  const len = value.length;
  if (len < DEFINITION_MIN_LENGTH) {
    return `Add ${DEFINITION_MIN_LENGTH - len} more character${
      DEFINITION_MIN_LENGTH - len === 1 ? '' : 's'
    }. The definition must be at least ${DEFINITION_MIN_LENGTH} characters.`;
  }
  if (len > DEFINITION_MAX_LENGTH) {
    return `Remove ${len - DEFINITION_MAX_LENGTH} character${
      len - DEFINITION_MAX_LENGTH === 1 ? '' : 's'
    }. The definition must be at most ${DEFINITION_MAX_LENGTH} characters.`;
  }
  return null;
}

// A single example row. Empty rows are reported so the customer cannot submit a
// blank example; over-length rows are reported with the overflow count.
export function validateExampleText(value: string): string | null {
  if (value.length < EXAMPLE_MIN_LENGTH) return 'Example cannot be empty.';
  if (value.length > EXAMPLE_MAX_LENGTH) {
    return `Example must be at most ${EXAMPLE_MAX_LENGTH} characters.`;
  }
  return null;
}

// Validates a list of examples of one kind: at least MIN_EXAMPLES_PER_KIND
// non-empty rows, and every non-empty row within bounds. Returns the first
// blocking error, or null.
export function validateExampleList(
  values: string[],
  kindLabel: string,
): string | null {
  const filled = values.filter((v) => v.trim().length > 0);
  if (filled.length < MIN_EXAMPLES_PER_KIND) {
    return `Add at least ${MIN_EXAMPLES_PER_KIND} ${kindLabel} examples.`;
  }
  for (const v of filled) {
    const err = validateExampleText(v);
    if (err) return err;
  }
  return null;
}

// --- Optional fields (memo 5.5 / 5.6), backfilled in M14 -------------------

export const BRIGHT_LINE_HELP =
  'Phrases that should always match this tag if present in the input. Optional but powerful -- use sparingly.';
export const CONFLICTS_WITH_HELP =
  'Tag names that should be considered mutually exclusive with this one. Can reference closed-set L3 tags (e.g. pig_butchering) or your own custom tags.';

// A single bright-line indicator row (memo 5.5). Printable ASCII, <= 200 chars.
// Empty rows are not errors -- the field is optional and blank rows are dropped
// on submit; this validates only a row the customer has typed into.
export function validateBrightLineIndicator(value: string): string | null {
  if (value.length === 0) return null;
  if (value.length > BRIGHT_LINE_MAX_LENGTH) {
    return `Bright-line indicator must be at most ${BRIGHT_LINE_MAX_LENGTH} characters.`;
  }
  if (!ASCII_PRINTABLE_PATTERN.test(value)) {
    return 'Bright-line indicator must be printable ASCII only.';
  }
  return null;
}

// A single conflicts-with tag row (memo 5.6). snake_case ASCII tag-name shape.
export function validateConflictTag(value: string): string | null {
  if (value.length === 0) return null;
  if (!TAG_NAME_PATTERN.test(value)) {
    return 'Conflicting tag must be snake_case, ASCII only, 1-40 characters.';
  }
  return null;
}

// Validates an optional repeatable list: the count cap, then each non-empty row.
// Blank rows are ignored. Returns the first blocking error, or null.
export function validateOptionalList(
  values: string[],
  max: number,
  label: string,
  validateEntry: (v: string) => string | null,
): string | null {
  const filled = values.filter((v) => v.trim().length > 0);
  if (filled.length > max) {
    return `Add at most ${max} ${label}.`;
  }
  for (const v of filled) {
    const err = validateEntry(v);
    if (err) return err;
  }
  return null;
}

export interface ClassifierFormValues {
  group_name: string;
  tag_name: string;
  definition: string;
  positives: string[];
  negatives: string[];
  // Optional (memo 5.5 / 5.6). Default to [] when the section is untouched.
  bright_line_indicators?: string[];
  conflicts_with?: string[];
}

export interface FormErrors {
  group_name?: string;
  tag_name?: string;
  definition?: string;
  positives?: string;
  negatives?: string;
  bright_line_indicators?: string;
  conflicts_with?: string;
}

// Whole-form validation used by the submit gate. Returns a map of field ->
// message; an empty map means the form is submittable.
export function validateClassifierForm(values: ClassifierFormValues): FormErrors {
  const errors: FormErrors = {};
  const group = validateGroupName(values.group_name);
  if (group) errors.group_name = group;
  const tag = validateTagName(values.tag_name);
  if (tag) errors.tag_name = tag;
  const def = validateDefinition(values.definition);
  if (def) errors.definition = def;
  const pos = validateExampleList(values.positives, 'positive');
  if (pos) errors.positives = pos;
  const neg = validateExampleList(values.negatives, 'negative');
  if (neg) errors.negatives = neg;
  const bright = validateOptionalList(
    values.bright_line_indicators ?? [],
    BRIGHT_LINE_INDICATORS_MAX,
    'bright-line indicators',
    validateBrightLineIndicator,
  );
  if (bright) errors.bright_line_indicators = bright;
  const conflicts = validateOptionalList(
    values.conflicts_with ?? [],
    CONFLICTS_WITH_MAX,
    'conflicting tags',
    validateConflictTag,
  );
  if (conflicts) errors.conflicts_with = conflicts;
  return errors;
}

export function isFormValid(values: ClassifierFormValues): boolean {
  return Object.keys(validateClassifierForm(values)).length === 0;
}
