// Organization data-access for the auth module.
//
// The organizations / users / memberships tables live in the DATA Supabase
// project (the one src/lib/data/db-client.ts points at via the service-role
// key), NOT the auth provider's project. So org lookups go through the data
// client, never through provider.ts. This keeps the migration-readiness rule
// intact: a Clerk migration rewrites provider.ts only; org/membership queries
// are provider-agnostic because they read application tables, not the auth
// provider's user store.
//
// Everything here is best-effort / fail-open. If the data env vars are unset
// (the live portfolio deployment before M12 is applied) or a query errors,
// the functions return null / [] so the auth layer degrades to the synthesized
// personal organization rather than crashing a route. This mirrors the same
// graceful-degradation posture session.ts uses for the auth provider.
//
// The whole surface is swappable via setOrgStoreForTesting(); unit tests
// inject a plain-object fake and never touch the Supabase query builder.

import { getClient } from '../data/db-client';
import type { User, Organization, OrgRole } from './types';
import { ORG_ROLES } from './types';

export interface OrgDataStore {
  // The user's primary organization: the membership with the earliest
  // created_at. null if the user has no membership or the table is unreachable.
  getPrimaryOrganization(authUserId: string): Promise<Organization | null>;
  // Every organization the user belongs to, primary-first. [] on no membership
  // or unreachable table.
  listOrganizations(authUserId: string): Promise<Organization[]>;
  // The user's role in a specific organization, or null if not a member.
  getMembershipRole(authUserId: string, organizationId: string): Promise<OrgRole | null>;
  // Idempotently create the user's mirror row, a "Personal" organization, and
  // an owner membership. Returns the organization, or null if the write failed.
  ensurePersonalOrganization(user: User): Promise<Organization | null>;
}

// Columns selected for an Organization. Kept in one place so the embedded
// PostgREST select strings stay in sync with the Organization shape.
const ORG_COLUMNS = 'id, name, slug, plan_tier, created_at';

interface OrganizationRowShape {
  id: string;
  name: string;
  slug: string;
  plan_tier: string;
  created_at: string;
}

function toOrganization(row: OrganizationRowShape | null | undefined): Organization | null {
  if (!row || !row.id) return null;
  const plan = row.plan_tier;
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    plan_tier:
      plan === 'free' || plan === 'pro' || plan === 'enterprise' ? plan : 'free',
    created_at: row.created_at,
  };
}

function coerceRole(value: unknown): OrgRole | null {
  return (ORG_ROLES as readonly string[]).includes(value as string)
    ? (value as OrgRole)
    : null;
}

// Resolve the raw data client. Throws inside getClient() when the data env
// vars are missing; callers wrap in try/catch and fail open.
function rawClient() {
  return getClient().getRawClient();
}

const realStore: OrgDataStore = {
  async getPrimaryOrganization(authUserId: string): Promise<Organization | null> {
    try {
      const raw = rawClient();
      const { data, error } = await raw
        .from('memberships')
        .select(`created_at, organizations ( ${ORG_COLUMNS} )`)
        .eq('user_id', authUserId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      // PostgREST returns the to-one embed as a single object at runtime;
      // supabase-js's select-string type parser models it as an array, so cast
      // through unknown.
      const org = (data as unknown as { organizations?: OrganizationRowShape })
        .organizations;
      return toOrganization(org);
    } catch {
      return null;
    }
  },

  async listOrganizations(authUserId: string): Promise<Organization[]> {
    try {
      const raw = rawClient();
      const { data, error } = await raw
        .from('memberships')
        .select(`created_at, organizations ( ${ORG_COLUMNS} )`)
        .eq('user_id', authUserId)
        .order('created_at', { ascending: true });
      if (error || !Array.isArray(data)) return [];
      const orgs: Organization[] = [];
      for (const row of data as unknown as Array<{ organizations?: OrganizationRowShape }>) {
        const org = toOrganization(row.organizations);
        if (org) orgs.push(org);
      }
      return orgs;
    } catch {
      return [];
    }
  },

  async getMembershipRole(
    authUserId: string,
    organizationId: string,
  ): Promise<OrgRole | null> {
    try {
      const raw = rawClient();
      const { data, error } = await raw
        .from('memberships')
        .select('role')
        .eq('user_id', authUserId)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error || !data) return null;
      return coerceRole((data as { role?: unknown }).role);
    } catch {
      return null;
    }
  },

  async ensurePersonalOrganization(user: User): Promise<Organization | null> {
    // Idempotent. Slug is derived from the (lowercase) auth_user_id so a repeat
    // call finds the existing org via the slug UNIQUE constraint instead of
    // creating a duplicate. The user's mirror row is upserted first so the
    // organizations.created_by_user_id FK resolves.
    const slug = `personal-${user.auth_user_id}`.toLowerCase();
    try {
      const raw = rawClient();

      await raw
        .from('users')
        .upsert(
          {
            id: user.auth_user_id,
            email: user.email,
            display_name: user.display_name,
          },
          { onConflict: 'id' },
        );

      // Find-or-create the organization by its unique slug.
      const existing = await raw
        .from('organizations')
        .select(ORG_COLUMNS)
        .eq('slug', slug)
        .maybeSingle();

      let orgRow: OrganizationRowShape | null =
        (existing.data as OrganizationRowShape | null) ?? null;

      if (!orgRow) {
        const inserted = await raw
          .from('organizations')
          .insert({
            name: 'Personal',
            slug,
            plan_tier: 'free',
            created_by_user_id: user.auth_user_id,
          })
          .select(ORG_COLUMNS)
          .maybeSingle();
        if (inserted.error || !inserted.data) {
          // A concurrent caller may have won the slug race; re-read.
          const reread = await raw
            .from('organizations')
            .select(ORG_COLUMNS)
            .eq('slug', slug)
            .maybeSingle();
          orgRow = (reread.data as OrganizationRowShape | null) ?? null;
        } else {
          orgRow = inserted.data as OrganizationRowShape;
        }
      }

      const org = toOrganization(orgRow);
      if (!org) return null;

      // Owner membership; ignore the duplicate on repeat calls.
      await raw
        .from('memberships')
        .upsert(
          { organization_id: org.id, user_id: user.auth_user_id, role: 'owner' },
          { onConflict: 'organization_id,user_id', ignoreDuplicates: true },
        );

      return org;
    } catch {
      return null;
    }
  },
};

// Swappable singleton. Production uses realStore; tests override per-method.
let active: OrgDataStore = realStore;

export function orgStore(): OrgDataStore {
  return active;
}

export function setOrgStoreForTesting(overrides: Partial<OrgDataStore>): void {
  active = { ...realStore, ...overrides };
}

export function resetOrgStoreForTesting(): void {
  active = realStore;
}
