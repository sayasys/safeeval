// Agnostic-output guarantee: the overlay composition layer (Phase 1, Q15).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 8 + the four Steven-locked decisions: SafeEval's closed-set L1/L2/L3
// envelope is the agnostic BASE layer and MUST remain present regardless of org
// configuration. Custom Pattern and Custom L3 Classifier matches are an OVERLAY:
// additive, appended ALONGSIDE the base envelope, never a replacement or filter.
//
// This module is the single seam where overlays are merged onto the base. The
// non-negotiable trust-architecture invariant -- that the base keys survive any
// org configuration -- is structurally guaranteed by composeEvaluationEnvelope
// (it spreads the base FIRST and only ever ADDS the three overlay arrays) and is
// asserted as a runtime invariant by
// tests/lib/data/agnostic-output-guarantee.test.ts (Q15: a runtime invariant
// test, not a schema-level type guarantee).
//
// The Phase 1 inference path is not built (Phase 4), so production callers pass
// empty overlay arrays today; the composer behaves identically whether the
// arrays are empty or populated, which is exactly what the invariant requires.

import type { V5Envelope } from '../types';
import type { MatchMode, L3GroupName } from './types';

// One org-defined Pattern match in the overlay (memo section 8). Shape mirrors
// the memo's `evaluation.custom_pattern_matches[]` entry.
export interface PatternMatch {
  pattern_id: string;
  name: string;
  typology: string;
  match_mode: MatchMode;
  components_present: string[];
  components_missing: string[];
}

// One org Custom L3 Classifier verdict in the overlay (memo section 8). Used for
// both the live overlay (custom_l3_matches) and the shadow debug overlay
// (custom_l3_shadow_matches).
export interface CustomL3Match {
  classifier_id: string;
  group_name: L3GroupName;
  tag_name: string;
  confidence: number;
  reasoning: string;
}

export interface OverlayMatches {
  custom_pattern_matches?: PatternMatch[];
  custom_l3_matches?: CustomL3Match[];
  // Shadow verdicts: admin/reviewer-visible debug surface, redacted from
  // member-facing responses (memo section 6.2). Modeled here so the composer
  // round-trips it; redaction is a route-layer concern (Phase 2+).
  custom_l3_shadow_matches?: CustomL3Match[];
}

// The composed envelope: the base V5 envelope plus the three additive overlay
// arrays. The overlay arrays are always present (defaulting to []), so a
// consumer never has to distinguish "no overlay configured" from "overlay
// configured but no match."
export type EvaluationEnvelope = V5Envelope & {
  custom_pattern_matches: PatternMatch[];
  custom_l3_matches: CustomL3Match[];
  custom_l3_shadow_matches: CustomL3Match[];
};

// The closed set of base envelope keys that MUST be present on every evaluation
// response regardless of org configuration. Anchored to the non-optional
// top-level fields of V5Envelope (src/lib/data/types.ts) -- the architect-owned
// agnostic surface. The L1/L2/L3 classification detail rides inside `evidence`
// and is carried through untouched by the spread in composeEvaluationEnvelope.
export const AGNOSTIC_BASE_ENVELOPE_KEYS = [
  'schema_version',
  'ontology_version',
  'evaluated_at',
  'model_pipeline',
  'prompt_length',
  'disposition',
  'evidence',
] as const;

// The overlay keys the composer always adds.
export const OVERLAY_ENVELOPE_KEYS = [
  'custom_pattern_matches',
  'custom_l3_matches',
  'custom_l3_shadow_matches',
] as const;

// Compose the base envelope with org overlays. The base is spread FIRST so every
// base key (and its exact value) survives; the three overlay arrays are then
// added. This ordering is the structural guarantee that an overlay can never
// remove or replace a base key -- it can only add the three overlay arrays.
export function composeEvaluationEnvelope(
  base: V5Envelope,
  overlays: OverlayMatches = {},
): EvaluationEnvelope {
  return {
    ...base,
    custom_pattern_matches: overlays.custom_pattern_matches ?? [],
    custom_l3_matches: overlays.custom_l3_matches ?? [],
    custom_l3_shadow_matches: overlays.custom_l3_shadow_matches ?? [],
  };
}

// Runtime guard used by the agnostic-output invariant test (and available to
// callers that want to assert the guarantee defensively). Returns the list of
// base keys missing from `env`; an empty array means the agnostic base layer is
// intact.
export function missingAgnosticBaseKeys(env: Record<string, unknown>): string[] {
  return AGNOSTIC_BASE_ENVELOPE_KEYS.filter((k) => !(k in env));
}
