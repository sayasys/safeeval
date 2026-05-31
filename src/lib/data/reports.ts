// Read-side helpers for the generated-report surface (report-gen surfacing,
// 2026-05-30).
//
// The write path (generateReport -> writeReportRecord) already persists report
// rows; these helpers are the org-scoped read path the /app/reports list and
// detail views consume. The reports table carries no organization_id of its
// own, so scoping is resolved through the evaluation FK.
//
// Single-tenant note. The synthesized personal organization (id prefixed
// 'personal-') that getOrganization() returns when there is no real membership
// row carries no evaluation rows to scope against -- every portfolio evaluation
// belongs to the shared "Portfolio self" org. So for an unscoped (personal)
// caller these helpers return the full report set, mirroring the on-demand
// report route's callerOrgIsReal logic. A real multi-tenant org scopes strictly.

import {
  getClient,
  type DbClientSurface,
  type ReportRow,
  type ReportListRow,
} from './db-client';

export interface ReportScope {
  organizationId: string;
  // False for the synthesized personal/portfolio org: such callers see every
  // report rather than scoping to a synthetic org id no evaluation row carries.
  scoped: boolean;
}

interface ReadOptions {
  // Test seam: inject a mock client. Production callers omit this.
  client?: DbClientSurface;
}

// Build a ReportScope from a resolved organization. A synthesized personal org
// (id prefixed 'personal-') is treated as unscoped; any real org id scopes.
export function scopeForOrg(org: { id: string }): ReportScope {
  return { organizationId: org.id, scoped: !org.id.startsWith('personal-') };
}

export async function listReports(
  scope: ReportScope,
  options: ReadOptions & { limit?: number } = {},
): Promise<ReportListRow[]> {
  const client = options.client ?? getClient();
  const limit = options.limit ?? 200;
  return scope.scoped
    ? client.listReportsByOrganization(scope.organizationId, limit)
    : client.listAllReports(limit);
}

// Fetch a single report by id, enforcing org scoping. Returns null when the
// report does not exist OR (for a real org) belongs to a different org -- the
// caller renders the same not-found state either way so existence of another
// org's report never leaks. An unscoped (personal) caller skips the org check.
export async function getReport(
  scope: ReportScope,
  reportId: string,
  options: ReadOptions = {},
): Promise<ReportRow | null> {
  const client = options.client ?? getClient();
  const report = await client.getReportById(reportId);
  if (!report) return null;
  if (!scope.scoped) return report;
  const evaluation = await client.getEvaluation(report.evaluation_id);
  if (!evaluation || evaluation.organization_id !== scope.organizationId) {
    return null;
  }
  return report;
}
