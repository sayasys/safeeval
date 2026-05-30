// Pattern composer -- create page (Phase 3 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 4 + 12.3. Server component: resolves the organization, fetches the
// org's custom L3 classifiers (so the composer can offer the org's own shadow /
// live tags alongside the built-in closed set) and the existing pattern names
// (so the form can warn on a duplicate name before the round-trip), then renders
// the client composer. The /app/* gate guarantees a signed-in user reaches here.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrganization } from '@/lib/auth';
import {
  listCustomClassifiers,
  listPatterns,
} from '@/lib/data/custom-patterns';
import PatternComposerForm from '../PatternComposerForm';

export const dynamic = 'force-dynamic';

// Custom classifiers eligible for composition are those in shadow or live status
// (memo 12.3: an org composes patterns from its own non-proposed, non-retired
// tags). Grouped by L3 group for the composer's per-group pickers.
async function loadCustomByGroup(orgId) {
  try {
    const classifiers = await listCustomClassifiers(orgId);
    const byGroup = {};
    for (const c of classifiers) {
      if (c.status !== 'shadow' && c.status !== 'live') continue;
      (byGroup[c.group_name] = byGroup[c.group_name] || []).push(c.tag_name);
    }
    return byGroup;
  } catch {
    // Fail open -- the composer still offers the built-in closed set.
    return {};
  }
}

async function loadExistingNames(orgId) {
  try {
    const patterns = await listPatterns(orgId);
    return patterns.map((p) => p.name);
  } catch {
    // Fail open -- the duplicate warning is a convenience; the persistence layer
    // is the real uniqueness guard.
    return [];
  }
}

export default async function NewPatternPage() {
  const org = await getOrganization();
  if (!org) redirect('/signup?redirect=/app/patterns/new');

  const [customByGroup, existingNames] = await Promise.all([
    loadCustomByGroup(org.id),
    loadExistingNames(org.id),
  ]);

  return (
    <main className="min-h-screen bg-tool text-slate-800 px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <nav className="mb-6 text-sm">
          <Link
            href="/app/patterns"
            className="text-slate-600 hover:text-slate-900 hover:underline"
          >
            Patterns
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          <span className="text-slate-500">New</span>
        </nav>

        <h1 className="text-2xl font-semibold text-slate-900">New pattern</h1>
        <p className="mt-1 mb-8 max-w-xl text-sm text-slate-600">
          Compose a named combination of L3 tags. The pattern matches an
          evaluation when every tag you name is present in its classification --
          a checklist over SafeEval&apos;s base envelope. It overlays the base
          classification; it never replaces it.
        </p>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <PatternComposerForm
            customByGroup={customByGroup}
            existingNames={existingNames}
          />
        </div>
      </div>
    </main>
  );
}
