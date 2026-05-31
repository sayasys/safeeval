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
  PRIMARY_AUDIO_MODEL,
  PRIMARY_IMAGE_MODEL,
} from '../media-detection';
import type {
  MediaClassification,
  MediaDetectionResult,
  ReasoningResult,
  ReasoningVerdict,
} from '../media-detection';

export type MediaVerdict =
  | 'likely_human'
  | 'likely_synthetic'
  | 'uncertain'
  | 'error';

// --- Rich-media result-card vocabulary (brief 0089) -------------------------
//
// The rich synthetic-media result card needs more than a verdict + likelihood
// bar: a closed-set tag chip stack ("what the detector saw"), a confidence
// band, a recommended disposition, and the Gemini reasoning surfaced as a
// secondary signal. These are derived purely from the detector result so the
// route, the page, and the tests share one derivation. The closed sets below
// are the policy-layer commitment in docs/08-v5-ontology.md section 3.18
// (7 image + 5 audio tags) and docs/policy-spec-v5.0.md section 13; the
// check-lockstep media-tag + disposition verifiers assert this file mirrors
// those surfaces byte-for-byte.

// Confidence-band closed set per policy-spec-v5.0.md section 13.1.
export type ConfidenceBand = 'high' | 'medium' | 'low';

// Engine 4-verb disposition closed set per policy-spec-v5.0.md section 6. The
// live-evaluator media card only reaches {allow, human_review, block} per the
// section 13.2 derivation (safe_completion is a generation-surface verb with
// no meaning on a verdict surface), but the field is typed to the full 4-verb
// set so the card and the case-mgmt detail pane share one disposition type.
export type EngineDisposition =
  | 'allow'
  | 'safe_completion'
  | 'human_review'
  | 'block';

// Closed-set "what the detector saw" tags, scoped by media type. MUST mirror
// docs/08-v5-ontology.md section 3.18.1 (image) and section 3.18.2 (audio)
// byte-for-byte -- enforced by checkMediaTagLockstep in scripts/check-lockstep.js.
export const IMAGE_TAGS = [
  'gan_artifact_detected',
  'diffusion_signature',
  'metadata_stripped',
  'unusual_compression',
  'face_swap_indicators',
  'prompt_injection_artifact',
  'watermark_present',
] as const;

export const AUDIO_TAGS = [
  'synthetic_voice_cadence',
  'splice_point_detected',
  'spectral_anomaly',
  'voice_clone_signature',
  'unusual_silence_pattern',
] as const;

export type ImageTag = typeof IMAGE_TAGS[number];
export type AudioTag = typeof AUDIO_TAGS[number];
export type MediaTag = ImageTag | AudioTag;

// Synthesis-indicator tag set per policy-spec-v5.0.md section 13.2. Presence
// of any of these in the fired-tag set is the third input (alongside verdict +
// band) to the recommended_disposition derivation: a high-confidence
// likely_synthetic verdict blocks only when a synthesis-indicator tag fired.
// The remaining tags (metadata_stripped, unusual_compression,
// unusual_silence_pattern, watermark_present) are context tags, not
// synthesis-indicators. MUST mirror the section 13.2 "Synthesis-indicator tag
// set" list -- enforced by checkMediaRecommendedDispositionLockstep.
export const SYNTHESIS_INDICATOR_TAGS = [
  'gan_artifact_detected',
  'diffusion_signature',
  'face_swap_indicators',
  'prompt_injection_artifact',
  'splice_point_detected',
  'spectral_anomaly',
  'voice_clone_signature',
] as const;

// Per-card-surface tag-firing threshold per ontology section 3.18.1 (the
// diffusion_signature row): slightly above the engine-emission threshold so a
// borderline detector score does not light a chip the reviewer should see
// uncluttered.
export const TAG_FIRE_THRESHOLD = 0.6;

// Gemini reasoning surfaced as a secondary signal per policy-spec-v5.0.md
// section 13.4. Null sub-fields when the reasoning fallback did not run.
export interface SecondarySignals {
  gemini_verdict: ReasoningVerdict | null;
  gemini_reasoning: string | null;
}

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
  // --- Rich-media-card fields (brief 0089) ---------------------------------
  // Closed-set "what the detector saw" chips per ontology section 3.18. Scoped
  // by media type (image tags for an image detection, audio tags for audio).
  tags: readonly MediaTag[];
  // Confidence band per policy-spec-v5.0.md section 13.1.
  confidence_band: ConfidenceBand;
  // Engine 4-verb recommendation per policy-spec-v5.0.md section 13.2.
  recommended_disposition: EngineDisposition;
  // Gemini reasoning surfaced as a secondary signal per section 13.4.
  secondary_signals: SecondarySignals;
  // Short prose describing the detector's label stack ("what the detector
  // saw"); null when the detector did not return a label list.
  detector_reasoning: string | null;
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

// --- Rich-media derivations (brief 0089) ------------------------------------

// The detector's binary verdict per policy-spec-v5.0.md section 13.1:
// likely_synthetic iff is_synthetic >= 0.5, else likely_real. This is the
// reasoning-agreement comparator, distinct from the four-state MediaVerdict.
function detectorBinaryVerdict(isSynthetic: number): 'likely_synthetic' | 'likely_real' {
  return isSynthetic >= 0.5 ? 'likely_synthetic' : 'likely_real';
}

// Confidence band per policy-spec-v5.0.md section 13.1. The "model and
// reasoning disagree" case is intrinsically low regardless of raw score, so
// the conflict branch is evaluated first. still_ambiguous never matches the
// binary verdict, so it counts as a conflict -- consistent with section 13.4's
// rule that a still_ambiguous reasoning verdict forces the band to low.
export function deriveMediaConfidenceBand(
  isSynthetic: number,
  reasoningVerdict: ReasoningVerdict | null
): ConfidenceBand {
  const score = clamp01(isSynthetic);
  const reasoningRan = reasoningVerdict !== null;
  const agrees = reasoningRan && reasoningVerdict === detectorBinaryVerdict(score);
  const conflicts = reasoningRan && !agrees;
  if (conflicts) return 'low';
  if (score > 0.85 || agrees) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

// Recommended disposition per policy-spec-v5.0.md section 13.2. Pure mapping of
// (verdict, band, tags) onto the engine 4-verb set. safe_completion is never
// returned on this verdict surface (section 13.2 rationale: the card is a
// verdict surface, not a generation surface). likely_human is the view's name
// for the spec's likely_real, which always maps to allow.
export function deriveMediaRecommendedDisposition(
  verdict: MediaVerdict,
  band: ConfidenceBand,
  tags: readonly MediaTag[]
): EngineDisposition {
  if (verdict === 'error') return 'human_review';
  if (verdict === 'uncertain') return 'human_review';
  if (verdict === 'likely_synthetic') {
    const synthIndicators: ReadonlySet<string> = new Set(SYNTHESIS_INDICATOR_TAGS);
    const hasSynthIndicator = tags.some((t) => synthIndicators.has(t));
    if (band === 'high' && hasSynthIndicator) return 'block';
    return 'human_review';
  }
  // verdict === 'likely_human' (spec: likely_real). Section 13.2's high/none,
  // high/watermark-only, and medium-or-low rows all map to allow.
  return 'allow';
}

// Phase-1 tag derivation per ontology section 3.18. Only the wired tags fire:
// diffusion_signature (image) and synthetic_voice_cadence (audio), each when
// the primary detector scores above the per-card firing threshold. The
// remaining tags are CLOSED-SET-DECLARED-BUT-NOT-WIRED -- declared in the
// closed set above, firing logic deferred to sub-detector integrations.
// NOTE: ontology section 3.18.1 also marks metadata_stripped as Phase-1 wired,
// but its trigger is upload-path metadata inspection the MediaDetectionResult
// does not carry; it does not fire at this layer (brief 0089 CONDITIONAL).
function deriveMediaTags(modelId: string, syntheticLikelihood: number): readonly MediaTag[] {
  if (syntheticLikelihood <= TAG_FIRE_THRESHOLD) return [];
  if (modelId === PRIMARY_IMAGE_MODEL) return ['diffusion_signature'];
  if (modelId === PRIMARY_AUDIO_MODEL) return ['synthetic_voice_cadence'];
  return [];
}

// Short prose describing the detector's label stack -- "what the detector saw".
// Built from the raw classifications list: the top label/score plus the
// runner-up labels. Null when the detector returned no runner-up labels (a
// single-label list, the error path, the video stub, or a pre-0089 envelope).
function deriveDetectorReasoning(
  classifications: readonly MediaClassification[] | undefined
): string | null {
  if (!Array.isArray(classifications) || classifications.length === 0) return null;
  const sorted = [...classifications].sort((a, b) => b.score - a.score);
  const runnersUp = sorted.slice(1);
  if (runnersUp.length === 0) return null;
  const top = sorted[0];
  const runnerText = runnersUp.map((c) => c.label + ' (' + pct(c.score) + '%)').join(', ');
  return (
    'Detector identified ' + top.label + ' (' + pct(top.score) + '%); ' +
    'runner-up labels: ' + runnerText + '.'
  );
}

export function deriveMediaVerdict(
  result: MediaDetectionResult | null | undefined
): MediaVerdictView {
  const r = result || ({} as MediaDetectionResult);
  const syntheticLikelihood = clamp01(r.is_synthetic);
  const reasoning = r.reasoning && typeof r.reasoning === 'object' ? r.reasoning : null;
  const reasoningVerdict: ReasoningVerdict | null =
    reasoning && typeof reasoning.verdict === 'string' ? reasoning.verdict : null;
  const reasoningText =
    reasoning && typeof reasoning.reasoning === 'string' ? reasoning.reasoning : null;
  const modelId = typeof r.model_id === 'string' ? r.model_id : 'unknown';
  const error = typeof r.error === 'string' && r.error.length > 0 ? r.error : null;

  // Four-state verdict via the established precedence: error wins, then the
  // Gemini reasoning verdict (it ran precisely because the raw score sat in
  // the ambiguous band), then the numeric fallback against the ambiguous band.
  let verdict: MediaVerdict;
  if (error) {
    verdict = 'error';
  } else if (reasoningVerdict === 'likely_synthetic') {
    verdict = 'likely_synthetic';
  } else if (reasoningVerdict === 'likely_real') {
    verdict = 'likely_human';
  } else if (reasoningVerdict === 'still_ambiguous') {
    verdict = 'uncertain';
  } else if (syntheticLikelihood > AMBIGUOUS_BAND_HIGH) {
    verdict = 'likely_synthetic';
  } else if (syntheticLikelihood < AMBIGUOUS_BAND_LOW) {
    verdict = 'likely_human';
  } else {
    verdict = 'uncertain';
  }

  // Rich-media fields. On the error path there is no detector evidence: empty
  // tags, low band, null detector_reasoning. The error verdict still resolves
  // to human_review per the section 13.2 error row.
  const tags: readonly MediaTag[] = error ? [] : deriveMediaTags(modelId, syntheticLikelihood);
  const confidence_band: ConfidenceBand = error
    ? 'low'
    : deriveMediaConfidenceBand(syntheticLikelihood, reasoningVerdict);
  const recommended_disposition = deriveMediaRecommendedDisposition(verdict, confidence_band, tags);
  const secondary_signals: SecondarySignals = {
    gemini_verdict: reasoningVerdict,
    gemini_reasoning: reasoningText,
  };
  const detector_reasoning = error ? null : deriveDetectorReasoning(r.classifications);

  return {
    verdict,
    label: MEDIA_VERDICT_LABELS[verdict],
    syntheticLikelihood,
    syntheticPct: pct(r.is_synthetic),
    detectorConfidencePct: pct(r.confidence),
    detectorModel: modelId,
    latencyMs: typeof r.latency_ms === 'number' ? r.latency_ms : 0,
    reasoningUsed: !!reasoning,
    reasoning: reasoningText,
    error,
    tags,
    confidence_band,
    recommended_disposition,
    secondary_signals,
    detector_reasoning,
  };
}
