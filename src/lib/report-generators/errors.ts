// Report-generator typed errors.
//
// Consolidated here in Phase 3 so both the dispatcher (index.ts) and the
// legal auth-gate (legal-auth-gate.ts) can import the same error classes
// without a circular index <-> legal-auth-gate dependency. index.ts
// re-exports these for back-compat with existing importers (the Phase 2
// dispatcher tests import LegalAccessGateError / EvaluationNotFoundError
// from '../report-generators').
//
// Routing convention: callers narrow by the `name` string (set via
// `override readonly name`) rather than `instanceof`. The name-based check
// is resilient across module instances -- the HTTP route maps err.name to
// an HTTP status without depending on class identity, which matters when
// the route is unit-tested with a mocked dispatcher module.

// Thrown when a legal-audience report is requested without the pii_reviewer
// role (Phase 3 manual ops-runbook gate). Phase 4+ swaps the role check for
// real RBAC; the error shape is stable across that upgrade.
export class LegalAccessGateError extends Error {
  override readonly name = 'LegalAccessGateError';
  readonly evaluation_id: string;
  // The role the caller presented (or null when unauthenticated / unset).
  // Surfaced for the audit-log denied_reason and for the route's 403 body.
  readonly presented_role: string | null;
  constructor(evaluation_id: string, presented_role: string | null = null) {
    super(
      'Legal-audience reports require the pii_reviewer role, granted manually ' +
        'by ops per the runbook (docs/runbooks/legal-report-access.md). The ' +
        'request was denied and the attempt was recorded to legal_access_log. ' +
        'Phase 4+ replaces the manual role assignment with real RBAC.',
    );
    this.evaluation_id = evaluation_id;
    this.presented_role = presented_role;
  }
}

// Thrown when the requested evaluation_id has no row in the evaluations
// table. Maps to HTTP 404.
export class EvaluationNotFoundError extends Error {
  override readonly name = 'EvaluationNotFoundError';
  readonly evaluation_id: string;
  constructor(evaluation_id: string) {
    super(`Evaluation not found: ${evaluation_id}`);
    this.evaluation_id = evaluation_id;
  }
}

// Thrown by defaultCallModel when the live Anthropic call fails (network
// error, timeout/abort, non-text response, or a missing API key while the
// SAFEEVAL_REPORT_GEN_LIVE flag is on). Carries structured context for the
// observation channel; the HTTP route maps this to a sanitized 500 that does
// NOT echo the cause_message to the client.
export class ReportGenerationError extends Error {
  override readonly name = 'ReportGenerationError';
  readonly evaluation_id: string;
  readonly audience: string;
  readonly model: string;
  // 'api_error' for an SDK/network failure, 'timeout' for an AbortController
  // abort, 'empty_response' for a non-text / empty completion, 'config' for a
  // missing key in live mode.
  readonly reason: 'api_error' | 'timeout' | 'empty_response' | 'config';
  readonly cause_message: string | undefined;
  constructor(
    message: string,
    context: {
      evaluation_id: string;
      audience: string;
      model: string;
      reason: ReportGenerationError['reason'];
      cause?: unknown;
    },
  ) {
    super(message);
    this.evaluation_id = context.evaluation_id;
    this.audience = context.audience;
    this.model = context.model;
    this.reason = context.reason;
    this.cause_message =
      context.cause instanceof Error ? context.cause.message : undefined;
  }
}
