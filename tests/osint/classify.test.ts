// Tests for the OSINT classification layer (Phase 1 stub).
//
// Coverage: the stub returns the expected ClassificationResult shape for
// any signal; classifySignals batch-applies the stub to every input.

import { describe, expect, it } from 'vitest';
import { PHASE_1_STUB_REASONING, classify } from '../../src/lib/osint/classify';
import { classifySignals } from '../../src/lib/osint/index';
import { ThreatSignal } from '../../src/lib/osint/types';

function makeSignal(): ThreatSignal {
  return {
    source: 'ic3',
    signal_type: 'bulletin',
    observed_at: '2026-05-28T15:00:00.000Z',
    fetched_at: '2026-05-28T15:00:00.000Z',
    raw_payload: {},
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
  };
}

describe('classify -- Phase 1 stub', () => {
  it('returns pending_classification with confidence 0 and stub reasoning', async () => {
    const result = await classify(makeSignal());
    expect(result.classification).toBe('pending_classification');
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toBe(PHASE_1_STUB_REASONING);
    expect(result.reasoning).toMatch(/Phase 1 stub/);
  });

  it('returns the same stub regardless of signal content', async () => {
    const a = await classify(makeSignal());
    const b = await classify({
      ...makeSignal(),
      source: 'reddit_scams',
      signal_type: 'forum_thread',
    });
    expect(a).toEqual(b);
  });
});

describe('classifySignals batch', () => {
  it('applies the stub classifier to every signal and pairs result by index', async () => {
    const signals: ThreatSignal[] = [makeSignal(), makeSignal(), makeSignal()];
    const out = await classifySignals(signals);
    expect(out).toHaveLength(3);
    for (const entry of out) {
      expect(entry.classification.classification).toBe('pending_classification');
      expect(entry.classification.confidence).toBe(0);
      expect(entry.signal).toBeDefined();
    }
  });

  it('returns an empty array when no signals are supplied', async () => {
    const out = await classifySignals([]);
    expect(out).toEqual([]);
  });
});
