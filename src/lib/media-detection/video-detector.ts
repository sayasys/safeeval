// Video synthetic-media detector -- Demo tier stub.
//
// Video detection is deferred to the Full tier per the implementation spec
// section 11 ("Video modality. Deferred to Full tier. The index.ts router
// returns an error for type: 'video' to keep the contract honest -- no
// silent fallback to image frames."). The stub returns a populated
// MediaDetectionResult with the error field set so downstream stages see
// a recognizable "not implemented" signal rather than a missing field or
// a misleading low score. ascii-safe.

import type { DetectorOptions, MediaArtifact, MediaDetectionResult } from './types';

export const VIDEO_DETECTOR_MODEL_ID = 'video-detector-stub';

export const VIDEO_NOT_IMPLEMENTED_MESSAGE =
  'Video detection not implemented in Demo tier';

export async function detectVideo(
  _input: MediaArtifact,
  _options: DetectorOptions = {}
): Promise<MediaDetectionResult> {
  return {
    is_synthetic: 0,
    confidence: 0,
    model_id: VIDEO_DETECTOR_MODEL_ID,
    latency_ms: 0,
    error: VIDEO_NOT_IMPLEMENTED_MESSAGE,
  };
}
