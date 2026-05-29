import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  persistEvaluation,
  PersistError,
  KMSNotImplementedError,
} from '../../src/lib/data/persistence';
import type {
  DbClientSurface,
  InsertEvaluationRow,
  InsertEvaluationResult,
  PingResult,
} from '../../src/lib/data/db-client';
import type { V5Envelope } from '../../src/lib/data/types';

// ---------------------------------------------------------------------------
// Mock db-client
// ---------------------------------------------------------------------------

interface MockClient extends DbClientSurface {
  insertEvaluation: ReturnType<typeof vi.fn>;
  withCustomerContext: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
  capturedRows: InsertEvaluationRow[];
  capturedCustomerIds: string[];
}

function makeMockClient(overrides: Partial<{
  insertResult: InsertEvaluationResult;
  insertError: Error;
  withContextError: Error;
}> = {}): MockClient {
  const capturedRows: InsertEvaluationRow[] = [];
  const capturedCustomerIds: string[] = [];

  const insertEvaluation = vi.fn(async (row: InsertEvaluationRow): Promise<InsertEvaluationResult> => {
    capturedRows.push(row);
    if (overrides.insertError) throw overrides.insertError;
    return overrides.insertResult ?? { evaluation_id: 'evalrow_1' };
  });

  const withCustomerContext = vi.fn(async <T,>(customer_id: string, fn: () => Promise<T>): Promise<T> => {
    capturedCustomerIds.push(customer_id);
    if (overrides.withContextError) throw overrides.withContextError;
    return fn();
  });

  const ping = vi.fn(async (): Promise<PingResult> => ({ ok: true, latency_ms: 1 }));

  return {
    insertEvaluation,
    withCustomerContext,
    ping,
    getRawClient: () => ({} as never),
    // Report-generator surface methods are not exercised by the persistence
    // tests; the mock provides no-op stubs so the type contract is satisfied.
    getEvaluation: vi.fn(async () => null),
    getReportRecord: vi.fn(async () => null),
    insertReportRecord: vi.fn(async () => {
      throw new Error('insertReportRecord not implemented in this mock');
    }),
    incrementReportCacheHit: vi.fn(async () => {}),
    capturedRows,
    capturedCustomerIds,
  };
}

// ---------------------------------------------------------------------------
// Envelope fixture: minimal V5 envelope with the audit-metadata hoisted fields
// the persistence layer maps to DB columns. Mirrors what safeeval-v5.js emits
// (top-level cache_key + stage[1-4]_prompt_hash per JSON Schema).
// ---------------------------------------------------------------------------

function makeEnvelope(over: Partial<V5Envelope> = {}): V5Envelope {
  return {
    schema_version: '5.1',
    ontology_version: '5.1',
    evaluated_at: '2026-05-28T00:00:00Z',
    model_pipeline: ['stage-1', 'stage-2'],
    prompt_length: 42,
    input: { kind: 'prompt', text: 'Send to alice@example.com' },
    disposition: {
      action: 'allow',
      confidence: 0.92,
    },
    evidence: {
      aggregate_score: 3,
    },
    cache_key: 'stage2:v5.1:sha256:' + 'a'.repeat(64),
    stage1_prompt_hash: 'b'.repeat(64),
    stage2_prompt_hash: 'c'.repeat(64),
    stage3_prompt_hash: 'd'.repeat(64),
    stage4_prompt_hash: 'e'.repeat(64),
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Sequence + happy path
// ---------------------------------------------------------------------------

describe('persistEvaluation: happy path', () => {
  let client: MockClient;
  beforeEach(() => {
    client = makeMockClient();
  });

  it('returns the evaluation_id from insertEvaluation', async () => {
    const result = await persistEvaluation(makeEnvelope(), 'raw input', { dbClient: client });
    expect(result.evaluation_id).toBe('evalrow_1');
  });

  it('calls withCustomerContext before insertEvaluation', async () => {
    await persistEvaluation(makeEnvelope(), 'raw input', { dbClient: client });
    expect(client.withCustomerContext).toHaveBeenCalledTimes(1);
    expect(client.insertEvaluation).toHaveBeenCalledTimes(1);
    const withCtxOrder = client.withCustomerContext.mock.invocationCallOrder[0]!;
    const insertOrder = client.insertEvaluation.mock.invocationCallOrder[0]!;
    expect(withCtxOrder).toBeLessThan(insertOrder);
  });

  it('defaults customer_id to "self" when not provided', async () => {
    await persistEvaluation(makeEnvelope(), 'raw input', { dbClient: client });
    expect(client.capturedCustomerIds).toEqual(['self']);
    expect(client.capturedRows[0]?.customer_id).toBe('self');
  });

  it('honors an explicit customer_id', async () => {
    await persistEvaluation(makeEnvelope(), 'raw input', {
      dbClient: client,
      customer_id: 'tenant-123',
    });
    expect(client.capturedCustomerIds).toEqual(['tenant-123']);
    expect(client.capturedRows[0]?.customer_id).toBe('tenant-123');
  });
});

// ---------------------------------------------------------------------------
// Field reconciliation: JSON-Schema top-level -> DB column
// ---------------------------------------------------------------------------

describe('persistEvaluation: field reconciliation', () => {
  it('hoists top-level audit-metadata fields onto the row in spec column names', async () => {
    const client = makeMockClient();
    const env = makeEnvelope({
      cache_key: 'stage2:v5.1:sha256:' + '1'.repeat(64),
      ontology_version: '5.1',
      schema_version: '5.1',
      stage1_prompt_hash: '2'.repeat(64),
      stage2_prompt_hash: '3'.repeat(64),
      stage3_prompt_hash: '4'.repeat(64),
      stage4_prompt_hash: '5'.repeat(64),
    });
    await persistEvaluation(env, 'raw', { dbClient: client });

    const row = client.capturedRows[0];
    expect(row).toBeDefined();
    if (!row) throw new Error('no row captured');
    expect(row.cache_key).toBe('stage2:v5.1:sha256:' + '1'.repeat(64));
    expect(row.ontology_version).toBe('5.1');
    expect(row.schema_version).toBe('5.1');
    expect(row.stage1_prompt_hash).toBe('2'.repeat(64));
    expect(row.stage2_prompt_hash).toBe('3'.repeat(64));
    expect(row.stage3_prompt_hash).toBe('4'.repeat(64));
    expect(row.stage4_prompt_hash).toBe('5'.repeat(64));
  });

  it('flattens nested disposition.action onto disposition column', async () => {
    const client = makeMockClient();
    const env = makeEnvelope({
      disposition: { action: 'human_review', confidence: 0.7 },
    });
    await persistEvaluation(env, 'raw', { dbClient: client });
    expect(client.capturedRows[0]?.disposition).toBe('human_review');
  });

  it('flattens nested evidence.aggregate_score onto aggregate_score column', async () => {
    const client = makeMockClient();
    const env = makeEnvelope({
      evidence: { aggregate_score: 11 },
    });
    await persistEvaluation(env, 'raw', { dbClient: client });
    expect(client.capturedRows[0]?.aggregate_score).toBe(11);
  });

  it('persists the sanitized envelope (not the raw one) into the envelope column', async () => {
    const client = makeMockClient();
    const env = makeEnvelope({
      input: { kind: 'prompt', text: 'Email me at alice@example.com please.' },
    });
    await persistEvaluation(env, 'raw', { dbClient: client });
    const row = client.capturedRows[0];
    if (!row) throw new Error('no row captured');
    const persistedEnv = row.envelope as V5Envelope;
    expect(persistedEnv.input).toBeDefined();
    if (persistedEnv.input?.kind !== 'prompt') throw new Error('expected prompt input');
    expect(persistedEnv.input.text).toBe('Email me at <EMAIL_1> please.');
  });

  it('attaches a non-empty pii_redaction_log when redactions fire', async () => {
    const client = makeMockClient();
    const env = makeEnvelope({
      input: { kind: 'prompt', text: 'alice@example.com' },
    });
    await persistEvaluation(env, 'raw', { dbClient: client });
    const log = client.capturedRows[0]?.pii_redaction_log as {
      version: string;
      total_redactions: number;
      redactions: unknown[];
    } | undefined;
    expect(log?.version).toBe('1');
    expect(log?.total_redactions).toBe(1);
    expect(log?.redactions).toHaveLength(1);
  });

  it('coerces missing stage_prompt_hash values to null', async () => {
    const client = makeMockClient();
    const env = makeEnvelope({
      stage1_prompt_hash: undefined,
      stage2_prompt_hash: undefined,
      stage3_prompt_hash: undefined,
      stage4_prompt_hash: undefined,
    });
    await persistEvaluation(env, 'raw', { dbClient: client });
    const row = client.capturedRows[0];
    expect(row?.stage1_prompt_hash).toBeNull();
    expect(row?.stage2_prompt_hash).toBeNull();
    expect(row?.stage3_prompt_hash).toBeNull();
    expect(row?.stage4_prompt_hash).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// KMS stub semantics (Phase 2 deferral)
// ---------------------------------------------------------------------------

describe('persistEvaluation: KMS stub', () => {
  it('default kms.skip=true stores null ciphertext columns', async () => {
    const client = makeMockClient();
    await persistEvaluation(makeEnvelope(), 'raw input', { dbClient: client });
    const row = client.capturedRows[0];
    expect(row?.unredacted_payload_kms_ciphertext).toBeNull();
    expect(row?.unredacted_payload_encrypted_dek).toBeNull();
    expect(row?.unredacted_payload_kms_key_id).toBeNull();
  });

  it('explicit kms.skip=true also stores null ciphertext columns', async () => {
    const client = makeMockClient();
    await persistEvaluation(makeEnvelope(), 'raw input', {
      dbClient: client,
      kms: { skip: true },
    });
    expect(client.capturedRows[0]?.unredacted_payload_kms_ciphertext).toBeNull();
  });

  it('throws KMSNotImplementedError when kms.skip is false', async () => {
    const client = makeMockClient();
    await expect(
      persistEvaluation(makeEnvelope(), 'raw input', {
        dbClient: client,
        kms: { skip: false },
      }),
    ).rejects.toBeInstanceOf(KMSNotImplementedError);
  });

  it('does not write a row when KMS path errors (Q3 fail-stop)', async () => {
    const client = makeMockClient();
    await expect(
      persistEvaluation(makeEnvelope(), 'raw input', {
        dbClient: client,
        kms: { skip: false },
      }),
    ).rejects.toBeDefined();
    expect(client.insertEvaluation).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Fail-stop semantics
// ---------------------------------------------------------------------------

describe('persistEvaluation: fail-stop', () => {
  it('throws PersistError(INVALID_ENVELOPE) when cache_key is missing', async () => {
    const client = makeMockClient();
    const env = makeEnvelope({ cache_key: undefined });
    await expect(persistEvaluation(env, 'raw', { dbClient: client })).rejects.toMatchObject({
      name: 'PersistError',
      code: 'INVALID_ENVELOPE',
      step: 'validate',
    });
    expect(client.insertEvaluation).not.toHaveBeenCalled();
  });

  it('throws PersistError(INVALID_ENVELOPE) when ontology_version is missing', async () => {
    const client = makeMockClient();
    const env = makeEnvelope({ ontology_version: '' });
    await expect(persistEvaluation(env, 'raw', { dbClient: client })).rejects.toMatchObject({
      code: 'INVALID_ENVELOPE',
    });
    expect(client.insertEvaluation).not.toHaveBeenCalled();
  });

  it('throws PersistError(INVALID_ENVELOPE) when disposition.action is unknown', async () => {
    const client = makeMockClient();
    const env = makeEnvelope({
      disposition: { action: 'unknown_verb' as never, confidence: 1 },
    });
    await expect(persistEvaluation(env, 'raw', { dbClient: client })).rejects.toMatchObject({
      code: 'INVALID_ENVELOPE',
    });
    expect(client.insertEvaluation).not.toHaveBeenCalled();
  });

  it('throws PersistError(DB_FAILURE) when insertEvaluation fails', async () => {
    const client = makeMockClient({ insertError: new Error('connection refused') });
    await expect(persistEvaluation(makeEnvelope(), 'raw', { dbClient: client })).rejects.toMatchObject({
      name: 'PersistError',
      code: 'DB_FAILURE',
      step: 'insert',
    });
  });

  it('PersistError carries the cache_key for log correlation', async () => {
    const client = makeMockClient({ insertError: new Error('boom') });
    const env = makeEnvelope({
      cache_key: 'stage2:v5.1:sha256:' + 'f'.repeat(64),
    });
    try {
      await persistEvaluation(env, 'raw', { dbClient: client });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PersistError);
      if (!(err instanceof PersistError)) throw err;
      expect(err.cache_key).toBe('stage2:v5.1:sha256:' + 'f'.repeat(64));
      expect(err.stage2_prompt_hash).toBeDefined();
    }
  });

  it('PersistError carries the underlying cause message', async () => {
    const client = makeMockClient({ insertError: new Error('connection refused') });
    try {
      await persistEvaluation(makeEnvelope(), 'raw', { dbClient: client });
      throw new Error('expected throw');
    } catch (err) {
      if (!(err instanceof PersistError)) throw err;
      expect(err.cause_message).toBe('connection refused');
    }
  });

  it('does not call withCustomerContext when validation fails first', async () => {
    const client = makeMockClient();
    const env = makeEnvelope({ cache_key: undefined });
    await expect(persistEvaluation(env, 'raw', { dbClient: client })).rejects.toBeInstanceOf(PersistError);
    expect(client.withCustomerContext).not.toHaveBeenCalled();
    expect(client.insertEvaluation).not.toHaveBeenCalled();
  });
});
