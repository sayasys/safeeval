// requireOrgRole + roleSatisfies tests (scoping memo section 6.5).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { roleSatisfies } from '../../src/lib/auth/roles';
import type { OrgRole } from '../../src/lib/auth';

const cookieGet = vi.fn();
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));

const getUser = vi.fn();
vi.mock('../../src/lib/auth/provider', () => ({
  getSupabaseAuthClient: () => ({ auth: { getUser } }),
  getSupabaseAuthBrowserClient: () => ({}),
  _resetBrowserClientForTesting: () => {},
}));

import {
  requireOrgRole,
  setOrgStoreForTesting,
  resetOrgStoreForTesting,
  ForbiddenError,
  UnauthorizedError,
} from '../../src/lib/auth';

// roleSatisfies is pure -- assert the full memo section 6.5 matrix, including
// the reviewer-is-a-sibling edge (member does NOT satisfy reviewer).
describe('roleSatisfies (memo section 6.5 matrix)', () => {
  const ALL: OrgRole[] = ['owner', 'admin', 'member', 'reviewer'];

  it('owner satisfies every required role', () => {
    for (const r of ALL) expect(roleSatisfies('owner', r)).toBe(true);
  });

  it('admin satisfies admin/member/reviewer but not owner', () => {
    expect(roleSatisfies('admin', 'owner')).toBe(false);
    expect(roleSatisfies('admin', 'admin')).toBe(true);
    expect(roleSatisfies('admin', 'member')).toBe(true);
    expect(roleSatisfies('admin', 'reviewer')).toBe(true);
  });

  it('member satisfies member only -- NOT reviewer (sibling role)', () => {
    expect(roleSatisfies('member', 'member')).toBe(true);
    expect(roleSatisfies('member', 'reviewer')).toBe(false);
    expect(roleSatisfies('member', 'admin')).toBe(false);
    expect(roleSatisfies('member', 'owner')).toBe(false);
  });

  it('reviewer satisfies reviewer only -- NOT member', () => {
    expect(roleSatisfies('reviewer', 'reviewer')).toBe(true);
    expect(roleSatisfies('reviewer', 'member')).toBe(false);
    expect(roleSatisfies('reviewer', 'admin')).toBe(false);
    expect(roleSatisfies('reviewer', 'owner')).toBe(false);
  });
});

const ORG_A = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Acme', slug: 'acme', plan_tier: 'pro' as const, created_at: '2026-05-01T00:00:00Z',
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

describe('requireOrgRole', () => {
  it('throws UnauthorizedError when there is no session', async () => {
    signOut();
    await expect(requireOrgRole('member')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('resolves when the membership role satisfies the requirement', async () => {
    signIn();
    setOrgStoreForTesting({
      getPrimaryOrganization: async () => ORG_A,
      getMembershipRole: async () => 'admin',
    });
    await expect(requireOrgRole('member')).resolves.toBeUndefined();
  });

  it('throws ForbiddenError when the role is insufficient', async () => {
    signIn();
    setOrgStoreForTesting({
      getPrimaryOrganization: async () => ORG_A,
      getMembershipRole: async () => 'member',
    });
    await expect(requireOrgRole('owner')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws ForbiddenError when the user has no membership in a real org', async () => {
    signIn();
    setOrgStoreForTesting({
      getPrimaryOrganization: async () => ORG_A,
      getMembershipRole: async () => null,
    });
    await expect(requireOrgRole('member')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('treats the owner of a synthesized fallback personal org as owner', async () => {
    signIn();
    // No real primary org -> getOrganization falls back to personal-u-1, which
    // has no membership row; the user is its owner by construction.
    setOrgStoreForTesting({
      getPrimaryOrganization: async () => null,
      getMembershipRole: async () => null,
    });
    await expect(requireOrgRole('owner')).resolves.toBeUndefined();
  });
});
