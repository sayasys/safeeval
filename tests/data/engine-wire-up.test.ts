// Phase 4 integration test: engine -> persistence wire-up.
//
// Scope: verifies maybePersistEvaluation() correctly gates on the
// SAFEEVAL_PERSIST_EVALUATIONS env var, swallows persistence errors, and
// mutates the v5 envelope to carry evaluation_id on success.
//
// Out of scope: real engine invocation (would require ANTHROPIC_API_KEY) and
// real Supabase (next milestone). The dispatch flagged this style of
// unit-with-mocks as the right shape for "engine wires up correctly" vs.
// "live persistence exercise".

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { V5Envelope } from '../../src/lib/data/types';

// Mock the persistence module BEFORE importing the wire-up. The wire-up
// imports persistEvaluation from './persistence' at module load time;
// vi.mock is hoisted above the import so the mock binding is in place.
vi.mock('../../src/lib/data/persistence', () => ({
  persistEvaluation: vi.fn(),
}));

import { persistEvaluation } from '../../src/lib/data/persistence';
import { maybePersistEvaluation, persistEvaluationsEnabled } from '../../src/lib/data/wire-up';

const mockedPersist = vi.mocked(persistEvaluation);

// Minimal v5 envelope fixture: only the fields the wire-up reads / sets.
// (The persistence module's own validation is mocked away here; engine-side
// envelope shape is exercised in persistence.test.ts, not this file.)
function makeEnvelope(): V5Envelope {
  return {
    schema_version: '5.1',
    ontology_version: '5.1',
    evaluated_at: '2026-05-28T00:00:00Z',
    model_pipeline: ['stage-1'],
    prompt_length: 12,
    input: { kind: 'prompt', text: 'hello world' },
    disposition: { action: 'allow', confidence: 0.9 },
    evidence: { aggregate_score: 0 },
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
  originalFlag = process.env.SAFEEVAL_PERSIST_EVALUATIONS;
  delete process.env.SAFEEVAL_PERSIST_EVALUATIONS;
  mockedPersist.mockReset();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.SAFEEVAL_PERSIST_EVALUATIONS;
  } else {
    process.env.SAFEEVAL_PERSIST_EVALUATIONS = originalFlag;
  }
  errorSpy.mockRestore();
});

describe('persistEvaluationsEnabled flag gating', () => {
  it('returns false when the env var is unset', () => {
    expect(persistEvaluationsEnabled()).toBe(false);
  });

  it('returns false when the env var is any non-"true" value', () => {
    process.env.SAFEEVAL_PERSIST_EVALUATIONS = 'false';
    expect(persistEvaluationsEnabled()).toBe(false);

    process.env.SAFEEVAL_PERSIST_EVALUATIONS = '1';
    expect(persistEvaluationsEnabled()).toBe(false);

    process.env.SAFEEVAL_PERSIST_EVALUATIONS = 'TRUE';
    expect(persistEvaluationsEnabled()).toBe(false);
  });

  it('returns true only for the exact string "true"', () => {
    process.env.SAFEEVAL_PERSIST_EVALUATIONS = 'true';
    expect(persistEvaluationsEnabled()).toBe(true);
  });
});

describe('maybePersistEvaluation: flag off (default)', () => {
  it('does not invoke persistEvaluation when the env var is unset', async () => {
    const envelope = makeEnvelope();
    await maybePersistEvaluation('raw input', envelope);
    expect(mockedPersist).not.toHaveBeenCalled();
  });

  it('does not invoke persistEvaluation when the env var is "false"', async () => {
    process.env.SAFEEVAL_PERSIST_EVALUATIONS = 'false';
    const envelope = makeEnvelope();
    await maybePersistEvaluation('raw input', envelope);
    expect(mockedPersist).not.toHaveBeenCalled();
  });

  it('leaves the envelope unmodified when persistence is off', async () => {
    const envelope = makeEnvelope();
    const snapshot = JSON.parse(JSON.stringify(envelope));
    await maybePersistEvaluation('raw input', envelope);
    expect(envelope).toEqual(snapshot);
    expect((envelope as { evaluation_id?: string }).evaluation_id).toBeUndefined();
  });
});

describe('maybePersistEvaluation: flag on, persist succeeds', () => {
  beforeEach(() => {
    process.env.SAFEEVAL_PERSIST_EVALUATIONS = 'true';
    mockedPersist.mockResolvedValue({ evaluation_id: 'eval_42' });
  });

  it('invokes persistEvaluation with no kms option (Tier A zero-storage)', async () => {
    const envelope = makeEnvelope();
    await maybePersistEvaluation('raw input', envelope);
    expect(mockedPersist).toHaveBeenCalledTimes(1);
    const [calledEnvelope, calledRaw, calledOpts] = mockedPersist.mock.calls[0]!;
    expect(calledEnvelope).toBe(envelope);
    expect(calledRaw).toBe('raw input');
    expect(calledOpts).toEqual({});
  });

  it('populates envelope.evaluation_id with the returned id', async () => {
    const envelope = makeEnvelope() as V5Envelope & { evaluation_id?: string };
    await maybePersistEvaluation('raw input', envelope);
    expect(envelope.evaluation_id).toBe('eval_42');
  });

  it('does not overwrite any other envelope fields', async () => {
    const envelope = makeEnvelope();
    const snapshot = JSON.parse(JSON.stringify(envelope));
    await maybePersistEvaluation('raw input', envelope);
    // Strip the added field for the comparison.
    const { evaluation_id: _id, ...rest } = envelope as V5Envelope & { evaluation_id?: string };
    void _id;
    expect(rest).toEqual(snapshot);
  });

  it('omits evaluation_id when persistEvaluation resolves with an empty id', async () => {
    mockedPersist.mockResolvedValueOnce({ evaluation_id: '' });
    const envelope = makeEnvelope() as V5Envelope & { evaluation_id?: string };
    await maybePersistEvaluation('raw input', envelope);
    expect(envelope.evaluation_id).toBeUndefined();
  });
});

describe('maybePersistEvaluation: flag on, persist throws', () => {
  beforeEach(() => {
    process.env.SAFEEVAL_PERSIST_EVALUATIONS = 'true';
  });

  it('swallows a thrown Error and returns cleanly', async () => {
    mockedPersist.mockRejectedValueOnce(new Error('supabase: ECONNREFUSED'));
    const envelope = makeEnvelope() as V5Envelope & { evaluation_id?: string };
    await expect(maybePersistEvaluation('raw input', envelope)).resolves.toBeUndefined();
    expect(envelope.evaluation_id).toBeUndefined();
  });

  it('logs the error via console.error with the message body', async () => {
    mockedPersist.mockRejectedValueOnce(new Error('supabase: ECONNREFUSED'));
    await maybePersistEvaluation('raw input', makeEnvelope());
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [label, message] = errorSpy.mock.calls[0]!;
    expect(label).toBe('persistEvaluation failed:');
    expect(message).toBe('supabase: ECONNREFUSED');
  });

  it('swallows a non-Error throw value (stringifies it)', async () => {
    mockedPersist.mockRejectedValueOnce('raw string failure');
    const envelope = makeEnvelope() as V5Envelope & { evaluation_id?: string };
    await expect(maybePersistEvaluation('raw input', envelope)).resolves.toBeUndefined();
    expect(envelope.evaluation_id).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]![1]).toBe('raw string failure');
  });

  it('leaves all other envelope fields intact after a persist throw', async () => {
    mockedPersist.mockRejectedValueOnce(new Error('boom'));
    const envelope = makeEnvelope();
    const snapshot = JSON.parse(JSON.stringify(envelope));
    await maybePersistEvaluation('raw input', envelope);
    expect(envelope).toEqual(snapshot);
  });
});
