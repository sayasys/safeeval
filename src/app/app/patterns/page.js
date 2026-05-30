// Patterns -- list view (Phase 3 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 4 + 12.3. Server component: resolves the current organization, lists
// its patterns (with components hydrated for the count) via the Phase 1
// persistence helper, and groups them by lifecycle status (active | archived).
// The /app/* middleware gate guarantees a signed-in user reaches this page; an
// unauthenticated request is redirected to /signup before render ever fires.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrganization } from '@/lib/auth';
import { listPatternsWithComponents } from '@/lib/data/custom-patterns';
import StatusBadge from './StatusBadge';
import { MATCH_MODE_LABELS, STATUS_DISPLAY_ORDER } from './labels';

// Reads the session cookie -> must be dynamic.
export const dynamic = 'force-dynamic';

// Fetch the org's patterns, failing open. The portfolio deployment may not have
// the M13 tables applied; rather than 500 the page, we surface an empty list
// plus a notice so the gate verification (and the eventual real backend) both
// behave.
async function loadPatterns(orgId) {
  try {
    const patterns = await listPatternsWithComponents(orgId);
    return { patterns, unavailable: false };
  } catch {
    return { patterns: [], unavailable: true };
  }
}

export default async function PatternsListPage() {
  const org = await getOrganization();
  // Defensive: middleware guarantees a session, but if the org cannot be
  // resolved there is nothing to scope to -- send the user back through signup.
  if (!org) redirect('/signup?redirect=/app/patterns');

  const { patterns, unavailable } = await loadPatterns(org.id);

  const byStatus = STATUS_DISPLAY_ORDER.map((status) => ({
    status,
    rows: patterns.filter((p) => p.status === status),
  })).filter((group) => group.rows.length > 0);

  return (
    <main className="min-h-screen bg-cream-50 text-slate-800 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Patterns</h1>
            <p className="mt-1 text-sm text-slate-600">
              Named compositions your organization defines from L3 tags. A
              pattern matches an evaluation when every tag it names is present --
              a checklist over SafeEval&apos;s base classification.
            </p>
          </div>
          <Link
            href="/app/patterns/new"
            className="shrink-0 rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
          >
            New pattern
          </Link>
        </div>

        {unavailable && (
          <div
            role="status"
            className="mb-6 rounded-md border border-sage-200 bg-sage-50 text-sage-700 text-sm px-4 py-3"
          >
            The pattern store is not reachable in this environment yet. Once the
            data layer is provisioned, your organization&apos;s patterns appear
            here.
          </div>
        )}

        {patterns.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-8">
            {byStatus.map((group) => (
              <section key={group.status}>
                <div className="mb-3 flex items-center gap-2">
                  <StatusBadge status={group.status} />
                  <span className="text-xs text-slate-500">
                    {group.rows.length}
                  </span>
                </div>
                <ul className="space-y-2">
                  {group.rows.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/app/patterns/${p.id}`}
                        className="block rounded-lg border border-sage-100 bg-white px-4 py-3 shadow-sm hover:border-sage-300"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-slate-900">
                            {p.name}
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            {p.typology}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-md border border-sage-200 bg-cream-100 px-1.5 py-0.5">
                            {MATCH_MODE_LABELS[p.match_mode] || p.match_mode}
                          </span>
                          <span>
                            {p.components.length}{' '}
                            {p.components.length === 1 ? 'component' : 'components'}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="mt-10 border-t border-sage-100 pt-6">
          <Link
            href="/app/dashboard"
            className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-sage-300 bg-white px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-slate-900">No patterns yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        A pattern is a named combination of L3 tags -- built-in ones plus your
        own custom classifiers -- that you want to label when they co-occur. The
        composer walks you through picking components group by group.
      </p>
      <Link
        href="/app/patterns/new"
        className="mt-6 inline-flex rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
      >
        Create your first pattern
      </Link>
    </div>
  );
}
