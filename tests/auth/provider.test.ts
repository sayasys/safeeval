// Auth provider smoke tests. Verifies the public surface is wired without
// constructing a real Supabase client (no env vars in tests, no SDK
// network contact). The provider is the sole importer of the Supabase
// SDK in the codebase per scoping memo 2026-05-28 section 3.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  getSupabaseAuthClient,
  getSupabaseAuthBrowserClient,
  _resetBrowserClientForTesting,
} from '../../src/lib/auth/provider';

const ORIG_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIG_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  _resetBrowserClientForTesting();
});

afterEach(() => {
  if (ORIG_URL !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = ORIG_URL;
  if (ORIG_KEY !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIG_KEY;
});

describe('auth provider exports', () => {
  it('exports getSupabaseAuthClient as a function', () => {
    expect(typeof getSupabaseAuthClient).toBe('function');
  });

  it('exports getSupabaseAuthBrowserClient as a function', () => {
    expect(typeof getSupabaseAuthBrowserClient).toBe('function');
  });

  it('throws a descriptive error when env vars are missing (server client)', () => {
    expect(() => getSupabaseAuthClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('throws a descriptive error when env vars are missing (browser client)', () => {
    expect(() => getSupabaseAuthBrowserClient()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it('constructs and memoizes the browser client when env vars are present', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-fake-key';
    const first = getSupabaseAuthBrowserClient();
    const second = getSupabaseAuthBrowserClient();
    expect(first).toBe(second);
    expect(first.auth).toBeDefined();
  });
});
