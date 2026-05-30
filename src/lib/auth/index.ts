// Public surface of the auth module. Every consumer outside src/lib/auth/
// imports from here, never from the individual files. The provider.ts
// internals are deliberately NOT re-exported -- migration-readiness rule
// per scoping memo 2026-05-28 section 3.3 keeps the Supabase SDK boundary
// inside this directory.

export {
  getCurrentUser,
  getCurrentUserFromRequest,
  requireAuth,
  getOrganization,
  getMemberships,
  requireOrganization,
  buildPersonalOrganization,
  SESSION_COOKIE_NAME,
} from './session';

export { requireOrgRole, roleSatisfies } from './roles';

// Organization writes. ensurePersonalOrganization is the idempotent onboarding
// hook called after signup; the *ForTesting seams let unit tests inject a fake
// store without touching Supabase.
export {
  ensurePersonalOrganization,
} from './org-actions';
export {
  setOrgStoreForTesting,
  resetOrgStoreForTesting,
} from './org-store';
export type { OrgDataStore } from './org-store';

export {
  signUpWithEmailPassword,
  signInWithEmailPassword,
  signInWithOAuth,
  signOut,
} from './actions';

export {
  UnauthorizedError,
  OrganizationNotFoundError,
  ForbiddenError,
} from './errors';

export { ORG_ROLES } from './types';
export type { User, Organization, Membership, OAuthProvider, OrgRole } from './types';
