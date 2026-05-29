// Verifies the video-detector stub. Video is deferred to Full tier; the
// stub returns a recognizable error so downstream stages can degrade.
// ascii-safe.

import { describe, it, expect } from 'vitest';

import {
  detectVideo,
  VIDEO_DETECTOR_MODEL_ID,
  VIDEO_NOT_IMPLEMENTED_MESSAGE,
} from '../../src/lib/media-detection/video-detector';
import { detectMedia } from '../../src/lib/media-detection/index';
import type { MediaArtifact } from '../../src/lib/media-detection/types';

const VIDEO_ARTIFACT: MediaArtifact = {
  type: 'video',
  url_or_base64: 'https://example.invalid/clip.mp4',
  mime_type: 'video/mp4',
};

describe('detectVideo -- Demo-tier stub', () => {
  it('returns is_synthetic = 0 and the not-implemented error message', async () => {
    const result = await detectVideo(VIDEO_ARTIFACT);
    expect(result.is_synthetic).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.latency_ms).toBe(0);
    expect(result.model_id).toBe(VIDEO_DETECTOR_MODEL_ID);
    expect(result.error).toBe(VIDEO_NOT_IMPLEMENTED_MESSAGE);
  });

  it('routes video artifacts through detectMedia() to the same stub error', async () => {
    const result = await detectMedia(VIDEO_ARTIFACT);
    expect(result.error).toBe(VIDEO_NOT_IMPLEMENTED_MESSAGE);
    expect(result.model_id).toBe(VIDEO_DETECTOR_MODEL_ID);
  });
});
