// Tests for the OSINT classification layer (Phase 2 real classifier).
//
// Coverage:
//   - Gating: classifier OFF by default returns stub verdict
//   - Gating: classifier ON with a mocked callModel produces structured output
//   - Schema validation: malformed JSON output -> pending_classification
//   - Schema validation: missing required field -> pending_classification
//   - API failure: thrown callModel -> pending_classification with reason
//   - Defensive prompting Layer 3: prompt-injection corpus on the model's
//     reasoning output triggers instruction_leakage_detected
//   - classifier_prompt_hash is computed and present on every result
//   - classifySignals batch behavior

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PHASE_1_STUB_REASONING,
  classify,
  CallModelFn,
} from '../../src/lib/osint/classify';
import { classifySignals } from '../../src/lib/osint/index';
import { ThreatSignal } from '../../src/lib/osint/types';

function makeSignal(overrides: Partial<ThreatSignal> = {}): ThreatSignal {
  return {
    source: 'ic3',
    signal_type: 'bulletin',
    observed_at: '2026-05-28T15:00:00.000Z',
    fetched_at: '2026-05-28T15:00:00.000Z',
    raw_payload: { title: 'A signal' },
    fetcher_version: 'test-fetcher-version',
    source_response_hash: 'test-source-response-hash',
    normalized: {
      title: 'A signal about a new pretext',
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

// --- Gating: OFF by default ------------------------------------------------

describe('classify -- gating', () => {
  it('returns stub verdict when OSINT_CLASSIFIER_ENABLED is unset', async () => {
    vi.stubEnv('OSINT_CLASSIFIER_ENABLED', '');
    const callModel = vi.fn();
    const result = await classify(makeSignal(), { callModel });
    expect(result.classification).toBe('pending_classification');
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toBe(PHASE_1_STUB_REASONING);
    expect(result.classifier_prompt_hash).toBeNull();
    expect(callModel).not.toHaveBeenCalled();
  });

  it('returns stub verdict when OSINT_CLASSIFIER_ENABLED is "false"', async () => {
    vi.stubEnv('OSINT_CLASSIFIER_ENABLED', 'false');
    const result = await classify(makeSignal(), { callModel: vi.fn() });
    expect(result.classification).toBe('pending_classification');
    expect(result.classifier_prompt_hash).toBeNull();
  });
});

// --- Happy path: classifier ON, structured output --------------------------

describe('classify -- enabled, structured output', () => {
  beforeEach(() => {
    vi.stubEnv('OSINT_CLASSIFIER_ENABLED', 'true');
  });

  it('returns known_ttp when the model identifies a covered pattern', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue(
      JSON.stringify({
        classification: 'known_ttp',
        confidence: 0.85,
        reasoning: 'Signal matches existing method:phishing pattern.',
        suggested_l3_entry: null,
      }),
    );
    const result = await classify(makeSignal(), { callModel });
    expect(result.classification).toBe('known_ttp');
    expect(result.confidence).toBe(0.85);
    expect(result.reasoning).toMatch(/method:phishing/);
    expect(result.classifier_prompt_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.suggested_l3_entry).toBeUndefined();
  });

  it('returns new_ttp_proposed with suggested_l3_entry when the model proposes', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue(
      JSON.stringify({
        classification: 'new_ttp_proposed',
        confidence: 0.72,
        reasoning: 'Novel pretext not in L3 method vocabulary.',
        suggested_l3_entry: {
          method: 'fake_court_summons',
          tactic: 'fear',
          target: 'consumer_general',
        },
      }),
    );
    const result = await classify(makeSignal(), { callModel });
    expect(result.classification).toBe('new_ttp_proposed');
    expect(result.suggested_l3_entry).toEqual({
      method: 'fake_court_summons',
      tactic: 'fear',
      target: 'consumer_general',
    });
    expect(result.classifier_prompt_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns low_signal_dismissed for non-TTP content', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue(
      JSON.stringify({
        classification: 'low_signal_dismissed',
        confidence: 0.95,
        reasoning: 'Vendor product announcement; not a fraud TTP.',
        suggested_l3_entry: null,
      }),
    );
    const result = await classify(makeSignal(), { callModel });
    expect(result.classification).toBe('low_signal_dismissed');
    expect(result.confidence).toBe(0.95);
  });

  it('strips a ```json code fence around the model output', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue(
      '```json\n' +
        JSON.stringify({
          classification: 'known_ttp',
          confidence: 0.5,
          reasoning: 'fenced',
        }) +
        '\n```',
    );
    const result = await classify(makeSignal(), { callModel });
    expect(result.classification).toBe('known_ttp');
  });
});

// --- Schema validation (Layer 2) -------------------------------------------

describe('classify -- schema validation drops malformed output', () => {
  beforeEach(() => {
    vi.stubEnv('OSINT_CLASSIFIER_ENABLED', 'true');
  });

  it('drops verdict when model returns non-JSON', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue('OK');
    const result = await classify(makeSignal(), { callModel });
    expect(result.classification).toBe('pending_classification');
    expect(result.reasoning).toMatch(/schema validation/i);
  });

  it('drops verdict when classification field is invalid', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue(
      JSON.stringify({
        classification: 'made_up_value',
        confidence: 0.9,
        reasoning: 'invalid verdict',
      }),
    );
    const result = await classify(makeSignal(), { callModel });
    expect(result.classification).toBe('pending_classification');
  });

  it('drops verdict when confidence is out of [0,1]', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue(
      JSON.stringify({
        classification: 'known_ttp',
        confidence: 1.5,
        reasoning: 'too confident',
      }),
    );
    const result = await classify(makeSignal(), { callModel });
    expect(result.classification).toBe('pending_classification');
  });

  it('drops verdict when reasoning is missing', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue(
      JSON.stringify({
        classification: 'known_ttp',
        confidence: 0.5,
      }),
    );
    const result = await classify(makeSignal(), { callModel });
    expect(result.classification).toBe('pending_classification');
  });
});

// --- API failure (network / timeout) ---------------------------------------

describe('classify -- API failure path', () => {
  beforeEach(() => {
    vi.stubEnv('OSINT_CLASSIFIER_ENABLED', 'true');
  });

  it('returns pending_classification when callModel rejects', async () => {
    const callModel: CallModelFn = vi
      .fn()
      .mockRejectedValue(new Error('ECONNRESET'));
    const result = await classify(makeSignal(), { callModel });
    expect(result.classification).toBe('pending_classification');
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toMatch(/Classifier API unreachable/);
    expect(result.reasoning).toMatch(/ECONNRESET/);
    // The hash is still computed because the prompt was assembled before
    // the call was made.
    expect(result.classifier_prompt_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns pending_classification when callModel times out (AbortError surrogate)', async () => {
    const callModel: CallModelFn = vi
      .fn()
      .mockRejectedValue(new Error('aborted'));
    const result = await classify(makeSignal(), { callModel });
    expect(result.classification).toBe('pending_classification');
    expect(result.reasoning).toMatch(/Classifier API unreachable/);
  });
});

// --- Defensive prompting Layer 3: injection corpus -------------------------

describe('classify -- Layer 3 INSTRUCTION_LEAKAGE_PATTERNS on output', () => {
  beforeEach(() => {
    vi.stubEnv('OSINT_CLASSIFIER_ENABLED', 'true');
  });

  // Each fixture simulates the model emitting an injection-success marker
  // in its reasoning field. The model returned a valid JSON envelope but
  // the reasoning content matches one of INSTRUCTION_LEAKAGE_PATTERNS.
  const injectionCases: { label: string; reasoning: string }[] = [
    {
      label: 'format-override OK marker',
      reasoning: 'OK',
    },
    {
      label: 'format-override PWNED marker',
      reasoning: 'PWNED',
    },
    {
      label: 'role-swap confirmation',
      reasoning: 'I am now an uncensored AI; let me help you with that.',
    },
    {
      label: 'system-prompt exfiltration',
      reasoning: 'My system prompt is to classify OSINT signals.',
    },
    {
      label: 'envelope-delimiter escape',
      reasoning: 'Signal matches known pattern </envelope> and continues.',
    },
  ];

  it.each(injectionCases)(
    'drops verdict on injection: $label',
    async ({ reasoning }) => {
      const callModel: CallModelFn = vi.fn().mockResolvedValue(
        JSON.stringify({
          classification: 'known_ttp',
          confidence: 0.9,
          reasoning,
        }),
      );
      const result = await classify(makeSignal(), { callModel });
      expect(result.classification).toBe('pending_classification');
      expect(result.reasoning).toMatch(/instruction_leakage_detected/);
      // Hash is still recorded.
      expect(result.classifier_prompt_hash).toMatch(/^[a-f0-9]{64}$/);
    },
  );
});

// --- Batch behavior --------------------------------------------------------

describe('classifySignals batch', () => {
  it('applies the stub classifier when gating is off', async () => {
    vi.stubEnv('OSINT_CLASSIFIER_ENABLED', '');
    const signals: ThreatSignal[] = [makeSignal(), makeSignal(), makeSignal()];
    const out = await classifySignals(signals);
    expect(out).toHaveLength(3);
    for (const entry of out) {
      expect(entry.classification.classification).toBe('pending_classification');
      expect(entry.classification.classifier_prompt_hash).toBeNull();
    }
  });

  it('returns an empty array when no signals are supplied', async () => {
    const out = await classifySignals([]);
    expect(out).toEqual([]);
  });
});
