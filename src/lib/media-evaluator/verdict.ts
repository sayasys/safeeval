// Media-detection result -> user-facing verdict view.
//
// The media-detection module (src/lib/media-detection) returns a numeric
// MediaDetectionResult (is_synthetic, confidence, optional reasoning). The
// public Evaluator page needs a plain-language verdict (green/red/sage badge,
// a likelihood bar, a caption, an optional reasoning paragraph). This module
// is the single pure mapping from the raw detector shape to that view so the
// route, the page, and the tests all agree on the derivation.
//
// Verdict precedence:
//   1. error present                 -> 'error' (detection unavailable)
//   2. Gemini reasoning verdict      -> maps likely_synthetic / likely_real /
//                                       still_ambiguous to the UI verdict
//   3. is_synthetic vs ambiguous band:
//        > AMBIGUOUS_BAND_HIGH (0.6) -> likely_synthetic
//        < AMBIGUOUS_BAND_LOW  (0.4) -> likely_human
//        otherwise                   -> uncertain
//
// The band boundaries are reused from the detector module so the UI's
// uncertain zone lines up exactly with the band that triggers the Gemini
// reasoning fallback. ascii-safe.

import {
  AMBIGUOUS_BAND_HIGH,
  AMBIGUOUS_BAND_LOW,
} from '../media-detection';
import type { MediaDetectionResult } from '../media-detection';

export type MediaVerdict =
  | 'likely_human'
  | 'likely_synthetic'
  | 'uncertain'
  | 'error';

// Plain-language labels per the dispatch copy. The em dash in the uncertain
// label is written as "--" to keep this module ASCII-safe (repo convention).
export const MEDIA_VERDICT_LABELS: Record<MediaVerdict, string> = {
  likely_human: 'Likely human-generated',
  likely_synthetic: 'Likely AI-generated',
  uncertain: 'Uncertain -- see reasoning below',
  error: 'Detection unavailable',
};

export interface MediaVerdictView {
  verdict: MediaVerdict;
  label: string;
  // Synthetic-likelihood score (the detector's is_synthetic), 0-1 and 0-100.
  syntheticLikelihood: number;
  syntheticPct: number;
  // The detector's confidence in its top class, 0-100 (caption only).
  detectorConfidencePct: number;
  detectorModel: string;
  latencyMs: number;
  // True when the Gemini reasoning fallback ran for the ambiguous band.
  reasoningUsed: boolean;
  reasoning: string | null;
  error: string | null;
}

function clamp01(n: unknown): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function pct(n: number): number {
  return Math.round(clamp01(n) * 100);
}

export function deriveMediaVerdict(
  result: MediaDetectionResult | null | undefined
): MediaVerdictView {
  const r = result || ({} as MediaDetectionResult);
  const syntheticLikelihood = clamp01(r.is_synthetic);
  const reasoning = r.reasoning && typeof r.reasoning === 'object' ? r.reasoning : null;

  const base: Omit<MediaVerdictView, 'verdict' | 'label'> = {
    syntheticLikelihood,
    syntheticPct: pct(r.is_synthetic),
    detectorConfidencePct: pct(r.confidence),
    detectorModel: typeof r.model_id === 'string' ? r.model_id : 'unknown',
    latencyMs: typeof r.latency_ms === 'number' ? r.latency_ms : 0,
    reasoningUsed: !!reasoning,
    reasoning: reasoning && typeof reasoning.reasoning === 'string' ? reasoning.reasoning : null,
    error: typeof r.error === 'string' && r.error.length > 0 ? r.error : null,
  };

  // 1. Error path: the detector was unreachable, unconfigured, or returned a
  // malformed response. The page shows a neutral "Detection unavailable" card.
  if (base.error) {
    return { verdict: 'error', label: MEDIA_VERDICT_LABELS.error, ...base };
  }

  // 2. Gemini reasoning verdict wins when present (it ran precisely because the
  // raw score sat in the ambiguous band).
  if (reasoning && typeof reasoning.verdict === 'string') {
    if (reasoning.verdict === 'likely_synthetic') {
      return { verdict: 'likely_synthetic', label: MEDIA_VERDICT_LABELS.likely_synthetic, ...base };
    }
    if (reasoning.verdict === 'likely_real') {
      return { verdict: 'likely_human', label: MEDIA_VERDICT_LABELS.likely_human, ...base };
    }
    // 'still_ambiguous'
    return { verdict: 'uncertain', label: MEDIA_VERDICT_LABELS.uncertain, ...base };
  }

  // 3. Numeric fallback against the ambiguous band.
  let verdict: MediaVerdict;
  if (syntheticLikelihood > AMBIGUOUS_BAND_HIGH) verdict = 'likely_synthetic';
  else if (syntheticLikelihood < AMBIGUOUS_BAND_LOW) verdict = 'likely_human';
  else verdict = 'uncertain';

  return { verdict, label: MEDIA_VERDICT_LABELS[verdict], ...base };
}
