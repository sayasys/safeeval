// Legal auth-gate unit tests (report-gen Phase 3).
//
// requireLegalAccess enforces the pii_reviewer role and writes a
// legal_access_log row on BOTH the grant and the deny path. Coverage:
//   1. Grant: pii_reviewer user -> no throw, granted=true audit row.
//   2. Deny: non-pii_reviewer user -> LegalAccessGateError, granted=false
//      audit row with a denied_reason.
//   3. Deny (no user): granted=false, user_id=null.
//   4. Fail-closed on grant: if the audit write fails on the grant path,
//      requireLegalAccess propagates the error (no unaudited access).
//   5. Deny-path log failure is swallowed: a logging outage must not mask
//      the denial -- the gate still throws LegalAccessGateError.
//   6. isAdmin helper.
//
// The db-client is a minimal stub exposing only insertLegalAccessLog (the
// single method the gate touches).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requireLegalAccess,
  isAdmin,
  PII_REVIEWER_ROLE,
  ADMIN_ROLE,
  type LegalAccessUser,
} from '../../src/lib/report-generators/legal-auth-gate';
import { LegalAccessGateError } from '../../src/lib/report-generators/errors';
import type { DbClientSurface, InsertLegalAccessLogRow } from '../../src/lib/data/db-client';

function makeClient(insertImpl?: (row: InsertLegalAccessLogRow) => Promise<void>): {
  client: DbClientSurface;
  insertLegalAccessLog: ReturnType<typeof vi.fn>;
} {
  const insertLegalAccessLog = vi.fn(insertImpl ?? (async () => {}));
  const client = { insertLegalAccessLog } as unknown as DbClientSurface;
  return { client, insertLegalAccessLog };
}

const REVIEWER: LegalAccessUser = { auth_user_id: 'u-1', role: PII_REVIEWER_ROLE };
const OUTSIDER: LegalAccessUser = { auth_user_id: 'u-2', role: 'member' };

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('requireLegalAccess: grant path', () => {
  it('resolves without throwing for a pii_reviewer and writes a granted audit row', async () => {
    const { client, insertLegalAccessLog } = makeClient();
    await expect(requireLegalAccess(REVIEWER, 'eval_9', client)).resolves.toBeUndefined();
    expect(insertLegalAccessLog).toHaveBeenCalledTimes(1);
    expect(insertLegalAccessLog.mock.calls[0]![0]).toEqual({
      user_id: 'u-1',
      evaluation_id: 'eval_9',
      audience: 'legal',
      granted: true,
      denied_reason: null,
    });
  });
});

describe('requireLegalAccess: deny path', () => {
  it('throws LegalAccessGateError and writes a denied audit row for a non-pii_reviewer', async () => {
    const { client, insertLegalAccessLog } = makeClient();
    await expect(requireLegalAccess(OUTSIDER, 'eval_9', client)).rejects.toBeInstanceOf(
      LegalAccessGateError,
    );
    expect(insertLegalAccessLog).toHaveBeenCalledTimes(1);
    const row = insertLegalAccessLog.mock.calls[0]![0];
    expect(row.granted).toBe(false);
    expect(row.user_id).toBe('u-2');
    expect(row.audience).toBe('legal');
    expect(row.denied_reason).toContain(PII_REVIEWER_ROLE);
    expect(row.denied_reason).toContain('member');
  });

  it('denies and logs user_id=null when no user is supplied', async () => {
    const { client, insertLegalAccessLog } = makeClient();
    await expect(requireLegalAccess(null, 'eval_9', client)).rejects.toBeInstanceOf(
      LegalAccessGateError,
    );
    const row = insertLegalAccessLog.mock.calls[0]![0];
    expect(row.user_id).toBeNull();
    expect(row.granted).toBe(false);
  });

  it('surfaces the presented role on the thrown error', async () => {
    const { client } = makeClient();
    await expect(requireLegalAccess(OUTSIDER, 'eval_9', client)).rejects.toMatchObject({
      name: 'LegalAccessGateError',
      evaluation_id: 'eval_9',
      presented_role: 'member',
    });
  });
});

describe('requireLegalAccess: audit-write failure handling', () => {
  it('fails closed on the grant path -- a log-write failure denies access', async () => {
    const { client } = makeClient(async () => {
      throw new Error('legal_access_log insert failed');
    });
    // pii_reviewer would normally be granted, but the audit write fails: the
    // gate must NOT grant unaudited access -- it propagates the error.
    await expect(requireLegalAccess(REVIEWER, 'eval_9', client)).rejects.toThrow(
      /legal_access_log insert failed/,
    );
  });

  it('swallows a deny-path log failure but still denies', async () => {
    const { client } = makeClient(async () => {
      throw new Error('legal_access_log insert failed');
    });
    // The denial must stand regardless of the logging outcome, and the error
    // surfaced is the gate error, not the DB error.
    await expect(requireLegalAccess(OUTSIDER, 'eval_9', client)).rejects.toBeInstanceOf(
      LegalAccessGateError,
    );
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('isAdmin', () => {
  it('is true only for the admin role', () => {
    expect(isAdmin({ auth_user_id: 'a', role: ADMIN_ROLE })).toBe(true);
    expect(isAdmin({ auth_user_id: 'a', role: PII_REVIEWER_ROLE })).toBe(false);
    expect(isAdmin({ auth_user_id: 'a', role: null })).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});
