// HTTP route handler tests for
//   src/app/api/app/reports/[evaluation_id]/[audience]/route.ts
//
// The auth module and the report-generators module are mocked at the module
// boundary (the same vi.mock factory pattern tests/auth/middleware.test.ts
// uses), so the handlers are exercised without an auth provider, a database,
// or the Anthropic API. Errors are routed by err.name, so the generateReport
// mock can reject with name-tagged plain errors.
//
// Coverage:
//   GET 200            -> markdown body + metadata headers
//   GET 400            -> unknown / deferred audience
//   GET 401            -> unauthenticated (getCurrentUser null)
//   GET 403 legal      -> LegalAccessGateError -> legal_access_denied + runbook
//   GET 404            -> EvaluationNotFoundError
//   GET 500            -> ReportGenerationError (sanitized; cause not echoed)
//   GET 503            -> feature-flag-disabled
//   POST admin-only    -> non-admin 403 (no generateReport); admin forces regen

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { generateReport, isAdmin } = vi.hoisted(() => ({
  generateReport: vi.fn(),
  isAdmin: vi.fn((u: { role?: string | null } | null | undefined) => (u?.role ?? null) === 'admin'),
}));
vi.mock('@/lib/report-generators', () => ({
  generateReport,
  isAdmin,
  IMPLEMENTED_AUDIENCES: ['reviewer', 'trust_safety_lead', 'legal', 'exec_summary'],
}));

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getCurrentUser }));

import {
  GET,
  POST,
} from '../../src/app/api/app/reports/[evaluation_id]/[audience]/route';

const REQ = new Request('http://localhost/api/app/reports/eval_1/reviewer');

function ctx(evaluation_id: string, audience: string) {
  return { params: Promise.resolve({ evaluation_id, audience }) };
}

function named(name: string, extra: Record<string, unknown> = {}): Error {
  return Object.assign(new Error(name), { name, ...extra });
}

const REVIEWER_USER = { auth_user_id: 'u-1', email: 'a@b.c', display_name: null, created_at: '2026-05-29T00:00:00Z', role: 'pii_reviewer' };
const ADMIN_USER = { ...REVIEWER_USER, role: 'admin' };
const PLAIN_USER = { ...REVIEWER_USER, role: null };

function okResult(over: Record<string, unknown> = {}) {
  return {
    markdown: '# Disposition\nbody',
    cache_hit: false,
    validation: { valid: true, violations: [] },
    report_prompt_hash: 'h'.repeat(64),
    audience: 'reviewer',
    evaluation_id: 'eval_1',
    ...over,
  };
}

beforeEach(() => {
  generateReport.mockReset();
  getCurrentUser.mockReset();
  isAdmin.mockClear();
});

describe('GET 200', () => {
  it('returns the markdown body and metadata headers', async () => {
    getCurrentUser.mockResolvedValue(REVIEWER_USER);
    generateReport.mockResolvedValue(okResult({ cache_hit: true }));
    const res = await GET(REQ, ctx('eval_1', 'reviewer'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(res.headers.get('x-safeeval-cache-hit')).toBe('true');
    expect(res.headers.get('x-safeeval-validation-valid')).toBe('true');
    expect(res.headers.get('x-safeeval-validation-violations')).toBe('0');
    expect(res.headers.get('x-safeeval-audience')).toBe('reviewer');
    expect(await res.text()).toBe('# Disposition\nbody');
    // The dispatcher is called on-demand, with the user and force off.
    expect(generateReport).toHaveBeenCalledWith('eval_1', 'reviewer', {
      source: 'on_demand',
      user: REVIEWER_USER,
      force_regenerate: false,
    });
  });
});

describe('GET 400 audience validation', () => {
  it('rejects an audience outside the implemented closed set', async () => {
    getCurrentUser.mockResolvedValue(REVIEWER_USER);
    const res = await GET(REQ, ctx('eval_1', 'end_user'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; allowed: string[] };
    expect(body.code).toBe('invalid_audience');
    expect(body.allowed).toContain('reviewer');
    expect(generateReport).not.toHaveBeenCalled();
  });

  it('rejects an unknown audience string', async () => {
    getCurrentUser.mockResolvedValue(REVIEWER_USER);
    const res = await GET(REQ, ctx('eval_1', 'bogus'));
    expect(res.status).toBe(400);
  });
});

describe('GET 401 unauthenticated', () => {
  it('returns 401 when getCurrentUser resolves null', async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await GET(REQ, ctx('eval_1', 'reviewer'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('unauthorized');
    expect(generateReport).not.toHaveBeenCalled();
  });
});

describe('GET 403 legal without auth', () => {
  it('maps LegalAccessGateError to 403 with the legal_access_denied shape', async () => {
    getCurrentUser.mockResolvedValue(PLAIN_USER);
    generateReport.mockRejectedValue(named('LegalAccessGateError', { evaluation_id: 'eval_1' }));
    const res = await GET(REQ, ctx('eval_1', 'legal'));
    expect(res.status).toBe(403);
    expect(res.headers.get('x-safeeval-runbook-ref')).toContain('legal-report-access');
    const body = (await res.json()) as { code: string; audience: string; runbook: string };
    expect(body.code).toBe('legal_access_denied');
    expect(body.audience).toBe('legal');
    expect(body.runbook).toContain('legal-report-access.md');
  });
});

describe('GET 404 evaluation not found', () => {
  it('maps EvaluationNotFoundError to 404', async () => {
    getCurrentUser.mockResolvedValue(REVIEWER_USER);
    generateReport.mockRejectedValue(named('EvaluationNotFoundError', { evaluation_id: 'missing' }));
    const res = await GET(REQ, ctx('missing', 'reviewer'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('evaluation_not_found');
  });
});

describe('GET 500 generation error (sanitized)', () => {
  it('maps ReportGenerationError to a sanitized 500 that does not echo the cause', async () => {
    getCurrentUser.mockResolvedValue(REVIEWER_USER);
    generateReport.mockRejectedValue(
      named('ReportGenerationError', { reason: 'api_error', cause_message: 'SECRET upstream detail' }),
    );
    const res = await GET(REQ, ctx('eval_1', 'reviewer'));
    expect(res.status).toBe(500);
    const raw = await res.text();
    expect(raw).not.toContain('SECRET upstream detail');
    const body = JSON.parse(raw) as { code: string; reason: string };
    expect(body.code).toBe('report_generation_failed');
    expect(body.reason).toBe('api_error');
  });
});

describe('GET 503 feature flag disabled', () => {
  it('maps the flag-disabled error to 503 report_gen_disabled', async () => {
    getCurrentUser.mockResolvedValue(REVIEWER_USER);
    generateReport.mockRejectedValue(
      new Error('Report generator live API call is disabled. Set SAFEEVAL_REPORT_GEN_LIVE=true ...'),
    );
    const res = await GET(REQ, ctx('eval_1', 'reviewer'));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('report_gen_disabled');
  });
});

describe('POST force-regeneration (admin-only)', () => {
  it('returns 403 for a non-admin caller and does not call generateReport', async () => {
    getCurrentUser.mockResolvedValue(REVIEWER_USER); // pii_reviewer, not admin
    const res = await POST(REQ, ctx('eval_1', 'reviewer'));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('forbidden');
    expect(generateReport).not.toHaveBeenCalled();
  });

  it('forces regeneration for an admin caller', async () => {
    getCurrentUser.mockResolvedValue(ADMIN_USER);
    generateReport.mockResolvedValue(okResult());
    const res = await POST(REQ, ctx('eval_1', 'reviewer'));
    expect(res.status).toBe(200);
    expect(generateReport).toHaveBeenCalledWith('eval_1', 'reviewer', {
      source: 'on_demand',
      user: ADMIN_USER,
      force_regenerate: true,
    });
  });
});
