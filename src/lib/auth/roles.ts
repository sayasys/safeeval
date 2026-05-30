// Per-organization role enforcement (scoping memo section 3.1 + 6).
//
// requireOrgRole(role) throws UnauthorizedError (401) if there is no session
// and ForbiddenError (403) if the signed-in user is not a member of their
// current organization with at least the named role. Provider-agnostic: it
// reads the current user + organization through the session abstraction and
// the membership role through the org-store data layer.

import { getCurrentUser, getOrganization } from './session';
import { orgStore } from './org-store';
import { UnauthorizedError, ForbiddenError } from './errors';
import type { OrgRole } from './types';

// Role-satisfaction matrix (scoping memo section 6.5). The hierarchy is total
// for owner > admin > member, but `reviewer` is a SIBLING specialist role, not
// a lesser one:
//   required owner    -> owner
//   required admin    -> owner, admin
//   required member   -> owner, admin, member
//   required reviewer -> owner, admin, reviewer   (NOT member)
// owner/admin subsume reviewer ("more administrative authority subsumes
// specialist authority"); member does not, because reviewer is scoped to
// edit-submission, not general access.
const ROLE_SATISFIES: Record<OrgRole, ReadonlySet<OrgRole>> = {
  owner: new Set<OrgRole>(['owner']),
  admin: new Set<OrgRole>(['owner', 'admin']),
  member: new Set<OrgRole>(['owner', 'admin', 'member']),
  reviewer: new Set<OrgRole>(['owner', 'admin', 'reviewer']),
};

// Exported for unit tests and any caller that already holds both roles and
// wants the pure predicate without a session round-trip.
export function roleSatisfies(actual: OrgRole, required: OrgRole): boolean {
  return ROLE_SATISFIES[required].has(actual);
}

export async function requireOrgRole(role: OrgRole): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();

  const org = await getOrganization();
  // getOrganization only returns null when there is no user, which the guard
  // above already excludes; this keeps the type narrowing honest.
  if (!org) throw new UnauthorizedError();

  let actual = await orgStore().getMembershipRole(user.auth_user_id, org.id);

  // A synthesized fallback personal org (no membership row exists for it) makes
  // its user the owner by construction -- getOrganization falls back to it when
  // the memberships table is unreachable or empty. Treat that as owner so role
  // checks behave sensibly in the single-tenant / pre-M12 path.
  if (actual === null && (org.id.startsWith('personal-') || org.slug === 'personal')) {
    actual = 'owner';
  }

  if (actual === null || !roleSatisfies(actual, role)) {
    throw new ForbiddenError(role, actual);
  }
}
