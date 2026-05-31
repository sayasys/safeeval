// Policy -- the IA parent for the customization surfaces (2026-05-30 reorg).
//
// Custom L3 classifiers and the named patterns that compose them used to be two
// peer top-nav tabs. They now collapse under a single "Policy" bucket: this
// landing page frames the relationship between the two and routes into each
// sub-page, which keep their own URLs (/app/classifiers, /app/patterns) and
// gain the PolicySubNav tab rail. Server component, gated by the /app/*
// middleware -- an unauthenticated request is redirected to /signup before
// render ever fires.
//
// Fail-open like the dashboard: the portfolio deployment may not have the M13
// tables applied, so a store error surfaces an empty state plus a notice rather
// than 500-ing the page.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrganization } from '@/lib/auth';
import {
  listCustomClassifiers,
  listPatterns,
} from '@/lib/data/custom-patterns';
import ClassifierStatusBadge from '../classifiers/StatusBadge';
import PatternStatusBadge from '../patterns/StatusBadge';
import { recentItems } from '../dashboard/model';

export const dynamic = 'force-dynamic';

// Fetch a list, failing open: on a store error return an empty list plus a flag
// so the page can note the store is unreachable instead of crashing.
async function loadList(fetcher, orgId) {
  try {
    return { items: await fetcher(orgId), unavailable: false };
  } catch {
    return { items: [], unavailable: true };
  }
}

export default async function PolicyPage() {
  const org = await getOrganization();
  if (!org) redirect('/signup?redirect=/app/policy');

  const [classifierResult, patternResult] = await Promise.all([
    loadList(listCustomClassifiers, org.id),
    loadList(listPatterns, org.id),
  ]);
  const unavailable = classifierResult.unavailable || patternResult.unavailable;

  return (
    <main className="min-h-screen bg-tool text-slate-800 px-6 py-12">
      <div className="mx-auto w-full max-w-4xl">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Policy</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Your custom L3 classifiers and the named patterns that compose them.
            Patterns reference classifiers, so define classifiers first if
            you&apos;re new.
          </p>
        </header>

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

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <PolicyCard
            title="Classifiers"
            count={classifierResult.items.length}
            description="Tags your organization adds to one of the closed-set L3 groups. They overlay SafeEval's base classification; they never replace it."
            manageLabel="Manage classifiers"
            manageHref="/app/classifiers"
            emptyCta="Create your first classifier"
            emptyHref="/app/classifiers/new"
          >
            {recentItems(classifierResult.items).map((c) => (
              <RecentRow
                key={c.id}
                href={`/app/classifiers/${c.id}`}
                label={c.tag_name}
                labelClassName="font-mono"
                badge={<ClassifierStatusBadge status={c.status} />}
              />
            ))}
          </PolicyCard>

          <PolicyCard
            title="Patterns"
            count={patternResult.items.length}
            description="Named sets of tags. SafeEval labels an evaluation with a pattern whenever all of its tags appear together."
            manageLabel="Manage patterns"
            manageHref="/app/patterns"
            emptyCta="Create your first pattern"
            emptyHref="/app/patterns/new"
          >
            {recentItems(patternResult.items).map((p) => (
              <RecentRow
                key={p.id}
                href={`/app/patterns/${p.id}`}
                label={p.name}
                labelClassName="font-medium"
                badge={<PatternStatusBadge status={p.status} />}
              />
            ))}
          </PolicyCard>
        </div>

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

function PolicyCard({
  title,
  count,
  description,
  manageLabel,
  manageHref,
  emptyCta,
  emptyHref,
  children,
}) {
  const isEmpty = count === 0;
  return (
    <section className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <span className="text-xs text-slate-500">{count}</span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{description}</p>

      <div className="mt-4 flex-1">
        {isEmpty ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
            <Link
              href={emptyHref}
              className="inline-flex rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90"
            >
              {emptyCta}
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">{children}</ul>
        )}
      </div>

      <Link
        href={manageHref}
        className="mt-4 text-sm font-medium text-brand-blue hover:underline"
      >
        {manageLabel} &rarr;
      </Link>
    </section>
  );
}

function RecentRow({ href, label, labelClassName, badge }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 hover:border-slate-300"
      >
        <span className={`truncate text-sm text-slate-900 ${labelClassName}`}>
          {label}
        </span>
        {badge}
      </Link>
    </li>
  );
}
