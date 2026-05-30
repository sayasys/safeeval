// Client-side validation for the pattern composer form (Phase 3 UI). Pure
// functions, no React, no DOM -- so they are unit-testable in the node vitest
// environment and shared between the live form (inline feedback) and the submit
// gate.
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 3.1 (name CHECK, typology) + 3.2 (components) + 4.1 (Subset: a
// pattern with zero components matches everything, which is meaningless, so at
// least one component is required) + 12.3. These mirror the Phase 1 schema-layer
// checks (src/lib/data/custom-patterns/constants.ts) so the customer gets an
// actionable message BEFORE the round-trip; the persistence layer re-validates
// and is the source of truth.

import {
  PATTERN_NAME_PATTERN,
  L3_GROUP_NAMES,
} from '../../../lib/data/custom-patterns';
import type {
  L3GroupName,
  TagSource,
} from '../../../lib/data/custom-patterns';

// org_patterns.name CHECK is 1-80 chars, alphanumeric-leading, letters/digits/
// spaces/underscores/hyphens (constants.ts PATTERN_NAME_PATTERN).
export const PATTERN_NAME_MAX_LENGTH = 80;
export const PATTERN_NAME_HELP =
  'A friendly label, 1-80 characters: letters, digits, spaces, underscores, or hyphens, starting with a letter or digit. Example: Romance-crypto cross-pollination.';

// typology is free-form text in Phase 3 (memo 3.1 validates it against the
// ontology section 3.9 closed set at the application layer in a later phase; the
// Q13 deferral makes Phase 3 free-form, tightened to a checkLockstep dropdown in
// Phase 4). The DDL has no length CHECK; the form holds it to a sane 1-40.
export const TYPOLOGY_MIN_LENGTH = 1;
export const TYPOLOGY_MAX_LENGTH = 40;
export const TYPOLOGY_HELP =
  'The fraud typology this pattern composes (free-form for now; becomes a closed-set picker in a later phase). Example: investment_fraud.';

// A single composed component: which closed-set or org-custom tag, in which
// group. The form tracks selections per group; this is the flattened shape that
// the submit gate and the server action consume.
export interface PatternComponentSelection {
  group_name: L3GroupName;
  tag_id: string;
  tag_source: TagSource;
}

// Returns an error string, or null when the value is valid. null = OK keeps the
// call sites terse.

export function validatePatternName(value: string): string | null {
  if (!value || value.trim().length === 0) return 'Enter a pattern name.';
  if (!PATTERN_NAME_PATTERN.test(value)) return PATTERN_NAME_HELP;
  return null;
}

export function validateTypology(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < TYPOLOGY_MIN_LENGTH) return 'Enter a typology.';
  if (trimmed.length > TYPOLOGY_MAX_LENGTH) {
    return `Typology must be at most ${TYPOLOGY_MAX_LENGTH} characters.`;
  }
  return null;
}

// At least one component must be composed across all groups -- a pattern with no
// components is a checklist with no items and would match every evaluation
// (memo 4.1). Unspecified groups are wildcards; the whole-pattern wildcard is
// disallowed.
export function validateComponents(
  components: PatternComponentSelection[],
): string | null {
  if (!Array.isArray(components) || components.length === 0) {
    return 'Add at least one component from any group. A pattern needs something to match on.';
  }
  for (const c of components) {
    if (!L3_GROUP_NAMES.includes(c.group_name)) {
      return 'A selected component is in an unknown group.';
    }
    if (typeof c.tag_id !== 'string' || c.tag_id.length === 0) {
      return 'A selected component is missing its tag.';
    }
  }
  return null;
}

export interface PatternFormValues {
  name: string;
  typology: string;
  components: PatternComponentSelection[];
}

export interface PatternFormErrors {
  name?: string;
  typology?: string;
  components?: string;
}

// Whole-form validation used by the submit gate. Returns a map of field ->
// message; an empty map means the form is submittable.
export function validatePatternForm(values: PatternFormValues): PatternFormErrors {
  const errors: PatternFormErrors = {};
  const name = validatePatternName(values.name);
  if (name) errors.name = name;
  const typology = validateTypology(values.typology);
  if (typology) errors.typology = typology;
  const components = validateComponents(values.components);
  if (components) errors.components = components;
  return errors;
}

export function isPatternFormValid(values: PatternFormValues): boolean {
  return Object.keys(validatePatternForm(values)).length === 0;
}
