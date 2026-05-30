// On-demand report-generation route (report-gen Phase 3).
//
//   GET  /api/app/reports/:evaluation_id/:audience
//   POST /api/app/reports/:evaluation_id/:audience   (admin force-regenerate)
//
// Lives under the gated /api/app/ prefix; src/middleware.ts returns 401 JSON
// for unauthenticated requests before this handler runs, so an authenticated
// user is the precondition here (the handler re-checks defensively).
//
// GET: validates the audience against the closed implemented set, resolves
// the authenticated user, and dispatches to generateReport(). For the legal
// audience, generateReport() runs the manual ops-runbook auth gate
// (requireLegalAccess) which enforces the pii_reviewer role and writes a
// legal_access_log audit row on both grant and deny.
//
// POST: admin-only force-regeneration. Bypasses the cache and regenerates
// against the model.
//
// Status mapping (errors routed by err.name, resilient across module
// instances; ReportGenerationError is sanitized -- the cause is logged
// server-side, never echoed to the client):
//   200  markdown body + metadata headers (cache_hit, validation)
//   400  unknown / deferred audience
//   401  unauthenticated (defense in depth behind the middleware gate)
//   403  legal audience without pii_reviewer role (LegalAccessGateError);
//        non-admin force-regenerate
//   404  evaluation_id not found (EvaluationNotFoundError)
//   500  generation failure (ReportGenerationError) or unexpected error
//   503  live report generation disabled (SAFEEVAL_REPORT_GEN_LIVE off)
//
// Out of scope (Phase 4+): ?format=pdf / ?format=html rendering, SSE
// streaming, end_user audience.

import { NextResponse } from 'next/server';
import { getCurrentUser, getOrganization } from '@/lib/auth';
import { getClient } from '@/lib/data/db-client';
import {
  generateReport,
  IMPLEMENTED_AUDIENCES,
  isAdmin,
  type ImplementedAudience,
} from '@/lib/report-generators';

// The route uses the Anthropic + Supabase SDKs (Node-only) via the
// dispatcher; pin the Node runtime and force dynamic (it reads the session
// cookie).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RUNBOOK_REF = 'docs/runbooks/legal-report-access.md';

interface RouteContext {
  // Next.js 15: dynamic route params are delivered as a Promise.
  params: Promise<{ evaluation_id: string; audience: string }>;
}

function isImplementedAudience(value: string): value is ImplementedAudience {
  return (IMPLEMENTED_AUDIENCES as readonly string[]).includes(value);
}

function mapError(
  err: unknown,
  evaluation_id: string,
  audience: string,
): NextResponse {
  const name = err instanceof Error ? err.name : '';

  if (name === 'EvaluationNotFoundError') {
    return NextResponse.json(
      { error: `Evaluation not found: ${evaluation_id}`, code: 'evaluation_not_found', evaluation_id },
      { status: 404 },
    );
  }

  if (name === 'LegalAccessGateError') {
    // The denied attempt was already recorded to legal_access_log by the gate.
    return NextResponse.json(
      {
        error:
          'Legal-audience reports require the pii_reviewer role, granted ' +
          'manually by ops per the runbook. This attempt was recorded for ' +
          'security review.',
        code: 'legal_access_denied',
        evaluation_id,
        audience: 'legal',
        runbook: RUNBOOK_REF,
      },
      { status: 403, headers: { 'x-safeeval-runbook-ref': RUNBOOK_REF } },
    );
  }

  if (name === 'ReportGenerationError') {
    // Sanitized: surface the failure mode but never the underlying cause.
    const reason =
      typeof (err as { reason?: unknown }).reason === 'string'
        ? (err as { reason: string }).reason
        : 'api_error';
    return NextResponse.json(
      { error: 'Report generation failed. The incident was logged.', code: 'report_generation_failed', reason },
      { status: 500 },
    );
  }

  // Feature-flag-disabled: defaultCallModel throws a plain Error naming the
  // flag when SAFEEVAL_REPORT_GEN_LIVE is off. Distinguish from a real
  // failure -- this is an operator-opt-in state, not an error.
  if (err instanceof Error && err.message.includes('SAFEEVAL_REPORT_GEN_LIVE')) {
    return NextResponse.json(
      {
        error:
          'Live report generation is disabled. Set SAFEEVAL_REPORT_GEN_LIVE=true ' +
          '(with ANTHROPIC_API_KEY configured) to enable it.',
        code: 'report_gen_disabled',
      },
      { status: 503 },
    );
  }

  console.error(
    `report route unexpected error (evaluation_id=${evaluation_id}, audience=${audience}):`,
    err instanceof Error ? err.message : String(err),
  );
  return NextResponse.json(
    { error: 'Internal error generating the report.', code: 'internal_error' },
    { status: 500 },
  );
}

async function handle(
  context: RouteContext,
  opts: { force: boolean },
): Promise<NextResponse | Response> {
  const { evaluation_id, audience } = await context.params;

  if (!isImplementedAudience(audience)) {
    return NextResponse.json(
      {
        error: `Unknown or deferred audience '${audience}'.`,
        code: 'invalid_audience',
        allowed: IMPLEMENTED_AUDIENCES,
      },
      { status: 400 },
    );
  }

  // Defense in depth: the middleware already returns 401 for unauthenticated
  // /api/app/* requests, but the handler must not assume it.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.', code: 'unauthorized' },
      { status: 401 },
    );
  }

  if (opts.force && !isAdmin(user)) {
    return NextResponse.json(
      { error: 'Force-regeneration requires the admin role.', code: 'forbidden' },
      { status: 403 },
    );
  }

  // Org-scoped access (M12 multi-tenancy): verify the evaluation belongs to the
  // requesting user's organization. A mismatch returns 404 (not 403) so the
  // route never leaks the existence of another organization's evaluation.
  //
  // Enforced only when the caller has a REAL (DB-backed) organization. In the
  // single-tenant portfolio, getOrganization() returns a synthesized fallback
  // personal org (id prefixed 'personal-') with no membership to scope against,
  // so we preserve the existing single-tenant behavior rather than 404-ing
  // every report. This is a real improvement for genuine multi-tenant users.
  const notFound = NextResponse.json(
    { error: `Evaluation not found: ${evaluation_id}`, code: 'evaluation_not_found', evaluation_id },
    { status: 404 },
  );
  let evalRow;
  try {
    const callerOrg = await getOrganization();
    evalRow = await getClient().getEvaluation(evaluation_id);
    if (!evalRow) return notFound;
    const callerOrgIsReal = !!callerOrg && !callerOrg.id.startsWith('personal-');
    if (callerOrgIsReal && evalRow.organization_id !== callerOrg.id) {
      return notFound;
    }
  } catch (err) {
    return mapError(err, evaluation_id, audience);
  }

  try {
    const result = await generateReport(evaluation_id, audience, {
      source: 'on_demand',
      user,
      force_regenerate: opts.force,
    });
    return new Response(result.markdown, {
      status: 200,
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'x-safeeval-cache-hit': String(result.cache_hit),
        'x-safeeval-validation-valid': String(result.validation.valid),
        'x-safeeval-validation-violations': String(result.validation.violations.length),
        'x-safeeval-report-prompt-hash': result.report_prompt_hash,
        'x-safeeval-audience': result.audience,
      },
    });
  } catch (err) {
    return mapError(err, evaluation_id, audience);
  }
}

export async function GET(
  _req: Request,
  context: RouteContext,
): Promise<NextResponse | Response> {
  return handle(context, { force: false });
}

export async function POST(
  _req: Request,
  context: RouteContext,
): Promise<NextResponse | Response> {
  return handle(context, { force: true });
}
