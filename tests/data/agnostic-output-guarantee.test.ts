// Agnostic-output guarantee -- runtime invariant test (Phase 1, Q15).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 8 + Steven-locked decision 4: SafeEval's closed-set L1/L2/L3 envelope
// is the agnostic BASE layer and MUST remain present regardless of org
// configuration; custom Pattern / Custom L3 matches are an additive OVERLAY,
// never a replacement or filter.
//
// Q15 adjudication: the Phase 1 acceptance criterion is a RUNTIME invariant
// test (this file), not a schema-level type guarantee. It asserts that for any
// overlay state -- absent OR populated, single-tenant fallback OR real org --
// composeEvaluationEnvelope always emits the closed-set base keys with their
// values intact, and only ever ADDS the three overlay arrays.

import { describe, it, expect } from 'vitest';
import type { V5Envelope } from '../../src/lib/data/types';
import {
  composeEvaluationEnvelope,
  missingAgnosticBaseKeys,
  AGNOSTIC_BASE_ENVELOPE_KEYS,
  OVERLAY_ENVELOPE_KEYS,
  type PatternMatch,
  type CustomL3Match,
} from '../../src/lib/data/custom-patterns/envelope';

// A representative base envelope. The L1/L2/L3 classification detail rides
// inside `evidence` (the architect-owned closed-set surface), which the composer
// must carry through untouched.
function makeBaseEnvelope(): V5Envelope {
  return {
    schema_version: '5.2',
    ontology_version: '5.2',
    evaluated_at: '2026-05-29T00:00:00.000Z',
    model_pipeline: ['claude-sonnet-4-6'],
    prompt_length: 128,
    disposition: { action: 'block', confidence: 0.93 },
    evidence: {
      aggregate_score: 0.81,
      l1: 'deceptive_fraud',
      l2: 'investment_fraud',
      l3: { method: ['sock_puppet'], tactic: ['trust_love'] },
    },
  };
}

const samplePatternMatches: PatternMatch[] = [
  {
    pattern_id: 'pattern-1',
    name: 'romance-crypto-cross-pollination',
    typology: 'investment_fraud',
    match_mode: 'subset',
    components_present: ['tactic:trust_love', 'target:crypto_holder'],
    components_missing: [],
  },
];

const sampleL3Matches: CustomL3Match[] = [
  {
    classifier_id: 'classifier-1',
    group_name: 'context_marker',
    tag_name: 'our_loyalty_token_promo_pretext',
    confidence: 0.88,
    reasoning: 'Input references the org loyalty-token promo pretext.',
  },
];

describe('agnostic-output guarantee', () => {
  it('keeps every closed-set base key present when no custom matches exist', () => {
    const base = makeBaseEnvelope();
    const env = composeEvaluationEnvelope(base);

    for (const key of AGNOSTIC_BASE_ENVELOPE_KEYS) {
      expect(env, `base key ${key} must be present`).toHaveProperty(key);
    }
    expect(missingAgnosticBaseKeys(env)).toEqual([]);

    // Overlay arrays are always present, and empty in the no-match case.
    expect(env.custom_pattern_matches).toEqual([]);
    expect(env.custom_l3_matches).toEqual([]);
    expect(env.custom_l3_shadow_matches).toEqual([]);
  });

  it('keeps every base key and its value intact when custom matches are populated', () => {
    const base = makeBaseEnvelope();
    const env = composeEvaluationEnvelope(base, {
      custom_pattern_matches: samplePatternMatches,
      custom_l3_matches: sampleL3Matches,
      custom_l3_shadow_matches: sampleL3Matches,
    });

    expect(missingAgnosticBaseKeys(env)).toEqual([]);
    // Base values are byte-for-byte unchanged by the overlay.
    expect(env.schema_version).toBe(base.schema_version);
    expect(env.ontology_version).toBe(base.ontology_version);
    expect(env.disposition).toEqual(base.disposition);
    expect(env.evidence).toEqual(base.evidence);

    // Overlays are additive.
    expect(env.custom_pattern_matches).toEqual(samplePatternMatches);
    expect(env.custom_l3_matches).toEqual(sampleL3Matches);
    expect(env.custom_l3_shadow_matches).toEqual(sampleL3Matches);
  });

  it('behaves identically for the single-tenant fallback and the real-org case', () => {
    const base = makeBaseEnvelope();

    // Single-tenant portfolio path: no overlay configured.
    const singleTenant = composeEvaluationEnvelope(base);
    // Real-org path: overlay configured and matching.
    const realOrg = composeEvaluationEnvelope(base, {
      custom_pattern_matches: samplePatternMatches,
      custom_l3_matches: sampleL3Matches,
    });

    // The base layer is identical across both regardless of overlay state.
    for (const key of AGNOSTIC_BASE_ENVELOPE_KEYS) {
      expect(singleTenant[key]).toEqual(realOrg[key]);
    }
  });

  it('never lets an overlay remove or replace a base key', () => {
    const base = makeBaseEnvelope();
    const env = composeEvaluationEnvelope(base, {
      custom_pattern_matches: samplePatternMatches,
    });
    // disposition + evidence (the trust-architecture surface) survive overlay.
    expect(env).toHaveProperty('disposition');
    expect(env).toHaveProperty('evidence');
    expect(env.disposition.action).toBe('block');
    // The shadow array defaults to empty even when only one overlay is supplied.
    expect(env.custom_l3_shadow_matches).toEqual([]);
  });

  it('exposes disjoint base-key and overlay-key closed sets', () => {
    const baseSet = new Set<string>(AGNOSTIC_BASE_ENVELOPE_KEYS);
    for (const overlayKey of OVERLAY_ENVELOPE_KEYS) {
      expect(baseSet.has(overlayKey)).toBe(false);
    }
  });

  it('missingAgnosticBaseKeys detects a stripped base key', () => {
    const base = makeBaseEnvelope();
    const env = composeEvaluationEnvelope(base) as Record<string, unknown>;
    // Simulate a regression that drops the disposition key.
    delete env.disposition;
    expect(missingAgnosticBaseKeys(env)).toContain('disposition');
  });
});
