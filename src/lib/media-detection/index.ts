// Media-detection public API, Phase 1 + Phase 2.
//
// Phase 1 shipped the per-modality detectors (image, audio, video stub)
// plus the routing dispatch detectMedia(). Phase 2 (this revision) wires
// the Gemini 2.5 Flash reasoning fallback on the ambiguous-band detector
// score (0.4-0.6) per Steven's Q3 adjudication and the implementation
// spec section 6.
//
// Gating rules for the reasoning fallback (cost-bounded):
//   1. The base detector's is_synthetic score must land inside the
//      ambiguous band [AMBIGUOUS_BAND_LOW, AMBIGUOUS_BAND_HIGH].
//   2. The GEMINI_API_KEY env var must be configured.
//   3. The caller did not pass options.skipReasoning = true.
//   4. The base detector did not return an error (no point reasoning
//      about a degraded detector result; the engine already has the
//      degraded shape).
//
// When all four conditions hold, detectMedia awaits the reasoning layer
// and attaches the result as result.reasoning. The Stage 3 reason-code
// emission lives in src/lib/safeeval-v5.js (not here) because Stage 3 is
// the engine's concern, not the detector module's. ascii-safe.

import { detectImage, PRIMARY_IMAGE_MODEL } from './image-detector';
import { detectAudio, PRIMARY_AUDIO_MODEL } from './audio-detector';
import {
  detectVideo,
  VIDEO_DETECTOR_MODEL_ID,
  VIDEO_NOT_IMPLEMENTED_MESSAGE,
} from './video-detector';
import { reasonAboutAmbiguousDetection, REASONING_MODEL_ID } from './reasoning-layer';
import type {
  DetectorOptions,
  MediaArtifact,
  MediaDetectionResult,
  MediaType,
  ReasoningResult,
  ReasoningVerdict,
} from './types';
import {
  AMBIGUOUS_BAND_HIGH,
  AMBIGUOUS_BAND_LOW,
  DEFAULT_DETECTOR_TIMEOUT_MS,
  DEFAULT_MEDIA_SYNTHETIC_THRESHOLD,
  REASON_CODE_MEDIA_LIKELY_SYNTHETIC,
} from './types';

export type {
  DetectorOptions,
  MediaArtifact,
  MediaClassification,
  MediaDetectionResult,
  MediaType,
  ReasoningResult,
  ReasoningVerdict,
} from './types';

export {
  AMBIGUOUS_BAND_HIGH,
  AMBIGUOUS_BAND_LOW,
  DEFAULT_DETECTOR_TIMEOUT_MS,
  DEFAULT_MEDIA_SYNTHETIC_THRESHOLD,
  REASON_CODE_MEDIA_LIKELY_SYNTHETIC,
  REASONING_MODEL_ID,
  detectImage,
  detectAudio,
  detectVideo,
  reasonAboutAmbiguousDetection,
  PRIMARY_IMAGE_MODEL,
  PRIMARY_AUDIO_MODEL,
  VIDEO_DETECTOR_MODEL_ID,
  VIDEO_NOT_IMPLEMENTED_MESSAGE,
};

function isAmbiguousBand(score: number): boolean {
  return score >= AMBIGUOUS_BAND_LOW && score <= AMBIGUOUS_BAND_HIGH;
}

async function dispatchToDetector(
  artifact: MediaArtifact,
  options: DetectorOptions
): Promise<MediaDetectionResult> {
  switch (artifact.type) {
    case 'image':
      return detectImage(artifact, options);
    case 'audio':
      return detectAudio(artifact, options);
    case 'video':
      return detectVideo(artifact, options);
    default: {
      // Exhaustiveness guard. If a new MediaType is added without a router
      // branch, TypeScript flags this; at runtime we degrade gracefully so
      // a malformed envelope never throws into Stage 0.
      const exhaustive: never = artifact.type;
      return {
        is_synthetic: 0,
        confidence: 0,
        model_id: 'media-detection-router',
        latency_ms: 0,
        error: `Unsupported media type: ${String(exhaustive)}`,
      };
    }
  }
}

export async function detectMedia(
  artifact: MediaArtifact,
  options: DetectorOptions = {}
): Promise<MediaDetectionResult> {
  const base = await dispatchToDetector(artifact, options);

  // Gemini fallback gating per the implementation spec section 6.1 and
  // Steven's Q3 adjudication. The gate is intentionally narrow: only the
  // happy-path detector results in the ambiguous band warrant the cost of
  // a Gemini call.
  if (options.skipReasoning) return base;
  if (base.error) return base;
  if (!isAmbiguousBand(base.is_synthetic)) return base;
  if (!process.env.GEMINI_API_KEY) return base;

  const reasoning = await reasonAboutAmbiguousDetection(artifact, base, options);
  return {
    ...base,
    reasoning,
  };
}
