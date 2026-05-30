// Migration dry-run test for the M12 multi-tenancy migration.
//
// Exercises the runner's pure file-discovery + UP/DOWN parser (no DB): asserts
// M12 is discovered in the correct apply order, that its UP block contains the
// org schema + the customer_id->organization_id rename, and that it carries a
// reversible DOWN block which parses to valid reversal SQL (no prose leaking
// into the un-commented DOWN, the bug class the runner's parser is prone to).

import { describe, it, expect } from 'vitest';

// run-migrations.js is CommonJS; require it for the exported parser helpers.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const runner = require('../../scripts/run-migrations.js') as {
  listMigrationFiles(): string[];
  readFile(name: string): string;
  splitUpDown(sql: string): { up: string; down: string };
};

const M12 = 'M12_organizations_and_memberships.sql';

describe('M12 migration: discovery + apply order', () => {
  it('discovers M12 and orders it after M11 (numeric prefix sort)', () => {
    const files = runner.listMigrationFiles();
    expect(files).toContain(M12);
    // M12 must sort after the existing M1..M11 chain -- the point of the
    // M6->M12 renumber. M13 (custom patterns) sorts after M12, and M14 (the
    // bright_line + conflicts_with backfill) is now the numeric tail.
    const m11Index = files.findIndex((f) => f.startsWith('M11_'));
    expect(files.indexOf(M12)).toBeGreaterThan(m11Index);
    const m13Index = files.findIndex((f) => f.startsWith('M13_'));
    expect(m13Index).toBeGreaterThan(files.indexOf(M12));
    const m14Index = files.findIndex((f) => f.startsWith('M14_'));
    expect(m14Index).toBeGreaterThan(m13Index);
    expect(files[files.length - 1]).toBe('M14_classifier_bright_line_and_conflicts.sql');
  });
});

describe('M12 migration: UP block', () => {
  const { up } = runner.splitUpDown(runner.readFile(M12));

  it('creates the three multi-tenancy tables', () => {
    expect(up).toContain('CREATE TABLE users');
    expect(up).toContain('CREATE TABLE organizations');
    expect(up).toContain('CREATE TABLE memberships');
  });

  it('enforces the closed role + plan_tier vocabularies via CHECK', () => {
    expect(up).toMatch(/CHECK\s*\(\s*role\s+IN\s*\(\s*'owner',\s*'admin',\s*'member',\s*'reviewer'\s*\)/);
    expect(up).toMatch(/CHECK\s*\(\s*plan_tier\s+IN\s*\(\s*'free',\s*'pro',\s*'enterprise'\s*\)/);
  });

  it('renames customer_id -> organization_id on evaluations with the backfill', () => {
    expect(up).toContain('ADD COLUMN organization_id UUID');
    expect(up).toContain('Portfolio self');
    expect(up).toContain('DROP COLUMN customer_id');
    expect(up).toContain('app.current_organization_id');
  });

  it('does not leak any DOWN reversal statement into the UP block', () => {
    expect(up).not.toContain('DROP TABLE IF EXISTS memberships');
  });
});

describe('M12 migration: DOWN block (reversible)', () => {
  const { down } = runner.splitUpDown(runner.readFile(M12));

  it('is non-empty and drops the new tables in FK-safe order', () => {
    expect(down.length).toBeGreaterThan(0);
    const mIdx = down.indexOf('DROP TABLE IF EXISTS memberships');
    const oIdx = down.indexOf('DROP TABLE IF EXISTS organizations');
    const uIdx = down.indexOf('DROP TABLE IF EXISTS users');
    expect(mIdx).toBeGreaterThanOrEqual(0);
    expect(mIdx).toBeLessThan(oIdx); // memberships before organizations
    expect(oIdx).toBeLessThan(uIdx); // organizations before users
  });

  it('restores the customer_id column + GUC policy', () => {
    expect(down).toContain('ADD COLUMN customer_id TEXT NOT NULL DEFAULT');
    expect(down).toContain('app.current_customer_id');
  });

  it('un-comments to valid SQL or SQL comments only (no bare prose lines)', () => {
    // Every non-empty DOWN line must be a SQL statement fragment or a `--`
    // comment. A bare prose line (the parser bug class) would start with a
    // lowercase word and no `--`.
    for (const raw of down.split('\n')) {
      const line = raw.trim();
      if (line === '') continue;
      const looksLikeProse = /^[a-z]/.test(line) && !line.startsWith('--');
      expect(looksLikeProse, `bare prose leaked into DOWN: "${line}"`).toBe(false);
    }
  });
});
