// The signed-in home. Shows the current organization, a preview of its custom
// classifiers and patterns, and a way into the evaluator. The middleware
// guarantees a session before this renders; reading it means the page is
// request-time, never static.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrganization } from '@/lib/auth';
import {
  listCustomClassifiers,
  listPatterns,
} from '@/lib/data/custom-patterns';
import ClassifierStatusBadge from '../classifiers/StatusBadge';
import PatternStatusBadge from '../patterns/StatusBadge';
import { buildDashboardModel } from './model';

export const dynamic = 'force-dynamic';

// Fetch a list, failing open. The portfolio deployment may not have the data
// tables applied yet; rather than 500 the dashboard, return an empty list and a
// flag so the page can note that the store is not reachable.
async function loadList(fetcher, orgId) {
  try {
    return { items: await fetcher(orgId), unavailable: false };
  } catch {
    return { items: [], unavailable: true };
  }
}

export default async function AppDashboardPage() {
  const org = await getOrganization();
  // Middleware guarantees a session, but if the organization cannot be resolved
  // there is nothing to scope to -- send the user back through signup.
  if (!org) redirect('/signup?redirect=/app/dashboard');

  const [classifierResult, patternResult] = await Promise.all([
    loadList(listCustomClassifiers, org.id),
    loadList(listPatterns, org.id),
  ]);

  const model = buildDashboardModel({
    org,
    classifiers: classifierResult.items,
    patterns: patternResult.items,
  });
  const unavailable = classifierResult.unavailable || patternResult.unavailable;

  return (
    <main className="min-h-screen bg-tool text-slate-800 px-6 py-12">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Your organization
          </h2>
          <dl className="mt-3 grid gap-4 sm:grid-cols-3">
            <SummaryField label="Name" value={model.orgName} />
            <SummaryField label="Role" value={model.roleLabel} />
            <SummaryField label="Plan" value={model.planLabel} />
          </dl>
        </section>

        {unavailable && (
          <div
            role="status"
            className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          >
            Your saved work is not reachable in this environment yet. Once the
            data layer is provisioned, your classifiers and patterns appear
            here.
          </div>
        )}

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <DashboardCard
            title="Your custom classifiers"
            count={model.classifiers.count}
            seeAllHref="/app/classifiers"
          >
            {model.classifiers.isEmpty ? (
              <EmptyState
                description="Custom classifiers add your own tags to SafeEval's output, so an evaluation can flag the behavior your team watches for."
                cta="Create your first classifier"
                href="/app/classifiers/new"
              />
            ) : (
              <ul className="space-y-2">
                {model.classifiers.recent.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/app/classifiers/${c.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 hover:border-slate-300"
                    >
                      <span className="truncate font-mono text-sm text-slate-900">
                        {c.tag_name}
                      </span>
                      <ClassifierStatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>

          <DashboardCard
            title="Your patterns"
            count={model.patterns.count}
            seeAllHref="/app/patterns"
          >
            {model.patterns.isEmpty ? (
              <EmptyState
                description="Patterns are named sets of tags. SafeEval labels an evaluation with one whenever all of its tags appear together."
                cta="Create your first pattern"
                href="/app/patterns/new"
              />
            ) : (
              <ul className="space-y-2">
                {model.patterns.recent.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/app/patterns/${p.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 hover:border-slate-300"
                    >
                      <span className="truncate text-sm font-medium text-slate-900">
                        {p.name}
                      </span>
                      <PatternStatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>
        </div>

        <section className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Try the evaluator
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Run any input through SafeEval and read the evaluation, the same
              way the public demo does.
            </p>
          </div>
          <Link
            href="/evaluator"
            className="inline-flex w-fit shrink-0 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Open the evaluator
          </Link>
        </section>
      </div>
    </main>
  );
}

function SummaryField({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function DashboardCard({ title, count, seeAllHref, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <span className="text-xs text-slate-500">{count}</span>
        </div>
        <Link
          href={seeAllHref}
          className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
        >
          See all &rarr;
        </Link>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ description, cta, href }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
      <p className="mx-auto max-w-sm text-sm text-slate-600">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        {cta}
      </Link>
    </div>
  );
}
