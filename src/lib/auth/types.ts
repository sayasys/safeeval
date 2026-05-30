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
  // Coarse access role, set MANUALLY by ops in the auth provider's
  // admin-only metadata (Supabase app_metadata.role) per the legal-report
  // access runbook (docs/runbooks/legal-report-access.md). Provider-agnostic:
  // the field is a plain string here, not a Supabase shape. Absent/null for
  // ordinary users; 'pii_reviewer' grants legal-audience report access and
  // 'admin' grants force-regeneration. Phase 4+ replaces the manual
  // assignment with real RBAC.
  role?: string | null;
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

// Per-organization role closed set (scoping memo section 6). This runtime
// constant is the canonical code-side source for the checkOrgRoleLockstep
// verifier in scripts/check-lockstep.js, which asserts it set-equals the
// `role` CHECK constraint in the M12 migration. NOTE: `pii_reviewer` is NOT a
// membership role -- it is an auth-provider app_metadata value the legal-
// access-log gate reads (see User.role above); the two vocabularies are
// deliberately separate. The doc-backed lockstep (ontology section 3.18) is a
// Phase 4 addition per memo sections 6 and 11; until then the verifier keys
// off this constant and the SQL CHECK only.
export const ORG_ROLES = ['owner', 'admin', 'member', 'reviewer'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

// Phase 2 populates this from the `memberships` table per scoping memo 4.3.
export interface Membership {
  user_id: string;
  organization_id: string;
  role: OrgRole;
  created_at: string;
}

export type OAuthProvider = 'google' | 'github';
