// Custom L3 classifier -- create page (Phase 2 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 5. Server component: resolves the organization, fetches the existing
// classifiers (so the form can warn on a duplicate tag-name + group before the
// round-trip), and renders the client definition form. The /app/* gate
// guarantees a signed-in user reaches this page.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrganization } from '@/lib/auth';
import { listCustomClassifiers } from '@/lib/data/custom-patterns';
import ClassifierForm from '../ClassifierForm';

export const dynamic = 'force-dynamic';

async function loadExisting(orgId) {
  try {
    const rows = await listCustomClassifiers(orgId);
    return rows.map((c) => ({ tag_name: c.tag_name, group_name: c.group_name }));
  } catch {
    // Fail open -- the duplicate warning is a convenience; the persistence
    // layer is the real uniqueness guard.
    return [];
  }
}

export default async function NewClassifierPage() {
  const org = await getOrganization();
  if (!org) redirect('/signup?redirect=/app/classifiers/new');

  const existing = await loadExisting(org.id);

  return (
    <main className="min-h-screen bg-tool text-slate-800 px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <nav className="mb-6 text-sm">
          <Link
            href="/app/classifiers"
            className="text-slate-600 hover:text-slate-900 hover:underline"
          >
            Custom classifiers
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          <span className="text-slate-500">New</span>
        </nav>

        <h1 className="text-2xl font-semibold text-slate-900">
          New custom classifier
        </h1>
        <p className="mt-1 mb-8 max-w-xl text-sm text-slate-600">
          Define a single tag your organization adds to one of the closed-set L3
          groups. It overlays SafeEval&apos;s base classification -- the agnostic
          L1 / L2 / L3 envelope is always present regardless of what you add.
        </p>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <ClassifierForm existing={existing} />
        </div>
      </div>
    </main>
  );
}
