// Provider-agnostic auth actions invoked from the signup / login pages and
// from any client-side sign-out trigger. These are the only auth-action
// surfaces the rest of the codebase ever sees; the underlying SDK calls
// live behind getSupabaseAuthBrowserClient in provider.ts.
//
// Cookie contract:
//   On a successful sign-in or sign-up the access_token is written to the
//   SESSION_COOKIE_NAME cookie so the Next.js middleware (which runs server-
//   side and cannot see localStorage) can gate /app/* routes. The cookie is
//   not HttpOnly because it is set from client JS; Phase 2 hardens this by
//   moving the cookie write into a server route. See scoping memo
//   2026-05-28 section 11.1 for the deferred-hardening note.

import { getSupabaseAuthBrowserClient } from './provider';
import { SESSION_COOKIE_NAME } from './session';
import type { OAuthProvider } from './types';

export interface AuthActionResult {
  ok: boolean;
  // Provider-agnostic error message; UI surfaces this verbatim.
  error?: string;
}

// Minimal DOM type surface. The auth module is compiled under a Node-target
// tsconfig (no DOM lib); declaring just the two browser globals we touch
// keeps the rest of the module Node-only without dragging in the full DOM
// types.
interface DocumentLike {
  cookie: string;
}
interface WindowLike {
  location: { protocol: string };
}

function getDocument(): DocumentLike | undefined {
  return (globalThis as unknown as { document?: DocumentLike }).document;
}

function getWindow(): WindowLike | undefined {
  return (globalThis as unknown as { window?: WindowLike }).window;
}

function writeSessionCookie(accessToken: string, expiresInSec: number): void {
  const doc = getDocument();
  if (!doc) return;
  const maxAge = Math.max(60, expiresInSec);
  const win = getWindow();
  const secure = win?.location.protocol === 'https:';
  const parts = [
    `${SESSION_COOKIE_NAME}=${accessToken}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  doc.cookie = parts.join('; ');
}

function clearSessionCookie(): void {
  const doc = getDocument();
  if (!doc) return;
  doc.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

interface SupabaseSessionShape {
  access_token: string;
  expires_in?: number | null;
}

function persistFromSession(session: SupabaseSessionShape | null | undefined): void {
  if (!session?.access_token) return;
  writeSessionCookie(session.access_token, session.expires_in ?? 3600);
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  try {
    const client = getSupabaseAuthBrowserClient();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };
    // If email confirmation is enabled in the Supabase project, session is
    // null on signup -- the user has to verify before signing in. If
    // confirmation is disabled, the session is populated immediately and we
    // can write the cookie so /app/* is reachable on the next nav.
    persistFromSession(data.session as SupabaseSessionShape | null);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  try {
    const client = getSupabaseAuthBrowserClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    persistFromSession(data.session as SupabaseSessionShape | null);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function signInWithOAuth(
  provider: OAuthProvider,
  redirectTo?: string,
): Promise<AuthActionResult> {
  try {
    const client = getSupabaseAuthBrowserClient();
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error) return { ok: false, error: error.message };
    // OAuth flows complete via redirect; the post-callback page is expected
    // to read the session and call persistFromSession. Phase 1 leaves the
    // callback handler stubbed -- the caller is responsible for following
    // up; Phase 3 wires the dedicated /auth/callback route.
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function signOut(): Promise<AuthActionResult> {
  try {
    const client = getSupabaseAuthBrowserClient();
    const { error } = await client.auth.signOut();
    clearSessionCookie();
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    clearSessionCookie();
    return { ok: false, error: errorMessage(err) };
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Unknown auth error.';
}
