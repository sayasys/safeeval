'use client';

// Lifecycle action buttons for a custom L3 classifier detail view.
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 6. The control shown depends on the classifier's status:
//   proposed -> "Move to shadow"  (promoteToShadowAction)
//   shadow   -> promotion gate (Phase 4): "Ready to promote" + "I accept
//               calibration risk" checkbox + Promote button when the readiness
//               gate is met (memo 6.3 / 6.4); otherwise a read-only progress
//               line ("23/50 evaluations, 4/10 feedback events, precision 0.68").
//   live     -> "Retire"          (retireClassifierAction; owner/admin only)
//   retired  -> no action
// Each action returns a structured result; failures render inline and the view
// is refreshed on success so the new status badge appears. The server-side gate
// in promoteToLive is the bright line -- the checkbox is acknowledgment only.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  promoteToShadowAction,
  promoteToLiveAction,
  retireClassifierAction,
} from './actions';
// Import the gate thresholds from the pure constants module (NOT the barrel,
// which pulls server-only deps like the Anthropic SDK into the client bundle) so
// the progress line never drifts from the values the server-side gate enforces.
import {
  PROMOTION_VOLUME_N,
  PROMOTION_FEEDBACK_M,
} from '@/lib/data/custom-patterns/constants';

export default function LifecycleActions({ id, status, readiness }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [riskAccepted, setRiskAccepted] = useState(false);

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
        <ShadowPromotion
          readiness={readiness}
          busy={busy}
          riskAccepted={riskAccepted}
          onToggleRisk={setRiskAccepted}
          onPromote={() => run(() => promoteToLiveAction(id))}
        />
      )}

      {status === 'live' && (
        <button
          type="button"
          onClick={handleRetire}
          disabled={busy}
          className="rounded-md border border-red-500 text-red-600 text-sm font-medium px-4 py-2 hover:bg-red-400/10 disabled:opacity-50"
        >
          {busy ? 'Retiring...' : 'Retire'}
        </button>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// The shadow-status control. When readiness.ready is true, the "Ready to promote"
// banner + risk-acceptance checkbox + Promote button (memo 6.4). Otherwise a
// read-only calibration-progress line. When readiness is null (store unreachable
// or not yet computed) we fall back to the static "Awaiting calibration" label.
function ShadowPromotion({ readiness, busy, riskAccepted, onToggleRisk, onPromote }) {
  if (!readiness) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Calibration progress is unavailable in this environment."
        className="rounded-md border border-sage-200 text-sm font-medium px-4 py-2 text-slate-400 cursor-not-allowed"
      >
        Awaiting calibration
      </button>
    );
  }

  if (!readiness.ready) {
    return (
      <div>
        <p className="text-sm font-medium text-slate-700">Awaiting calibration</p>
        <p className="mt-1 text-xs text-slate-500">{formatProgress(readiness)}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-sage-700">Ready to promote</p>
      <p className="mt-1 text-xs text-slate-500">{formatProgress(readiness)}</p>
      <label className="mt-3 flex items-start gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={riskAccepted}
          onChange={(e) => onToggleRisk(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I accept calibration risk. Promoting makes this classifier appear in
          member-facing evaluation cards; calibration may drift as production
          traffic broadens, and our organization remains responsible for monitoring
          its accuracy.
        </span>
      </label>
      <button
        type="button"
        onClick={onPromote}
        disabled={busy || !riskAccepted}
        className="mt-3 rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? 'Promoting...' : 'Promote to live'}
      </button>
    </div>
  );
}

// Render the readiness snapshot as a compact progress line, e.g.
// "23/50 evaluations, 4/10 feedback events, 1 reviewer, precision 0.68".
function formatProgress(r) {
  const precision = (Math.round(r.precision_proxy * 100) / 100).toFixed(2);
  const reviewers =
    r.distinct_reviewers === 1 ? '1 reviewer' : `${r.distinct_reviewers} reviewers`;
  return (
    `${r.evaluations_count}/${PROMOTION_VOLUME_N} evaluations, ` +
    `${r.feedback_events_count}/${PROMOTION_FEEDBACK_M} feedback events, ` +
    `${reviewers}, precision ${precision}`
  );
}
