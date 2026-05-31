// Media-detection surface, Phase 1 + Phase 2 type definitions.
//
// The implementation spec is at
//   docs/memos/2026-05-28-synthetic-media-detection-implementation-spec.md
// and the upstream scoping memo is at
//   docs/memos/2026-05-28-synthetic-media-detection-scoping.md
//
// Phase 1 landed: the envelope schema delta (media_artifact +
// media_detection_result optional top-level fields), this module skeleton, the
// Hugging Face Inference API integration for image and audio detectors, the
// video stub, and unit tests.
//
// Phase 2 lands: Stage 0 routing wire-up in src/lib/safeeval-v5.js, the
// Gemini 2.5 Flash reasoning fallback on the ambiguous detector-score band
// (0.4-0.6), and Stage 3 reason-code emission of media_likely_synthetic when
// the configurable threshold trips. Per Steven's Q1 adjudication the Stage 2
// FAF prompt is NOT touched in Phase 2 (deferred out of Demo tier);
// media_detection_result is consumed via reason-code emission only.
//
// Out of scope for Phase 2:
//   - Upload widget UI on the Vercel app (Phase 4)
//   - ai_generated_confirmed bright-line (deferred per scoping memo section 5.2)
//   - Real HF / Gemini integration tests against live endpoints (Phase 4)
//
// The types below mirror the schema delta in
// tests/schema/v5-envelope.schema.json $defs.media_artifact and $defs.
// media_detection_result. The reasoning sub-field and reason_codes_emitted
// list are the Phase 2 additive shape; both are optional so a Phase 1
// detector-only envelope still validates.
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

// Phase 2 verdict vocabulary emitted by the Gemini reasoning layer. The
// vocabulary is closed and matches Steven's locked adjudication on Q3:
// `likely_synthetic`, `likely_real`, `still_ambiguous`. Stage 3 reads the
// verdict alongside the numeric is_synthetic score; `likely_synthetic`
// triggers media_likely_synthetic emission even when is_synthetic alone
// sits below the configurable threshold.
export type ReasoningVerdict = 'likely_synthetic' | 'likely_real' | 'still_ambiguous';

// Phase 2 reasoning sub-result. Populated only when the base detector's
// is_synthetic score lands inside the ambiguous band [0.4, 0.6] AND the
// GEMINI_API_KEY env var is configured. On Gemini failure (timeout,
// non-2xx, malformed JSON, schema-validation rejection) the layer returns
// verdict='still_ambiguous' with the failure surfaced in `reasoning` and
// confidence=0, so the caller still gets a populated record rather than an
// exception.
export interface ReasoningResult {
  verdict: ReasoningVerdict;
  confidence: number;
  reasoning: string;
  model_id: string;
}

// Phase 1 + Phase 2 result shape. Mirrors the schema delta one-for-one. The
// error field is set when the detector was unreachable, rejected the input,
// or returned a malformed response -- downstream stages MUST treat a present
// error field as "no media evidence" and continue the pipeline. is_synthetic
// remains 0 in the error path so callers can use it as a safe default. The
// reasoning sub-field (Phase 2 additive) is present only when the base
// detector landed in the ambiguous band and the Gemini fallback ran. The
// reason_codes_emitted list (Phase 2 additive) carries the modifier reason
// codes the engine attached -- `media_likely_synthetic` per ontology
// section 3.13.
export interface MediaDetectionResult {
  is_synthetic: number;
  confidence: number;
  model_id: string;
  latency_ms: number;
  error?: string;
  reasoning?: ReasoningResult;
  reason_codes_emitted?: string[];
}

// Detector options. timeoutMs is the hard cap on the upstream API call; the
// dispatch pins the default at 10000ms but callers may override per-call
// (for instance, Phase 2 integration tests use a lower timeout). fetchImpl
// is a dependency-injection seam for unit tests; production callers leave
// it undefined to use the global fetch. skipReasoning (Phase 2) lets the
// caller opt out of the Gemini fallback even when the score lands in the
// ambiguous band -- useful in unit tests that want pure detector behavior.
export interface DetectorOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  skipReasoning?: boolean;
}

export const DEFAULT_DETECTOR_TIMEOUT_MS = 10000;

// Phase 2 ambiguous-band constants. The base detector calls the Gemini
// reasoning fallback only when is_synthetic in [AMBIGUOUS_BAND_LOW,
// AMBIGUOUS_BAND_HIGH] AND GEMINI_API_KEY is set. The 0.4-0.6 width is the
// Demo-tier narrowing of the scoping memo's 0.3-0.7 band; widening to 0.3-0.7
// is the Full-tier amendment per implementation spec section 6.1.
export const AMBIGUOUS_BAND_LOW = 0.4;
export const AMBIGUOUS_BAND_HIGH = 0.6;

// Phase 2 default Stage 3 emission threshold. When
// media_detection_result.is_synthetic exceeds this value, OR when the
// reasoning verdict is `likely_synthetic`, the engine emits the
// media_likely_synthetic secondary reason code per ontology section 3.13.
// The threshold is configurable via the MEDIA_SYNTHETIC_THRESHOLD env var
// so production tuning can shift the surface without a code edit.
export const DEFAULT_MEDIA_SYNTHETIC_THRESHOLD = 0.5;

// Phase 2 reason code constant. Keep as a literal export so the engine can
// reference it without re-declaring the string. Closed-set; the value must
// match the ontology section 3.13 secondary table row byte-for-byte.
export const REASON_CODE_MEDIA_LIKELY_SYNTHETIC = 'media_likely_synthetic';
