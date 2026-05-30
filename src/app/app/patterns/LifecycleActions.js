'use client';

// Lifecycle action button for a pattern detail view (Phase 3 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 3.1 + 12.3. A pattern has a two-state lifecycle (active | archived) --
// no shadow/live calibration path (that is the custom-classifier lifecycle), so
// there is no promote action. The button shown depends on the status:
//   active   -> "Archive"  (archivePatternAction; owner/admin only)
//   archived -> no action
// The action returns a structured result; failures render inline and the view is
// refreshed on success so the new status badge appears.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { archivePatternAction } from './actions';

export default function LifecycleActions({ id, status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(action) {
    setError(null);
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result && result.ok === false) {
      setError(result.message || 'The action could not be completed.');
      return;
    }
    router.refresh();
  }

  function handleArchive() {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        'Archive this pattern? It stops being matched against new evaluations. Existing evaluations that reference it still resolve.',
      );
      if (!ok) return;
    }
    run(() => archivePatternAction(id));
  }

  if (status === 'archived') {
    return (
      <p className="text-sm text-slate-400">
        This pattern is archived. There are no further actions.
      </p>
    );
  }

  return (
    <div>
      {status === 'active' && (
        <button
          type="button"
          onClick={handleArchive}
          disabled={busy}
          className="rounded-md border border-coral-500 text-coral-600 text-sm font-medium px-4 py-2 hover:bg-coral-400/10 disabled:opacity-50"
        >
          {busy ? 'Archiving...' : 'Archive'}
        </button>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-coral-600">
          {error}
        </p>
      )}
    </div>
  );
}
