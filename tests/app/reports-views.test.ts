// Structural coverage for the new IA + report-flow surfaces. The pages and the
// generate-report panel are server / client React components that the node test
// env cannot render, so (per the project's established pattern) these assert
// the load-bearing wiring against the source text: the gate, the data calls,
// the route targets, and the honesty/empty states. The pure logic behind them
// is covered by reports-model / reports-sort / markdown-parse / app-nav tests.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('/app/policy parent page', () => {
  const src = read('src/app/app/policy/page.js');
  it('is a gated dynamic server page', () => {
    expect(src).toContain("export const dynamic = 'force-dynamic'");
    expect(src).toContain("redirect('/signup?redirect=/app/policy')");
  });
  it('renders both sub-page cards routing to the preserved URLs', () => {
    expect(src).toContain('Manage classifiers');
    expect(src).toContain('Manage patterns');
    expect(src).toContain('/app/classifiers');
    expect(src).toContain('/app/patterns');
  });
  it('explains the classifier->pattern relationship in the header', () => {
    expect(src).toContain('Patterns reference classifiers');
  });
});

describe('/app/reports list page', () => {
  const src = read('src/app/app/reports/page.js');
  it('is a gated dynamic server page', () => {
    expect(src).toContain("export const dynamic = 'force-dynamic'");
    expect(src).toContain("redirect('/signup?redirect=/app/reports')");
  });
  it('loads org-scoped reports and sorts via the URL', () => {
    expect(src).toContain('listReports');
    expect(src).toContain('scopeForOrg');
    expect(src).toContain('sortReports');
    expect(src).toContain('normalizeSortKey');
  });
  it('links each row into the detail view and has an empty state', () => {
    expect(src).toContain('/app/reports/${r.id}');
    expect(src).toContain('No reports yet');
  });
});

describe('/app/reports/[id] detail page', () => {
  const src = read('src/app/app/reports/[id]/page.js');
  it('is a gated dynamic server page', () => {
    expect(src).toContain("export const dynamic = 'force-dynamic'");
    expect(src).toContain("redirect('/signup?redirect=/app/reports')");
  });
  it('resolves the report org-scoped and renders body + actions', () => {
    expect(src).toContain('getReport');
    expect(src).toContain('ReportMarkdown');
    expect(src).toContain('DownloadMarkdownButton');
    expect(src).toContain('Report not found');
  });
});

describe('GenerateReportPanel', () => {
  const src = read('src/app/app/reports/GenerateReportPanel.js');
  it('is a client component gated to text/conversation results', () => {
    expect(src).toContain("'use client'");
    expect(src).toContain("inputKind !== 'prompt' && inputKind !== 'conversation'");
  });
  it('resolves the legal gate from the session-role probe', () => {
    expect(src).toContain('/api/app/session-role');
    expect(src).toContain('Requires PII reviewer role');
  });
  it('posts to the report route and explains the disabled-feature state', () => {
    expect(src).toContain('/api/app/reports/');
    expect(src).toContain('SAFEEVAL_REPORT_GEN_LIVE');
    expect(src).toContain('report_gen_disabled');
  });
  it('requires a persisted evaluation_id before it can generate', () => {
    expect(src).toContain('SAFEEVAL_PERSIST_EVALUATIONS');
    expect(src).toContain('hasEvaluation');
  });
});

describe('session-role route', () => {
  const src = read('src/app/api/app/session-role/route.ts');
  it('returns the pii_reviewer signal and 401s the unauthenticated', () => {
    expect(src).toContain('is_pii_reviewer');
    expect(src).toContain('PII_REVIEWER_ROLE');
    expect(src).toContain('401');
  });
});

describe('AppNav wiring into the layout', () => {
  const layout = read('src/app/app/layout.js');
  it('mounts the PolicySubNav below the AppNav', () => {
    expect(layout).toContain('PolicySubNav');
  });
});
