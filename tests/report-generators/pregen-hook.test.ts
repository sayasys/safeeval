// Post-write pregen hook tests.
//
// Verifies the persistence -> report-generator handoff:
//   - SAFEEVAL_PREGEN_REPORTS=true: on block / human_review, the hook fires
//     for the four implemented non-legal audiences.
//   - SAFEEVAL_PREGEN_REPORTS unset: no calls fire even for block /
//     human_review dispositions.
//   - allow / safe_completion: no calls fire even with the flag on.
//   - Hook errors are swallowed and never propagate to persistEvaluation.
//
// The test mocks the report-generator module so generateReport is a vi.fn,
// then exercises persistEvaluation against a mocked db-client (the same
// pattern persistence.test.ts uses).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the report-generators module BEFORE importing persistence so the
// vi.mock hoist replaces the import binding before module load.
vi.mock('../../src/lib/report-generators', () => ({
  generateReport: vi.fn(),
  IMPLEMENTED_AUDIENCES: ['reviewer', 'trust_safety_lead', 'legal', 'exec_summary'] as const,
}));

import { generateReport } from '../../src/lib/report-generators';
import { persistEvaluation } from '../../src/lib/data/persistence';
import type {
  DbClientSurface,
  InsertEvaluationRow,
  InsertEvaluationResult,
  PingResult,
} from '../../src/lib/data/db-client';
import type { V5Envelope } from '../../src/lib/data/types';

const mockedGenerate = vi.mocked(generateReport);

function makeMockClient(insertId = 'eval_42'): DbClientSurface {
  const surface: DbClientSurface = {
    insertEvaluation: vi.fn(async (_row: InsertEvaluationRow): Promise<InsertEvaluationResult> => ({
      evaluation_id: insertId,
    })),
    withOrganizationContext: async <T,>(_organization_id: string, fn: () => Promise<T>): Promise<T> => fn(),
    getEvaluationsByOrganization: vi.fn(async () => []),
    ping: vi.fn(async (): Promise<PingResult> => ({ ok: true, latency_ms: 1 })),
    getRawClient: vi.fn(),
    getEvaluation: vi.fn(),
    getReportRecord: vi.fn(),
    insertReportRecord: vi.fn(),
    incrementReportCacheHit: vi.fn(),
    insertLegalAccessLog: vi.fn(),
    getReportById: vi.fn(async () => null),
    listReportsByOrganization: vi.fn(async () => []),
    listAllReports: vi.fn(async () => []),
  };
  return surface;
}

function makeEnvelope(disposition: V5Envelope['disposition']['action']): V5Envelope {
  return {
    schema_version: '5.1',
    ontology_version: '5.1',
    evaluated_at: '2026-05-29T00:00:00Z',
    model_pipeline: ['stage-1', 'stage-2'],
    prompt_length: 42,
    input: { kind: 'prompt', text: 'send funds to alice@example.com' },
    disposition: { action: disposition, confidence: 0.9 },
    evidence: { aggregate_score: 4 },
    cache_key: 'stage2:v5.1:sha256:' + 'a'.repeat(64),
    stage1_prompt_hash: 'b'.repeat(64),
    stage2_prompt_hash: 'c'.repeat(64),
    stage3_prompt_hash: 'd'.repeat(64),
    stage4_prompt_hash: 'e'.repeat(64),
  };
}

let originalFlag: string | undefined;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  originalFlag = process.env.SAFEEVAL_PREGEN_REPORTS;
  delete process.env.SAFEEVAL_PREGEN_REPORTS;
  mockedGenerate.mockReset();
  mockedGenerate.mockResolvedValue({
    markdown: '# r',
    cache_hit: false,
    validation: { valid: true, violations: [] },
    report_prompt_hash: 'h'.repeat(64),
    audience: 'reviewer',
    evaluation_id: 'eval_42',
  });
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.SAFEEVAL_PREGEN_REPORTS;
  } else {
    process.env.SAFEEVAL_PREGEN_REPORTS = originalFlag;
  }
  errorSpy.mockRestore();
});

// Flush a single tick of the microtask queue so the fire-and-forget
// promises started by triggerPregenReports settle before assertions.
async function flushAsync(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setImmediate(r));
  }
}

describe('pregen hook: flag off (default)', () => {
  it('does not fire generateReport for a block disposition when flag is unset', async () => {
    const client = makeMockClient();
    await persistEvaluation(makeEnvelope('block'), 'raw', { dbClient: client });
    await flushAsync();
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('does not fire generateReport for a human_review disposition when flag is unset', async () => {
    const client = makeMockClient();
    await persistEvaluation(makeEnvelope('human_review'), 'raw', { dbClient: client });
    await flushAsync();
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('does not fire for any disposition when flag is "false"', async () => {
    process.env.SAFEEVAL_PREGEN_REPORTS = 'false';
    const client = makeMockClient();
    await persistEvaluation(makeEnvelope('block'), 'raw', { dbClient: client });
    await flushAsync();
    expect(mockedGenerate).not.toHaveBeenCalled();
  });
});

describe('pregen hook: flag on, fires only on block / human_review', () => {
  beforeEach(() => {
    process.env.SAFEEVAL_PREGEN_REPORTS = 'true';
  });

  it('does not fire for allow disposition', async () => {
    const client = makeMockClient();
    await persistEvaluation(makeEnvelope('allow'), 'raw', { dbClient: client });
    await flushAsync();
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('does not fire for safe_completion disposition', async () => {
    const client = makeMockClient();
    await persistEvaluation(makeEnvelope('safe_completion'), 'raw', { dbClient: client });
    await flushAsync();
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('fires for block: calls generateReport for the four non-legal audiences', async () => {
    const client = makeMockClient();
    await persistEvaluation(makeEnvelope('block'), 'raw', { dbClient: client });
    await flushAsync();
    expect(mockedGenerate).toHaveBeenCalledTimes(3);
    const audiences = mockedGenerate.mock.calls.map((c) => c[1]).sort();
    expect(audiences).toEqual(['exec_summary', 'reviewer', 'trust_safety_lead']);
  });

  it('fires for human_review: calls generateReport for the three non-legal audiences', async () => {
    const client = makeMockClient();
    await persistEvaluation(makeEnvelope('human_review'), 'raw', { dbClient: client });
    await flushAsync();
    expect(mockedGenerate).toHaveBeenCalledTimes(3);
  });

  it('passes the inserted evaluation_id and source=pre_gen to each call', async () => {
    const client = makeMockClient('eval_42');
    await persistEvaluation(makeEnvelope('block'), 'raw', { dbClient: client });
    await flushAsync();
    for (const call of mockedGenerate.mock.calls) {
      expect(call[0]).toBe('eval_42');
      expect(call[2]?.source).toBe('pre_gen');
      expect(call[2]?.dbClient).toBe(client);
    }
  });

  it('does NOT trigger the legal audience -- legal goes through the auth-gate at read time', async () => {
    const client = makeMockClient();
    await persistEvaluation(makeEnvelope('block'), 'raw', { dbClient: client });
    await flushAsync();
    const audiences = mockedGenerate.mock.calls.map((c) => c[1]);
    expect(audiences).not.toContain('legal');
  });
});

describe('pregen hook: error containment', () => {
  beforeEach(() => {
    process.env.SAFEEVAL_PREGEN_REPORTS = 'true';
  });

  it('swallows generateReport failures and never throws from persistEvaluation', async () => {
    mockedGenerate.mockRejectedValue(new Error('Anthropic 503'));
    const client = makeMockClient();
    await expect(
      persistEvaluation(makeEnvelope('block'), 'raw', { dbClient: client }),
    ).resolves.toEqual({ evaluation_id: 'eval_42' });
    await flushAsync();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('one audience failure does not cancel the others', async () => {
    let callIdx = 0;
    mockedGenerate.mockImplementation(async () => {
      const i = callIdx++;
      if (i === 1) throw new Error('exec_summary boom');
      return {
        markdown: '# ok',
        cache_hit: false,
        validation: { valid: true, violations: [] },
        report_prompt_hash: 'h'.repeat(64),
        audience: 'reviewer',
        evaluation_id: 'eval_42',
      };
    });
    const client = makeMockClient();
    await persistEvaluation(makeEnvelope('block'), 'raw', { dbClient: client });
    await flushAsync();
    expect(mockedGenerate).toHaveBeenCalledTimes(3);
    expect(errorSpy).toHaveBeenCalled();
  });
});
