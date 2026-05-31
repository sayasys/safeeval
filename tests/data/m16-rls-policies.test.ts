// M16 RLS-policy migration test (brief 0077, 2026-05-31).
//
// SCOPE OF THIS TEST -- and what it deliberately cannot cover.
// The data-track test infra has no live Postgres connection: scripts/
// run-migrations.js only opens a DB in live mode (requires the `pg` package +
// DATABASE_URL, neither present in CI), and the verified path is --dry-run.
// So this suite exercises the runner's pure file-discovery + UP/DOWN parser
// (exactly like migration-dryrun.test.ts) and asserts the M16 SQL is
// structurally correct: the right tables get RLS, the four policies exist with
// the right shape, and the default-deny GUC contract is expressed.
//
// What it CANNOT assert here is RUNTIME enforcement -- that with
// app.current_organization_id set to org A a SELECT returns only org A's rows,
// and that an unset GUC returns zero rows. That requires a non-service-role
// connection against a real database (the app's db-client uses the service
// role, which bypasses RLS entirely). Brief 0077 anticipates this: the runtime
// multi-tenant smoke test is the engineering follow-up that lands alongside the
// non-service-role auth surface (the app_set_organization_context RPC +
// withOrganizationContext-throws-on-missing-GUC dispatch). This file's
// assertion of the `current_setting(..., true)::uuid` missing-ok form is the
// static proxy for the default-deny property; the live assertion is deferred.

import { describe, it, expect } from 'vitest';

// run-migrations.js is CommonJS; require it for the exported parser helpers.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const runner = require('../../scripts/run-migrations.js') as {
  listMigrationFiles(): string[];
  readFile(name: string): string;
  splitUpDown(sql: string): { up: string; down: string };
};

const M16 = 'M16_reports_rls_and_org_policies.sql';

// The missing-ok GUC read that yields default-deny when the org context is
// unset (current_setting returns NULL -> NULL::uuid -> `col = NULL` is NULL,
// never TRUE, so zero rows are admitted). Every M16 policy must use this exact
// form -- the same contract M12 / M15 carry.
const GUC = "current_setting('app.current_organization_id', true)::uuid";

describe('M16 migration: discovery + apply order', () => {
  const files = runner.listMigrationFiles();

  it('discovers M16 and orders it after the M1..M15 chain as the new tail', () => {
    expect(files).toContain(M16);
    const m15Index = files.findIndex((f) => f.startsWith('M15_'));
    expect(m15Index).toBeGreaterThanOrEqual(0);
    expect(files.indexOf(M16)).toBeGreaterThan(m15Index);
    // M16 is the numeric tail of the chain.
    expect(files[files.length - 1]).toBe(M16);
  });
});

describe('M16 migration: UP block', () => {
  const { up } = runner.splitUpDown(runner.readFile(M16));

  it('enables RLS on reports (the M4 table that had none)', () => {
    expect(up).toContain('ALTER TABLE reports ENABLE ROW LEVEL SECURITY');
  });

  it('does NOT re-enable RLS on the M12 tables (M12 already did; M16 only adds policies)', () => {
    // Re-enabling is harmless but would mean M16 is reaching past its remit and
    // M16's DOWN might wrongly disable a posture M12 owns. Guard against it.
    expect(up).not.toContain('ALTER TABLE organizations ENABLE ROW LEVEL SECURITY');
    expect(up).not.toContain('ALTER TABLE users ENABLE ROW LEVEL SECURITY');
    expect(up).not.toContain('ALTER TABLE memberships ENABLE ROW LEVEL SECURITY');
  });

  it('creates the four tenant-isolation policies by name', () => {
    expect(up).toContain('CREATE POLICY reports_tenant_isolation ON reports');
    expect(up).toContain('CREATE POLICY organizations_tenant_isolation ON organizations');
    expect(up).toContain('CREATE POLICY users_tenant_isolation ON users');
    expect(up).toContain('CREATE POLICY memberships_tenant_isolation ON memberships');
  });

  it('scopes reports transitively via an EXISTS join on evaluations (no org column of its own)', () => {
    // reports has no organization_id; it inherits org scope through evaluation_id.
    // Mirrors M12's classifier_edits EXISTS-join shape.
    expect(up).toMatch(/CREATE POLICY reports_tenant_isolation ON reports\s+USING \(EXISTS \(/);
    expect(up).toMatch(/SELECT 1 FROM evaluations e\s+WHERE e\.id = reports\.evaluation_id/);
    expect(up).toContain('e.organization_id = ' + GUC);
  });

  it('scopes users via an EXISTS join through memberships', () => {
    expect(up).toMatch(/CREATE POLICY users_tenant_isolation ON users\s+USING \(EXISTS \(/);
    expect(up).toMatch(/SELECT 1 FROM memberships m\s+WHERE m\.user_id = users\.id/);
    expect(up).toContain('m.organization_id = ' + GUC);
  });

  it('scopes organizations + memberships with a direct GUC filter', () => {
    expect(up).toContain('id = ' + GUC); // organizations self-read
    expect(up).toContain('organization_id = ' + GUC); // memberships direct
  });

  it('uses the missing-ok GUC form on every policy (default-deny on unset org context)', () => {
    // reports(1) + organizations(1) + users(1) + memberships(1) = 4 reads.
    const occurrences = up.split(GUC).length - 1;
    expect(occurrences).toBe(4);
  });

  it('does not leak any DOWN reversal statement into the UP block', () => {
    expect(up).not.toContain('DROP POLICY IF EXISTS reports_tenant_isolation');
    expect(up).not.toContain('DISABLE ROW LEVEL SECURITY');
  });
});

describe('M16 migration: DOWN block (reversible)', () => {
  const { down } = runner.splitUpDown(runner.readFile(M16));

  it('is non-empty and drops all four policies', () => {
    expect(down.length).toBeGreaterThan(0);
    expect(down).toContain('DROP POLICY IF EXISTS reports_tenant_isolation ON reports');
    expect(down).toContain('DROP POLICY IF EXISTS organizations_tenant_isolation ON organizations');
    expect(down).toContain('DROP POLICY IF EXISTS users_tenant_isolation ON users');
    expect(down).toContain('DROP POLICY IF EXISTS memberships_tenant_isolation ON memberships');
  });

  it('disables RLS on reports only (M16 enabled it) and leaves M12 tables enabled', () => {
    expect(down).toContain('ALTER TABLE reports DISABLE ROW LEVEL SECURITY');
    // M16 must not undo M12's RLS posture on the org tables.
    expect(down).not.toContain('ALTER TABLE organizations DISABLE ROW LEVEL SECURITY');
    expect(down).not.toContain('ALTER TABLE users DISABLE ROW LEVEL SECURITY');
    expect(down).not.toContain('ALTER TABLE memberships DISABLE ROW LEVEL SECURITY');
  });

  it('drops the reports policy before disabling RLS on reports', () => {
    const policyIdx = down.indexOf('DROP POLICY IF EXISTS reports_tenant_isolation ON reports');
    const disableIdx = down.indexOf('ALTER TABLE reports DISABLE ROW LEVEL SECURITY');
    expect(policyIdx).toBeGreaterThanOrEqual(0);
    expect(disableIdx).toBeGreaterThan(policyIdx);
  });

  it('un-comments to valid SQL or SQL comments only (no bare prose lines)', () => {
    for (const raw of down.split('\n')) {
      const line = raw.trim();
      if (line === '') continue;
      const looksLikeProse = /^[a-z]/.test(line) && !line.startsWith('--');
      expect(looksLikeProse, `bare prose leaked into DOWN: "${line}"`).toBe(false);
    }
  });
});
