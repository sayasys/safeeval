// Testable core for the custom L3 classifier server actions (Phase 2 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 5 + 6 + 12.2. This module holds NO auth / session / Next.js
// dependency: every function takes the resolved org / user / role explicitly
// and threads an optional store seam, exactly like the Phase 1 persistence
// helpers. The thin 'use server' wrappers in actions.ts resolve the session and
// delegate here, and the unit tests drive these directly against the in-memory
// store. The split keeps the actions' auth-gating and the persistence-mapping
// logic independently testable.

import {
  createCustomClassifier,
  promoteToShadow,
  retireClassifier,
  CustomPatternsError,
  CustomPatternsValidationError,
  type CustomPatternsOptions,
  type CustomL3ClassifierWithExamples,
  type CustomL3Classifier,
  type NewCustomL3Example,
  type L3GroupName,
} from '@/lib/data/custom-patterns';
import type { OrgRole } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Result shape returned across the server-action boundary. Plain data so it is
// serializable from a server action back to the client form.
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
    message: 'Something went wrong saving this classifier. Please try again.',
  };
}

// ---------------------------------------------------------------------------
// Create.
// ---------------------------------------------------------------------------

export interface CreateClassifierInput {
  group_name: string;
  tag_name: string;
  definition: string;
  positives: string[];
  negatives: string[];
}

function buildExamples(input: CreateClassifierInput): NewCustomL3Example[] {
  const positives: NewCustomL3Example[] = input.positives
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text) => ({ kind: 'positive', text }));
  const negatives: NewCustomL3Example[] = input.negatives
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text) => ({ kind: 'negative', text }));
  return [...positives, ...negatives];
}

// Create a classifier in 'proposed' status with its examples. The group_name is
// passed through as-is; createCustomClassifier validates it against the closed
// set and throws CustomPatternsValidationError (mapped to a field failure) when
// it is not a member.
export async function runCreateClassifier(
  orgId: string,
  userId: string,
  input: CreateClassifierInput,
  options?: CustomPatternsOptions,
): Promise<ActionResult<CustomL3ClassifierWithExamples>> {
  try {
    const created = await createCustomClassifier(
      orgId,
      {
        group_name: input.group_name as L3GroupName,
        tag_name: input.tag_name,
        definition: input.definition,
        created_by_user_id: userId,
      },
      buildExamples(input),
      options,
    );
    return { ok: true, data: created };
  } catch (err) {
    return toFailure(err);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle transitions.
// ---------------------------------------------------------------------------

// proposed -> shadow. Surfaces the InsufficientExamplesError / invalid-transition
// failures as structured results the detail view can render inline.
export async function runPromoteToShadow(
  orgId: string,
  classifierId: string,
  options?: CustomPatternsOptions,
): Promise<ActionResult<CustomL3Classifier>> {
  try {
    const updated = await promoteToShadow(orgId, classifierId, options);
    return { ok: true, data: updated };
  } catch (err) {
    return toFailure(err);
  }
}

// Retire. The persistence layer enforces the owner/admin authority guard against
// the role it is handed (defense in depth behind the wrapper's requireOrgRole
// gate); a 'member'/'reviewer' role surfaces as a RETIREMENT_FORBIDDEN failure.
export async function runRetireClassifier(
  orgId: string,
  classifierId: string,
  actorRole: OrgRole,
  options?: CustomPatternsOptions,
): Promise<ActionResult<CustomL3Classifier>> {
  try {
    const updated = await retireClassifier(orgId, classifierId, actorRole, options);
    return { ok: true, data: updated };
  } catch (err) {
    return toFailure(err);
  }
}
