'use server';

// Server actions for the custom L3 classifier surface (Phase 2 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 5 + 6 + 12.2. Each action resolves the session-scoped organization,
// user, and role through the provider-agnostic auth module, enforces the
// required role with requireOrgRole, then delegates the persistence work to the
// dependency-injected core in action-core.ts. The core returns a structured
// ActionResult so the client form / detail view can render failures inline.
//
// The definition flow and the proposed -> shadow transition are owner/admin
// gated (memo sections 6.1 + 12.2). Retirement is owner/admin only (Q13); the
// persistence layer re-checks the role it is handed as defense in depth.

import { redirect } from 'next/navigation';
import {
  requireOrgRole,
  getOrganization,
  getCurrentUser,
  UnauthorizedError,
  ForbiddenError,
  type OrgRole,
} from '@/lib/auth';
import {
  runCreateClassifier,
  runPromoteToShadow,
  runPromoteToLive,
  runRetireClassifier,
  type ActionResult,
  type ActionFailure,
  type CreateClassifierInput,
} from './action-core';
import type {
  CustomL3Classifier,
} from '@/lib/data/custom-patterns';

// Map an auth-layer throw to the structured failure the client renders. Keeps
// the wrapper bodies free of try/catch noise around the gate.
function mapAuthError(err: unknown): ActionFailure {
  if (err instanceof ForbiddenError) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message:
        'You need the owner or admin role in this organization to manage custom classifiers.',
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

interface WriteContext {
  orgId: string;
  userId: string;
}

// Resolve the org + user for a write, gating on the minimum role. Throws the
// auth errors mapAuthError understands.
async function resolveWriteContext(minRole: OrgRole): Promise<WriteContext> {
  await requireOrgRole(minRole);
  const [org, user] = await Promise.all([getOrganization(), getCurrentUser()]);
  if (!org || !user) throw new UnauthorizedError();
  return { orgId: org.id, userId: user.auth_user_id };
}

// Determine the caller's precise owner/admin role for the retire authority
// argument, using only the public auth API. requireOrgRole('owner') passing
// means owner; otherwise requireOrgRole('admin') gates to admin (and throws
// ForbiddenError for member/reviewer, which the caller maps).
async function resolveAdminRole(): Promise<OrgRole> {
  try {
    await requireOrgRole('owner');
    return 'owner';
  } catch (err) {
    // A non-owner surfaces ForbiddenError here -- fall through to the admin
    // gate. A missing session surfaces UnauthorizedError, which must propagate.
    if (err instanceof UnauthorizedError) throw err;
  }
  await requireOrgRole('admin');
  return 'admin';
}

// ---------------------------------------------------------------------------
// Create. On success redirects to the new detail view (so this branch never
// returns); on failure returns the structured result with form state intact.
// ---------------------------------------------------------------------------
export async function createClassifierAction(
  input: CreateClassifierInput,
): Promise<ActionResult<{ id: string }>> {
  let ctx: WriteContext;
  try {
    ctx = await resolveWriteContext('admin');
  } catch (err) {
    return mapAuthError(err);
  }

  const result = await runCreateClassifier(ctx.orgId, ctx.userId, input);
  if (!result.ok) return result;

  // Outside any try/catch: redirect() throws NEXT_REDIRECT by design.
  redirect(`/app/classifiers/${result.data.id}`);
}

// ---------------------------------------------------------------------------
// proposed -> shadow.
// ---------------------------------------------------------------------------
export async function promoteToShadowAction(
  classifierId: string,
): Promise<ActionResult<CustomL3Classifier>> {
  let ctx: WriteContext;
  try {
    ctx = await resolveWriteContext('admin');
  } catch (err) {
    return mapAuthError(err);
  }
  return runPromoteToShadow(ctx.orgId, classifierId);
}

// ---------------------------------------------------------------------------
// shadow -> live. Owner/admin gated (memo 6.4). The "I accept calibration risk"
// acknowledgment is collected client-side before this action fires; the
// server-side gate (promoteToLive) is the bright line, not the checkbox.
// ---------------------------------------------------------------------------
export async function promoteToLiveAction(
  classifierId: string,
): Promise<ActionResult<CustomL3Classifier>> {
  let ctx: WriteContext;
  try {
    ctx = await resolveWriteContext('admin');
  } catch (err) {
    return mapAuthError(err);
  }
  return runPromoteToLive(ctx.orgId, classifierId);
}

// ---------------------------------------------------------------------------
// Retire (owner/admin only).
// ---------------------------------------------------------------------------
export async function retireClassifierAction(
  classifierId: string,
): Promise<ActionResult<CustomL3Classifier>> {
  let orgId: string;
  let role: OrgRole;
  try {
    const org = await getOrganization();
    if (!org) throw new UnauthorizedError();
    orgId = org.id;
    role = await resolveAdminRole();
  } catch (err) {
    return mapAuthError(err);
  }
  return runRetireClassifier(orgId, classifierId, role);
}
