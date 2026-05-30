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
      `No organization found for auth_user_id=${auth_user_id}. The org lookup ` +
        `auto-derives a personal organization on read when the memberships ` +
        `table is unreachable or empty; this error indicates the user lookup ` +
        `itself failed upstream (no session, or session refers to a deleted ` +
        `auth record).`,
    );
    this.auth_user_id = auth_user_id;
  }
}

// 403: the user is authenticated but lacks the required role in the current
// organization. Distinct from UnauthorizedError (401, no session) so route
// handlers and requireOrgRole() callers can map to the correct HTTP status.
export class ForbiddenError extends Error {
  override readonly name = 'ForbiddenError';
  readonly required_role: string;
  readonly actual_role: string | null;
  constructor(required_role: string, actual_role: string | null) {
    super(
      `Insufficient role: this action requires '${required_role}' but the ` +
        `current user has '${actual_role ?? 'no membership'}' in the active ` +
        `organization.`,
    );
    this.required_role = required_role;
    this.actual_role = actual_role;
  }
}
