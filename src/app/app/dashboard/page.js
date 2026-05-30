// SaaS auth Phase 1 -- gated stub. Same gate as /app/welcome. Phase 3
// replaces this with the real org dashboard (recent evaluations summary,
// plan tier card, quota usage). Phase 1 keeps the page deliberately empty
// of product surface so the closure-report verification can confirm the
// gate fires without asserting downstream features.

import Link from 'next/link';

export default function AppDashboardPage() {
  return (
    <main className="min-h-screen bg-cream-50 text-slate-800 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="bg-white border border-sage-100 rounded-lg p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900 mb-3">
            Dashboard
          </h1>
          <p className="text-slate-700 mb-2">
            Phase 1 stub. Real surfaces -- recent evaluations, plan tier,
            quota usage -- arrive in Phase 3 per the scoping memo dated
            2026-05-28.
          </p>
          <p className="text-slate-700 mb-6">
            The middleware confirmed you are signed in before serving this
            page. The Phase 1 organization model returns a personal-org stub
            keyed to your auth_user_id; Phase 2's M6 migration replaces the
            stub with a real organizations table.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/app/classifiers"
              className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
            >
              Custom classifiers
            </Link>
            <Link
              href="/app/welcome"
              className="rounded-md border border-sage-200 text-sm px-4 py-2 hover:bg-cream-100"
            >
              Welcome page
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
