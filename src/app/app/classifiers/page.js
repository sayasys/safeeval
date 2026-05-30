// Custom L3 classifiers -- list view (Phase 2 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 12.2. Server component: resolves the current organization, lists its
// custom L3 classifiers via the Phase 1 persistence helper, and groups them by
// lifecycle status. The /app/* middleware gate guarantees a signed-in user
// reaches this page; an unauthenticated request is redirected to /signup before
// render ever fires.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrganization } from '@/lib/auth';
import { listCustomClassifiers } from '@/lib/data/custom-patterns';
import StatusBadge from './StatusBadge';
import { GROUP_LABELS, STATUS_DISPLAY_ORDER } from './labels';

// Reads the session cookie -> must be dynamic.
export const dynamic = 'force-dynamic';

// Fetch the org's classifiers, failing open. The portfolio deployment may not
// have the M13 tables applied; rather than 500 the page, we surface an empty
// list plus a notice so the gate verification (and the eventual real backend)
// both behave.
async function loadClassifiers(orgId) {
  try {
    const classifiers = await listCustomClassifiers(orgId);
    return { classifiers, unavailable: false };
  } catch {
    return { classifiers: [], unavailable: true };
  }
}

export default async function ClassifiersListPage() {
  const org = await getOrganization();
  // Defensive: middleware guarantees a session, but if the org cannot be
  // resolved there is nothing to scope to -- send the user back through signup.
  if (!org) redirect('/signup?redirect=/app/classifiers');

  const { classifiers, unavailable } = await loadClassifiers(org.id);

  const byStatus = STATUS_DISPLAY_ORDER.map((status) => ({
    status,
    rows: classifiers.filter((c) => c.status === status),
  })).filter((group) => group.rows.length > 0);

  return (
    <main className="min-h-screen bg-tool text-slate-800 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Custom classifiers
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Tags your organization adds to one of the closed-set L3 groups.
              They overlay SafeEval&apos;s base classification; they never
              replace it.
            </p>
          </div>
          <Link
            href="/app/classifiers/new"
            className="shrink-0 rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
          >
            New classifier
          </Link>
        </div>

        {unavailable && (
          <div
            role="status"
            className="mb-6 rounded-md border border-slate-200 bg-slate-50 text-slate-700 text-sm px-4 py-3"
          >
            The classifier store is not reachable in this environment yet. Once
            the data layer is provisioned, your organization&apos;s classifiers
            appear here.
          </div>
        )}

        {classifiers.length === 0 ? (
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
                  {group.rows.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/app/classifiers/${c.id}`}
                        className="block rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-sm text-slate-900">
                            {c.tag_name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {GROUP_LABELS[c.group_name] || c.group_name}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                          {c.definition}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="mt-10 border-t border-slate-200 pt-6">
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
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-slate-900">
        No custom classifiers yet
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        A custom classifier is a single tag your organization adds to one of the
        six closed-set L3 groups, defined through a structured form so the model
        reads it as reference material -- never as instructions.
      </p>
      <Link
        href="/app/classifiers/new"
        className="mt-6 inline-flex rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
      >
        Create your first
      </Link>
    </div>
  );
}
