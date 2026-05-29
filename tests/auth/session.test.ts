// Auth session unit tests. The provider's Supabase client is mocked at
// the module boundary so no SDK calls fire; next/headers is mocked so the
// getCurrentUser path runs without a Next.js runtime context.
//
// Coverage:
//   1. getCurrentUser returns null when no session cookie is present.
//   2. getCurrentUser returns null when the SDK reports an error.
//   3. getCurrentUser returns a User when the SDK resolves the token.
//   4. requireAuth throws UnauthorizedError when no user.
//   5. requireAuth resolves with the user when signed in.
//   6. getOrganization returns null when no user.
//   7. getOrganization returns a personal-org stub keyed to auth_user_id.
//   8. buildPersonalOrganization shape (no SDK contact required).
//   9. getCurrentUserFromRequest happy path + missing-cookie path.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const supabaseGetUser = vi.fn();

vi.mock('../../src/lib/auth/provider', () => ({
  getSupabaseAuthClient: () => ({
    auth: { getUser: supabaseGetUser },
  }),
  getSupabaseAuthBrowserClient: () => ({ auth: {} }),
  _resetBrowserClientForTesting: () => {},
}));

const cookieStoreGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: cookieStoreGet }),
}));

import {
  getCurrentUser,
  getCurrentUserFromRequest,
  requireAuth,
  getOrganization,
  buildPersonalOrganization,
  SESSION_COOKIE_NAME,
} from '../../src/lib/auth/session';
import { UnauthorizedError } from '../../src/lib/auth/errors';

const VALID_TOKEN = 'eyJhbGciOi.fake.jwt';

const SDK_USER = {
  id: 'auth-user-42',
  email: 'alice@example.com',
  user_metadata: { display_name: 'Alice Example' },
  created_at: '2026-05-29T10:00:00.000Z',
};

beforeEach(() => {
  supabaseGetUser.mockReset();
  cookieStoreGet.mockReset();
});

describe('getCurrentUser', () => {
  it('returns null when the session cookie is missing', async () => {
    cookieStoreGet.mockReturnValue(undefined);
    const user = await getCurrentUser();
    expect(user).toBeNull();
    expect(supabaseGetUser).not.toHaveBeenCalled();
  });

  it('returns null when the SDK reports an error', async () => {
    cookieStoreGet.mockImplementation((name: string) =>
      name === SESSION_COOKIE_NAME ? { value: VALID_TOKEN } : undefined,
    );
    supabaseGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'bad jwt' },
    });
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it('maps the SDK user into a provider-agnostic User', async () => {
    cookieStoreGet.mockImplementation((name: string) =>
      name === SESSION_COOKIE_NAME ? { value: VALID_TOKEN } : undefined,
    );
    supabaseGetUser.mockResolvedValue({ data: { user: SDK_USER }, error: null });
    const user = await getCurrentUser();
    expect(user).toEqual({
      auth_user_id: 'auth-user-42',
      email: 'alice@example.com',
      display_name: 'Alice Example',
      created_at: '2026-05-29T10:00:00.000Z',
    });
    expect(supabaseGetUser).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it('falls back to full_name when display_name is absent', async () => {
    cookieStoreGet.mockImplementation((name: string) =>
      name === SESSION_COOKIE_NAME ? { value: VALID_TOKEN } : undefined,
    );
    supabaseGetUser.mockResolvedValue({
      data: {
        user: { ...SDK_USER, user_metadata: { full_name: 'Alice E.' } },
      },
      error: null,
    });
    const user = await getCurrentUser();
    expect(user?.display_name).toBe('Alice E.');
  });

  it('treats an empty-string cookie as no session', async () => {
    cookieStoreGet.mockImplementation((name: string) =>
      name === SESSION_COOKIE_NAME ? { value: '   ' } : undefined,
    );
    const user = await getCurrentUser();
    expect(user).toBeNull();
    expect(supabaseGetUser).not.toHaveBeenCalled();
  });
});

describe('requireAuth', () => {
  it('throws UnauthorizedError when no session', async () => {
    cookieStoreGet.mockReturnValue(undefined);
    await expect(requireAuth()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('returns the User when signed in', async () => {
    cookieStoreGet.mockImplementation((name: string) =>
      name === SESSION_COOKIE_NAME ? { value: VALID_TOKEN } : undefined,
    );
    supabaseGetUser.mockResolvedValue({ data: { user: SDK_USER }, error: null });
    const user = await requireAuth();
    expect(user.auth_user_id).toBe('auth-user-42');
  });
});

describe('getOrganization', () => {
  it('returns null when no session', async () => {
    cookieStoreGet.mockReturnValue(undefined);
    const org = await getOrganization();
    expect(org).toBeNull();
  });

  it('returns a personal-org stub keyed to auth_user_id', async () => {
    cookieStoreGet.mockImplementation((name: string) =>
      name === SESSION_COOKIE_NAME ? { value: VALID_TOKEN } : undefined,
    );
    supabaseGetUser.mockResolvedValue({ data: { user: SDK_USER }, error: null });
    const org = await getOrganization();
    expect(org).toEqual({
      id: 'personal-auth-user-42',
      name: 'Personal',
      slug: 'personal',
      plan_tier: 'free',
      created_at: '2026-05-29T10:00:00.000Z',
    });
  });
});

describe('buildPersonalOrganization', () => {
  it('derives the org id from auth_user_id and uses free plan tier', () => {
    const org = buildPersonalOrganization({
      auth_user_id: 'u-1',
      email: 'a@b.c',
      display_name: null,
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(org.id).toBe('personal-u-1');
    expect(org.plan_tier).toBe('free');
    expect(org.slug).toBe('personal');
  });
});

describe('getCurrentUserFromRequest', () => {
  it('returns null when the request has no session cookie', async () => {
    const req = { cookies: { get: () => undefined } };
    const user = await getCurrentUserFromRequest(req);
    expect(user).toBeNull();
  });

  it('resolves the User from the request cookie', async () => {
    supabaseGetUser.mockResolvedValue({ data: { user: SDK_USER }, error: null });
    const req = {
      cookies: {
        get: (name: string) =>
          name === SESSION_COOKIE_NAME ? { value: VALID_TOKEN } : undefined,
      },
    };
    const user = await getCurrentUserFromRequest(req);
    expect(user?.auth_user_id).toBe('auth-user-42');
    expect(supabaseGetUser).toHaveBeenCalledWith(VALID_TOKEN);
  });
});
