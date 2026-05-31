// Small presentational badge for a report's audience. Cool-palette slate chip
// (reports use slate chrome + brand-blue CTAs per the surface palette rule);
// the audience is a neutral classification, not a severity, so it stays slate
// rather than borrowing any disposition color. Shared across the dashboard
// widget, the /app/reports list, and the detail header.

import { audienceLabel } from './audience';

export default function AudienceBadge({ audience }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      {audienceLabel(audience)}
    </span>
  );
}
