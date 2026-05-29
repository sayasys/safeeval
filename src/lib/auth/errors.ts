// Auth-module typed errors. Mirror the LegalAccessGateError pattern from
// src/lib/report-generators/index.ts -- named subclasses with explicit
// `override readonly name` and typed instance fields, so call sites can
// `instanceof`-narrow and route by error type.

export class UnauthorizedError extends Error {
  override readonly name = 'UnauthorizedError';
  constructor(message = 'Authentication required.') {
    super(message);
  }
}

export class OrganizationNotFoundError extends Error {
  override readonly name = 'OrganizationNotFoundError';
  readonly auth_user_id: string;
  constructor(auth_user_id: string) {
    super(
      `No organization found for auth_user_id=${auth_user_id}. Phase 1 stub ` +
        `auto-derives a personal organization on read; this error indicates ` +
        `the user lookup failed upstream (no session, or session refers to a ` +
        `deleted auth record). Phase 2 (M6 migration) replaces the stub with ` +
        `a real organizations table query.`,
    );
    this.auth_user_id = auth_user_id;
  }
}
