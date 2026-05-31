# Video detection -- Wave 2 scoping

Date: 2026-05-30
Status: Proposed (scoping only -- not yet scheduled)
Author: SafeEval VS Code build venue (dispatched)

## Context

Wave 1 converged the Evaluator's separate Image and Audio tabs into a single
"Synthetic media" tab (one drop zone, MIME auto-routing to the existing image /
audio detectors). The whole point of that convergence was to stop leaking a
developer's model-by-model mental model into the UI: a user wants to know "is
this AI-generated?" and should not have to pick which detector runs.

Wave 2 extends that same surface to a third media type -- video -- without
adding a new tab. A user drops an MP4 the same way they drop a PNG or a WAV; the
file is routed to a video detector and the verdict comes back in the same
result envelope. This memo scopes that work. It does not schedule it and does
not commit any dependency -- the implementing session will own those calls.

This is a scoping memo: it evaluates alternatives, makes a recommendation where
the brief pre-adjudicated one, and leaves the genuinely open questions (section
6) un-adjudicated for the implementing venue / policy track to decide.

## 1. Goal

Let users upload video files to the same `/evaluator?mode=media` surface (the
unified Synthetic media tab shipped in Wave 1) and get a deepfake / synthetic
verdict back, rendered in the same result card as image and audio results.

No new tab. Video joins images and audio inside the one drop zone -- the file
kind is auto-detected from MIME (`video/*`) exactly as `image/*` and `audio/*`
are today via `detectMediaKind` in `src/app/evaluator/page.js`.

## 2. Approach options with tradeoffs

### Option A -- Keyframe extraction + existing image classifier

Extract one frame per second locally inside the serverless function (ffmpeg),
then run each frame through the existing HF `Organika/sdxl-detector` via the
`router.huggingface.co` endpoint the image detector already uses. Aggregate the
per-frame synthetic-likelihood scores into a single verdict.

Aggregation strategy is itself a decision. Options:

- max -- most sensitive; one strongly-synthetic frame flips the whole video.
  Highest recall, but a single false-positive frame poisons the verdict.
- mean -- smoothest; dilutes a real deepfake whose artifacts are concentrated
  in a few frames (e.g. a face-swap visible only when the subject turns).
- trimmed mean (drop top/bottom decile) -- a reasonable middle: resists single
  outlier frames in both directions. This is the recommended aggregation if
  Option A is ever taken.

Pros: reuses existing infra (same endpoint, same auth, same response shape, same
result envelope); cheap (roughly $0.01 per video at one frame/sec); no new
Anthropic-side dependency.

Cons: not temporal-aware. Deepfakes that exploit motion or lip-sync, rather than
per-frame texture artifacts, are only caught insofar as individual frames look
wrong. Adds an ffmpeg binary dependency to the serverless function (cold-start
weight + a layer/build step), which is exactly the kind of dependency Wave 1
avoided.

### Option B -- Gemini multimodal video (RECOMMENDED)

A single Gemini 2.5 Flash call with the video as native multimodal input. The
model evaluates the video holistically and returns a synthetic-vs-authentic
judgment, which maps directly to the result envelope's confidence.

Cost: roughly $0.006-$0.01 per 5-minute video, at $0.075 / 1M input tokens and
about 263 tokens/sec of video. Marginal cost is effectively zero if Gemini is
already paid for in the reasoning layer (the media-detection reasoning fallback
already calls Gemini -- see `src/lib/media-detection/reasoning-layer.ts`).

Pros: one API call; cleanest architecture; no ffmpeg / no binary dependency;
temporal-aware (the model sees motion, not just isolated frames); reuses the
Gemini wiring the reasoning layer already established.

Cons: not a specialized deepfake model -- it is a general multimodal LLM, so its
synthetic-media discrimination is a side capability, not a trained classifier
head. Confidence calibration for this specific task is unknown and must be
validated against a labelled corpus before the verdict is trusted as more than
indicative.

### Option C -- Dedicated video deepfake API (Sensity, Reality Defender)

A purpose-built third-party deepfake API. Production-grade accuracy, $0.10-$1.00
per video.

Pros: best accuracy; built for exactly this.

Cons: cost is 10-100x Options A/B; vendor dependency + a new env var/secret;
and it undercuts the portfolio narrative ("I built this from scratch") by
outsourcing the core judgment to a black-box vendor. Overkill for portfolio
scope.

### Adjudication

Recommend Option B (Gemini multimodal) for portfolio scope. It is the cleanest
architecture, has effectively zero marginal cost given the reasoning layer
already pays for Gemini, adds no binary dependency, and is temporal-aware.

Fallback: if Gemini's classification quality proves insufficient when validated
against a labelled corpus, fall back to Option A (keyframe + image classifier,
trimmed-mean aggregation). Option C is explicitly out of scope for portfolio.

## 3. Vercel constraints

The hard constraint is the serverless function request-body limit: 4.5MB. A
5-minute 1080p video is 100-500MB -- it cannot be POSTed through `/api/evaluate`
the way image and audio uploads are today (those stay well under the cap; see
the size-cap note in `src/lib/media-evaluator/upload.ts`).

Solution: direct client-to-storage upload (Vercel Blob), then process the video
from its URL server-side. The browser uploads straight to Blob storage; the API
route receives only the resulting URL, not the bytes, so the 4.5MB body limit
never binds.

Vercel Blob pricing: about $0.015/GB stored and $0.04/GB egress.

Portfolio scope cap: 30 seconds / 50MB / 720p. That keeps per-video storage and
egress negligible while still demonstrating the full pipeline. The memo should
document the production-scale pattern (chunked/resumable upload, lifecycle
expiry on the blob, signed URLs) even though portfolio scope does not build it.

## 4. Detection contract

Video results use the same envelope shape as image and audio so the result card
renders them identically (disposition / verdict, confidence, model attribution
-- see `deriveMediaVerdict` in `src/lib/media-evaluator/verdict.ts` and the
`MediaResult` component in `src/app/evaluator/page.js`).

New field: `media_type: "video"` (extend the existing `media_type` rather than
inventing a parallel field; the route's `handleMediaUpload` already carries
`media_type` through to the artifact). `detectMediaKind` in the page gains a
`video/*` -> `video` branch.

Aggregation strategy: under Option B there is no aggregation -- the single
Gemini score maps directly to the envelope confidence. (Aggregation only exists
under the Option A fallback, where the trimmed-mean of per-frame scores becomes
the confidence.)

## 5. Implementation phases

Each phase is sized at one focused session (roughly 50-100 turns).

- Phase 1 -- Vercel Blob upload pipeline. Client-side direct upload to Blob;
  API route accepts a blob URL and fetches the video server-side; URL-based
  detection plumbing end to end with a stub detector returning a fixed verdict.
- Phase 2 -- Gemini video call. Wire the real Gemini 2.5 Flash multimodal call
  into the media-detection module (alongside the existing image / audio
  detectors and the reasoning layer), returning the standard envelope.
- Phase 3 -- UI. Add `video/*` to the accepted MIME types in the unified
  Synthetic media tab and a `video/*` branch to `detectMediaKind`, plus a
  `<video>` preview element. No new tab -- that was the whole point of Wave 1.
- Phase 4 -- Tests + lockstep. Unit coverage for the video branch of
  `detectMediaKind`, the envelope shape, the upload guard's video caps, and the
  source-wiring assertions; `npm run check-lockstep` green; `tsc` clean.

## 6. Open questions (not pre-adjudicated)

These are genuine decisions for the implementing venue / policy track, not
recommendations to ratify here:

- Storage provider: Vercel Blob vs S3 vs Cloudflare R2 -- pick one.
- Maximum video duration cap: 30s, 60s, or 5min?
- Second-opinion audio: whether to extract the video's audio track separately
  and run it through the existing audio detector for a corroborating verdict.
- Refusal handling: what to render when Gemini declines to classify (e.g. the
  video trips its own content filters) -- surface an error verdict, fall back to
  Option A, or both?
- Cost cap / abuse control: rate limiting per user/session for video uploads,
  given video is the most expensive media type to store and process.

## 7. Cost projections

Portfolio scope: 5-20 videos/month x ~$0.01 = essentially free (well under $1).
Blob storage/egress at the 50MB cap is similarly negligible at this volume.

At-scale (documented for completeness, not built): 1,000 videos/day x ~$0.01 =
about $10/day = ~$300/month in inference, before Blob egress. Egress at 1,000 x
50MB/day is ~50GB/day x $0.04 = ~$2/day = ~$60/month. So roughly $360/month all
in at 1K videos/day -- the point being that the architecture scales linearly and
predictably, not that portfolio scope incurs it.

## 8. Non-goals

- Real-time video stream classification (live feeds).
- Frame-level temporal-artifact forensics (optical-flow / blink-rate analysis).
  Out of scope for portfolio quality.
- Fine-tuning a dedicated video deepfake model.
