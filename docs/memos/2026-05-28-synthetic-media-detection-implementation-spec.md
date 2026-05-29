# Synthetic media detection -- implementation spec (Demo tier)

**Status:** engineering spec, ready for VS Code execution
**Date:** 2026-05-28
**Author:** `safeeval-policy` (Cowork), via `design:design-handoff` skill
**Scope tier:** Demo (per scoping memo §5.2; adopted `3849510`)
**Companion to:** `docs/memos/2026-05-28-synthetic-media-detection-scoping.md` (the scoping memo this spec executes against), `docs/03-master-policy.md` (existing `realtime_synthetic_media_executive_impersonation` bright-line), `docs/08-v5-ontology.md` §3.3 (existing `method:deepfake_video`, `method:deepfake_audio`, `method:realtime_synthetic_media`), `tests/schema/v5-envelope.schema.json` (the schema delta target), `src/lib/safeeval-v5.js` (the Stage 0 insertion target).
**Out of scope (deferred):** `ai_generated_confirmed` bright-line, video modality, `end_user` audience UI variants. See §11.
**Open questions:** 3 (one `route-to-steven` flagged for architect coordination; two `default-accept`). See §12.

## 1. Overview

This spec converts the Demo-tier scope of the synthetic-media-detection scoping memo into an executable engineering brief. The deliverable is a new `media_artifact` input mode (image + audio) that flows through the existing five-stage v5 pipeline with a single new Stage-0 detector step. The Hugging Face Inference API is the primary detector; Gemini 1.5 Flash is a cost-bounded reasoning fallback that fires only on ambiguous detector scores (0.4-0.6 band). The Anthropic-driven five-stage cascade is unchanged; the new module produces an additional evidence field (`media_detection_result`) that Stage 2 consumes as context and Stage 3 records as a new modifier reason code (`media_likely_synthetic`).

The deliverable does *not* add the `ai_generated_confirmed` bright-line, does *not* add video, does *not* add `end_user`-audience UI, and does *not* change any existing threshold. Those are Full-tier or out-of-scope per the scoping memo.

A hiring reader visiting `safeeval.vercel.app` after this spec ships can drag-and-drop an image or audio file into the upload widget and watch the full v5 pipeline classify it -- with the HF detector score and the Gemini fallback reasoning (where present) shown side-by-side with the existing classification cascade.

## 2. Module layout

### 2.1 New directory: `src/lib/media-detection/`

```
src/lib/media-detection/
  index.ts              -- router by media type; entry point
  image-detector.ts     -- HF Inference API integration for image
  audio-detector.ts     -- HF Inference API integration for audio
  reasoning-layer.ts    -- Gemini 1.5 Flash fallback for ambiguous scores
  types.ts              -- shared type definitions
```

TypeScript is used in this directory rather than the existing repo-wide JavaScript convention. Rationale: the new module has narrow, well-typed contracts at the HF and Gemini API boundaries; typing the boundaries up front prevents the API-shape drift that plagued earlier external-API integrations. The `index.ts` exports a single function that the existing JS engine imports via tsconfig path; no other JS file imports any other TS file in this module. ASCII-safety rules still apply to all `.ts` files; markdown comments use ASCII even in `.ts`.

### 2.2 `types.ts` -- shared contracts

```ts
export type MediaType = 'image' | 'audio' | 'video';

export type MediaArtifact = {
  type: MediaType;
  url_or_base64: string;
  mime_type: string;
};

export type DetectorResult = {
  is_synthetic: number;          // 0.0-1.0 detector score
  confidence: number;            // 0.0-1.0 detector self-reported confidence
  model_id: string;              // HF model identifier, e.g. 'Organika/sdxl-detector'
  raw_response?: unknown;        // pass-through for debugging; not persisted
};

export type ReasoningResult = {
  verdict: 'likely_synthetic' | 'likely_authentic' | 'inconclusive';
  rationale: string;             // 1-3 sentence Gemini-emitted prose
  model_id: string;              // 'gemini-1.5-flash'
};

export type MediaDetectionResult = {
  type: MediaType;
  detector: DetectorResult | { error: string };  // error path: HF unreachable
  reasoning?: ReasoningResult;                   // present only on ambiguous band
  aggregate_is_synthetic: number;                // final 0-1 used by Stage 2/3
  evaluated_at: string;                          // ISO-8601
};
```

### 2.3 `index.ts` -- router

Single exported function:

```ts
export async function detectMedia(
  artifact: MediaArtifact
): Promise<MediaDetectionResult>
```

Behavior:

- Branches on `artifact.type`. `image` -> `image-detector.ts`. `audio` -> `audio-detector.ts`. `video` -> returns `{ error: 'video_modality_not_in_demo_tier' }` (video is Full tier per scoping memo).
- Awaits detector result.
- If `detector.is_synthetic` is in the ambiguous band (0.4-0.6), invokes `reasoning-layer.ts` for the Gemini interpretation. Otherwise skips Gemini entirely.
- Computes `aggregate_is_synthetic` as: detector-only when reasoning not fired; when reasoning fired, the aggregate is a weighted blend (detector 0.6, reasoning verdict mapped to 0.85 / 0.15 / 0.5 for likely_synthetic / likely_authentic / inconclusive, weighted 0.4). The blend coefficients are *implementation calibration*, not policy -- they live in `index.ts` as named constants for easy tuning.
- All exceptions are caught and mapped to `{ detector: { error: '<reason>' }, aggregate_is_synthetic: 0, type, evaluated_at }`. Graceful degradation per §8.3.

## 3. Envelope schema delta

### 3.1 Schema change to `tests/schema/v5-envelope.schema.json`

Existing `input` is a discriminated union over `prompt` and `conversation` (see schema lines 545-590). Add a third arm to the `oneOf`:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["kind", "media_artifact"],
  "properties": {
    "kind": { "const": "media_artifact" },
    "media_artifact": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "url_or_base64", "mime_type"],
      "properties": {
        "type":         { "type": "string", "enum": ["image", "audio", "video"] },
        "url_or_base64": { "type": "string", "minLength": 1 },
        "mime_type":    { "type": "string", "minLength": 1 }
      }
    },
    "prompt_context": { "type": "string" }
  }
}
```

`prompt_context` is the optional surrounding textual frame from scoping memo §3.1 (caption, claimed source, claimed identity). It is preserved verbatim so the existing typology cascade can run against the textual frame in parallel with media classification.

Note: the scoping memo §3.1 used `synthetic_confidence` *inside* the envelope; this spec moves that field out of the envelope and into a separate `media_detection_result` field on the response, because the input envelope should be the *raw* user input and detector output is engine-emitted, not user-supplied. The scoping memo's intent (carry detector signal as evidence) is preserved -- it just lives on the output envelope, not the input envelope.

### 3.2 Response envelope additions

Add to the v5-envelope schema a new optional top-level field `media_detection_result`:

```json
"media_detection_result": {
  "type": "object",
  "additionalProperties": false,
  "required": ["type", "aggregate_is_synthetic", "evaluated_at"],
  "properties": {
    "type":                  { "type": "string", "enum": ["image", "audio", "video"] },
    "aggregate_is_synthetic": { "type": "number", "minimum": 0, "maximum": 1 },
    "evaluated_at":          { "type": "string", "format": "date-time" },
    "detector": {
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["is_synthetic", "confidence", "model_id"],
          "properties": {
            "is_synthetic": { "type": "number", "minimum": 0, "maximum": 1 },
            "confidence":   { "type": "number", "minimum": 0, "maximum": 1 },
            "model_id":     { "type": "string", "minLength": 1 }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["error"],
          "properties": { "error": { "type": "string", "minLength": 1 } }
        }
      ]
    },
    "reasoning": {
      "type": "object",
      "additionalProperties": false,
      "required": ["verdict", "rationale", "model_id"],
      "properties": {
        "verdict":   { "type": "string", "enum": ["likely_synthetic", "likely_authentic", "inconclusive"] },
        "rationale": { "type": "string", "minLength": 1, "maxLength": 500 },
        "model_id":  { "type": "string", "const": "gemini-1.5-flash" }
      }
    }
  }
}
```

The field is optional at the envelope root -- when the input is `prompt` or `conversation`, the field is omitted. When the input is `media_artifact`, the field MUST be present.

Schema version stays at `5.1` per scoping memo §8 open question 5 (additive delta is patch-level; the ontology_version bump is for the engine-wiring dispatch to call, not this spec). The schema constants `schema_version` and `ontology_version` in the existing envelope can remain `5.1`.

## 4. Stage 0 routing

### 4.1 Insertion point in `src/lib/safeeval-v5.js`

The existing Stage 0 branches on input kind around lines 2055-2090 (conversation parse handler) and lines 2224-2275 (the `parseConversation*` helpers). Add a new branch *before* the existing conversation handler:

```js
// Stage 0: media-artifact detection (Demo tier addition, 2026-05-28).
// Routes media-artifact inputs to the media-detection module before the
// existing turn-segmentation / risk-hint logic. Result is attached to the
// pipeline state as media_detection_result and read by Stages 2 and 3.
if (input && input.kind === 'media_artifact') {
  const { detectMedia } = await import('./media-detection/index.js');
  const mdr = await detectMedia(input.media_artifact);
  trace.stage_0 = {
    ok: !mdr.detector || !('error' in mdr.detector),
    model: mdr.detector && 'model_id' in mdr.detector ? mdr.detector.model_id : 'media-detection-router',
    duration_ms: 0,  // populated by detector internals; placeholder shape
    output: mdr,
  };
  // Stash on pipeline state so Stages 2 and 3 read it.
  p.media_detection_result = mdr;
  // Fall through to Stage 1 -- the textual frame (prompt_context) still
  // runs through the existing typology pipeline. The media result is
  // additional evidence, not a short-circuit.
}
```

Key constraint: media detection runs *before* the existing Stage 0 risk-hint logic but does *not* short-circuit the pipeline. The textual `prompt_context` (if present) still goes through Stage 1/2/3/4 as a normal prompt. The media result is supplementary evidence.

### 4.2 Failure semantics

- HF unreachable or timeout -> `media_detection_result.detector = { error: '...' }`, `aggregate_is_synthetic = 0`. Pipeline continues. Stage 2 sees the error field and treats it as "no media evidence available".
- Gemini unreachable or timeout -> reasoning field is omitted; aggregate falls back to detector-only.
- Invalid `mime_type` or unsupported `type` -> detector error path, same as HF unreachable.

No Stage 0 failure routes to `human_review` for the Demo tier (that's a Full-tier disposition rule when the new bright-line lands; see scoping memo §3.2 step 3).

## 5. Detector API integration

### 5.1 Hugging Face Inference API -- image

Recommended model: `Organika/sdxl-detector` (primary). Fallback if unavailable: `umm-maybe/AI-image-detector`. Choice between these is §12 open question (a).

```ts
// image-detector.ts
const HF_INFERENCE_ENDPOINT = (modelId: string) =>
  `https://api-inference.huggingface.co/models/${modelId}`;

const PRIMARY_IMAGE_MODEL = 'Organika/sdxl-detector';

export async function detectImage(
  url_or_base64: string
): Promise<DetectorResult> {
  const token = process.env.HF_API_TOKEN;
  if (!token) throw new Error('HF_API_TOKEN not configured');

  const body = url_or_base64.startsWith('http')
    ? JSON.stringify({ inputs: url_or_base64 })
    : Buffer.from(url_or_base64, 'base64');

  const res = await fetch(HF_INFERENCE_ENDPOINT(PRIMARY_IMAGE_MODEL), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': url_or_base64.startsWith('http') ? 'application/json' : 'application/octet-stream',
    },
    body,
  });

  if (!res.ok) throw new Error(`HF inference failed: ${res.status} ${res.statusText}`);

  // HF image classifier returns [{ label: 'artificial', score: 0.92 }, { label: 'human', score: 0.08 }]
  const data = await res.json() as Array<{ label: string; score: number }>;
  const synthetic = data.find(d => /art|fake|ai|generated|synth/i.test(d.label));
  const is_synthetic = synthetic ? synthetic.score : 0;
  // Confidence proxy: how peaked the distribution is.
  const top = Math.max(...data.map(d => d.score));
  return {
    is_synthetic,
    confidence: top,
    model_id: PRIMARY_IMAGE_MODEL,
  };
}
```

### 5.2 Hugging Face Inference API -- audio

Recommended model (per scoping memo §4): `MelodyMachine/Deepfake-audio-detection-V2`. Same auth header, same endpoint shape:

```ts
// audio-detector.ts
const PRIMARY_AUDIO_MODEL = 'MelodyMachine/Deepfake-audio-detection-V2';

export async function detectAudio(
  url_or_base64: string
): Promise<DetectorResult>
```

Signature and error handling mirror `detectImage`. The audio classifier returns the same `[{ label, score }]` shape; the synthetic-class label regex matches `/fake|spoof|synth|deepfake/i`.

### 5.3 Response normalization

HF model outputs vary slightly between models in label naming. The `synthetic` label detection above uses a regex over canonical synonyms; a model whose synthetic class label does not match any pattern degrades to `is_synthetic = 0` with `confidence` still populated. This is logged as a parsing degradation but does not throw.

### 5.4 Rate limits and retries

No retry logic in v1. The HF free-tier rate limit (~30 req/min) is well above demo traffic; if a request 429s, it surfaces as a detector error. The scoping memo §4 already addresses caching as a future mitigation; that's *not* in the Demo tier (cache hit by media hash is mentioned in scoping memo §3.2 step 1 but the Demo-tier scope does not require it -- defer to Full tier).

## 6. Gemini reasoning fallback

### 6.1 When it fires

Only when `detector.is_synthetic` is in the ambiguous band `[0.4, 0.6]`. The band edges are constants in `reasoning-layer.ts`:

```ts
const AMBIGUOUS_BAND_LOW = 0.4;
const AMBIGUOUS_BAND_HIGH = 0.6;
```

The 0.4-0.6 band differs from the scoping memo's 0.3-0.7 because Demo tier narrows the band to bound cost (Gemini calls have a per-call cost even on free tier; tighter band = fewer fallback firings). The 0.3-0.7 width is for Full tier. This narrowing is §12 open question (b).

### 6.2 Signature

```ts
// reasoning-layer.ts
export async function interpretAmbiguous(
  artifact: MediaArtifact,
  detectorResult: DetectorResult
): Promise<ReasoningResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not configured');

  const prompt = [
    'You are reviewing a media artifact for synthetic-content evidence.',
    `An ML detector scored this artifact ${detectorResult.is_synthetic.toFixed(2)} on a 0-1 synthetic scale (1 = AI-generated).`,
    `Detector confidence: ${detectorResult.confidence.toFixed(2)}. Model: ${detectorResult.model_id}.`,
    'Examine the artifact for visible AI artifacts: smearing, biometric inconsistencies, missing reflections, asymmetric features, audio splicing seams.',
    'Output a verdict (likely_synthetic / likely_authentic / inconclusive) and a 1-3 sentence rationale.',
  ].join('\n');

  // Gemini 1.5 Flash multimodal call -- see https://ai.google.dev/api/generate-content
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            artifact.url_or_base64.startsWith('http')
              ? { fileData: { mimeType: artifact.mime_type, fileUri: artifact.url_or_base64 } }
              : { inlineData: { mimeType: artifact.mime_type, data: artifact.url_or_base64 } },
          ],
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini call failed: ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = JSON.parse(text) as { verdict: string; rationale: string };
  return {
    verdict: parsed.verdict as ReasoningResult['verdict'],
    rationale: parsed.rationale.slice(0, 500),
    model_id: 'gemini-1.5-flash',
  };
}
```

Response is parsed as JSON; malformed JSON throws and triggers the error path (reasoning field omitted from final result).

### 6.3 Cost bounds

Gemini 1.5 Flash free tier is ~1500 requests/day (per scoping memo §4). Ambiguous-band firing rate on a portfolio demo is expected at <10% of total media submissions, so the daily budget supports hundreds of media submissions per day before exhaustion. No additional rate limiting beyond Google's enforced quota in v1.

## 7. Stage 2 and Stage 3 consumption

### 7.1 Stage 2 FAF analysis -- prompt addition

The Stage 2 system prompt currently scores five FAF components from the input prompt text. Add a small section *only when* `media_detection_result` is present and `aggregate_is_synthetic > 0.5`:

```text
ADDITIONAL EVIDENCE -- MEDIA DETECTION:
The input includes a media artifact. An external detector scored it
at <X> on a 0-1 synthetic scale (1 = AI-generated). [Reasoning layer
verdict: <Y>, rationale: <Z>.]  Treat this as supplementary evidence
when scoring trust and evade components. Do NOT treat a high score
as a bright-line override; the existing impersonation context
requirement still applies for the realtime_synthetic_media bright-line.
```

The bracketed reasoning section appears only when the reasoning field is present. The score-and-rationale substitution is performed in the engine just before the Stage 2 call.

**This is a lockstep touch.** The Stage 2 prompt is the canonical FAF analysis prompt; changing it requires running `scripts/check-lockstep.js` GREEN before merge. This is flagged in §12 open question (c) for architect coordination.

### 7.2 Stage 3 reason codes -- new modifier

Add to the Stage 3 reason-code vocabulary a new entry:

```
media_likely_synthetic   -- modifier, secondary
```

Wiring: Stage 3 emits this reason code as a secondary modifier when `media_detection_result.aggregate_is_synthetic > 0.6`. The threshold (0.6) is intentionally lower than a bright-line threshold; the modifier is informational and contributes to disposition reasoning via the existing modifier mechanism, not via override.

No new `method:` value is added (scoping memo §3.3: existing `method:deepfake_video`, `method:deepfake_audio`, `method:realtime_synthetic_media` cover this scope unchanged).

No bright-line `ai_generated_confirmed` is added (Demo tier defers this to Full per scoping memo §5.3).

### 7.3 No Stage 4 change

Stage 4 rule cascade is unchanged. The new modifier reason code is consumed by the existing rules; no new disposition rule is added.

## 8. Tests

Tests use Vitest (existing convention). Three test files:

### 8.1 Unit -- `tests/media-detection/unit-detector.test.ts`

- Mock `fetch` to return canned HF responses (synthetic-high, synthetic-low, malformed).
- Assert `detectImage` and `detectAudio` map the responses to the expected `DetectorResult` shape.
- Assert error paths: missing token throws; 4xx/5xx surfaces as thrown error; malformed JSON degrades to `is_synthetic = 0`.

Fixture for synthetic-high HF response:
```json
[{ "label": "artificial", "score": 0.92 }, { "label": "human", "score": 0.08 }]
```

Fixture for synthetic-low:
```json
[{ "label": "artificial", "score": 0.04 }, { "label": "human", "score": 0.96 }]
```

Ambiguous fixture (triggers Gemini in integration test):
```json
[{ "label": "artificial", "score": 0.51 }, { "label": "human", "score": 0.49 }]
```

### 8.2 Integration -- `tests/media-detection/integration-pipeline.test.ts`

- Construct a `media_artifact` envelope with a sample image fixture.
- Mock HF + Gemini at the network boundary; run the full v5 pipeline.
- Assert: response envelope includes `media_detection_result`; the existing classification fields are still populated (textual frame from `prompt_context` still classified); Stage 2 prose evidence reflects the media result when score > 0.5.
- Three scenarios: obviously-AI image (`is_synthetic = 0.92`), obviously-real image (`is_synthetic = 0.04`), ambiguous (`is_synthetic = 0.51` -> Gemini fires).

### 8.3 Graceful degradation -- `tests/media-detection/degradation.test.ts`

- Mock HF to reject every call (network unreachable, 503, timeout).
- Assert: pipeline still completes; `media_detection_result.detector = { error: '...' }`; classification + disposition still emitted from the textual frame; no exception bubbles to the API response.
- Same test for Gemini failure on ambiguous-band path: reasoning omitted, detector value used as aggregate.

### 8.4 Schema validation

Existing `tests/schema/validate-envelope.test.ts` (or equivalent) extended with two new fixtures:

- `fixture-media-image.json` -- envelope with image media_artifact + media_detection_result.
- `fixture-media-audio.json` -- envelope with audio media_artifact + media_detection_result.

Both validate against the extended schema.

### 8.5 Regression safety

Existing fixture sweeps (the `tests/fixtures/*.json` corpus) MUST continue to pass unchanged. None of those fixtures use `media_artifact`; the new branch is dormant when the input kind is `prompt` or `conversation`.

## 9. Demo tier UI surface

### 9.1 Upload widget on `safeeval.vercel.app`

Add a drag-and-drop + paste upload zone above (or beside) the existing prompt textarea. Accepts:

- Image: `image/png`, `image/jpeg`, `image/webp` (max 5 MB per file)
- Audio: `audio/mpeg`, `audio/wav`, `audio/webm` (max 5 MB per file)

The widget is exclusive with the textarea -- a user submits either a prompt OR a media artifact, not both simultaneously. (The `prompt_context` field is reserved for future Full-tier scope where the textual frame accompanies the media; in Demo tier the user provides one input mode at a time.)

### 9.2 Result rendering

The existing result card renders `classification`, `disposition`, `evidence`, `prompt_summary`. Add a new section above the existing result card:

```
+-- Media detection ---------------------------------------+
| Type: image (image/png, 1.2 MB)                          |
| Detector: Organika/sdxl-detector                         |
| Synthetic confidence: 0.92                               |
| [Reasoning: gemini-1.5-flash -- likely_synthetic         |
|  "Visible smearing around eyes and facial asymmetry      |
|  consistent with diffusion-model artifacts."]            |
+-----------------------------------------------------------+
```

The reasoning block appears only when the ambiguous-band fallback fired.

Below the media-detection section, the existing result card renders normally (classification, disposition, etc.).

### 9.3 Framing copy

Per scoping memo §6 framing requirement, the upload widget's empty state includes:

> SafeEval ingests external detector signals as evidence for fraud classification.
> SafeEval does not detect deepfakes; it applies its fraud policy framework once
> a detector has scored an artifact.

This copy is required boilerplate, not optional. UI changes that remove it fail design review.

### 9.4 Out-of-scope UI

- No `end_user` audience variant (scoping memo: deferred to Full tier; this Demo tier surfaces the same UI to all visitors).
- No admin queue for reviewing flagged media.
- No rate-limit indicator (scoping memo R4 mitigation is caching, deferred to Full).

## 10. Environment variables

### 10.1 Required additions

Add to `.env.example` (and document in repo README):

```
# Hugging Face Inference API token for synthetic-media detection.
# Free tier: ~30 req/min. Get yours at https://huggingface.co/settings/tokens.
HF_API_TOKEN=

# Google AI Studio API key for Gemini 1.5 Flash reasoning fallback.
# Free tier: ~1500 req/day. Get yours at https://aistudio.google.com/app/apikey.
GEMINI_API_KEY=
```

### 10.2 Distinction from `ANTHROPIC_API_KEY`

`ANTHROPIC_API_KEY` continues to be the credential for all 5 stages of the existing engine (Stages 1-5 all use `claude-sonnet-4-6`). The new variables are *only* for the new media-detection module:

- `HF_API_TOKEN` -> Stage 0 detector call (image, audio).
- `GEMINI_API_KEY` -> Stage 0 reasoning fallback (ambiguous band only).
- `ANTHROPIC_API_KEY` -> Stage 1, 2, 3, 4, 5 (unchanged).

No existing flow is repointed to Gemini or HF. Their introduction is additive.

### 10.3 Vercel configuration

Both new variables MUST be added to Vercel project env settings (production + preview) before the deploy that includes this change. Missing either variable surfaces as a detector error in the response envelope (graceful degradation per §8.3), not as a build failure.

## 11. Out of scope (Demo tier explicit deferrals)

Per scoping memo §5.2 and §5.3 boundary:

- **`ai_generated_confirmed` bright-line.** Deferred to Full tier. Requires `docs/03-master-policy.md` amendment, which routes through `policy-author` and `classifier-translator` in a separate dispatch.
- **Video modality.** Deferred to Full tier. The `index.ts` router returns an error for `type: 'video'` to keep the contract honest -- no silent fallback to image frames.
- **`end_user` audience UI variant.** Deferred. All visitors see the same media-detection result card.
- **Production-grade rate limiting.** Deferred. HF and Gemini free-tier limits are the only governors; demo failure mode under burst traffic is detector-error rendering, not queueing.
- **Admin UI for reviewing flagged media.** Deferred. The portfolio demo is read-only from a moderator's perspective; there is no flagged-queue.
- **Caching by media hash.** Mentioned in scoping memo §3.2 step 1 as a free-tier mitigation; deferred from Demo tier to Full because the Demo traffic profile does not exhaust quota.
- **Ollama documented alternative.** Scoping memo §4 deployment-guide entry; deferred from this spec to Full tier.

## 12. Acceptance criteria

A merge candidate is ready to ship when ALL of the following hold:

1. **Pre-flight lockstep GREEN.** `scripts/check-lockstep.js` exits 0. Stage 2 prompt change in §7.1 is the only lockstep delta.
2. **New schema validates.** `tests/schema/validate-envelope.test.ts` GREEN on the two new fixtures (`fixture-media-image.json`, `fixture-media-audio.json`).
3. **Existing fixture sweep unaffected.** All existing `tests/fixtures/*.json` evaluations produce identical outputs to pre-change baseline. Regression-safe.
4. **Sample image fixture routes correctly.** One obviously-AI-generated fixture -> `aggregate_is_synthetic > 0.7`, `media_likely_synthetic` modifier emitted. One obviously-real fixture -> `aggregate_is_synthetic < 0.3`, no `media_likely_synthetic` modifier.
5. **Gemini fallback fires on ambiguous case.** A fixture mocked to return `is_synthetic = 0.51` triggers a Gemini call (verified via mock invocation counter); the response envelope's `media_detection_result.reasoning` field is populated.
6. **Graceful degradation verified.** HF unreachable -> `media_detection_result.detector = { error: ... }`, pipeline completes, classification and disposition emitted from textual frame.
7. **ASCII-safe.** All `.ts` and `.js` files in `src/lib/media-detection/` and the Stage 0 edit pass the repo ASCII check (no em dashes, smart quotes, non-ASCII).
8. **Vercel build GREEN.** Post-merge deploy verifies HTTP 200, prompt evaluation works, no build errors. Media upload widget renders.
9. **Framing copy present.** Upload widget empty state includes the §9.3 boilerplate verbatim.

## 13. Open questions for Steven

Per the fifth atomic amendment escalation-field convention (`docs/memos/2026-05-24-parallel-cowork-tracks.md` §6), each open question carries an inline `escalation:` field.

1. **HF model choice -- `Organika/sdxl-detector` or `umm-maybe/AI-image-detector` as primary image detector?** `escalation: default-accept, rec: Organika/sdxl-detector as primary because it specifically targets the diffusion-model output that dominates 2024-2026 deepfake imagery; fallback to umm-maybe only if Organika is unavailable on HF Inference API at deploy-time`. Routine implementation choice; no public-artifact change at this layer.

2. **Gemini fallback confidence band -- 0.4-0.6 (Demo) or scoping memo's 0.3-0.7 (Full)?** `escalation: default-accept, rec: 0.4-0.6 for Demo tier to bound Gemini cost; widen to 0.3-0.7 in a future Full-tier amendment if quota headroom permits`. The Demo narrowing is a cost-bounding decision, not a policy decision.

3. **Stage 2 prompt edit scope -- does adding the media-evidence section to the Stage 2 prompt cross the lockstep gate, and if so, who coordinates the lockstep refresh?** `escalation: route-to-steven, reason: Stage 2 prompt is the canonical FAF analysis surface; any prompt edit touches the lockstep validator and may require coordination with the architect (tracks-architect SOP for Stage 2 prompt changes is not codified in this spec's scope)`. Recommendation: dispatch the prompt edit as a separate small brief routed through `arch:` so the lockstep refresh is owned by the architect rather than the implementation dispatch.

The one `route-to-steven` question (Stage 2 prompt scope) is the pause point before the architect coordination -- the implementation can proceed on schema, detector module, Stage 0 routing, and UI in parallel; the Stage 2 prompt edit waits for §13.3 adjudication.

## 14. Closure (for the dispatch shipping this spec)

This memo is the implementation spec. The deliverable is the memo itself; no schema is yet changed, no engine code yet touched, no UI yet wired. Downstream of Steven's adjudication on §13.3 (Stage 2 prompt scope), the next dispatch is the VS Code execution -- module scaffold, schema delta, Stage 0 routing, detector integration, UI widget, tests -- per the venue-boundary rules in `handoff/README.md`.

The commit-bounce brief for this memo is filed at the next available pending ID per the venue-rules. The bounce-brief scope is single-file: commit and push `docs/memos/2026-05-28-synthetic-media-detection-implementation-spec.md`; no lockstep delta, no schema delta, no build delta.

**Open questions enumerated:** 3 (§13).
**Of which `route-to-steven`:** 1 (Stage 2 prompt edit scope, §13.3).
**Of which `default-accept`:** 2 (HF model choice §13.1; Gemini band §13.2).
