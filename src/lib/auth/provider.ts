// Supabase Auth SDK wrapper. SOLE importer of @supabase/supabase-js auth
// methods in the entire codebase.
//
// MIGRATION-READINESS RULE -- DO NOT VIOLATE:
//   This is the ONLY file that imports @supabase/supabase-js auth methods.
//   When the Clerk migration fires (per scoping memo 2026-05-28 section 3.3
//   -- trigger is SAML/SCIM customer requirement or auth UX complexity
//   exceeding 2-3 features Clerk gives free), this file's contents are
//   rewritten. Every other consumer in the codebase calls the abstraction in
//   session.ts / actions.ts / index.ts. The rest of the repo does not move.
//
//   A repo-level ESLint rule prohibiting `import '@supabase/supabase-js'`
//   outside src/lib/auth/ is named for Phase 5 of the scoping memo (section
//   3.4). Until then, this comment block is the structural guard; reviewers
//   on every PR touching this directory should reject any new outside
//   importer.
//
// Phase 1 scope: two factory functions (server-side, browser-side) returning
// a configured SupabaseClient. Session storage on the browser is the SDK's
// localStorage default; the cookie marker that the middleware reads is set
// by actions.ts after a successful sign-in -- see actions.ts for the
// cookie-name and lifetime contract.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Auth-only env vars. The data persistence layer's SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are intentionally separate -- the auth Supabase
// project is distinct from the data Supabase project (or, in Phase 2 when
// they collapse to one project, the auth surface uses the anon key, not the
// service-role key). See .env.example notes.
const AUTH_URL_ENV = 'NEXT_PUBLIC_SUPABASE_URL';
const AUTH_ANON_KEY_ENV = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

function readEnv(): { url: string; anonKey: string } | null {
  // STATIC LITERAL ACCESS IS REQUIRED -- DO NOT refactor to process.env[KEY].
  // The signup/login pages are 'use client' components, so this runs in the
  // browser bundle. Next.js exposes NEXT_PUBLIC_* vars to client code only by
  // statically replacing the literal text `process.env.NEXT_PUBLIC_FOO` at
  // build time. A dynamic/computed key (process.env[AUTH_URL_ENV]) is never
  // matched by that replacement, so the value is undefined in the browser no
  // matter what is configured in Vercel -- which is exactly the bug this
  // shape fixes. The AUTH_*_ENV constants below are kept only for the error
  // message text. On the server, process.env is the live object and either
  // form works; the literal form is the one that also works client-side.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

// Browser client is intentionally memoized: the SDK manages session refresh
// internally; constructing multiple clients fragments that state.
let browserClient: SupabaseClient | null = null;

export function getSupabaseAuthBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const env = readEnv();
  if (!env) {
    throw new Error(
      `Supabase auth env vars missing: ${AUTH_URL_ENV} and/or ` +
        `${AUTH_ANON_KEY_ENV}. Set both in .env.local (development) or the ` +
        `Vercel project (production). See .env.example.`,
    );
  }
  browserClient = createClient(env.url, env.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
}

// Server-side client is stateless: the caller passes the access token
// explicitly to auth.getUser(jwt) at the call site (see session.ts). The
// client itself does not retain session, so a per-request construction is
// fine.
export function getSupabaseAuthClient(): SupabaseClient {
  const env = readEnv();
  if (!env) {
    throw new Error(
      `Supabase auth env vars missing: ${AUTH_URL_ENV} and/or ` +
        `${AUTH_ANON_KEY_ENV}. Set both in .env.local (development) or the ` +
        `Vercel project (production). See .env.example.`,
    );
  }
  return createClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// Test seam. Tests reset the memoized browser client between cases.
export function _resetBrowserClientForTesting(): void {
  browserClient = null;
}
