// SaaS auth Phase 1 -- gated stub. Middleware guarantees a signed-in user
// reaches this page; unauthenticated requests redirect to /signup before
// rendering ever fires. Phase 3 of the scoping memo replaces this with the
// real onboarding flow (org creation prompt, plan tier selection, first-
// evaluation walkthrough).

import Link from 'next/link';

export default function AppWelcomePage() {
  return (
    <main className="min-h-screen bg-cream-50 text-slate-800 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="bg-white border border-sage-100 rounded-lg p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900 mb-3">
            You are signed in.
          </h1>
          <p className="text-slate-700 mb-2">
            Phase 1 of the gated SaaS surface is live. The middleware gate is
            enforced; the auth abstraction is provider-agnostic; the
            organization model is stubbed pending the Phase 2 multi-tenancy
            migration.
          </p>
          <p className="text-slate-700 mb-6">
            Real product surfaces -- per-organization evaluation history,
            audience-tailored reports, classifier-edit submission -- ship in
            Phases 2 through 5 per the scoping memo dated 2026-05-28.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/app/dashboard"
              className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
            >
              Go to dashboard
            </Link>
            <Link
              href="/"
              className="rounded-md border border-sage-200 text-sm px-4 py-2 hover:bg-cream-100"
            >
              Public site
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
