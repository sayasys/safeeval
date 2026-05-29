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
  requireOrganization,
  buildPersonalOrganization,
  SESSION_COOKIE_NAME,
} from './session';

export {
  signUpWithEmailPassword,
  signInWithEmailPassword,
  signInWithOAuth,
  signOut,
} from './actions';

export { UnauthorizedError, OrganizationNotFoundError } from './errors';

export type { User, Organization, Membership, OAuthProvider } from './types';
