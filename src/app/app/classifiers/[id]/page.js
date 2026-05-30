// Custom L3 classifier -- detail view (Phase 2 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 5 + 6. Server component: resolves the organization, loads the
// classifier with its examples via the Phase 1 persistence helper, and renders
// the full definition plus the status-appropriate lifecycle action (a client
// component). The /app/* gate guarantees a signed-in user reaches this page.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrganization } from '@/lib/auth';
import { getCustomClassifier } from '@/lib/data/custom-patterns';
import StatusBadge from '../StatusBadge';
import LifecycleActions from '../LifecycleActions';
import { GROUP_LABELS, STATUS_META } from '../labels';

export const dynamic = 'force-dynamic';

// ISO -> YYYY-MM-DD. Deterministic (no locale), enough for an audit-style date.
function fmtDate(iso) {
  return typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : null;
}

async function loadClassifier(orgId, id) {
  try {
    return { classifier: await getCustomClassifier(orgId, id), unavailable: false };
  } catch {
    return { classifier: null, unavailable: true };
  }
}

export default async function ClassifierDetailPage({ params }) {
  const org = await getOrganization();
  if (!org) redirect('/signup?redirect=/app/classifiers');

  const { id } = await params;
  const { classifier, unavailable } = await loadClassifier(org.id, id);

  if (!classifier) {
    return <NotFound unavailable={unavailable} />;
  }

  const positives = classifier.examples.filter((e) => e.kind === 'positive');
  const negatives = classifier.examples.filter((e) => e.kind === 'negative');
  const meta = STATUS_META[classifier.status];

  return (
    <main className="min-h-screen bg-cream-50 text-slate-800 px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <nav className="mb-6 text-sm">
          <Link
            href="/app/classifiers"
            className="text-slate-600 hover:text-slate-900 hover:underline"
          >
            Custom classifiers
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          <span className="font-mono text-slate-500">{classifier.tag_name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold text-slate-900">
              {classifier.tag_name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {GROUP_LABELS[classifier.group_name] || classifier.group_name} group
            </p>
          </div>
          <StatusBadge status={classifier.status} />
        </div>

        {/* Lifecycle */}
        <div className="mt-6 rounded-lg border border-sage-100 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm text-slate-600">
            {meta ? meta.description : null}
          </p>
          <LifecycleActions id={classifier.id} status={classifier.status} />
        </div>

        {/* Definition */}
        <Section title="Definition">
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {classifier.definition}
          </p>
        </Section>

        {/* Examples */}
        <Section title={`Positive examples (${positives.length})`}>
          <ExampleRows rows={positives} empty="No positive examples." />
        </Section>
        <Section title={`Negative examples (${negatives.length})`}>
          <ExampleRows rows={negatives} empty="No negative examples." />
        </Section>

        {/* Metadata */}
        <Section title="Timeline">
          <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2">
            <Meta label="Created" value={fmtDate(classifier.created_at)} />
            <Meta label="Moved to shadow" value={fmtDate(classifier.shadow_started_at)} />
            <Meta label="Promoted to live" value={fmtDate(classifier.promoted_at)} />
            <Meta label="Retired" value={fmtDate(classifier.retired_at)} />
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

function ExampleRows({ rows, empty }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((e) => (
        <li
          key={e.id}
          className="rounded-md border border-sage-100 bg-white px-3 py-2 text-sm text-slate-700"
        >
          {e.text}
        </li>
      ))}
    </ul>
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
        <h1 className="text-xl font-semibold text-slate-900">
          Classifier not found
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {unavailable
            ? 'The classifier store is not reachable in this environment yet.'
            : 'This classifier does not exist in your organization, or it has been removed.'}
        </p>
        <Link
          href="/app/classifiers"
          className="mt-6 inline-flex rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
        >
          Back to classifiers
        </Link>
      </div>
    </main>
  );
}
