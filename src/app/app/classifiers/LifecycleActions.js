'use client';

// Lifecycle action buttons for a custom L3 classifier detail view (Phase 2 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 6. The button shown depends on the classifier's status:
//   proposed -> "Move to shadow"  (promoteToShadowAction)
//   shadow   -> "Awaiting calibration" (disabled; promote-to-live is Phase 4)
//   live     -> "Retire"          (retireClassifierAction; owner/admin only)
//   retired  -> no action
// Each action returns a structured result; failures render inline and the view
// is refreshed on success so the new status badge appears.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { promoteToShadowAction, retireClassifierAction } from './actions';

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

  function handleRetire() {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        'Retire this classifier? It stops being evaluated against new inputs. Existing evaluations that reference it still render.',
      );
      if (!ok) return;
    }
    run(() => retireClassifierAction(id));
  }

  return (
    <div>
      {status === 'proposed' && (
        <button
          type="button"
          onClick={() => run(() => promoteToShadowAction(id))}
          disabled={busy}
          className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Moving...' : 'Move to shadow'}
        </button>
      )}

      {status === 'shadow' && (
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Promotion to live arrives in a later phase."
          className="rounded-md border border-sage-200 text-sm font-medium px-4 py-2 text-slate-400 cursor-not-allowed"
        >
          Awaiting calibration
        </button>
      )}

      {status === 'live' && (
        <button
          type="button"
          onClick={handleRetire}
          disabled={busy}
          className="rounded-md border border-coral-500 text-coral-600 text-sm font-medium px-4 py-2 hover:bg-coral-400/10 disabled:opacity-50"
        >
          {busy ? 'Retiring...' : 'Retire'}
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
