// Pattern -- detail view (Phase 3 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 3.1 + 3.2 + 4 + 12.3. Server component: resolves the organization,
// loads the pattern with its components via the Phase 1 persistence helper, and
// renders the full composition (components grouped by L3 group, each labeled
// built-in or custom) plus the status-appropriate lifecycle action (a client
// component). The /app/* gate guarantees a signed-in user reaches this page.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrganization } from '@/lib/auth';
import { getPattern } from '@/lib/data/custom-patterns';
import StatusBadge from '../StatusBadge';
import LifecycleActions from '../LifecycleActions';
import {
  GROUP_ORDER,
  GROUP_LABELS,
  MATCH_MODE_LABELS,
  STATUS_META,
  TAG_SOURCE_LABELS,
  TAG_SOURCE_BADGE_CLASS,
} from '../labels';

export const dynamic = 'force-dynamic';

// ISO -> YYYY-MM-DD. Deterministic (no locale), enough for an audit-style date.
function fmtDate(iso) {
  return typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : null;
}

async function loadPattern(orgId, id) {
  try {
    return { pattern: await getPattern(orgId, id), unavailable: false };
  } catch {
    return { pattern: null, unavailable: true };
  }
}

export default async function PatternDetailPage({ params }) {
  const org = await getOrganization();
  if (!org) redirect('/signup?redirect=/app/patterns');

  const { id } = await params;
  const { pattern, unavailable } = await loadPattern(org.id, id);

  if (!pattern) {
    return <NotFound unavailable={unavailable} />;
  }

  const meta = STATUS_META[pattern.status];
  // Group the components by L3 group, preserving the canonical group order and
  // dropping groups with no components (an unspecified group is a wildcard).
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    components: pattern.components.filter((c) => c.group_name === group),
  })).filter((g) => g.components.length > 0);

  return (
    <main className="min-h-screen bg-cream-50 text-slate-800 px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <nav className="mb-6 text-sm">
          <Link
            href="/app/patterns"
            className="text-slate-600 hover:text-slate-900 hover:underline"
          >
            Patterns
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          <span className="text-slate-500">{pattern.name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{pattern.name}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <span className="font-mono">{pattern.typology}</span>
              <span className="text-slate-300">&middot;</span>
              <span>{MATCH_MODE_LABELS[pattern.match_mode] || pattern.match_mode} match</span>
            </div>
          </div>
          <StatusBadge status={pattern.status} />
        </div>

        {/* Lifecycle */}
        <div className="mt-6 rounded-lg border border-sage-100 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm text-slate-600">{meta ? meta.description : null}</p>
          <LifecycleActions id={pattern.id} status={pattern.status} />
        </div>

        {/* Composition */}
        <Section title={`Components (${pattern.components.length})`}>
          {grouped.length === 0 ? (
            <p className="text-sm text-slate-400">This pattern has no components.</p>
          ) : (
            <div className="space-y-4">
              {grouped.map(({ group, components }) => (
                <div key={group}>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {GROUP_LABELS[group] || group}
                  </h3>
                  <ul className="flex flex-wrap gap-2">
                    {components.map((c) => (
                      <li
                        key={`${c.group_name}-${c.tag_id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-sage-200 bg-white px-2.5 py-1 text-sm"
                      >
                        <span className="font-mono text-slate-700">{c.tag_id}</span>
                        <SourceBadge source={c.tag_source} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* How it matches */}
        <Section title="How it matches">
          <p className="text-sm text-slate-600">
            With <span className="font-medium">Subset</span> matching, this pattern
            fires on an evaluation when{' '}
            <span className="font-medium">every</span> component above is present
            in the evaluation&apos;s classification. Groups not listed here are
            wildcards -- they place no constraint on the match.
          </p>
        </Section>

        {/* Metadata */}
        <Section title="Timeline">
          <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2">
            <Meta label="Created" value={fmtDate(pattern.created_at)} />
          </dl>
        </Section>

        {unavailable && (
          <p className="mt-6 text-xs text-slate-400">
            Some data could not be loaded from the store.
          </p>
        )}
      </div>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SourceBadge({ source }) {
  const label = TAG_SOURCE_LABELS[source] || source;
  const cls =
    TAG_SOURCE_BADGE_CLASS[source] || 'bg-cream-100 text-slate-600 border border-sage-200';
  return (
    <span
      className={`rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value || '--'}</dd>
    </div>
  );
}

function NotFound({ unavailable }) {
  return (
    <main className="min-h-screen bg-cream-50 text-slate-800 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold text-slate-900">Pattern not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          {unavailable
            ? 'The pattern store is not reachable in this environment yet.'
            : 'This pattern does not exist in your organization, or it has been removed.'}
        </p>
        <Link
          href="/app/patterns"
          className="mt-6 inline-flex rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
        >
          Back to patterns
        </Link>
      </div>
    </main>
  );
}
