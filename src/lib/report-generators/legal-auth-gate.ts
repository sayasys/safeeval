// Manual ops-runbook auth gate for the legal audience (Phase 3 MVP).
//
// Spec: docs/memos/2026-05-28-report-generator-implementation-spec.md
//       section 7 (auth gate), and the Phase 3 dispatch adjudication
//       (compliance posture Decision 2: manual ops-runbook gate at MVP).
// Runbook: docs/runbooks/legal-report-access.md.
//
// Phase 3 replaces the Phase 2 unredacted_access boolean stub with a real
// role check. The role is set MANUALLY by ops via the Supabase Auth admin
// panel (app_metadata.role = 'pii_reviewer'); src/lib/auth surfaces it onto
// the User as `role`. app_metadata is admin-only-writable, so a user cannot
// self-escalate. Phase 4+ swaps the manual role assignment for real RBAC
// (a legal_access_grants table with time-bounded tokens); the function
// signature is the stable boundary across that upgrade.
//
// Every access attempt -- granted OR denied -- writes a row to
// legal_access_log (migration M10). The denied rows are the security-review
// surface; the granted rows are the chain-of-custody record. Fail-closed on
// the grant path: if the audit write fails, access is NOT granted (no
// unaudited access to a legal report). On the deny path the audit write is
// best-effort -- a logging outage must never turn a denial into a grant.

import { getClient, type DbClientSurface } from '../data/db-client';
import { LegalAccessGateError } from './errors';

// The role an ops-provisioned reviewer must carry to read a legal-audience
// report. Set manually in Supabase Auth app_metadata.role per the runbook.
export const PII_REVIEWER_ROLE = 'pii_reviewer';

// The role required for the admin-only force-regeneration (POST) path.
export const ADMIN_ROLE = 'admin';

// Minimal structural shape of the authenticated caller the gate needs. The
// route resolves a full auth User and passes the relevant fields; keeping
// this structural (rather than importing the auth User type) avoids a hard
// dependency from the report-generator surface onto the auth module.
export interface LegalAccessUser {
  auth_user_id: string;
  role?: string | null;
}

// Throw LegalAccessGateError unless the caller carries the pii_reviewer role.
// Writes a legal_access_log row on both the grant and the deny path.
export async function requireLegalAccess(
  user: LegalAccessUser | null | undefined,
  evaluation_id: string,
  dbClient?: DbClientSurface,
): Promise<void> {
  const client = dbClient ?? getClient();
  const role = user?.role ?? null;
  const granted = role === PII_REVIEWER_ROLE;
  const denied_reason = granted
    ? null
    : `caller role '${role ?? 'none'}' lacks ${PII_REVIEWER_ROLE}`;

  try {
    await client.insertLegalAccessLog({
      user_id: user?.auth_user_id ?? null,
      evaluation_id,
      audience: 'legal',
      granted,
      denied_reason,
    });
  } catch (logErr) {
    // Fail-closed on grant: a legal report must never be served without an
    // audit record. Propagate so the route surfaces a 500 rather than
    // granting unaudited access.
    if (granted) throw logErr;
    // Deny path: the denial stands regardless of the log outcome. Record the
    // logging failure on the observation channel but do not mask the denial.
    const message = logErr instanceof Error ? logErr.message : String(logErr);
    console.error(
      `legal_access_log write failed on DENIED access ` +
        `(evaluation_id=${evaluation_id}, user_id=${user?.auth_user_id ?? 'none'}):`,
      message,
    );
  }

  if (!granted) {
    throw new LegalAccessGateError(evaluation_id, role);
  }
}

// True when the caller holds the admin role (force-regeneration path). The
// route uses this for the POST handler; a non-admin POST returns 403.
export function isAdmin(user: LegalAccessUser | null | undefined): boolean {
  return (user?.role ?? null) === ADMIN_ROLE;
}
