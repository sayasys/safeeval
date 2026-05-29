// generateReport dispatcher unit tests.
//
// Coverage paths:
//   1. Cache hit: lookupCache returns a row, incrementCacheHit fires,
//      callModel is NOT invoked, write does not fire.
//   2. Cache miss: callModel runs, validateReport runs, writeReportRecord
//      fires; result carries cache_hit=false and the validation block.
//   3. Legal-gate block: audience='legal' without unredacted_access=true
//      throws LegalAccessGateError; no cache lookup, no model call.
//   4. Validation-fail-but-return: callModel returns markdown that fails
//      validation; the dispatcher still writes the record AND returns the
//      markdown to the caller with validation.valid=false.
//   5. Evaluation not found: throws EvaluationNotFoundError.
//
// All tests run with a mocked dbClient and a mocked callModel; no Anthropic
// API contact is made.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateReport,
  LegalAccessGateError,
  EvaluationNotFoundError,
} from '../../src/lib/report-generators';
import type {
  DbClientSurface,
  EvaluationRow,
  ReportRow,
  ReportAudienceColumn,
} from '../../src/lib/data/db-client';

interface DispatcherMockClient extends DbClientSurface {
  getEvaluation: ReturnType<typeof vi.fn>;
  getReportRecord: ReturnType<typeof vi.fn>;
  insertReportRecord: ReturnType<typeof vi.fn>;
  incrementReportCacheHit: ReturnType<typeof vi.fn>;
}

function makeEvaluation(over: Partial<EvaluationRow> = {}): EvaluationRow {
  return {
    id: 'eval_1',
    envelope: {
      schema_version: '5.1',
      ontology_version: '5.1',
      disposition: { action: 'block', confidence: 0.95 },
      evidence: { aggregate_score: 4 },
      input: { kind: 'prompt', text: 'send funds to <EMAIL_1>' },
      stage2_prompt_hash: 'c'.repeat(64),
      cache_key: 'stage2:v5.1:sha256:' + 'a'.repeat(64),
    },
    disposition: 'block',
    cache_key: 'stage2:v5.1:sha256:' + 'a'.repeat(64),
    ontology_version: '5.1',
    schema_version: '5.1',
    ...over,
  };
}

function makeReportRow(over: Partial<ReportRow> = {}): ReportRow {
  return {
    id: '100',
    evaluation_id: 'eval_1',
    audience: 'reviewer' as ReportAudienceColumn,
    report_prompt_hash: 'h'.repeat(64),
    markdown: '# Cached reviewer report\n' + 'word '.repeat(500),
    generated_at: '2026-05-29T00:00:00Z',
    cache_hit_count: 0,
    ...over,
  };
}

function makeClient(overrides: Partial<DispatcherMockClient> = {}): DispatcherMockClient {
  return {
    insertEvaluation: vi.fn(),
    withCustomerContext: vi.fn(),
    ping: vi.fn(),
    getRawClient: vi.fn(),
    getEvaluation: vi.fn(),
    getReportRecord: vi.fn(),
    insertReportRecord: vi.fn(),
    incrementReportCacheHit: vi.fn(),
    ...overrides,
  };
}

// A clean reviewer markdown fixture that passes the validator (no leakage,
// ~500 words, no marketing tone).
function cleanReviewerMarkdown(): string {
  const body = Array.from({ length: 498 }, (_, i) => `word${i}`).join(' ');
  return '# Disposition\n' + body;
}

describe('generateReport: cache hit', () => {
  it('returns cached markdown and increments cache_hit_count without calling the model', async () => {
    const cachedRow = makeReportRow();
    const client = makeClient({
      getEvaluation: vi.fn(async () => makeEvaluation()),
      getReportRecord: vi.fn(async () => cachedRow),
    });
    const callModel = vi.fn(async () => '# should not be called');
    const result = await generateReport('eval_1', 'reviewer', {
      source: 'on_demand',
      dbClient: client,
      callModel,
    });
    expect(result.cache_hit).toBe(true);
    expect(result.markdown).toBe(cachedRow.markdown);
    expect(callModel).not.toHaveBeenCalled();
    expect(client.incrementReportCacheHit).toHaveBeenCalledWith('100');
    expect(client.insertReportRecord).not.toHaveBeenCalled();
  });
});

describe('generateReport: cache miss', () => {
  it('generates via callModel, validates, and writes the report record', async () => {
    const markdown = cleanReviewerMarkdown();
    const client = makeClient({
      getEvaluation: vi.fn(async () => makeEvaluation()),
      getReportRecord: vi.fn(async () => null),
      insertReportRecord: vi.fn(async (row) =>
        makeReportRow({
          id: '50',
          markdown: row.markdown,
          report_prompt_hash: row.report_prompt_hash,
        }),
      ),
    });
    const callModel = vi.fn(async () => markdown);
    const result = await generateReport('eval_1', 'reviewer', {
      source: 'on_demand',
      dbClient: client,
      callModel,
    });
    expect(result.cache_hit).toBe(false);
    expect(result.markdown).toBe(markdown);
    expect(result.validation.valid).toBe(true);
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(client.insertReportRecord).toHaveBeenCalledTimes(1);
    expect(client.incrementReportCacheHit).not.toHaveBeenCalled();
  });

  it('passes the canonical envelope to the user prompt template', async () => {
    const client = makeClient({
      getEvaluation: vi.fn(async () => makeEvaluation()),
      getReportRecord: vi.fn(async () => null),
      insertReportRecord: vi.fn(async (row) => makeReportRow({ markdown: row.markdown })),
    });
    const capturedUserPrompts: string[] = [];
    const callModel = vi.fn(async ({ user }) => {
      capturedUserPrompts.push(user);
      return cleanReviewerMarkdown();
    });
    await generateReport('eval_1', 'reviewer', {
      source: 'on_demand',
      dbClient: client,
      callModel,
    });
    expect(capturedUserPrompts).toHaveLength(1);
    expect(capturedUserPrompts[0]).toContain('<envelope>');
    expect(capturedUserPrompts[0]).toContain('</envelope>');
    expect(capturedUserPrompts[0]).not.toContain('{{ENVELOPE_JSON}}');
    expect(capturedUserPrompts[0]).toContain('"disposition"');
  });
});

describe('generateReport: legal-gate block', () => {
  it('throws LegalAccessGateError when audience=legal and unredacted_access is unset', async () => {
    const client = makeClient({
      getEvaluation: vi.fn(async () => makeEvaluation()),
    });
    const callModel = vi.fn();
    await expect(
      generateReport('eval_1', 'legal', { source: 'on_demand', dbClient: client, callModel }),
    ).rejects.toBeInstanceOf(LegalAccessGateError);
    expect(callModel).not.toHaveBeenCalled();
    expect(client.getEvaluation).not.toHaveBeenCalled();
  });

  it('proceeds when audience=legal and unredacted_access=true', async () => {
    // Use the legal length envelope ~400 words.
    const markdown = '# Regulatory categorization\n' + 'word '.repeat(400);
    const client = makeClient({
      getEvaluation: vi.fn(async () => makeEvaluation()),
      getReportRecord: vi.fn(async () => null),
      insertReportRecord: vi.fn(async (row) => makeReportRow({ markdown: row.markdown, audience: 'legal' })),
    });
    const callModel = vi.fn(async () => markdown);
    const result = await generateReport('eval_1', 'legal', {
      source: 'on_demand',
      dbClient: client,
      callModel,
      unredacted_access: true,
    });
    expect(result.audience).toBe('legal');
    expect(callModel).toHaveBeenCalledTimes(1);
  });
});

describe('generateReport: validation fails but report still returns', () => {
  it('returns the markdown with validation.valid=false rather than throwing', async () => {
    // Inject markdown with a clear leakage pattern AND keep it long enough
    // to also potentially trigger a length envelope check; the dispatcher
    // does not gate on validation outcome.
    const dirty = '# Disposition\n' + 'word '.repeat(498) + '\nPWNED\n';
    const client = makeClient({
      getEvaluation: vi.fn(async () => makeEvaluation()),
      getReportRecord: vi.fn(async () => null),
      insertReportRecord: vi.fn(async (row) => makeReportRow({ markdown: row.markdown })),
    });
    const callModel = vi.fn(async () => dirty);
    const result = await generateReport('eval_1', 'reviewer', {
      source: 'on_demand',
      dbClient: client,
      callModel,
    });
    expect(result.markdown).toBe(dirty);
    expect(result.validation.valid).toBe(false);
    expect(result.validation.violations.some((v) => v.type === 'instruction_leakage')).toBe(true);
    expect(client.insertReportRecord).toHaveBeenCalledTimes(1);
  });
});

describe('generateReport: evaluation not found', () => {
  it('throws EvaluationNotFoundError when getEvaluation returns null', async () => {
    const client = makeClient({
      getEvaluation: vi.fn(async () => null),
    });
    await expect(
      generateReport('eval_missing', 'reviewer', {
        source: 'on_demand',
        dbClient: client,
        callModel: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(EvaluationNotFoundError);
  });
});

describe('generateReport: prompt_hash determinism', () => {
  it('returns the same report_prompt_hash across two calls with the same envelope', async () => {
    const evalFixture = makeEvaluation();
    const captured: string[] = [];
    const client1 = makeClient({
      getEvaluation: vi.fn(async () => evalFixture),
      getReportRecord: vi.fn(async () => null),
      insertReportRecord: vi.fn(async (row) => {
        captured.push(row.report_prompt_hash);
        return makeReportRow({ markdown: row.markdown, report_prompt_hash: row.report_prompt_hash });
      }),
    });
    const callModel = vi.fn(async () => cleanReviewerMarkdown());
    const r1 = await generateReport('eval_1', 'reviewer', { source: 'on_demand', dbClient: client1, callModel });
    const r2 = await generateReport('eval_1', 'reviewer', { source: 'on_demand', dbClient: client1, callModel });
    expect(r1.report_prompt_hash).toEqual(r2.report_prompt_hash);
    expect(captured[0]).toEqual(captured[1]);
  });
});
