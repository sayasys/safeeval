// Unit coverage for the media-detection -> user-facing verdict mapping. This
// is the pure derivation the Evaluator media result card renders, so each
// verdict type and every precedence branch is exercised here.

import { describe, it, expect } from 'vitest';
import {
  deriveMediaVerdict,
  MEDIA_VERDICT_LABELS,
} from '../../src/lib/media-evaluator/verdict';
import type { MediaDetectionResult } from '../../src/lib/media-detection/types';

function base(overrides: Partial<MediaDetectionResult> = {}): MediaDetectionResult {
  return {
    is_synthetic: 0,
    confidence: 0,
    model_id: 'Organika/sdxl-detector',
    latency_ms: 120,
    ...overrides,
  };
}

describe('deriveMediaVerdict -- error precedence', () => {
  it('returns the error verdict when the detector set an error field', () => {
    const v = deriveMediaVerdict(base({ error: 'HF_API_TOKEN not configured', is_synthetic: 0.9 }));
    expect(v.verdict).toBe('error');
    expect(v.label).toBe(MEDIA_VERDICT_LABELS.error);
    expect(v.error).toContain('HF_API_TOKEN');
  });

  it('treats a null/undefined result as an empty (human-leaning) record, not a crash', () => {
    const v = deriveMediaVerdict(null);
    expect(v.verdict).toBe('likely_human');
    expect(v.syntheticPct).toBe(0);
  });
});

describe('deriveMediaVerdict -- reasoning verdict wins when present', () => {
  it('maps reasoning likely_synthetic -> likely_synthetic', () => {
    const v = deriveMediaVerdict(base({
      is_synthetic: 0.5,
      reasoning: { verdict: 'likely_synthetic', confidence: 0.8, reasoning: 'glossy skin, no pores', model_id: 'gemini-1.5-flash' },
    }));
    expect(v.verdict).toBe('likely_synthetic');
    expect(v.label).toBe('Likely AI-generated');
    expect(v.reasoningUsed).toBe(true);
    expect(v.reasoning).toContain('pores');
  });

  it('maps reasoning likely_real -> likely_human', () => {
    const v = deriveMediaVerdict(base({
      is_synthetic: 0.5,
      reasoning: { verdict: 'likely_real', confidence: 0.7, reasoning: 'natural lens grain', model_id: 'gemini-1.5-flash' },
    }));
    expect(v.verdict).toBe('likely_human');
    expect(v.label).toBe('Likely human-generated');
  });

  it('maps reasoning still_ambiguous -> uncertain', () => {
    const v = deriveMediaVerdict(base({
      is_synthetic: 0.5,
      reasoning: { verdict: 'still_ambiguous', confidence: 0, reasoning: 'cannot decide', model_id: 'gemini-1.5-flash' },
    }));
    expect(v.verdict).toBe('uncertain');
    expect(v.label).toBe('Uncertain -- see reasoning below');
  });
});

describe('deriveMediaVerdict -- numeric band fallback (no reasoning)', () => {
  it('above the high band -> likely_synthetic', () => {
    expect(deriveMediaVerdict(base({ is_synthetic: 0.92 })).verdict).toBe('likely_synthetic');
  });

  it('below the low band -> likely_human', () => {
    expect(deriveMediaVerdict(base({ is_synthetic: 0.08 })).verdict).toBe('likely_human');
  });

  it('inside the band -> uncertain', () => {
    expect(deriveMediaVerdict(base({ is_synthetic: 0.5 })).verdict).toBe('uncertain');
    // band edges are inclusive of uncertain
    expect(deriveMediaVerdict(base({ is_synthetic: 0.4 })).verdict).toBe('uncertain');
    expect(deriveMediaVerdict(base({ is_synthetic: 0.6 })).verdict).toBe('uncertain');
  });

  it('reasoningUsed is false on the pure numeric path', () => {
    expect(deriveMediaVerdict(base({ is_synthetic: 0.9 })).reasoningUsed).toBe(false);
  });
});

describe('deriveMediaVerdict -- numeric view fields', () => {
  it('rounds the synthetic likelihood and detector confidence to whole percents', () => {
    const v = deriveMediaVerdict(base({ is_synthetic: 0.876, confidence: 0.954 }));
    expect(v.syntheticPct).toBe(88);
    expect(v.detectorConfidencePct).toBe(95);
    expect(v.detectorModel).toBe('Organika/sdxl-detector');
    expect(v.latencyMs).toBe(120);
  });

  it('clamps out-of-range scores into [0, 100]', () => {
    expect(deriveMediaVerdict(base({ is_synthetic: 1.4 })).syntheticPct).toBe(100);
    expect(deriveMediaVerdict(base({ is_synthetic: -0.3 })).syntheticPct).toBe(0);
  });
});
