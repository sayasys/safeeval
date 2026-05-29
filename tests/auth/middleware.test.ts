// Middleware unit tests. The auth module is mocked at the module boundary
// so we exercise the routing logic without touching the SDK.
//
// Coverage:
//   1. Authenticated /app/* request -> NextResponse.next (pass-through).
//   2. Unauthenticated /app/welcome  -> 302 redirect to /signup?redirect=...
//   3. Unauthenticated /api/app/...  -> 401 JSON.
//   4. Authenticated /api/app/...    -> pass-through.
//   5. Matcher config restricts firing to /app/:path* and /api/app/:path*.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted above the top-level statements, so the mock function
// has to be declared via vi.hoisted() to exist at hoist time.
const { getCurrentUserFromRequest } = vi.hoisted(() => ({
  getCurrentUserFromRequest: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  getCurrentUserFromRequest,
}));

import { middleware, config } from '../../src/middleware';

// Faithful fake of NextRequest.nextUrl: pathname and searchParams are
// live on the underlying URL, and clone() returns a fresh URL the
// middleware can mutate without affecting the original.
function makeUrl(pathname: string, base = 'http://localhost:3000'): URL & { clone(): URL } {
  const u = new URL(pathname, base) as URL & { clone(): URL };
  u.clone = function clone() {
    return makeUrl(this.pathname + (this.search || ''), base);
  };
  return u;
}

function makeRequest(pathname: string) {
  const url = makeUrl(pathname);
  return {
    nextUrl: url,
    cookies: { get: () => undefined },
  };
}

const FAKE_USER = {
  auth_user_id: 'u-1',
  email: 'a@b.c',
  display_name: null,
  created_at: '2026-05-29T00:00:00.000Z',
};

beforeEach(() => {
  getCurrentUserFromRequest.mockReset();
});

describe('middleware', () => {
  it('passes authenticated /app/* requests through', async () => {
    getCurrentUserFromRequest.mockResolvedValue(FAKE_USER);
    const req = makeRequest('/app/welcome');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await middleware(req as any);
    // NextResponse.next() returns a response whose headers do NOT include a
    // Location and whose status is 200. Distinguish from the redirect path
    // by checking absence of Location.
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('redirects unauthenticated /app/welcome to /signup with redirect param', async () => {
    getCurrentUserFromRequest.mockResolvedValue(null);
    const req = makeRequest('/app/welcome');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await middleware(req as any);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).not.toBeNull();
    expect(location!).toContain('/signup');
    expect(location!).toContain('redirect=%2Fapp%2Fwelcome');
  });

  it('returns 401 JSON on unauthenticated /api/app/* requests', async () => {
    getCurrentUserFromRequest.mockResolvedValue(null);
    const req = makeRequest('/api/app/evaluate');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await middleware(req as any);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code?: string; error?: string };
    expect(body.code).toBe('unauthorized');
    expect(typeof body.error).toBe('string');
  });

  it('passes authenticated /api/app/* requests through', async () => {
    getCurrentUserFromRequest.mockResolvedValue(FAKE_USER);
    const req = makeRequest('/api/app/evaluate');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await middleware(req as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('restricts the matcher to /app and /api/app prefixes', () => {
    expect(config.matcher).toEqual(['/app/:path*', '/api/app/:path*']);
  });

  it('keeps public surface routes outside the matcher', () => {
    // Sanity check: matcher does not list /, /evaluator, /product, etc.
    for (const route of ['/', '/evaluator', '/product', '/case-study', '/signup', '/login']) {
      expect(config.matcher.some((p: string) => p.startsWith(route + '/') || p === route)).toBe(false);
    }
  });
});
