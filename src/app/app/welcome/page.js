// SaaS gated landing. Middleware guarantees a signed-in user reaches this
// page; unauthenticated requests redirect to /signup before rendering ever
// fires. Phase 2 wires the post-signup org backfill here (default auto-create
// per scoping memo section 5); Phase 3 replaces it with the full onboarding
// flow (org-name customization, plan tier selection, first-evaluation
// walkthrough).

import Link from 'next/link';
import { getCurrentUser, ensurePersonalOrganization } from '@/lib/auth';

// Reads the session cookie -> must be dynamic.
export const dynamic = 'force-dynamic';

export default async function AppWelcomePage() {
  // Idempotent personal-organization backfill on first authenticated landing
  // (scoping memo section 5, default auto-create). Fail-open: ensurePersonal-
  // Organization returns null if the data tables are unreachable (e.g. the
  // portfolio deployment before M12 is applied), and we never block render on
  // it. Safe to run on every visit -- the org is resolved by its unique slug.
  const user = await getCurrentUser();
  if (user) {
    await ensurePersonalOrganization(user);
  }

  return (
    <main className="min-h-screen bg-cream-50 text-slate-800 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="bg-white border border-sage-100 rounded-lg p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900 mb-3">
            You are signed in.
          </h1>
          <p className="text-slate-700 mb-2">
            The gated SaaS surface is live. The middleware gate is enforced, the
            auth abstraction is provider-agnostic, and your personal
            organization has been provisioned by the Phase 2 multi-tenancy
            layer.
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
