// Unit tests for the DB-backed organization accessors. getCurrentUser is
// driven by mocking its two dependencies (next/headers for the cookie read and
// the auth provider for token -> user); the org data layer is injected via the
// org-store test seam, so no Supabase query builder is faked.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const cookieGet = vi.fn();
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));

const getUser = vi.fn();
vi.mock('../../src/lib/auth/provider', () => ({
  getSupabaseAuthClient: () => ({ auth: { getUser } }),
  getSupabaseAuthBrowserClient: () => ({}),
  _resetBrowserClientForTesting: () => {},
}));

import {
  getOrganization,
  getMemberships,
  ensurePersonalOrganization,
  setOrgStoreForTesting,
  resetOrgStoreForTesting,
} from '../../src/lib/auth';
import type { Organization, User } from '../../src/lib/auth';

const ORG_A: Organization = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Acme', slug: 'acme', plan_tier: 'pro', created_at: '2026-05-01T00:00:00Z',
};
const ORG_B: Organization = {
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Beta', slug: 'beta', plan_tier: 'free', created_at: '2026-05-02T00:00:00Z',
};

function signIn() {
  cookieGet.mockReturnValue({ value: 'token-abc' });
  getUser.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'a@b.c', user_metadata: {}, app_metadata: {}, created_at: '2026-05-29T00:00:00Z' } },
    error: null,
  });
}
function signOut() {
  cookieGet.mockReturnValue(undefined);
}

beforeEach(() => {
  cookieGet.mockReset();
  getUser.mockReset();
  resetOrgStoreForTesting();
});

describe('getOrganization', () => {
  it('returns null when there is no session', async () => {
    signOut();
    expect(await getOrganization()).toBeNull();
  });

  it('returns the primary org from the store when present', async () => {
    signIn();
    setOrgStoreForTesting({ getPrimaryOrganization: async () => ORG_A });
    expect(await getOrganization()).toEqual(ORG_A);
  });

  it('falls back to the synthesized personal org when the store has none', async () => {
    signIn();
    setOrgStoreForTesting({ getPrimaryOrganization: async () => null });
    const org = await getOrganization();
    expect(org).not.toBeNull();
    expect(org!.id).toBe('personal-u-1');
    expect(org!.slug).toBe('personal');
    expect(org!.plan_tier).toBe('free');
  });
});

describe('getMemberships', () => {
  it('returns [] when there is no session', async () => {
    signOut();
    expect(await getMemberships()).toEqual([]);
  });

  it('returns every org the user belongs to', async () => {
    signIn();
    setOrgStoreForTesting({ listOrganizations: async () => [ORG_A, ORG_B] });
    expect(await getMemberships()).toEqual([ORG_A, ORG_B]);
  });

  it('falls back to a single personal org when the store is empty', async () => {
    signIn();
    setOrgStoreForTesting({ listOrganizations: async () => [] });
    const orgs = await getMemberships();
    expect(orgs).toHaveLength(1);
    expect(orgs[0]!.id).toBe('personal-u-1');
  });
});

describe('ensurePersonalOrganization', () => {
  const user: User = {
    auth_user_id: 'u-1', email: 'a@b.c', display_name: null, created_at: '2026-05-29T00:00:00Z',
  };

  it('delegates to the store and returns the org', async () => {
    const PERSONAL: Organization = {
      id: 'org-personal', name: 'Personal', slug: 'personal-u-1', plan_tier: 'free', created_at: '2026-05-29T00:00:00Z',
    };
    const ensure = vi.fn(async () => PERSONAL);
    setOrgStoreForTesting({ ensurePersonalOrganization: ensure });
    const org = await ensurePersonalOrganization(user);
    expect(org).toEqual(PERSONAL);
    expect(ensure).toHaveBeenCalledWith(user);
  });

  it('returns null on a soft store-write failure', async () => {
    setOrgStoreForTesting({ ensurePersonalOrganization: async () => null });
    expect(await ensurePersonalOrganization(user)).toBeNull();
  });
});
