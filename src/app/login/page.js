'use client';

// SaaS auth Phase 1 -- login route. Mirrors signup/page.js shape; on
// success redirects to /app/dashboard rather than /app/welcome.
//
// Same migration-readiness contract: no Supabase SDK import here. All auth
// calls go through src/lib/auth.

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  signInWithEmailPassword,
  signInWithOAuth,
} from '@/lib/auth';

// Next.js 15 requires useSearchParams to live under a Suspense boundary
// for the page to prerender; otherwise the build bails out with the CSR-
// bailout error. The form is split into an inner client component so the
// outer page can stay statically renderable.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main className="min-h-screen bg-tool text-slate-800 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center text-sm text-slate-500">
        Loading...
      </div>
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/app/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await signInWithEmailPassword(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || 'Log in failed.');
      return;
    }
    router.push(redirectTarget);
  }

  async function handleOAuth(provider) {
    setError(null);
    setBusy(true);
    const result = await signInWithOAuth(provider, `${window.location.origin}${redirectTarget}`);
    if (!result.ok) {
      setBusy(false);
      setError(result.error || 'OAuth sign in failed.');
    }
  }

  return (
    <main className="min-h-screen bg-tool text-slate-800 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-slate-900">
            SafeEval
          </Link>
          <p className="mt-2 text-sm text-slate-600">Welcome back.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900 mb-6">Log in</h1>

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
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:opacity-50"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:opacity-50"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md bg-red-50 border border-red-200 text-red-900 text-sm px-3 py-2"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-slate-900 text-white text-sm font-medium py-2 hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'Signing in...' : 'Log in'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-100" />
            <span>or</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={busy}
              className="w-full rounded-md border border-slate-200 text-sm py-2 hover:bg-slate-100 disabled:opacity-50"
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('github')}
              disabled={busy}
              className="w-full rounded-md border border-slate-200 text-sm py-2 hover:bg-slate-100 disabled:opacity-50"
            >
              Continue with GitHub
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          New here?{' '}
          <Link href="/signup" className="text-slate-900 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
