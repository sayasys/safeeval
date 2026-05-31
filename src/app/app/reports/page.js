// Reports -- list view. Server component, gated by the /app/* middleware.
//
// Lists every report the caller's org has generated (scoped via the evaluation
// FK; the single-tenant portfolio sees all). Sortable by date (default, newest
// first), evaluation id, or audience -- the active sort lives in ?sort= so the
// view is linkable and the server render is deterministic. Reports are reached
// from here, the dashboard widget, and the result card -- never the top nav.
//
// Fail-open like the rest of /app: an unreachable data layer yields an empty
// list + notice rather than a 500.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrganization } from '@/lib/auth';
import { listReports, scopeForOrg } from '@/lib/data';
import AudienceBadge from './AudienceBadge';
import { formatReportDate, truncateEvaluationId } from './model';
import { sortReports, normalizeSortKey, REPORT_SORT_KEYS } from './sort';

export const dynamic = 'force-dynamic';

const SORT_LABELS = {
  date: 'Date',
  evaluation: 'Evaluation',
  audience: 'Audience',
};

async function loadReports(org) {
  try {
    return { items: await listReports(scopeForOrg(org)), unavailable: false };
  } catch {
    return { items: [], unavailable: true };
  }
}

export default async function ReportsListPage({ searchParams }) {
  const org = await getOrganization();
  if (!org) redirect('/signup?redirect=/app/reports');

  const sp = (await searchParams) || {};
  const sort = normalizeSortKey(sp.sort);

  const { items, unavailable } = await loadReports(org);
  const rows = sortReports(items, sort);

  return (
    <main className="min-h-screen bg-tool text-slate-800 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-600">
            Audience-tailored summaries generated from your evaluations.
          </p>
        </header>

        {unavailable && (
          <div
            role="status"
            className="mb-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          >
            The reports store is not reachable in this environment yet. Once the
            data layer is provisioned, your organization&apos;s reports appear
            here.
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
              <span>Sort by</span>
              {REPORT_SORT_KEYS.map((key) => {
                const active = key === sort;
                return (
                  <Link
                    key={key}
                    href={key === 'date' ? '/app/reports' : `/app/reports?sort=${key}`}
                    aria-current={active ? 'true' : undefined}
                    className={
                      active
                        ? 'rounded-full bg-slate-900 px-2.5 py-1 font-medium text-white'
                        : 'rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 hover:border-slate-300'
                    }
                  >
                    {SORT_LABELS[key]}
                  </Link>
                );
              })}
            </div>

            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id}>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <AudienceBadge audience={r.audience} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900">
                          {formatReportDate(r.generated_at)}
                        </div>
                        {/* No per-evaluation detail route exists, so the id is
                            shown as reference text rather than a dead link. */}
                        <div className="truncate font-mono text-xs text-slate-500">
                          eval {truncateEvaluationId(r.evaluation_id)}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/app/reports/${r.id}`}
                      className="shrink-0 text-sm font-medium text-brand-blue hover:underline"
                    >
                      View report &rarr;
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </>
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
      <h2 className="text-lg font-semibold text-slate-900">No reports yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        Reports turn evaluations into audience-tailored summaries. Generate one
        from the Evaluator&apos;s result card.
      </p>
      <Link
        href="/evaluator"
        className="mt-6 inline-flex rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90"
      >
        Open the evaluator
      </Link>
    </div>
  );
}
