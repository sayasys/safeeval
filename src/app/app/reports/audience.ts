// Display vocabulary for report audiences. The engine/route audience column is
// a closed set (ReportAudienceColumn: reviewer | trust_safety_lead | legal |
// exec_summary); this maps each to the human-facing label shown across the
// reports surfaces -- the dashboard widget, the result-card picker, the
// /app/reports list, and the detail view. Kept as plain data so the label set
// lives in one place and both server and client components read from it.
//
// Note on "Executive summary": the exec_summary column is surfaced to users as
// "Executive summary". An earlier brief referred to this audience as
// "Executive"; the route accepts the column name exec_summary, so the picker
// submits exec_summary while displaying the friendly label.

import type { ReportAudienceColumn } from '@/lib/data/db-client';

export const AUDIENCE_LABELS: Record<ReportAudienceColumn, string> = {
  reviewer: 'Reviewer',
  trust_safety_lead: 'Trust & Safety lead',
  exec_summary: 'Executive summary',
  legal: 'Legal',
};

// One-line description of what each audience report is for. Drives the picker
// option subtitles and the detail-view header.
export const AUDIENCE_DESCRIPTIONS: Record<ReportAudienceColumn, string> = {
  reviewer:
    'A working analyst summary: the disposition, the signals that drove it, and what to check.',
  trust_safety_lead:
    'A concise lead-level readout focused on the decision and its policy basis.',
  exec_summary:
    'A short non-technical summary for leadership -- the call and why it matters.',
  legal:
    'A chain-of-custody framing for legal review. Requires the PII reviewer role.',
};

// Display order used by the picker and any audience-grouped views. Legal sits
// last because it is access-gated.
export const AUDIENCE_ORDER: readonly ReportAudienceColumn[] = [
  'reviewer',
  'trust_safety_lead',
  'exec_summary',
  'legal',
];

export function audienceLabel(audience: string): string {
  return (AUDIENCE_LABELS as Record<string, string>)[audience] ?? audience;
}
