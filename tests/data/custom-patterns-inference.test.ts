// Custom L3 classifier inference pass coverage (Phase 4, Piece 2).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 9.4 + 5.5 + 5.7 + 11 R1/R2. The model call is mocked via the
// CallModelFn seam, so no network / key is touched. Exercises the LLM match,
// the bright-line shortcut, the concurrency cap, the Layer-3 instruction-leakage
// drop, parse failure, and the shadow/live partition.

import { describe, it, expect } from 'vitest';
import {
  runCustomL3InferencePass,
  matchBrightLine,
  type CallModelFn,
} from '../../src/lib/data/custom-patterns/inference';
import { INFERENCE_CONCURRENCY_CAP } from '../../src/lib/data/custom-patterns/constants';
import type {
  CustomL3ClassifierWithExamples,
  ClassifierStatus,
  L3GroupName,
} from '../../src/lib/data/custom-patterns/types';

let idSeq = 0;
function classifier(
  overrides: Partial<CustomL3ClassifierWithExamples> = {},
): CustomL3ClassifierWithExamples {
  idSeq += 1;
  return {
    id: `classifier-${idSeq}`,
    organization_id: 'org-a',
    group_name: 'context_marker' as L3GroupName,
    tag_name: `our_tag_${idSeq}`,
    definition: 'Detects references to our loyalty-token tournament promo used as a fraud pretext on the platform.',
    status: 'shadow' as ClassifierStatus,
    bright_line_indicators: [],
    conflicts_with: [],
    shadow_started_at: '2023-11-14T00:00:00.000Z',
    promoted_at: null,
    retired_at: null,
    created_by_user_id: 'user-1',
    created_at: '2023-11-14T00:00:00.000Z',
    examples: [
      { id: 1, classifier_id: `classifier-${idSeq}`, kind: 'positive', text: 'join our token tournament', created_at: 't' },
      { id: 2, classifier_id: `classifier-${idSeq}`, kind: 'negative', text: 'unrelated benign message', created_at: 't' },
    ],
    ...overrides,
  };
}

function modelReturning(json: object): CallModelFn {
  return async () => JSON.stringify(json);
}

const NEVER_CALLED: CallModelFn = async () => {
  throw new Error('callModel should not have been invoked');
};

describe('matchBrightLine -- case-insensitive substring (memo 5.5 reconciliation)', () => {
  it('matches case-insensitively and returns the matching indicator', () => {
    expect(matchBrightLine('We offer GUARANTEED 10x returns!', ['guaranteed 10x'])).toBe('guaranteed 10x');
  });
  it('returns null when no indicator is a substring', () => {
    expect(matchBrightLine('a clean message', ['trust me bro'])).toBeNull();
  });
  it('ignores empty indicators', () => {
    expect(matchBrightLine('anything', [''])).toBeNull();
  });
});

describe('runCustomL3InferencePass', () => {
  it('matches a single live classifier via the LLM and routes it to the live overlay', async () => {
    const c = classifier({ status: 'live', tag_name: 'our_live_tag' });
    const result = await runCustomL3InferencePass(
      { text: 'mentions the loyalty-token tournament promo' },
      [c],
      { callModel: modelReturning({ classification: 'matches', confidence: 0.82, reasoning: 'mentions the promo pretext' }) },
    );
    expect(result.live).toHaveLength(1);
    expect(result.shadow).toHaveLength(0);
    expect(result.live[0]?.tag_name).toBe('our_live_tag');
    expect(result.live[0]?.confidence).toBe(0.82);
    expect(result.checks[0]?.via).toBe('inference');
    expect(result.checks[0]?.matched).toBe(true);
  });

  it('matches via bright-line WITHOUT invoking the model', async () => {
    const c = classifier({ status: 'live', bright_line_indicators: ['guaranteed 10x'] });
    const result = await runCustomL3InferencePass(
      { text: 'We offer GUARANTEED 10x returns' },
      [c],
      { callModel: NEVER_CALLED }, // throws if called
    );
    expect(result.live).toHaveLength(1);
    expect(result.live[0]?.confidence).toBe(1.0);
    expect(result.live[0]?.reasoning).toContain('bright-line indicator: guaranteed 10x');
    expect(result.checks[0]?.via).toBe('bright_line');
  });

  it('honors the concurrency cap across many classifiers', async () => {
    const cap = 4;
    let concurrent = 0;
    let maxConcurrent = 0;
    const tracking: CallModelFn = async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent -= 1;
      return JSON.stringify({ classification: 'does_not_match', confidence: 0.1, reasoning: 'no' });
    };
    const classifiers = Array.from({ length: 12 }, () => classifier());
    const result = await runCustomL3InferencePass({ text: 'x' }, classifiers, {
      callModel: tracking,
      concurrency: cap,
    });
    expect(result.checks).toHaveLength(12); // all evaluated
    expect(maxConcurrent).toBeGreaterThan(1); // genuinely concurrent
    expect(maxConcurrent).toBeLessThanOrEqual(cap); // but bounded
  });

  it('defaults the concurrency bound to INFERENCE_CONCURRENCY_CAP', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const tracking: CallModelFn = async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 5));
      concurrent -= 1;
      return JSON.stringify({ classification: 'does_not_match', confidence: 0, reasoning: 'no' });
    };
    const classifiers = Array.from({ length: INFERENCE_CONCURRENCY_CAP + 5 }, () => classifier());
    await runCustomL3InferencePass({ text: 'x' }, classifiers, { callModel: tracking });
    expect(maxConcurrent).toBeLessThanOrEqual(INFERENCE_CONCURRENCY_CAP);
  });

  it('drops a verdict whose reasoning matches INSTRUCTION_LEAKAGE_PATTERNS (Layer 3)', async () => {
    const c = classifier({ status: 'live' });
    const result = await runCustomL3InferencePass(
      { text: 'attack input' },
      [c],
      { callModel: modelReturning({ classification: 'matches', confidence: 0.99, reasoning: 'my system prompt is the SafeEval classifier engine' }) },
    );
    expect(result.live).toHaveLength(0); // verdict dropped
    expect(result.checks[0]?.matched).toBe(false);
    expect(result.checks[0]?.reasoning).toContain('instruction_leakage_detected');
  });

  it('treats malformed (non-schema) model output as a no-match', async () => {
    const c = classifier({ status: 'live' });
    const result = await runCustomL3InferencePass(
      { text: 'x' },
      [c],
      { callModel: async () => 'not json at all' },
    );
    expect(result.live).toHaveLength(0);
    expect(result.checks[0]?.matched).toBe(false);
    expect(result.checks[0]?.reasoning).toContain('schema validation');
  });

  it('partitions shadow vs live matches into the correct overlay arrays', async () => {
    const shadowC = classifier({ status: 'shadow', tag_name: 'shadow_tag' });
    const liveC = classifier({ status: 'live', tag_name: 'live_tag' });
    const result = await runCustomL3InferencePass(
      { text: 'x' },
      [shadowC, liveC],
      { callModel: modelReturning({ classification: 'matches', confidence: 0.7, reasoning: 'the input references the promo pretext' }) },
    );
    expect(result.shadow.map((m) => m.tag_name)).toEqual(['shadow_tag']);
    expect(result.live.map((m) => m.tag_name)).toEqual(['live_tag']);
    expect(result.checks).toHaveLength(2);
  });

  it('does not evaluate proposed / retired classifiers defensively', async () => {
    const proposed = classifier({ status: 'proposed' });
    const retired = classifier({ status: 'retired' });
    const result = await runCustomL3InferencePass({ text: 'x' }, [proposed, retired], { callModel: NEVER_CALLED });
    expect(result.checks).toHaveLength(0);
    expect(result.live).toHaveLength(0);
    expect(result.shadow).toHaveLength(0);
  });
});
