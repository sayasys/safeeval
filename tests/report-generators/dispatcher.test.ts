// generateReport dispatcher unit tests.
//
// Coverage paths:
//   1. Cache hit: lookupCache returns a row, incrementCacheHit fires,
//      callModel is NOT invoked, write does not fire.
//   2. Cache miss: callModel runs, validateReport runs, writeReportRecord
//      fires; result carries cache_hit=false and the validation block.
//   3. Legal-gate deny: audience='legal' with a non-pii_reviewer user throws
//      LegalAccessGateError, writes a denied legal_access_log row, and never
//      reaches the evaluation read or the model call.
//   4. Legal-gate grant: audience='legal' with a pii_reviewer user proceeds
//      and writes a granted legal_access_log row.
//   5. Validation-fail-but-return: callModel returns markdown that fails
//      validation; the dispatcher still writes the record AND returns the
//      markdown to the caller with validation.valid=false.
//   6. Evaluation not found: throws EvaluationNotFoundError.
//   7. force_regenerate: skips the cache lookup and regenerates.
//   8. Live defaultCallModel (Phase 3): the real Anthropic wire-up, gated on
//      SAFEEVAL_REPORT_GEN_LIVE, with the per-audience token budget; the SDK
//      is mocked so no network contact is made.
//
// Tests 1-7 run with a mocked dbClient and a mocked callModel. Test group 8
// mocks the @anthropic-ai/sdk module instead, exercising defaultCallModel.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted SDK mock: every `new Anthropic(...).messages.create(...)` in the
// dispatcher resolves to anthropicCreate. Only the live-path tests exercise
// it; the callModel-injection tests never reach the SDK.
const { anthropicCreate } = vi.hoisted(() => ({ anthropicCreate: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: anthropicCreate };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(_opts: any) {}
  },
}));

import {
  generateReport,
  LegalAccessGateError,
  EvaluationNotFoundError,
  ReportGenerationError,
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
  insertLegalAccessLog: ReturnType<typeof vi.fn>;
}

const PII_REVIEWER = { auth_user_id: 'u-pii', role: 'pii_reviewer' };
const NO_ROLE_USER = { auth_user_id: 'u-x', role: null };

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
    insertLegalAccessLog: vi.fn(async () => {}),
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

describe('generateReport: legal-gate deny (Phase 3 role check)', () => {
  it('throws LegalAccessGateError and writes a denied audit row when the user lacks pii_reviewer', async () => {
    const client = makeClient({
      getEvaluation: vi.fn(async () => makeEvaluation()),
    });
    const callModel = vi.fn();
    await expect(
      generateReport('eval_1', 'legal', {
        source: 'on_demand',
        dbClient: client,
        callModel,
        user: NO_ROLE_USER,
      }),
    ).rejects.toBeInstanceOf(LegalAccessGateError);
    expect(callModel).not.toHaveBeenCalled();
    expect(client.getEvaluation).not.toHaveBeenCalled();
    expect(client.insertLegalAccessLog).toHaveBeenCalledTimes(1);
    const logged = client.insertLegalAccessLog.mock.calls[0]![0];
    expect(logged.granted).toBe(false);
    expect(logged.audience).toBe('legal');
    expect(logged.user_id).toBe('u-x');
    expect(typeof logged.denied_reason).toBe('string');
  });

  it('also denies (and logs) when no user is supplied at all', async () => {
    const client = makeClient({ getEvaluation: vi.fn(async () => makeEvaluation()) });
    await expect(
      generateReport('eval_1', 'legal', {
        source: 'on_demand',
        dbClient: client,
        callModel: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(LegalAccessGateError);
    expect(client.insertLegalAccessLog).toHaveBeenCalledTimes(1);
    expect(client.insertLegalAccessLog.mock.calls[0]![0].granted).toBe(false);
    expect(client.insertLegalAccessLog.mock.calls[0]![0].user_id).toBeNull();
  });
});

describe('generateReport: legal-gate grant (Phase 3 role check)', () => {
  it('proceeds and writes a granted audit row when the user has pii_reviewer', async () => {
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
      user: PII_REVIEWER,
    });
    expect(result.audience).toBe('legal');
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(client.insertLegalAccessLog).toHaveBeenCalledTimes(1);
    const logged = client.insertLegalAccessLog.mock.calls[0]![0];
    expect(logged.granted).toBe(true);
    expect(logged.user_id).toBe('u-pii');
    expect(logged.denied_reason).toBeNull();
  });
});

describe('generateReport: validation fails but report still returns', () => {
  it('returns the markdown with validation.valid=false rather than throwing', async () => {
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

describe('generateReport: force_regenerate', () => {
  it('skips the cache lookup and regenerates even when a cached row exists', async () => {
    const client = makeClient({
      getEvaluation: vi.fn(async () => makeEvaluation()),
      // A cached row exists, but force_regenerate must bypass it.
      getReportRecord: vi.fn(async () => makeReportRow()),
      insertReportRecord: vi.fn(async (row) => makeReportRow({ markdown: row.markdown })),
    });
    const callModel = vi.fn(async () => cleanReviewerMarkdown());
    const result = await generateReport('eval_1', 'reviewer', {
      source: 'on_demand',
      dbClient: client,
      callModel,
      force_regenerate: true,
    });
    expect(result.cache_hit).toBe(false);
    expect(client.getReportRecord).not.toHaveBeenCalled();
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(client.insertReportRecord).toHaveBeenCalledTimes(1);
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

describe('generateReport: live defaultCallModel (Phase 3 Anthropic wire-up)', () => {
  let savedLive: string | undefined;
  let savedKey: string | undefined;

  beforeEach(() => {
    savedLive = process.env.SAFEEVAL_REPORT_GEN_LIVE;
    savedKey = process.env.ANTHROPIC_API_KEY;
    anthropicCreate.mockReset();
  });

  afterEach(() => {
    if (savedLive === undefined) delete process.env.SAFEEVAL_REPORT_GEN_LIVE;
    else process.env.SAFEEVAL_REPORT_GEN_LIVE = savedLive;
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
  });

  it('errors with a feature-flag-disabled message when SAFEEVAL_REPORT_GEN_LIVE is off (no Anthropic call)', async () => {
    delete process.env.SAFEEVAL_REPORT_GEN_LIVE;
    const client = makeClient({
      getEvaluation: vi.fn(async () => makeEvaluation()),
      getReportRecord: vi.fn(async () => null),
    });
    // No callModel injected -> defaultCallModel runs and hits the flag gate.
    await expect(
      generateReport('eval_1', 'reviewer', { source: 'on_demand', dbClient: client }),
    ).rejects.toThrow(/SAFEEVAL_REPORT_GEN_LIVE/);
    expect(anthropicCreate).not.toHaveBeenCalled();
    expect(client.insertReportRecord).not.toHaveBeenCalled();
  });

  it.each([
    ['reviewer', 600],
    ['trust_safety_lead', 400],
    ['exec_summary', 120],
  ] as const)(
    'calls the Anthropic SDK with the %s token budget (%i) at model claude-sonnet-4-6, temperature 0',
    async (audience, expectedMaxTokens) => {
      process.env.SAFEEVAL_REPORT_GEN_LIVE = 'true';
      process.env.ANTHROPIC_API_KEY = 'sk-test';
      anthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '# Report\n' + 'word '.repeat(120) }],
      });
      const client = makeClient({
        getEvaluation: vi.fn(async () => makeEvaluation()),
        getReportRecord: vi.fn(async () => null),
        insertReportRecord: vi.fn(async (row) => makeReportRow({ markdown: row.markdown, audience })),
      });
      const result = await generateReport('eval_1', audience, { source: 'on_demand', dbClient: client });
      expect(anthropicCreate).toHaveBeenCalledTimes(1);
      const [params] = anthropicCreate.mock.calls[0]!;
      expect(params.model).toBe('claude-sonnet-4-6');
      expect(params.max_tokens).toBe(expectedMaxTokens);
      expect(params.temperature).toBe(0);
      expect(typeof params.system).toBe('string');
      expect(params.messages[0].role).toBe('user');
      expect(result.markdown).toContain('# Report');
    },
  );

  it('uses the legal token budget (500) for the legal audience with a pii_reviewer user', async () => {
    process.env.SAFEEVAL_REPORT_GEN_LIVE = 'true';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: '# Regulatory categorization\n' + 'word '.repeat(400) }],
    });
    const client = makeClient({
      getEvaluation: vi.fn(async () => makeEvaluation()),
      getReportRecord: vi.fn(async () => null),
      insertReportRecord: vi.fn(async (row) => makeReportRow({ markdown: row.markdown, audience: 'legal' })),
    });
    await generateReport('eval_1', 'legal', {
      source: 'on_demand',
      dbClient: client,
      user: PII_REVIEWER,
    });
    expect(anthropicCreate.mock.calls[0]![0].max_tokens).toBe(500);
  });

  it('throws ReportGenerationError when the Anthropic call fails', async () => {
    process.env.SAFEEVAL_REPORT_GEN_LIVE = 'true';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    anthropicCreate.mockRejectedValue(new Error('upstream 529 overloaded'));
    const client = makeClient({
      getEvaluation: vi.fn(async () => makeEvaluation()),
      getReportRecord: vi.fn(async () => null),
    });
    await expect(
      generateReport('eval_1', 'reviewer', { source: 'on_demand', dbClient: client }),
    ).rejects.toBeInstanceOf(ReportGenerationError);
    expect(client.insertReportRecord).not.toHaveBeenCalled();
  });

  it('throws ReportGenerationError (reason=empty_response) on a non-text completion', async () => {
    process.env.SAFEEVAL_REPORT_GEN_LIVE = 'true';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    anthropicCreate.mockResolvedValue({ content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }] });
    const client = makeClient({
      getEvaluation: vi.fn(async () => makeEvaluation()),
      getReportRecord: vi.fn(async () => null),
    });
    await expect(
      generateReport('eval_1', 'reviewer', { source: 'on_demand', dbClient: client }),
    ).rejects.toMatchObject({ name: 'ReportGenerationError', reason: 'empty_response' });
  });

  it('throws ReportGenerationError (reason=config) when the API key is missing in live mode', async () => {
    process.env.SAFEEVAL_REPORT_GEN_LIVE = 'true';
    delete process.env.ANTHROPIC_API_KEY;
    const client = makeClient({
      getEvaluation: vi.fn(async () => makeEvaluation()),
      getReportRecord: vi.fn(async () => null),
    });
    await expect(
      generateReport('eval_1', 'reviewer', { source: 'on_demand', dbClient: client }),
    ).rejects.toMatchObject({ name: 'ReportGenerationError', reason: 'config' });
    expect(anthropicCreate).not.toHaveBeenCalled();
  });
});
