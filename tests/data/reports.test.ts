// Read-side report helper tests (src/lib/data/reports.ts).
//
// Covers org-scope resolution (scopeForOrg), the scoped/unscoped list dispatch,
// and the getReport org gate -- including the not-found-on-mismatch behavior
// that prevents leaking another org's report. The db-client is a minimal stub
// (only the methods the helpers call) cast to DbClientSurface, the same pattern
// the legal-auth-gate test uses.

import { describe, it, expect, vi } from 'vitest';
import {
  listReports,
  getReport,
  scopeForOrg,
  type ReportScope,
} from '../../src/lib/data/reports';
import type {
  DbClientSurface,
  ReportRow,
  ReportListRow,
  EvaluationRow,
} from '../../src/lib/data/db-client';

function reportRow(over: Partial<ReportRow> = {}): ReportRow {
  return {
    id: '7',
    evaluation_id: '42',
    audience: 'reviewer',
    report_prompt_hash: 'h'.repeat(64),
    markdown: '# Report\nbody',
    generated_at: '2026-05-30T00:00:00Z',
    cache_hit_count: 0,
    ...over,
  };
}

function listRow(over: Partial<ReportListRow> = {}): ReportListRow {
  return {
    id: '7',
    evaluation_id: '42',
    audience: 'reviewer',
    generated_at: '2026-05-30T00:00:00Z',
    ...over,
  };
}

function evalRow(over: Partial<EvaluationRow> = {}): EvaluationRow {
  return {
    id: '42',
    organization_id: 'org-real-1',
    envelope: {},
    disposition: 'block',
    cache_key: 'ck',
    ontology_version: 'v5',
    schema_version: 's1',
    ...over,
  };
}

function makeClient(over: Partial<DbClientSurface> = {}): DbClientSurface {
  return {
    getReportById: vi.fn(async () => null),
    listReportsByOrganization: vi.fn(async () => []),
    listAllReports: vi.fn(async () => []),
    getEvaluation: vi.fn(async () => null),
    ...over,
  } as unknown as DbClientSurface;
}

describe('scopeForOrg', () => {
  it('treats a synthesized personal org as unscoped', () => {
    expect(scopeForOrg({ id: 'personal-abc' })).toEqual({
      organizationId: 'personal-abc',
      scoped: false,
    });
  });

  it('scopes a real org id strictly', () => {
    expect(scopeForOrg({ id: '00000000-0000-0000-0000-000000000010' })).toEqual({
      organizationId: '00000000-0000-0000-0000-000000000010',
      scoped: true,
    });
  });
});

describe('listReports', () => {
  it('scoped: queries by organization', async () => {
    const byOrg = vi.fn(async () => [listRow()]);
    const all = vi.fn(async () => []);
    const client = makeClient({ listReportsByOrganization: byOrg, listAllReports: all });
    const scope: ReportScope = { organizationId: 'org-real-1', scoped: true };

    const rows = await listReports(scope, { client, limit: 50 });

    expect(rows).toHaveLength(1);
    expect(byOrg).toHaveBeenCalledWith('org-real-1', 50);
    expect(all).not.toHaveBeenCalled();
  });

  it('unscoped: queries the full set (single-tenant portfolio)', async () => {
    const byOrg = vi.fn(async () => []);
    const all = vi.fn(async () => [listRow(), listRow({ id: '8' })]);
    const client = makeClient({ listReportsByOrganization: byOrg, listAllReports: all });
    const scope: ReportScope = { organizationId: 'personal-x', scoped: false };

    const rows = await listReports(scope, { client });

    expect(rows).toHaveLength(2);
    expect(all).toHaveBeenCalledWith(200); // default limit
    expect(byOrg).not.toHaveBeenCalled();
  });
});

describe('getReport', () => {
  it('returns null when the report does not exist', async () => {
    const client = makeClient({ getReportById: vi.fn(async () => null) });
    const got = await getReport({ organizationId: 'org-real-1', scoped: true }, '7', { client });
    expect(got).toBeNull();
  });

  it('unscoped: returns the report without an org check', async () => {
    const getEvaluation = vi.fn(async () => null);
    const client = makeClient({
      getReportById: vi.fn(async () => reportRow()),
      getEvaluation,
    });
    const got = await getReport({ organizationId: 'personal-x', scoped: false }, '7', { client });
    expect(got).not.toBeNull();
    expect(getEvaluation).not.toHaveBeenCalled();
  });

  it('scoped: returns the report when its evaluation belongs to the org', async () => {
    const client = makeClient({
      getReportById: vi.fn(async () => reportRow({ evaluation_id: '42' })),
      getEvaluation: vi.fn(async () => evalRow({ organization_id: 'org-real-1' })),
    });
    const got = await getReport({ organizationId: 'org-real-1', scoped: true }, '7', { client });
    expect(got?.id).toBe('7');
  });

  it('scoped: returns null when the evaluation belongs to another org', async () => {
    const client = makeClient({
      getReportById: vi.fn(async () => reportRow()),
      getEvaluation: vi.fn(async () => evalRow({ organization_id: 'someone-else' })),
    });
    const got = await getReport({ organizationId: 'org-real-1', scoped: true }, '7', { client });
    expect(got).toBeNull();
  });

  it('scoped: returns null when the evaluation is missing', async () => {
    const client = makeClient({
      getReportById: vi.fn(async () => reportRow()),
      getEvaluation: vi.fn(async () => null),
    });
    const got = await getReport({ organizationId: 'org-real-1', scoped: true }, '7', { client });
    expect(got).toBeNull();
  });
});
