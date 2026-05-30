// Provider-agnostic session API. The rest of the codebase calls these
// functions and never touches the Supabase SDK directly.
//
// Contract (scoping memo 2026-05-28 sections 3.2 + 11.1):
//   - getCurrentUser:    null if no session, User if signed in.
//   - requireAuth:       throws UnauthorizedError if no session.
//   - getOrganization:   the user's primary org from the memberships +
//                        organizations tables (M12), falling back to the
//                        synthesized personal org when there is no membership
//                        row or the data tables are unreachable. Argless.
//   - getMemberships:    every org the user belongs to (multi-org switcher).
// Role checks live in roles.ts (requireOrgRole); org writes (personal-org
// auto-create on signup) live in org-store.ts (ensurePersonalOrganization).

import { getSupabaseAuthClient } from './provider';
import { UnauthorizedError, OrganizationNotFoundError } from './errors';
import { orgStore } from './org-store';
import type { User, Organization } from './types';

// The cookie name is intentionally provider-neutral. Migration to Clerk
// (per scoping memo section 3.3) keeps the same name; only the JWT issuer
// changes. Outside this module no code reads or writes this cookie.
export const SESSION_COOKIE_NAME = 'safeeval-session';

// Structural type so callers can pass either next/headers' ReadonlyRequestCookies
// or a NextRequest.cookies without importing the Next types here.
export interface CookieReaderLike {
  get(name: string): { value: string } | undefined;
}

export interface RequestLike {
  cookies: CookieReaderLike;
}

function extractAccessToken(cookies: CookieReaderLike): string | null {
  const entry = cookies.get(SESSION_COOKIE_NAME);
  if (!entry) return null;
  const value = entry.value.trim();
  return value.length > 0 ? value : null;
}

interface SupabaseAuthUserShape {
  id: string;
  email?: string | null;
  user_metadata?: {
    display_name?: string | null;
    full_name?: string | null;
    role?: string | null;
  } | null;
  // app_metadata is admin-only-writable in Supabase Auth -- the correct home
  // for an ops-assigned access role (a user cannot self-escalate). See the
  // legal-report access runbook.
  app_metadata?: { role?: string | null } | null;
  created_at?: string | null;
}

function mapAuthUserToUser(raw: SupabaseAuthUserShape): User {
  const meta = raw.user_metadata ?? {};
  const display = meta.display_name ?? meta.full_name ?? null;
  // Prefer the admin-only app_metadata.role; fall back to user_metadata.role
  // only for local-dev convenience. Surfaced onto User for the legal-report
  // auth gate (src/lib/report-generators/legal-auth-gate.ts). Attached only
  // when present so the ordinary-user mapped shape stays {auth_user_id,
  // email, display_name, created_at}.
  const role = raw.app_metadata?.role ?? meta.role ?? null;
  return {
    auth_user_id: raw.id,
    email: raw.email ?? '',
    display_name: display,
    created_at: raw.created_at ?? new Date(0).toISOString(),
    ...(role ? { role } : {}),
  };
}

async function resolveUserFromAccessToken(token: string): Promise<User | null> {
  let client;
  try {
    client = getSupabaseAuthClient();
  } catch {
    // Env vars missing -- treat as no session rather than crashing the
    // route. Production deployments without env vars configured will land
    // here on every request, which is the intended graceful-degradation
    // behavior per the closure note in the scoping memo.
    return null;
  }
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return mapAuthUserToUser(data.user as SupabaseAuthUserShape);
  } catch {
    return null;
  }
}

// Server-component / route-handler path: reads cookies from next/headers.
// Middleware should use getCurrentUserFromRequest instead, since middleware
// runs in Edge runtime and does not expose next/headers cookies in the
// same shape.
export async function getCurrentUser(): Promise<User | null> {
  // Lazy import so this file can be exercised by unit tests that mock the
  // resolveUserFromAccessToken path without dragging in next/headers.
  let cookieStore: CookieReaderLike;
  try {
    const mod = await import('next/headers');
    cookieStore = (await mod.cookies()) as unknown as CookieReaderLike;
  } catch {
    return null;
  }
  const token = extractAccessToken(cookieStore);
  if (!token) return null;
  return resolveUserFromAccessToken(token);
}

// Middleware path: caller passes the request object. The request.cookies
// shape matches CookieReaderLike structurally for both NextRequest and the
// test fakes in tests/auth/middleware.test.ts.
export async function getCurrentUserFromRequest(
  request: RequestLike,
): Promise<User | null> {
  const token = extractAccessToken(request.cookies);
  if (!token) return null;
  return resolveUserFromAccessToken(token);
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

// Returns the current user's primary organization: the membership with the
// earliest created_at, queried against the memberships + organizations tables
// (M12). If the user has no membership row, or the data tables are unreachable
// (e.g. the portfolio deployment before M12 is applied), it falls back to the
// synthesized personal organization -- so the Phase 1 stub contract is
// preserved exactly for every existing caller. Argless by design (scoping memo
// section 3.2): it reads the current session.
export async function getOrganization(): Promise<Organization | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const org = await orgStore().getPrimaryOrganization(user.auth_user_id);
  return org ?? buildPersonalOrganization(user);
}

// Every organization the current user belongs to (primary-first), for the
// future multi-org switcher. Falls back to a single-element list holding the
// synthesized personal org when there are no membership rows or the table is
// unreachable, so a signed-in user always belongs to at least their own org.
export async function getMemberships(): Promise<Organization[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const orgs = await orgStore().listOrganizations(user.auth_user_id);
  if (orgs.length > 0) return orgs;
  return [buildPersonalOrganization(user)];
}

// Exported for callers that already hold a User and want to avoid a second
// round-trip to the auth provider (notably the middleware path, which has
// just resolved the user from the request).
export function buildPersonalOrganization(user: User): Organization {
  return {
    id: `personal-${user.auth_user_id}`,
    name: 'Personal',
    slug: 'personal',
    plan_tier: 'free',
    created_at: user.created_at,
  };
}

// Variant used by callers that need to surface the OrganizationNotFoundError
// when the user lookup itself fails. Phase 1 never reaches this path under
// normal use (getOrganization returns null on no-session), but the throw
// path is present so Phase 2 callers can opt in by switching to this entry.
export async function requireOrganization(): Promise<Organization> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  const org = buildPersonalOrganization(user);
  if (!org) throw new OrganizationNotFoundError(user.auth_user_id);
  return org;
}
