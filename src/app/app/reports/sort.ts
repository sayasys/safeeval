// Pure sort logic for the /app/reports list. Kept out of the page so the
// ordering rules are unit-testable without rendering a server component. The
// active sort is carried in the URL (?sort=) so the list is linkable and the
// server render is deterministic.

import type { ReportListRow } from '@/lib/data/db-client';
import { AUDIENCE_LABELS } from './audience';

export type ReportSortKey = 'date' | 'evaluation' | 'audience';

export const REPORT_SORT_KEYS: readonly ReportSortKey[] = [
  'date',
  'evaluation',
  'audience',
];

export const DEFAULT_SORT: ReportSortKey = 'date';

// Coerce an arbitrary query value to a known sort key, defaulting to date.
export function normalizeSortKey(value: unknown): ReportSortKey {
  return value === 'evaluation' || value === 'audience' ? value : DEFAULT_SORT;
}

function audienceLabel(a: string): string {
  return (AUDIENCE_LABELS as Record<string, string>)[a] ?? a;
}

// Returns a new sorted array (never mutates the input).
//   date       -> newest first (generated_at desc)
//   evaluation -> evaluation id ascending (numeric-aware: ids are BIGINT)
//   audience   -> audience label A->Z, then newest first within an audience
export function sortReports(
  rows: readonly ReportListRow[],
  key: ReportSortKey,
): ReportListRow[] {
  const copy = [...rows];
  switch (key) {
    case 'evaluation':
      copy.sort((a, b) =>
        (a.evaluation_id || '').localeCompare(b.evaluation_id || '', undefined, {
          numeric: true,
        }),
      );
      break;
    case 'audience':
      copy.sort((a, b) => {
        const byLabel = audienceLabel(a.audience).localeCompare(audienceLabel(b.audience));
        if (byLabel !== 0) return byLabel;
        return (b.generated_at || '').localeCompare(a.generated_at || '');
      });
      break;
    case 'date':
    default:
      copy.sort((a, b) => (b.generated_at || '').localeCompare(a.generated_at || ''));
      break;
  }
  return copy;
}
