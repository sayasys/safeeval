'use server';

// Server actions for the pattern composer surface (Phase 3 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 4 + 12.3 + Q13. Each mutating action resolves the session-scoped
// organization and role through the provider-agnostic auth module, enforces the
// owner/admin role with requireOrgRole, then delegates the persistence work to
// the dependency-injected core in action-core.ts. The core returns a structured
// ActionResult so the client form / detail view can render failures inline.
//
// Authority (Q13): owner/admin may compose and archive patterns; member/reviewer
// may view but not mutate. A pattern carries no per-component calibration, so
// there is no shadow/live promotion action here -- only create and archive.

import { redirect } from 'next/navigation';
import {
  requireOrgRole,
  getOrganization,
  UnauthorizedError,
  ForbiddenError,
  type OrgRole,
} from '@/lib/auth';
import {
  runCreatePattern,
  runArchivePattern,
  type ActionResult,
  type ActionFailure,
  type CreatePatternInput,
} from './action-core';
import type { Pattern } from '@/lib/data/custom-patterns';

// Map an auth-layer throw to the structured failure the client renders. Keeps
// the wrapper bodies free of try/catch noise around the gate.
function mapAuthError(err: unknown): ActionFailure {
  if (err instanceof ForbiddenError) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message:
        'You need the owner or admin role in this organization to manage patterns.',
    };
  }
  if (err instanceof UnauthorizedError) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'You must be signed in.' };
  }
  // Anything else from the auth layer is unexpected; do not leak it.
  return {
    ok: false,
    code: 'INTERNAL',
    message: 'Something went wrong. Please try again.',
  };
}

// Resolve the org for a write, gating on the minimum role. Throws the auth
// errors mapAuthError understands.
async function resolveWriteOrgId(minRole: OrgRole): Promise<string> {
  await requireOrgRole(minRole);
  const org = await getOrganization();
  if (!org) throw new UnauthorizedError();
  return org.id;
}

// ---------------------------------------------------------------------------
// Create. On success redirects to the new detail view (so this branch never
// returns); on failure returns the structured result with form state intact.
// ---------------------------------------------------------------------------
export async function createPatternAction(
  input: CreatePatternInput,
): Promise<ActionResult<{ id: string }>> {
  let orgId: string;
  try {
    orgId = await resolveWriteOrgId('admin');
  } catch (err) {
    return mapAuthError(err);
  }

  const result = await runCreatePattern(orgId, input);
  if (!result.ok) return result;

  // Outside any try/catch: redirect() throws NEXT_REDIRECT by design.
  redirect(`/app/patterns/${result.data.id}`);
}

// ---------------------------------------------------------------------------
// Archive (active -> archived). Owner/admin only.
// ---------------------------------------------------------------------------
export async function archivePatternAction(
  patternId: string,
): Promise<ActionResult<Pattern>> {
  let orgId: string;
  try {
    orgId = await resolveWriteOrgId('admin');
  } catch (err) {
    return mapAuthError(err);
  }
  return runArchivePattern(orgId, patternId);
}
