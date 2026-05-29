// Media-detection surface, Phase 1 type definitions.
//
// The implementation spec is at
//   docs/memos/2026-05-28-synthetic-media-detection-implementation-spec.md
// and the upstream scoping memo is at
//   docs/memos/2026-05-28-synthetic-media-detection-scoping.md
//
// Phase 1 lands: the envelope schema delta (media_artifact +
// media_detection_result optional top-level fields), this module skeleton, the
// Hugging Face Inference API integration for image and audio detectors, the
// video stub, and unit tests. Out of scope for Phase 1 per the dispatch:
//   - Stage 0 routing wire-up in src/lib/safeeval-v5.js (Phase 2)
//   - Gemini 1.5 Flash reasoning fallback on the ambiguous band (Phase 2)
//   - Stage 3 reason-code modifier media_likely_synthetic (Phase 3)
//   - Upload widget UI on the Vercel app (Phase 4)
//
// The types below mirror the schema delta in
// tests/schema/v5-envelope.schema.json $defs.media_artifact and $defs.
// media_detection_result. Phase 1 emits the flat detector-only result shape;
// Phase 2 will extend the result with Gemini-derived reasoning fields and
// the aggregate_is_synthetic field once the reasoning layer lands.
// ascii-safe.

export type MediaType = 'image' | 'audio' | 'video';

// Input artifact -- a user-supplied media file, supplied either as a URL the
// detector can fetch or as a base64 string (the data:URI prefix is allowed
// but not required; detectors strip it before calling the upstream API).
export interface MediaArtifact {
  type: MediaType;
  url_or_base64: string;
  mime_type: string;
}

// Phase 1 result shape. Mirrors the schema delta one-for-one. The error
// field is set when the detector was unreachable, rejected the input, or
// returned a malformed response -- downstream stages MUST treat a present
// error field as "no media evidence" and continue the pipeline. is_synthetic
// remains 0 in the error path so callers can use it as a safe default.
export interface MediaDetectionResult {
  is_synthetic: number;
  confidence: number;
  model_id: string;
  latency_ms: number;
  error?: string;
}

// Detector options. timeoutMs is the hard cap on the upstream API call; the
// dispatch pins the default at 10000ms but callers may override per-call
// (for instance, Phase 2 integration tests use a lower timeout). fetchImpl
// is a dependency-injection seam for unit tests; production callers leave
// it undefined to use the global fetch.
export interface DetectorOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export const DEFAULT_DETECTOR_TIMEOUT_MS = 10000;
