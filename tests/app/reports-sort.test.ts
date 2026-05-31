// Tests for the /app/reports list sort logic (src/app/app/reports/sort.ts).

import { describe, it, expect } from 'vitest';
import {
  sortReports,
  normalizeSortKey,
  DEFAULT_SORT,
} from '../../src/app/app/reports/sort';
import type { ReportListRow } from '../../src/lib/data/db-client';

function r(
  id: string,
  evaluation_id: string,
  audience: ReportListRow['audience'],
  generated_at: string,
): ReportListRow {
  return { id, evaluation_id, audience, generated_at };
}

const ROWS: ReportListRow[] = [
  r('1', '20', 'reviewer', '2026-05-10T00:00:00Z'),
  r('2', '3', 'legal', '2026-05-30T00:00:00Z'),
  r('3', '100', 'exec_summary', '2026-05-20T00:00:00Z'),
];

describe('normalizeSortKey', () => {
  it('passes through known keys', () => {
    expect(normalizeSortKey('evaluation')).toBe('evaluation');
    expect(normalizeSortKey('audience')).toBe('audience');
    expect(normalizeSortKey('date')).toBe('date');
  });
  it('defaults unknown / missing values to date', () => {
    expect(normalizeSortKey(undefined)).toBe(DEFAULT_SORT);
    expect(normalizeSortKey('bogus')).toBe('date');
    expect(normalizeSortKey(42)).toBe('date');
  });
});

describe('sortReports', () => {
  it('date: newest first', () => {
    expect(sortReports(ROWS, 'date').map((x) => x.id)).toEqual(['2', '3', '1']);
  });

  it('evaluation: numeric ascending (BIGINT-aware, not lexical)', () => {
    // Lexical order would put '100' before '20'; numeric keeps 3 < 20 < 100.
    expect(sortReports(ROWS, 'evaluation').map((x) => x.evaluation_id)).toEqual([
      '3',
      '20',
      '100',
    ]);
  });

  it('audience: by label A->Z (Executive summary, Legal, Reviewer)', () => {
    expect(sortReports(ROWS, 'audience').map((x) => x.audience)).toEqual([
      'exec_summary',
      'legal',
      'reviewer',
    ]);
  });

  it('does not mutate the input array', () => {
    const before = ROWS.map((x) => x.id);
    sortReports(ROWS, 'evaluation');
    expect(ROWS.map((x) => x.id)).toEqual(before);
  });
});
