// Provider-agnostic auth types.
//
// MIGRATION-READINESS RULE -- DO NOT VIOLATE:
//   Types here are provider-agnostic. Field name `auth_user_id` not
//   `supabase_user_id`. No Supabase-specific shapes (Session, JWTPayload,
//   AuthError) appear here or anywhere else outside src/lib/auth/provider.ts.
//   When the Clerk migration fires (per scoping memo 2026-05-28 section 3.3),
//   provider.ts is the only file that rewrites. These types stay.
//
// Shape sources: scoping memo 2026-05-28-saas-conversion-scoping.md section
// 3.2 (User, Organization, Membership). Phase 1 of the implementation lands
// the shapes; Phase 2 (M6 migration) populates them from real tables.

export interface User {
  // UUID from the auth provider (Supabase today, Clerk later). NEVER named
  // after the provider; the scoping memo section 3.2 locks this in.
  auth_user_id: string;
  email: string;
  display_name: string | null;
  // ISO 8601.
  created_at: string;
}

export interface Organization {
  // UUID in Phase 2; in Phase 1 the stub uses `personal-<auth_user_id>`.
  id: string;
  name: string;
  // URL-safe; unique once Phase 2's `organizations` table lands.
  slug: string;
  plan_tier: 'free' | 'pro' | 'enterprise';
  // ISO 8601.
  created_at: string;
}

// Phase 1 leaves this shape declared but unused (no membership rows yet).
// Phase 2 populates it from the `memberships` table per scoping memo 4.3.
export interface Membership {
  user_id: string;
  organization_id: string;
  role: 'owner' | 'admin' | 'member' | 'reviewer';
  created_at: string;
}

export type OAuthProvider = 'google' | 'github';
