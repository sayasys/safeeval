// Tests for the OSINT audit-metadata extension (Phase 2, sec memo section 4).
//
// Coverage:
//   - normalize() populates source_response_hash from raw_payload as a SHA-256
//   - source_response_hash is deterministic across runs (same input -> same hash)
//   - source_response_hash differs for different payloads
//   - normalize() preserves fetcher_version threaded through from RawSignal
//   - normalize() defaults fetcher_version to 'unknown' when RawSignal omits it
//   - classify() returns classifier_prompt_hash (null when stub, hex when called)
//   - computeFetcherVersion is stable and source-discriminating
//   - The three hash fields satisfy SHA-256 hex shape constraints

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeFetcherVersion,
} from '../../src/lib/osint/index';
import {
  computeSourceResponseHash,
  normalize,
} from '../../src/lib/osint/normalize';
import { classify, CallModelFn } from '../../src/lib/osint/classify';
import { ic3 } from '../../src/lib/osint/sources/ic3';
import { krebs } from '../../src/lib/osint/sources/krebs';
import { RawSignal, ThreatSignal } from '../../src/lib/osint/types';

const FIXED_FETCHED_AT = '2026-05-28T15:00:00.000Z';
const SHA256_HEX = /^[a-f0-9]{64}$/;

function makeRaw(payload: unknown, fetcher_version?: string): RawSignal {
  return {
    source: 'ic3',
    signal_type: 'bulletin',
    observed_at_source: null,
    fetched_at: FIXED_FETCHED_AT,
    payload,
    ...(fetcher_version !== undefined ? { fetcher_version } : {}),
  };
}

function makeSignal(overrides: Partial<ThreatSignal> = {}): ThreatSignal {
  return {
    source: 'ic3',
    signal_type: 'bulletin',
    observed_at: FIXED_FETCHED_AT,
    fetched_at: FIXED_FETCHED_AT,
    raw_payload: { title: 'A signal' },
    fetcher_version: 'test-fv',
    source_response_hash: 'test-srh',
    normalized: {
      title: 'A signal',
      summary: null,
      url: null,
      claimed_actor: null,
      target_audience: null,
      mentioned_techniques: [],
      mentioned_indicators: [],
      geographic_scope: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// --- normalize() audit-metadata ------------------------------------------

describe('normalize -- source_response_hash', () => {
  it('populates source_response_hash as SHA-256 hex over canonical payload', () => {
    const raw = makeRaw({ title: 'x', body: 'y' });
    const signal = normalize(raw);
    expect(signal.source_response_hash).toMatch(SHA256_HEX);
  });

  it('is deterministic across calls for the same payload', () => {
    const raw1 = makeRaw({ title: 'x', body: 'y' });
    const raw2 = makeRaw({ title: 'x', body: 'y' });
    expect(normalize(raw1).source_response_hash).toBe(normalize(raw2).source_response_hash);
  });

  it('is key-order invariant via canonical JSON', () => {
    // Two payloads with different ECMAScript insertion order but identical
    // canonical-JSON form must hash the same.
    const a = normalize(makeRaw({ title: 'x', body: 'y' })).source_response_hash;
    const b = normalize(makeRaw({ body: 'y', title: 'x' })).source_response_hash;
    expect(a).toBe(b);
  });

  it('differs for different payloads', () => {
    const a = normalize(makeRaw({ title: 'x' })).source_response_hash;
    const b = normalize(makeRaw({ title: 'y' })).source_response_hash;
    expect(a).not.toBe(b);
  });

  it('handles null / scalar / array payloads without throwing', () => {
    expect(normalize(makeRaw(null)).source_response_hash).toMatch(SHA256_HEX);
    expect(normalize(makeRaw('a string')).source_response_hash).toMatch(SHA256_HEX);
    expect(normalize(makeRaw([1, 2, 3])).source_response_hash).toMatch(SHA256_HEX);
  });

  it('computeSourceResponseHash is the same standalone function used by normalize', () => {
    const payload = { foo: 'bar' };
    const direct = computeSourceResponseHash(payload);
    const viaNormalize = normalize(makeRaw(payload)).source_response_hash;
    expect(direct).toBe(viaNormalize);
  });
});

describe('normalize -- fetcher_version pass-through', () => {
  it('threads RawSignal.fetcher_version onto the ThreatSignal', () => {
    const raw = makeRaw({ title: 'x' }, 'abcdef1234');
    expect(normalize(raw).fetcher_version).toBe('abcdef1234');
  });

  it('defaults to "unknown" when RawSignal omits fetcher_version', () => {
    const raw = makeRaw({ title: 'x' });
    expect(normalize(raw).fetcher_version).toBe('unknown');
  });
});

// --- classify() audit-metadata --------------------------------------------

describe('classify -- classifier_prompt_hash', () => {
  it('is null when the classifier is gated off (stub path)', async () => {
    vi.stubEnv('OSINT_CLASSIFIER_ENABLED', '');
    const result = await classify(makeSignal(), { callModel: vi.fn() });
    expect(result.classifier_prompt_hash).toBeNull();
  });

  it('is a SHA-256 hex string when the classifier runs and returns valid output', async () => {
    vi.stubEnv('OSINT_CLASSIFIER_ENABLED', 'true');
    const callModel: CallModelFn = vi.fn().mockResolvedValue(
      JSON.stringify({
        classification: 'known_ttp',
        confidence: 0.8,
        reasoning: 'matches existing pattern',
      }),
    );
    const result = await classify(makeSignal(), { callModel });
    expect(result.classifier_prompt_hash).toMatch(SHA256_HEX);
  });

  it('is recorded even on API failure (the prompt was assembled before the call)', async () => {
    vi.stubEnv('OSINT_CLASSIFIER_ENABLED', 'true');
    const callModel: CallModelFn = vi.fn().mockRejectedValue(new Error('fail'));
    const result = await classify(makeSignal(), { callModel });
    expect(result.classifier_prompt_hash).toMatch(SHA256_HEX);
  });

  it('changes when the signal context changes (different prompt)', async () => {
    vi.stubEnv('OSINT_CLASSIFIER_ENABLED', 'true');
    const callModel: CallModelFn = vi.fn().mockResolvedValue(
      JSON.stringify({
        classification: 'known_ttp',
        confidence: 0.8,
        reasoning: 'r',
      }),
    );
    const a = await classify(makeSignal({ normalized: { ...makeSignal().normalized, title: 'A' } }), { callModel });
    const b = await classify(makeSignal({ normalized: { ...makeSignal().normalized, title: 'B' } }), { callModel });
    expect(a.classifier_prompt_hash).not.toBe(b.classifier_prompt_hash);
  });
});

// --- computeFetcherVersion -------------------------------------------------

describe('computeFetcherVersion', () => {
  it('returns a SHA-256 hex string', () => {
    expect(computeFetcherVersion(ic3)).toMatch(SHA256_HEX);
  });

  it('is stable across calls for the same source', () => {
    expect(computeFetcherVersion(ic3)).toBe(computeFetcherVersion(ic3));
  });

  it('differs between sources with different fetcher logic', () => {
    expect(computeFetcherVersion(ic3)).not.toBe(computeFetcherVersion(krebs));
  });
});
