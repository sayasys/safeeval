#!/usr/bin/env node
// SafeEval data-track migration runner (Phase 2).
//
// Spec: docs/memos/2026-05-28-data-track-implementation-spec.md section 9.
//
// Reads src/lib/data/schema/M*.sql in numeric prefix order, applies whichever
// have not yet been recorded in the schema_migrations bookkeeping table, and
// supports a reversible -- DOWN block parsed from each SQL file.
//
// Usage:
//   node scripts/run-migrations.js                       Apply pending migrations.
//   node scripts/run-migrations.js --dry-run             Print the SQL that would
//                                                       run; never touches the DB.
//   node scripts/run-migrations.js --down <migration>    Run the DOWN block for
//                                                       the named migration
//                                                       (e.g. M3_backfill_customer_id.sql).
//   node scripts/run-migrations.js --down <migration> --dry-run
//                                                       Print the DOWN SQL only.
//
// Exit codes:
//   0  Success (including --dry-run successful parse).
//   1  Migration failure (SQL error, schema_migrations write error, bad file).
//   2  Database unreachable (connection refused, missing DB env vars at apply
//      time).
//
// Dependency note. Live apply/down requires the `pg` package (node-postgres).
// Phase 2 ships --dry-run as the verified path; real Supabase exercise is
// Phase 4. The runner lazy-requires pg only when an actual connection is
// needed, so dry-run works with the Phase 2 deps as-is. When you do need to
// run for real, `npm install --no-save pg` is sufficient; the dependency is
// not added to package.json by Phase 2 dispatch scope.
//
// Connection env vars (live mode):
//   DATABASE_URL    Postgres connection string, e.g.
//                     postgres://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
//                   Prefer the direct-connection URL for migrations (transaction-
//                   pooling endpoints can drop session-level state mid-migration).
//
// All file paths resolve relative to the repository root, not the script's CWD.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMA_DIR = path.join(REPO_ROOT, 'src', 'lib', 'data', 'schema');

const EXIT_OK = 0;
const EXIT_MIGRATION_FAILURE = 1;
const EXIT_DB_UNREACHABLE = 2;

function log(msg) {
  process.stdout.write(`[run-migrations] ${msg}\n`);
}

function logErr(msg) {
  process.stderr.write(`[run-migrations] ERROR: ${msg}\n`);
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    dryRun: false,
    downTarget: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--down') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--down requires a migration name argument (e.g. M3_backfill_customer_id.sql).');
      }
      args.downTarget = next;
      i++;
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(EXIT_OK);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    'Usage:\n' +
      '  node scripts/run-migrations.js                       Apply pending migrations.\n' +
      '  node scripts/run-migrations.js --dry-run             Print SQL only.\n' +
      '  node scripts/run-migrations.js --down <name>         Run DOWN block.\n' +
      '  node scripts/run-migrations.js --down <name> --dry-run\n' +
      '\n' +
      'Exit codes: 0 success, 1 migration failure, 2 DB unreachable.\n',
  );
}

// ---------------------------------------------------------------------------
// File discovery + DOWN parsing
// ---------------------------------------------------------------------------

function listMigrationFiles() {
  if (!fs.existsSync(SCHEMA_DIR)) {
    throw new Error(`schema dir not found: ${SCHEMA_DIR}`);
  }
  const files = fs
    .readdirSync(SCHEMA_DIR)
    .filter((f) => /^M\d+_.+\.sql$/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/^M(\d+)_/)[1], 10);
      const numB = parseInt(b.match(/^M(\d+)_/)[1], 10);
      return numA - numB;
    });
  return files;
}

function readFile(name) {
  return fs.readFileSync(path.join(SCHEMA_DIR, name), 'utf8');
}

// Split a migration file into the apply (UP) SQL and the DOWN SQL block. The
// DOWN block is a series of `-- ...` lines below a `-- DOWN ...` marker; we
// strip the `-- ` prefix from each line.
function splitUpDown(sqlText) {
  const lines = sqlText.split(/\r?\n/);
  let downMarkerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^--\s*DOWN\b/i.test(lines[i])) {
      downMarkerIndex = i;
      break;
    }
  }

  if (downMarkerIndex === -1) {
    return { up: sqlText, down: '' };
  }

  const upText = lines.slice(0, downMarkerIndex).join('\n');
  const downLines = [];
  for (let i = downMarkerIndex + 1; i < lines.length; i++) {
    const raw = lines[i];
    // Skip blank or marker-only lines.
    const trimmed = raw.trim();
    if (trimmed === '' || /^--\s*$/.test(trimmed)) continue;
    // Each DOWN-block line should be a `-- <sql>` comment; un-comment it.
    if (!/^--\s?/.test(trimmed)) {
      // Stop at the first non-comment line: the DOWN block has ended.
      break;
    }
    const uncommented = raw.replace(/^\s*--\s?/, '');
    downLines.push(uncommented);
  }

  return { up: upText, down: downLines.join('\n').trim() };
}

// ---------------------------------------------------------------------------
// Bookkeeping
// ---------------------------------------------------------------------------

const SCHEMA_MIGRATIONS_DDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id              SERIAL PRIMARY KEY,
  migration_name  TEXT UNIQUE NOT NULL,
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
`.trim();

// ---------------------------------------------------------------------------
// Live DB driver (lazy)
// ---------------------------------------------------------------------------

async function connect() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new DbUnreachableError(
      'DATABASE_URL is not set. Required to apply migrations. See script header for the Supabase direct-connection URL form.',
    );
  }
  let pg;
  try {
    pg = require('pg');
  } catch (err) {
    throw new DbUnreachableError(
      "Live migration requires the 'pg' package. Install it ad-hoc with `npm install --no-save pg` (the dependency is not pinned by Phase 2 dispatch).",
    );
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
  } catch (err) {
    throw new DbUnreachableError(`Postgres connect failed: ${err && err.message ? err.message : err}`);
  }
  return client;
}

class DbUnreachableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DbUnreachableError';
  }
}

class MigrationFailureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MigrationFailureError';
  }
}

async function ensureBookkeepingTable(client) {
  await client.query(SCHEMA_MIGRATIONS_DDL);
}

async function fetchAppliedNames(client) {
  const result = await client.query('SELECT migration_name FROM schema_migrations ORDER BY id');
  return new Set(result.rows.map((row) => row.migration_name));
}

async function recordApplied(client, name) {
  await client.query(
    'INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
    [name],
  );
}

async function deleteRecord(client, name) {
  await client.query('DELETE FROM schema_migrations WHERE migration_name = $1', [name]);
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

async function modeApply(args) {
  const files = listMigrationFiles();
  log(`Found ${files.length} migration file(s) in schema/.`);

  if (args.dryRun) {
    log('--dry-run: no DB connection will be opened.');
    for (const name of files) {
      const { up } = splitUpDown(readFile(name));
      process.stdout.write(`\n-- BEGIN ${name} (UP)\n${up.trim()}\n-- END ${name}\n`);
    }
    log('Dry-run complete. No state changed.');
    return EXIT_OK;
  }

  let client;
  try {
    client = await connect();
  } catch (err) {
    if (err instanceof DbUnreachableError) {
      logErr(err.message);
      return EXIT_DB_UNREACHABLE;
    }
    throw err;
  }

  try {
    await ensureBookkeepingTable(client);
    const applied = await fetchAppliedNames(client);

    let appliedCount = 0;
    for (const name of files) {
      if (applied.has(name)) {
        log(`SKIP  ${name} (already applied)`);
        continue;
      }
      const { up } = splitUpDown(readFile(name));
      log(`APPLY ${name}`);
      try {
        await client.query('BEGIN');
        await client.query(up);
        await recordApplied(client, name);
        await client.query('COMMIT');
        log(`OK    ${name}`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw new MigrationFailureError(
          `migration ${name} failed: ${err && err.message ? err.message : err}`,
        );
      }
    }
    log(`Applied ${appliedCount} migration(s).`);
    return EXIT_OK;
  } catch (err) {
    if (err instanceof MigrationFailureError) {
      logErr(err.message);
      return EXIT_MIGRATION_FAILURE;
    }
    logErr(`unexpected: ${err && err.message ? err.message : err}`);
    return EXIT_MIGRATION_FAILURE;
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (_) {
        // swallow on shutdown
      }
    }
  }
}

async function modeDown(args) {
  const name = args.downTarget;
  const files = listMigrationFiles();
  if (!files.includes(name)) {
    logErr(`migration ${name} not found in schema/. Available: ${files.join(', ') || '(none)'}`);
    return EXIT_MIGRATION_FAILURE;
  }

  const { down } = splitUpDown(readFile(name));
  if (!down) {
    logErr(`migration ${name} has no -- DOWN block; cannot reverse.`);
    return EXIT_MIGRATION_FAILURE;
  }

  if (args.dryRun) {
    log(`--dry-run --down ${name}:`);
    process.stdout.write(`\n-- BEGIN ${name} (DOWN)\n${down}\n-- END ${name}\n`);
    log('Dry-run complete. No state changed.');
    return EXIT_OK;
  }

  let client;
  try {
    client = await connect();
  } catch (err) {
    if (err instanceof DbUnreachableError) {
      logErr(err.message);
      return EXIT_DB_UNREACHABLE;
    }
    throw err;
  }

  try {
    await ensureBookkeepingTable(client);
    log(`DOWN  ${name}`);
    try {
      await client.query('BEGIN');
      await client.query(down);
      await deleteRecord(client, name);
      await client.query('COMMIT');
      log(`OK    DOWN ${name}`);
      return EXIT_OK;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw new MigrationFailureError(`DOWN ${name} failed: ${err && err.message ? err.message : err}`);
    }
  } catch (err) {
    if (err instanceof MigrationFailureError) {
      logErr(err.message);
      return EXIT_MIGRATION_FAILURE;
    }
    logErr(`unexpected: ${err && err.message ? err.message : err}`);
    return EXIT_MIGRATION_FAILURE;
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (_) {
        // swallow on shutdown
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    logErr(err.message);
    printHelp();
    process.exit(EXIT_MIGRATION_FAILURE);
  }

  try {
    const code = args.downTarget ? await modeDown(args) : await modeApply(args);
    process.exit(code);
  } catch (err) {
    logErr(`fatal: ${err && err.stack ? err.stack : err}`);
    process.exit(EXIT_MIGRATION_FAILURE);
  }
}

// Export the pure file-discovery + UP/DOWN parsing helpers so the migration
// dry-run test can assert a migration parses correctly without opening a DB.
// The CLI entry (main) only fires when run directly, never on require().
module.exports = {
  listMigrationFiles,
  readFile,
  splitUpDown,
  SCHEMA_DIR,
};

if (require.main === module) {
  main();
}
