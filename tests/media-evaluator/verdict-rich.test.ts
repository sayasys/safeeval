// Unit coverage for the rich-media verdict-shape extension (brief 0089): the
// closed-set tags, confidence band, recommended_disposition, secondary signals,
// and detector_reasoning the synthetic-media result card renders. The pure
// derivation functions are exercised directly for boundary coverage, and the
// integrated deriveMediaVerdict() is exercised for the end-to-end shape.
//
// Canonical surfaces: docs/08-v5-ontology.md section 3.18 (tag closed sets) and
// docs/policy-spec-v5.0.md section 13.1 / 13.2 / 13.4 (band, disposition,
// secondary signals). The check-lockstep media verifiers assert verdict.ts
// mirrors those surfaces; this file asserts the derivation logic is correct.

import { describe, it, expect } from 'vitest';
import {
  deriveMediaVerdict,
  deriveMediaConfidenceBand,
  deriveMediaRecommendedDisposition,
  IMAGE_TAGS,
  AUDIO_TAGS,
  SYNTHESIS_INDICATOR_TAGS,
} from '../../src/lib/media-evaluator/verdict';
import type { MediaTag } from '../../src/lib/media-evaluator/verdict';
import {
  PRIMARY_IMAGE_MODEL,
  PRIMARY_AUDIO_MODEL,
} from '../../src/lib/media-detection';
import type {
  MediaClassification,
  MediaDetectionResult,
  ReasoningResult,
} from '../../src/lib/media-detection';

function base(overrides: Partial<MediaDetectionResult> = {}): MediaDetectionResult {
  return {
    is_synthetic: 0,
    confidence: 0,
    model_id: PRIMARY_IMAGE_MODEL,
    latency_ms: 120,
    ...overrides,
  };
}

function reasoning(overrides: Partial<ReasoningResult> = {}): ReasoningResult {
  return {
    verdict: 'still_ambiguous',
    confidence: 0.5,
    reasoning: 'The artifact shows mixed signals.',
    model_id: 'gemini-2.5-flash',
    ...overrides,
  };
}

// 1. Tag emission ------------------------------------------------------------

describe('tag emission (Phase 1 wired tags)', () => {
  it('fires diffusion_signature for the image detector above the firing threshold', () => {
    const v = deriveMediaVerdict(base({ model_id: PRIMARY_IMAGE_MODEL, is_synthetic: 0.8 }));
    expect(v.tags).toContain('diffusion_signature');
    expect(v.tags).toHaveLength(1);
  });

  it('fires synthetic_voice_cadence for the audio detector above the firing threshold', () => {
    const v = deriveMediaVerdict(base({ model_id: PRIMARY_AUDIO_MODEL, is_synthetic: 0.7 }));
    expect(v.tags).toContain('synthetic_voice_cadence');
    expect(v.tags).toHaveLength(1);
  });

  it('fires no tags for low-confidence detector output (no false positives)', () => {
    const v = deriveMediaVerdict(base({ model_id: PRIMARY_IMAGE_MODEL, is_synthetic: 0.5 }));
    expect(v.tags).toHaveLength(0);
  });

  it('fires no tags at exactly the firing threshold (strict greater-than)', () => {
    const v = deriveMediaVerdict(base({ model_id: PRIMARY_IMAGE_MODEL, is_synthetic: 0.6 }));
    expect(v.tags).toHaveLength(0);
  });

  it('fires no tags for an unknown model id', () => {
    const v = deriveMediaVerdict(base({ model_id: 'some/other-model', is_synthetic: 0.95 }));
    expect(v.tags).toHaveLength(0);
  });
});

// 2. Confidence-band derivation ---------------------------------------------

describe('deriveMediaConfidenceBand (policy-spec section 13.1)', () => {
  it('high above 0.85 with no reasoning', () => {
    expect(deriveMediaConfidenceBand(0.86, null)).toBe('high');
  });

  it('medium at the 0.85 boundary (inclusive, not high)', () => {
    expect(deriveMediaConfidenceBand(0.85, null)).toBe('medium');
  });

  it('medium at the 0.6 boundary (inclusive)', () => {
    expect(deriveMediaConfidenceBand(0.6, null)).toBe('medium');
  });

  it('low just below 0.6', () => {
    expect(deriveMediaConfidenceBand(0.59, null)).toBe('low');
  });

  it('high when reasoning agrees with the detector binary verdict (synthetic)', () => {
    expect(deriveMediaConfidenceBand(0.7, 'likely_synthetic')).toBe('high');
  });

  it('high when reasoning agrees with the detector binary verdict (real)', () => {
    expect(deriveMediaConfidenceBand(0.3, 'likely_real')).toBe('high');
  });

  it('low when reasoning conflicts with the detector binary verdict', () => {
    expect(deriveMediaConfidenceBand(0.7, 'likely_real')).toBe('low');
  });

  it('low for still_ambiguous regardless of a strong raw score', () => {
    expect(deriveMediaConfidenceBand(0.9, 'still_ambiguous')).toBe('low');
  });

  it('high when reasoning agrees even with a very strong raw score', () => {
    expect(deriveMediaConfidenceBand(0.95, 'likely_synthetic')).toBe('high');
  });
});

// 3. Recommended-disposition derivation -------------------------------------

describe('deriveMediaRecommendedDisposition (policy-spec section 13.2)', () => {
  it('likely_synthetic x high x synthesis-indicator tag -> block', () => {
    expect(deriveMediaRecommendedDisposition('likely_synthetic', 'high', ['diffusion_signature'])).toBe('block');
  });

  it('likely_synthetic x high x no tag -> human_review (anomaly)', () => {
    expect(deriveMediaRecommendedDisposition('likely_synthetic', 'high', [])).toBe('human_review');
  });

  it('likely_synthetic x high x context-only tag -> human_review (not a synthesis-indicator)', () => {
    expect(deriveMediaRecommendedDisposition('likely_synthetic', 'high', ['metadata_stripped'])).toBe('human_review');
  });

  it('likely_synthetic x medium -> human_review', () => {
    expect(deriveMediaRecommendedDisposition('likely_synthetic', 'medium', ['diffusion_signature'])).toBe('human_review');
  });

  it('likely_synthetic x low -> human_review', () => {
    expect(deriveMediaRecommendedDisposition('likely_synthetic', 'low', ['diffusion_signature'])).toBe('human_review');
  });

  it('uncertain -> human_review (any band, any tags)', () => {
    expect(deriveMediaRecommendedDisposition('uncertain', 'high', ['diffusion_signature'])).toBe('human_review');
    expect(deriveMediaRecommendedDisposition('uncertain', 'low', [])).toBe('human_review');
  });

  it('likely_human -> allow (any band, any tags)', () => {
    expect(deriveMediaRecommendedDisposition('likely_human', 'high', [])).toBe('allow');
    expect(deriveMediaRecommendedDisposition('likely_human', 'low', ['diffusion_signature'])).toBe('allow');
  });

  it('error -> human_review', () => {
    expect(deriveMediaRecommendedDisposition('error', 'low', [])).toBe('human_review');
  });

  it('never returns safe_completion on the verdict surface', () => {
    const inputs: Array<Parameters<typeof deriveMediaRecommendedDisposition>> = [
      ['likely_synthetic', 'high', ['diffusion_signature']],
      ['likely_synthetic', 'medium', []],
      ['uncertain', 'high', []],
      ['likely_human', 'high', []],
      ['error', 'low', []],
    ];
    for (const args of inputs) {
      expect(deriveMediaRecommendedDisposition(...args)).not.toBe('safe_completion');
    }
  });
});

describe('deriveMediaVerdict -- integrated disposition', () => {
  it('high-confidence synthetic image with a synthesis-indicator tag resolves to block', () => {
    const v = deriveMediaVerdict(base({ model_id: PRIMARY_IMAGE_MODEL, is_synthetic: 0.9 }));
    expect(v.verdict).toBe('likely_synthetic');
    expect(v.confidence_band).toBe('high');
    expect(v.tags).toContain('diffusion_signature');
    expect(v.recommended_disposition).toBe('block');
  });

  it('clearly-human image resolves to allow', () => {
    const v = deriveMediaVerdict(base({ model_id: PRIMARY_IMAGE_MODEL, is_synthetic: 0.1 }));
    expect(v.verdict).toBe('likely_human');
    expect(v.recommended_disposition).toBe('allow');
  });
});

// 4. Secondary signals -------------------------------------------------------

describe('secondary_signals (policy-spec section 13.4)', () => {
  it('carries the Gemini verdict + reasoning when the reasoning fallback ran', () => {
    const v = deriveMediaVerdict(base({
      is_synthetic: 0.5,
      reasoning: reasoning({ verdict: 'likely_synthetic', reasoning: 'Diffusion fingerprints present.' }),
    }));
    expect(v.reasoningUsed).toBe(true);
    expect(v.secondary_signals.gemini_verdict).toBe('likely_synthetic');
    expect(v.secondary_signals.gemini_reasoning).toBe('Diffusion fingerprints present.');
  });

  it('is null on both sub-fields when the reasoning fallback did not run', () => {
    const v = deriveMediaVerdict(base({ is_synthetic: 0.9 }));
    expect(v.reasoningUsed).toBe(false);
    expect(v.secondary_signals.gemini_verdict).toBeNull();
    expect(v.secondary_signals.gemini_reasoning).toBeNull();
  });
});

// 5. Detector reasoning ------------------------------------------------------

describe('detector_reasoning (what the detector saw)', () => {
  it('is non-null and names the runner-up labels when the detector returned a multi-label list', () => {
    const classifications: MediaClassification[] = [
      { label: 'artificial', score: 0.82 },
      { label: 'real', score: 0.18 },
    ];
    const v = deriveMediaVerdict(base({ is_synthetic: 0.82, classifications }));
    expect(v.detector_reasoning).not.toBeNull();
    expect(v.detector_reasoning).toContain('artificial');
    expect(v.detector_reasoning).toContain('real');
  });

  it('sorts the label stack highest-score-first regardless of input order', () => {
    const classifications: MediaClassification[] = [
      { label: 'real', score: 0.18 },
      { label: 'artificial', score: 0.82 },
    ];
    const v = deriveMediaVerdict(base({ is_synthetic: 0.82, classifications }));
    expect(v.detector_reasoning).toMatch(/artificial.*runner-up.*real/);
  });

  it('is null when the detector returned only a single label (no runner-up)', () => {
    const classifications: MediaClassification[] = [{ label: 'artificial', score: 0.82 }];
    const v = deriveMediaVerdict(base({ is_synthetic: 0.82, classifications }));
    expect(v.detector_reasoning).toBeNull();
  });

  it('is null when the detector returned no label list', () => {
    const v = deriveMediaVerdict(base({ is_synthetic: 0.82 }));
    expect(v.detector_reasoning).toBeNull();
  });
});

// 6. Closed-set discipline ---------------------------------------------------

describe('closed-set tag discipline', () => {
  it('declares 7 image tags and 5 audio tags (ontology section 3.18)', () => {
    expect(IMAGE_TAGS).toHaveLength(7);
    expect(AUDIO_TAGS).toHaveLength(5);
  });

  it('the synthesis-indicator set is a subset of the union of the two tag sets', () => {
    const union = new Set<string>([...IMAGE_TAGS, ...AUDIO_TAGS]);
    for (const t of SYNTHESIS_INDICATOR_TAGS) {
      expect(union.has(t)).toBe(true);
    }
  });

  it('every emitted tag is a member of the closed set', () => {
    const union = new Set<string>([...IMAGE_TAGS, ...AUDIO_TAGS]);
    const cases: MediaDetectionResult[] = [
      base({ model_id: PRIMARY_IMAGE_MODEL, is_synthetic: 0.9 }),
      base({ model_id: PRIMARY_AUDIO_MODEL, is_synthetic: 0.7 }),
      base({ model_id: PRIMARY_IMAGE_MODEL, is_synthetic: 0.5 }),
    ];
    for (const c of cases) {
      const v = deriveMediaVerdict(c);
      for (const t of v.tags) {
        expect(union.has(t)).toBe(true);
      }
    }
  });

  it('rejects an out-of-set tag literal at the type level', () => {
    // @ts-expect-error 'not_a_real_tag' is not a member of the MediaTag closed set.
    const bad: MediaTag = 'not_a_real_tag';
    void bad;
  });
});

// Error path -----------------------------------------------------------------

describe('deriveMediaVerdict -- error path carries safe rich-field defaults', () => {
  it('empty tags, low band, human_review disposition, null detector_reasoning', () => {
    const v = deriveMediaVerdict(base({ error: 'HF_API_TOKEN not configured', is_synthetic: 0.9 }));
    expect(v.verdict).toBe('error');
    expect(v.tags).toHaveLength(0);
    expect(v.confidence_band).toBe('low');
    expect(v.recommended_disposition).toBe('human_review');
    expect(v.detector_reasoning).toBeNull();
  });
});
