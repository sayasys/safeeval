// Status badge for a custom L3 classifier. Presentational and server-safe
// (no client hooks) so it renders inside the list and detail server components.
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 6 (the proposed -> shadow -> live -> retired lifecycle).

import { STATUS_META } from './labels';

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  // Unknown status should never reach here (the closed set is enforced at the
  // schema layer), but degrade to a neutral chip rather than crash a render.
  const label = meta ? meta.label : status;
  const badgeClass = meta
    ? meta.badgeClass
    : 'bg-slate-100 text-slate-500 border border-slate-200';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
    >
      {label}
    </span>
  );
}
