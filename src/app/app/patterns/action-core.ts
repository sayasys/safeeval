// Testable core for the pattern composer server actions (Phase 3 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 4 + 12.3. This module holds NO auth / session / Next.js dependency:
// every function takes the resolved org explicitly and threads an optional store
// seam, exactly like the Phase 1 persistence helpers. The thin 'use server'
// wrappers in actions.ts resolve the session and delegate here, and the unit
// tests drive these directly against the in-memory store. The split keeps the
// actions' auth-gating and the persistence-mapping logic independently testable.

import {
  createPattern,
  archivePattern,
  CustomPatternsError,
  CustomPatternsValidationError,
  type CustomPatternsOptions,
  type PatternWithComponents,
  type Pattern,
  type NewPatternComponent,
  type L3GroupName,
  type TagSource,
} from '../../../lib/data/custom-patterns';

// ---------------------------------------------------------------------------
// Result shape returned across the server-action boundary. Plain data so it is
// serializable from a server action back to the client form. Mirrors the
// Phase 2 classifier action-core ActionResult exactly.
// ---------------------------------------------------------------------------

export interface ActionSuccess<T> {
  ok: true;
  data: T;
}

export interface ActionFailure {
  ok: false;
  // Stable machine code (mirrors CustomPatternsErrorCode plus the auth + generic
  // codes the wrapper adds). The client switches copy off this, not the message.
  code: string;
  // Present for field-level validation failures so the form can attach the
  // message to the offending input.
  field?: string;
  message: string;
}

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

// Map any thrown error to a structured failure. Known CustomPatternsError codes
// pass through with their message (which is already customer-readable); anything
// else (store failure, unexpected) collapses to a generic INTERNAL so a raw
// database string never reaches the customer.
export function toFailure(err: unknown): ActionFailure {
  if (err instanceof CustomPatternsValidationError) {
    return { ok: false, code: err.code, field: err.field, message: err.message };
  }
  if (err instanceof CustomPatternsError) {
    return { ok: false, code: err.code, message: err.message };
  }
  return {
    ok: false,
    code: 'INTERNAL',
    message: 'Something went wrong saving this pattern. Please try again.',
  };
}

// ---------------------------------------------------------------------------
// Create.
// ---------------------------------------------------------------------------

export interface CreatePatternComponentInput {
  group_name: string;
  tag_id: string;
  tag_source: string;
}

export interface CreatePatternInput {
  name: string;
  typology: string;
  components: CreatePatternComponentInput[];
}

// A pattern with zero components matches every evaluation (memo 4.1: an empty
// checklist), which is meaningless. The client form enforces this too, but the
// core is the boundary the tests drive, so the guard lives here and surfaces as
// a field-level VALIDATION failure the form can attach to the composer.
function assertHasComponents(components: CreatePatternComponentInput[]): void {
  if (!Array.isArray(components) || components.length === 0) {
    throw new CustomPatternsValidationError(
      'components',
      'a pattern must compose at least one component',
    );
  }
}

// Create a Pattern at status 'active' (memo 3.1 -- patterns need no calibration
// period; a composition rule is usable the moment it exists). match_mode is
// hardcoded to 'subset' in this phase (memo 12.3; the 'weighted' toggle is
// Phase 5). The group_name / tag_source values are passed through as-is;
// createPattern validates them against the closed sets and throws
// CustomPatternsValidationError (mapped to a field failure) on a bad member.
export async function runCreatePattern(
  orgId: string,
  input: CreatePatternInput,
  options?: CustomPatternsOptions,
): Promise<ActionResult<PatternWithComponents>> {
  try {
    assertHasComponents(input.components);
    const components: NewPatternComponent[] = input.components.map((c) => ({
      group_name: c.group_name as L3GroupName,
      tag_id: c.tag_id,
      tag_source: c.tag_source as TagSource,
    }));
    const created = await createPattern(
      orgId,
      {
        name: input.name,
        typology: input.typology,
        match_mode: 'subset',
        components,
      },
      options,
    );
    return { ok: true, data: created };
  } catch (err) {
    return toFailure(err);
  }
}

// ---------------------------------------------------------------------------
// Archive (active -> archived). The only Phase 3 lifecycle transition: a Pattern
// has no shadow/live calibration path (that is the custom-classifier lifecycle),
// so 'active' is the create state and 'archived' is the terminal one. Surfaces a
// missing pattern as a PATTERN_NOT_FOUND failure the detail view renders inline.
// ---------------------------------------------------------------------------
export async function runArchivePattern(
  orgId: string,
  patternId: string,
  options?: CustomPatternsOptions,
): Promise<ActionResult<Pattern>> {
  try {
    const updated = await archivePattern(orgId, patternId, options);
    return { ok: true, data: updated };
  } catch (err) {
    return toFailure(err);
  }
}
