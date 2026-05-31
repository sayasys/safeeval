// View-model + display-vocabulary tests for the reports surfaces. These cover
// the pure helpers (recency, date format, id truncation, audience labels) that
// the dashboard widget, list, and detail views share. src/app modules are
// imported via relative paths (the @/ alias is build-time only for the node
// test env).

import { describe, it, expect } from 'vitest';
import {
  recentReports,
  formatReportDate,
  truncateEvaluationId,
  REPORTS_RECENT_LIMIT,
} from '../../src/app/app/reports/model';
import {
  audienceLabel,
  AUDIENCE_LABELS,
  AUDIENCE_ORDER,
} from '../../src/app/app/reports/audience';

function row(id: string, generated_at: string) {
  return { id, evaluation_id: '42', audience: 'reviewer' as const, generated_at };
}

describe('recentReports', () => {
  it('sorts newest first and caps at the recent limit', () => {
    const rows = [
      row('a', '2026-05-01T00:00:00Z'),
      row('b', '2026-05-30T00:00:00Z'),
      row('c', '2026-05-15T00:00:00Z'),
      row('d', '2026-05-20T00:00:00Z'),
    ];
    const recent = recentReports(rows);
    expect(recent).toHaveLength(REPORTS_RECENT_LIMIT);
    expect(recent.map((r) => r.id)).toEqual(['b', 'd', 'c']);
  });

  it('does not mutate the input array', () => {
    const rows = [row('a', '2026-05-01T00:00:00Z'), row('b', '2026-05-30T00:00:00Z')];
    const before = rows.map((r) => r.id);
    recentReports(rows);
    expect(rows.map((r) => r.id)).toEqual(before);
  });

  it('honors a custom limit', () => {
    const rows = [row('a', '2026-05-01T00:00:00Z'), row('b', '2026-05-30T00:00:00Z')];
    expect(recentReports(rows, 1)).toHaveLength(1);
  });
});

describe('formatReportDate', () => {
  it('renders a stable YYYY-MM-DD', () => {
    expect(formatReportDate('2026-05-30T12:34:56Z')).toBe('2026-05-30');
  });
  it('returns empty string for empty input', () => {
    expect(formatReportDate('')).toBe('');
  });
  it('falls back to the leading 10 chars for an unparseable value', () => {
    expect(formatReportDate('not-a-date')).toBe('not-a-date');
  });
});

describe('truncateEvaluationId', () => {
  it('leaves short ids untouched', () => {
    expect(truncateEvaluationId('42')).toBe('42');
  });
  it('truncates long ids with an ascii ellipsis', () => {
    expect(truncateEvaluationId('0123456789abcdef', 12)).toBe('0123456789ab...');
  });
});

describe('audience labels', () => {
  it('maps every closed-set audience to a friendly label', () => {
    expect(AUDIENCE_LABELS.reviewer).toBe('Reviewer');
    expect(AUDIENCE_LABELS.trust_safety_lead).toBe('Trust & Safety lead');
    expect(AUDIENCE_LABELS.exec_summary).toBe('Executive summary');
    expect(AUDIENCE_LABELS.legal).toBe('Legal');
  });
  it('orders legal last (it is access-gated)', () => {
    expect(AUDIENCE_ORDER[AUDIENCE_ORDER.length - 1]).toBe('legal');
    expect([...AUDIENCE_ORDER].sort()).toEqual(
      ['exec_summary', 'legal', 'reviewer', 'trust_safety_lead'],
    );
  });
  it('passes unknown audiences through unchanged', () => {
    expect(audienceLabel('end_user')).toBe('end_user');
  });
});
