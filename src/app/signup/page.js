'use client';

// SaaS auth Phase 1 -- signup route. Minimal email/password form rolled
// against the provider-agnostic auth actions in src/lib/auth/actions. The
// page deliberately does NOT import @supabase/supabase-js -- the
// migration-readiness rule lives at src/lib/auth/provider.ts.
//
// OAuth providers are Google + GitHub per scoping memo 2026-05-28 section
// 14 Q3 (default-accept). On success, redirect to /app/welcome (the gated
// stub). Phase 3 swaps the stub for real onboarding.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  signUpWithEmailPassword,
  signInWithOAuth,
} from '@/lib/auth';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await signUpWithEmailPassword(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || 'Sign up failed.');
      return;
    }
    router.push('/app/welcome');
  }

  async function handleOAuth(provider) {
    setError(null);
    setBusy(true);
    const result = await signInWithOAuth(provider, `${window.location.origin}/app/welcome`);
    if (!result.ok) {
      setBusy(false);
      setError(result.error || 'OAuth sign in failed.');
    }
    // On success the browser is redirected; busy stays true so the form is
    // visually disabled until the redirect completes.
  }

  return (
    <main className="min-h-screen bg-cream-50 text-slate-800 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-slate-900">
            SafeEval
          </Link>
          <p className="mt-2 text-sm text-slate-600">
            Create an account to evaluate prompts against the framework.
          </p>
        </div>

        <div className="bg-white border border-sage-100 rounded-lg p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900 mb-6">Sign up</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-slate-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-sage-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400 disabled:opacity-50"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-slate-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-sage-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400 disabled:opacity-50"
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md bg-coral-50 border border-coral-200 text-coral-900 text-sm px-3 py-2"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-slate-900 text-white text-sm font-medium py-2 hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <div className="flex-1 h-px bg-sage-100" />
            <span>or</span>
            <div className="flex-1 h-px bg-sage-100" />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={busy}
              className="w-full rounded-md border border-sage-200 text-sm py-2 hover:bg-cream-100 disabled:opacity-50"
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('github')}
              disabled={busy}
              className="w-full rounded-md border border-sage-200 text-sm py-2 hover:bg-cream-100 disabled:opacity-50"
            >
              Continue with GitHub
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="text-slate-900 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
