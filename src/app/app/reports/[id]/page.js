// Reports -- detail view. Server component, gated by the /app/* middleware.
//
// Renders one generated report: a header (audience badge, evaluation source id,
// generated-at), the report markdown body, and actions (download the markdown,
// back to the list). Org-scoped via getReport -- a report belonging to another
// org (real multi-tenant) resolves to the same not-found state as a missing id,
// so existence never leaks. Fail-open: an unreachable data layer renders the
// not-found state rather than 500-ing.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrganization } from '@/lib/auth';
import { getReport, scopeForOrg } from '@/lib/data';
import AudienceBadge from '../AudienceBadge';
import ReportMarkdown from '../ReportMarkdown';
import DownloadMarkdownButton from '../DownloadMarkdownButton';
import { audienceLabel } from '../audience';
import { formatReportDate, truncateEvaluationId } from '../model';

export const dynamic = 'force-dynamic';

async function loadReport(org, id) {
  try {
    return await getReport(scopeForOrg(org), id);
  } catch {
    // Treat an unreachable store the same as not-found: the page renders the
    // friendly not-found card rather than surfacing an internal error.
    return null;
  }
}

export default async function ReportDetailPage({ params }) {
  const org = await getOrganization();
  if (!org) redirect('/signup?redirect=/app/reports');

  const { id } = await params;
  const report = await loadReport(org, id);

  if (!report) {
    return (
      <main className="min-h-screen bg-tool text-slate-800 px-6 py-12">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h1 className="text-lg font-semibold text-slate-900">Report not found</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              This report doesn&apos;t exist, or it isn&apos;t available in this
              environment yet.
            </p>
            <Link
              href="/app/reports"
              className="mt-6 inline-flex rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90"
            >
              Back to reports
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const filename = `report-${report.id}-${report.audience}.md`;

  return (
    <main className="min-h-screen bg-tool text-slate-800 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/app/reports"
          className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
        >
          &larr; Back to reports
        </Link>

        <header className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">
            {audienceLabel(report.audience)} report
          </h1>
          <AudienceBadge audience={report.audience} />
        </header>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {/* No per-evaluation detail route exists; the source id is reference
              text, not a link. */}
          <span className="font-mono">
            evaluation {truncateEvaluationId(report.evaluation_id, 24)}
          </span>
          <span>Generated {formatReportDate(report.generated_at)}</span>
        </div>

        <article className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <ReportMarkdown markdown={report.markdown} />
        </article>

        <div className="mt-6 flex items-center gap-3">
          <DownloadMarkdownButton markdown={report.markdown} filename={filename} />
          <Link
            href="/app/reports"
            className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
          >
            Back to reports
          </Link>
        </div>
      </div>
    </main>
  );
}
