// Media-detection public API, Phase 1.
//
// Phase 1 exports the per-modality detectors plus a single dispatch
// detectMedia() that routes on MediaArtifact.type. The Stage 0 wire-up in
// src/lib/safeeval-v5.js is Phase 2; nothing in this module is imported by
// the engine yet. Phase 2 will also wire the Gemini reasoning fallback on
// the ambiguous detector-score band (0.4-0.6) per the implementation spec
// section 6. ascii-safe.

import { detectImage, PRIMARY_IMAGE_MODEL } from './image-detector';
import { detectAudio, PRIMARY_AUDIO_MODEL } from './audio-detector';
import {
  detectVideo,
  VIDEO_DETECTOR_MODEL_ID,
  VIDEO_NOT_IMPLEMENTED_MESSAGE,
} from './video-detector';
import type {
  DetectorOptions,
  MediaArtifact,
  MediaDetectionResult,
  MediaType,
} from './types';
import { DEFAULT_DETECTOR_TIMEOUT_MS } from './types';

export type {
  DetectorOptions,
  MediaArtifact,
  MediaDetectionResult,
  MediaType,
} from './types';

export {
  DEFAULT_DETECTOR_TIMEOUT_MS,
  detectImage,
  detectAudio,
  detectVideo,
  PRIMARY_IMAGE_MODEL,
  PRIMARY_AUDIO_MODEL,
  VIDEO_DETECTOR_MODEL_ID,
  VIDEO_NOT_IMPLEMENTED_MESSAGE,
};

export async function detectMedia(
  artifact: MediaArtifact,
  options: DetectorOptions = {}
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
