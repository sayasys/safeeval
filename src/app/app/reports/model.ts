// Pure view-model helpers for the reports surfaces. Kept separate from the JSX
// so the recency, date-format, and id-truncation logic is unit-testable without
// rendering a server component (the test env is node, no DOM).

import type { ReportListRow } from '@/lib/data/db-client';

// How many recent reports the dashboard widget previews before "See all" takes
// over. Matches the dashboard's RECENT_LIMIT for classifiers/patterns.
export const REPORTS_RECENT_LIMIT = 3;

// Newest first by generated_at, capped at `limit`. Copies the array so the
// caller's list is never mutated; rows without a timestamp sort to the end.
export function recentReports(
  rows: readonly ReportListRow[],
  limit: number = REPORTS_RECENT_LIMIT,
): ReportListRow[] {
  return [...rows]
    .sort((a, b) => (b.generated_at || '').localeCompare(a.generated_at || ''))
    .slice(0, limit);
}

// Stable YYYY-MM-DD rendering. Uses the ISO date directly rather than
// toLocaleDateString so server-rendered output is deterministic (no timezone /
// locale drift between SSR and any later hydration).
export function formatReportDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// Evaluation ids are BIGINT strings (usually short), but the column is rendered
// in tight rows; truncate defensively with an ASCII ellipsis so a long id never
// blows out the layout.
export function truncateEvaluationId(id: string, max: number = 12): string {
  if (!id) return '';
  return id.length <= max ? id : id.slice(0, max) + '...';
}
