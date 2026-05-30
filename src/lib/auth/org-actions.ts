// Public organization actions (onboarding). Thin orchestration over the
// swappable org-store; kept separate from org-store.ts so the data seam and
// the public action surface stay distinct (and so tests can drive either).

import { orgStore } from './org-store';
import type { User, Organization } from './types';

// Idempotently ensure the user has a "Personal" organization with themselves
// as owner. Called after signup (scoping memo section 5, default auto-create).
// Safe to call repeatedly: the org-store resolves the existing org by its
// unique slug rather than creating a duplicate. Returns the organization, or
// null if the write failed (callers treat a null as a soft failure -- the user
// is still signed in; the personal-org backfill can be retried on next visit).
export async function ensurePersonalOrganization(
  user: User,
): Promise<Organization | null> {
  return orgStore().ensurePersonalOrganization(user);
}
