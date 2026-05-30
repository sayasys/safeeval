// Cache module unit tests.
//
// Coverage:
//   - lookupCache hit: returns the record converted from the row shape.
//   - lookupCache miss: returns null.
//   - writeReportRecord happy path: insert succeeds, returns cache_conflict=false.
//   - writeReportRecord race: insert raises a UNIQUE violation, the cache
//     module re-reads the canonical row and increments cache_hit_count;
//     returns cache_conflict=true.
//   - incrementCacheHit: passes through to client.incrementReportCacheHit.
//
// The mock dbClient implements only the surface methods the cache module
// exercises; other DbClientSurface methods throw if invoked unexpectedly.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  lookupCache,
  writeReportRecord,
  incrementCacheHit,
} from '../../src/lib/report-generators/cache';
import type {
  DbClientSurface,
  ReportRow,
  ReportAudienceColumn,
} from '../../src/lib/data/db-client';

interface CacheMockClient extends DbClientSurface {
  getReportRecord: ReturnType<typeof vi.fn>;
  insertReportRecord: ReturnType<typeof vi.fn>;
  incrementReportCacheHit: ReturnType<typeof vi.fn>;
}

function rowFixture(over: Partial<ReportRow> = {}): ReportRow {
  return {
    id: '42',
    evaluation_id: 'eval_1',
    audience: 'reviewer' as ReportAudienceColumn,
    report_prompt_hash: 'h'.repeat(64),
    markdown: '# Report\nbody',
    generated_at: '2026-05-29T00:00:00Z',
    cache_hit_count: 0,
    ...over,
  };
}

function makeClient(overrides: Partial<CacheMockClient> = {}): CacheMockClient {
  const surface: CacheMockClient = {
    insertEvaluation: vi.fn(),
    withOrganizationContext: vi.fn(),
    getEvaluationsByOrganization: vi.fn(async () => []),
    ping: vi.fn(),
    getRawClient: vi.fn(),
    getEvaluation: vi.fn(),
    getReportRecord: vi.fn(),
    insertReportRecord: vi.fn(),
    incrementReportCacheHit: vi.fn(),
    insertLegalAccessLog: vi.fn(),
    ...overrides,
  };
  return surface;
}

describe('lookupCache', () => {
  it('returns the persisted record on hit', async () => {
    const row = rowFixture();
    const client = makeClient({
      getReportRecord: vi.fn(async () => row),
    });
    const record = await lookupCache('eval_1', 'reviewer', row.report_prompt_hash, client);
    expect(record).not.toBeNull();
    expect(record!.id).toBe(42);
    expect(record!.audience).toBe('reviewer');
    expect(record!.markdown).toBe('# Report\nbody');
    expect(client.getReportRecord).toHaveBeenCalledWith(
      'eval_1',
      'reviewer',
      row.report_prompt_hash,
    );
  });

  it('returns null on miss', async () => {
    const client = makeClient({
      getReportRecord: vi.fn(async () => null),
    });
    const record = await lookupCache('eval_1', 'reviewer', 'h'.repeat(64), client);
    expect(record).toBeNull();
  });

  it('does not increment cache_hit_count on lookup', async () => {
    const row = rowFixture();
    const client = makeClient({
      getReportRecord: vi.fn(async () => row),
    });
    await lookupCache('eval_1', 'reviewer', row.report_prompt_hash, client);
    expect(client.incrementReportCacheHit).not.toHaveBeenCalled();
  });
});

describe('writeReportRecord', () => {
  it('inserts a fresh row and returns cache_conflict=false', async () => {
    const row = rowFixture({ id: '7' });
    const client = makeClient({
      insertReportRecord: vi.fn(async () => row),
    });
    const result = await writeReportRecord(
      {
        evaluation_id: 'eval_1',
        audience: 'reviewer',
        report_prompt_hash: row.report_prompt_hash,
        markdown: row.markdown,
      },
      client,
    );
    expect(result.id).toBe(7);
    expect(result.cache_conflict).toBe(false);
    expect(client.insertReportRecord).toHaveBeenCalledTimes(1);
  });

  it('recovers from a UNIQUE conflict by re-reading and incrementing', async () => {
    const existing = rowFixture({ id: '99' });
    const conflictError: Error & { code?: string } = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      { code: '23505' },
    );
    const client = makeClient({
      insertReportRecord: vi.fn(async () => {
        throw conflictError;
      }),
      getReportRecord: vi.fn(async () => existing),
      incrementReportCacheHit: vi.fn(async () => {}),
    });
    const result = await writeReportRecord(
      {
        evaluation_id: 'eval_1',
        audience: 'reviewer',
        report_prompt_hash: existing.report_prompt_hash,
        markdown: '# loser',
      },
      client,
    );
    expect(result.cache_conflict).toBe(true);
    expect(result.id).toBe(99);
    expect(client.incrementReportCacheHit).toHaveBeenCalledWith('99');
  });

  it('rethrows non-conflict insert failures', async () => {
    const client = makeClient({
      insertReportRecord: vi.fn(async () => {
        throw new Error('connection refused');
      }),
    });
    await expect(
      writeReportRecord(
        {
          evaluation_id: 'eval_1',
          audience: 'reviewer',
          report_prompt_hash: 'h'.repeat(64),
          markdown: '# r',
        },
        client,
      ),
    ).rejects.toThrow(/connection refused/);
  });

  it('detects UNIQUE conflicts via message text when code is absent', async () => {
    const existing = rowFixture({ id: '12' });
    const client = makeClient({
      insertReportRecord: vi.fn(async () => {
        throw new Error('Unique constraint "reports_evaluation_id_audience_..."');
      }),
      getReportRecord: vi.fn(async () => existing),
      incrementReportCacheHit: vi.fn(async () => {}),
    });
    const result = await writeReportRecord(
      {
        evaluation_id: 'eval_1',
        audience: 'reviewer',
        report_prompt_hash: existing.report_prompt_hash,
        markdown: '# loser',
      },
      client,
    );
    expect(result.cache_conflict).toBe(true);
    expect(result.id).toBe(12);
  });
});

describe('incrementCacheHit', () => {
  it('invokes client.incrementReportCacheHit with the row id as string', async () => {
    const client = makeClient({
      incrementReportCacheHit: vi.fn(async () => {}),
    });
    await incrementCacheHit(123, client);
    expect(client.incrementReportCacheHit).toHaveBeenCalledWith('123');
  });
});
