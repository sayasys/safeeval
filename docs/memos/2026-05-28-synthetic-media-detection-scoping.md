# Synthetic media (deepfake) detection input -- scoping memo

**Status:** draft, recommends-only (memo proposes; no schema changes, no engine code, no bright-line additions applied)
**Date:** 2026-05-28
**Author:** `safeeval-policy` (Cowork), via `safeeval-agents:design-memo-author` (mode A)
**Companion to:** `docs/03-master-policy.md` (bright-line `realtime_synthetic_media_executive_impersonation`), `docs/08-v5-ontology.md` §3.3 method values (`deepfake_video`, `deepfake_audio`, `realtime_synthetic_media`), `docs/threat-models/09-ai-enabled-abuse.md`, `docs/threat-models/03-phishing-spearphishing.md`, `docs/policy-reviews/2026-06-case-study-analysis.md` (case 4 / Arup deepfake-CFO), `docs/memos/2026-05-24-parallel-cowork-tracks.md` §6 closure ritual + fifth atomic amendment escalation-field convention.
**Scope:** define the input-plumbing policy and architecture for a new `media_artifact` input mode that ingests image / video / audio with per-modality synthetic-confidence scores from an external detector and routes the result through SafeEval's existing fraud classifier. The detector itself is out of scope -- this memo is about what SafeEval does *with* a detector signal, not how to build one. Three scope tiers (MVP / Demo / Full) are sketched for Steven's adjudication.

## 1. Problem statement

Synthetic-media-enabled fraud is the FBI IC3's highest-growth attack surface since 2023, but SafeEval today cannot ingest detector signal of any kind. The existing ontology already recognizes synthetic media as a fraud surface in three ways: (a) bright-line `realtime_synthetic_media_executive_impersonation` in `docs/03-master-policy.md`; (b) L3 method values `deepfake_video`, `deepfake_audio`, and `realtime_synthetic_media` in `docs/08-v5-ontology.md` §3.3; (c) the worked case-study case 4 / Arup deepfake-CFO incident in `docs/policy-reviews/2026-06-case-study-analysis.md`. What is missing is the input surface -- SafeEval accepts `prompt` and `conversation` modes only, both text-shaped. A user (or hiring reader) cannot upload an image, video clip, or audio sample today and watch the pipeline apply its existing synthetic-media policy to it.

This memo proposes the input plumbing -- a new `media_artifact` input mode, an envelope-schema extension carrying per-modality `synthetic_confidence` scores, Stage 0 routing for detector calls, and Stage 2/3/4 engine consumption rules -- so the existing ontology becomes operational against media inputs. The portfolio value is the policy framework around detection, not the detector. A hiring reader looking at SafeEval today sees text-only classification of text-described fraud; this scope makes the existing synthetic-media policy visible end-to-end against the modality those policies were written for.

The proposal is intentionally low-precision. The detector is a third-party signal; SafeEval's job is to consume the signal as evidence and apply policy. Reduction of detector false-positive rate is not in scope and would be a separate ML/CV project. The framing language SafeEval uses throughout must reinforce that distinction: *SafeEval ingests detector signals as evidence; SafeEval does not detect deepfakes*.

## 2. Real fraud landscape -- citations

The case for prioritizing this scope rests on three real incident clusters, each already documented in established taxonomies:

- **Arup Hong Kong deepfake-CFO BEC, January 2024 -- approximately USD 25M loss.** A finance employee was directed in a multi-participant video conference where the CFO and several colleagues were deepfaked, interacting in real time. The target was the only authentic human on the call. This case is the canonical worked example for `method:realtime_synthetic_media` in the ontology and is the most-cited 2024 deepfake-fraud incident in financial-crime reporting. SafeEval already documents this case (case-study analysis 2026-06 §4.6 recommendation 2) but has no way to evaluate a media artifact against it; the policy fires only on textual prompts describing such a scheme.

- **Voice-cloning vishing -- US primary election cycle 2024.** Robocalls in New Hampshire impersonated then-President Biden's voice telling Democratic voters not to vote in the primary. The cloning quality required less than 30 seconds of source audio. FCC ruled AI-generated voices in robocalls illegal under TCPA shortly after (February 2024). The pattern -- short source audio, cloned voice, automated outbound dialing -- is now the canonical romance-scam and elder-fraud vishing template per FBI IC3 2024 reporting.

- **FBI IC3 2024 annual report on synthetic-media trend.** The Internet Crime Complaint Center publicly characterized AI-enabled fraud as the "fastest-growing" category in its 2024 reporting, citing combined losses from BEC + romance + investment fraud where synthetic media was the operational method. The specific year-over-year growth figure varies by quarter and methodology, so this memo cites the directional characterization rather than a specific percentage.

These three clusters span SafeEval's existing typologies (BEC for Arup; political / civic-engagement abuse for the Biden robocall; romance + elder fraud for IC3's aggregate trend). The existing ontology covers each cluster textually; this scope makes the same coverage applicable when the input *is* the synthetic artifact.

## 3. Architecture proposal -- three layers

### 3.1 Layer 1: Envelope schema additions

Add a new input mode `media_artifact` alongside existing `prompt` and `conversation` modes. The envelope shape is:

```
{
  "input_mode": "media_artifact",
  "artifact": {
    "modality": "image" | "video" | "audio",
    "uri": "<media URI or content-hash>",
    "synthetic_confidence": 0.0-1.0,
    "detector_provenance": "<detector name + version>",
    "detector_confidence_calibration": "calibrated" | "uncalibrated" | "unknown"
  },
  "prompt_context": "<optional textual frame, e.g. caption, claimed source, claimed identity>"
}
```

The required fields are `modality`, `uri`, and `synthetic_confidence`. The optional `detector_provenance` field names which detector produced each score; the optional `detector_confidence_calibration` flag captures whether the detector self-reports its calibration quality (some HF models publish ROC curves; others do not). The `prompt_context` field is the existing text-mode envelope's payload, carried over so the pipeline can apply existing typology classification to the surrounding textual framing -- the impersonation context, claimed identity, victim-targeting language, etc.

Video and audio artifacts may carry per-segment sub-scores at the implementation's discretion (e.g. per-frame for video, per-window for audio). The required envelope field is the aggregate per-modality score; sub-scores are an implementation detail that does not change the schema's external contract.

The schema extension is *additive* against current envelope v5.2; no existing field is removed or renamed. Existing `prompt` and `conversation` modes remain unchanged. The ontology_version bump for this change is left as an open question in §8 (whether the additive media-mode warrants 5.3 promotion or a 5.2.x patch bump).

### 3.2 Layer 2: Stage 0 routing

`media_artifact` mode triggers an upstream detector call before Stage 1 classification. The Stage 0 detector-call shape:

1. **Cache hit by media hash.** If the artifact's content hash matches a recently-scored artifact, reuse the cached `synthetic_confidence`. This is both a free-tier rate-limit mitigation and a determinism aid (identical input always produces identical engine input downstream).
2. **Cache miss, detector available.** Invoke the configured detector(s) per modality; populate `synthetic_confidence` and `detector_provenance`; proceed to Stage 1.
3. **Cache miss, detector failure (timeout, network error, quota exceeded).** Route to `human_review` with reason code `detector_unavailable` (queued for the parallel reason-codes work; the §3.13 vocabulary in `docs/08-v5-ontology.md` is the natural home and the specific code-name is for that vocabulary's owner to choose -- candidates: `detector_unavailable`, `media_artifact_detector_failure`). Do not silently proceed without a score; the policy framework depends on the detector signal as evidence and a missing signal is itself a defensible reason to escalate to human review rather than guess.
4. **Detector low-confidence band (synthetic_confidence in [0.3, 0.7]).** The score is flagged as evidence in the envelope but does not force disposition on its own. The engine consumes it as one input among others; the cascade reaches disposition based on the full evidence aggregate. This middle band is exactly where the policy framework adds value beyond the detector -- the detector is unsure, but the surrounding textual frame (impersonation, urgency, payment instructions) may resolve the uncertainty in either direction.

### 3.3 Layer 3: Engine consumption

The existing four-stage cascade (Stage 1 typology, Stage 2 FAF component scores, Stage 3 L3 method routing, Stage 4 rule cascade to disposition) absorbs the new signal at each of three stages:

- **Stage 2 FAF.** The `synthetic_confidence` value contributes evidence weight to the relevant component scores. Primary contributions: `trust` (synthetic media as impersonation of a trusted identity attacks the trust component directly), `evade` (deepfaked impersonation is a deliberate evasion of identity-verification trust signals). Secondary contribution: `lure` (synthetic media is often the lure -- the believable hook -- in romance, investment, and recovery-fraud variants). The exact weights are implementation-time calibration, not memo-time; the policy claim is which components are touched, not the numeric coefficients.

- **Stage 3 L3 routing.** The existing `method:deepfake_video`, `method:deepfake_audio`, and `method:realtime_synthetic_media` values apply unchanged. The Stage 3 router selects between them based on modality (`image` and `video` modalities map to `method:deepfake_video` for static-frame and pre-recorded video respectively; the `realtime_synthetic_media` value continues to require the interactive turn-taking signal from `prompt_context`, not from the artifact alone). `audio` modality maps to `method:deepfake_audio`. No new L3 values are required for this scope.

- **Stage 4 rule cascade and bright-line evaluation.** The existing bright-line `realtime_synthetic_media_executive_impersonation` continues to require the impersonation context to fire -- a high synthetic confidence score on a random AI-generated marketing image is not the same fraud surface as a synthetic image-of-the-CFO accompanying a wire-transfer request, and the existing bright-line's contextual gating is correct. This memo proposes a *new* bright-line `ai_generated_confirmed` that fires when `synthetic_confidence > 0.85` regardless of textual context. The disposition floor on the new bright-line is `human_review` -- not `block`. The justification: a high-confidence detector signal on synthetic content is always worth a reviewer's attention even when no impersonation context is named, because the absence of context may itself be evidence (e.g. an artifact uploaded with no caption that turns out to be a deepfake of a public figure is worth review even if no fraud frame accompanies it). The new bright-line is included as an *optional* component of the Full scope tier per §5; it is deferred entirely for the MVP and Demo tiers.

## 4. Free / low-cost detector options for the demo

Three real candidate detectors / detector layers are publicly available mid-2026 and cost-compatible with a portfolio demo:

- **Hugging Face Inference API** is the recommended primary signal for the demo. Public deepfake-detection models on the HF Hub include image-detection models such as `umm-maybe/AI-image-detector` and `dima806/ai_vs_real_image_detection`, and audio-detection models such as `MelodyMachine/Deepfake-audio-detection-V2`. Free-tier rate limit is approximately 30 requests per minute per token; sufficient for a portfolio demo and for development. Both image and audio detection are covered in the free tier; no video-detection HF model is robust enough to recommend as primary signal today, so video is handled by N-frame sampling through the image detector (see scope tiers, §5).

- **Google Gemini 1.5 Flash** free tier (approximately 1500 requests per day mid-2026) is the recommended fallback / reasoning layer. Gemini is not a purpose-built deepfake detector and should not be the primary signal, but it accepts image and video input and can be prompted to describe AI artifacts visible in the image (smearing, missing reflections, biometric inconsistencies). Use it as a reasoning layer when the primary detector returns a medium-confidence score (0.3-0.7 band per §3.2) -- the Gemini explanation becomes evidence prose in the envelope's `signals` array, complementing the numeric score.

- **Ollama with Llama 3.2 Vision (or a successor local model)** is the recommended documented-alternative for users who prefer fully-local inference. No API limits, no third-party network call, no API key. The requirement is a consumer GPU with sufficient VRAM (8GB minimum, 12GB recommended for video segmentation). Document this as the privacy-preferring deployment option rather than the default; the demo defaults to HF + Gemini to minimize setup friction.

**Recommended stack for the demo:** image detector via HF (primary), Gemini Flash (reasoning fallback on medium-confidence band), Ollama (documented privacy alternative). Video is handled by sampling N frames through the image detector and aggregating per-frame scores into a per-clip score (weighted by frame variance; defer the specific aggregation function to implementation). Audio is the HF audio classifier directly. Each layer emits a 0-1 score in its own native space; final per-modality `synthetic_confidence` is the weighted aggregate. Weights are calibration-time decisions, not memo-time decisions.

## 5. Scope tiers -- Steven adjudicates

Three scope tiers are offered, each with a dispatch-count estimate so the work is sized against the existing roadmap:

### 5.1 MVP tier -- 2-3 dispatches

- Envelope schema extension only: add `media_artifact` input mode with the §3.1 fields.
- POST endpoint accepts the new envelope; no UI changes.
- HF image detector wired as Stage 0 detector; image modality only.
- Stage 2 FAF component-score consumption against existing weights (no new component-score logic).
- Stage 3 routing maps `image` modality to `method:deepfake_video` (with prose noting that single-image is the static-frame case).
- Stage 4: existing bright-line and disposition rules apply unchanged; new `ai_generated_confirmed` bright-line *not* in scope at this tier.
- No reason-code mapping in scope (deferred to the parallel reason-codes wiring brief).

This tier is the minimum-viable input plumbing. A hiring reader can POST a base64-encoded image and watch the existing typology pipeline classify the surrounding text frame against an HF-scored artifact. The synthetic-media policy is exercised but not extended.

### 5.2 Demo tier -- 4-6 dispatches

Everything in MVP, plus:

- Audio modality (HF audio detector).
- Simple upload UI (drag-and-drop + paste) on the existing SafeEval page; the UI shows the per-modality `synthetic_confidence` score and the engine's cascade output side-by-side, so a hiring reader sees the *policy logic* end-to-end (detector says X; engine reads X as evidence; bright-line fires Y; disposition is Z).
- Gemini Flash wired as the reasoning fallback for the 0.3-0.7 band.
- Reason-code mapping for `detector_unavailable` (cross-dispatch with the reason-codes wiring brief).

This tier is the recommended scope tier for the portfolio demo -- it makes the policy framework visible end-to-end against real artifacts, exercises both modalities the ontology already names, and lands the Gemini reasoning layer that distinguishes SafeEval's approach (multi-signal aggregation with policy on top) from the naive "did the detector say yes" framing.

### 5.3 Full tier -- 7-11 dispatches

Everything in Demo, plus:

- Video modality (N-frame sampling through the image detector with per-clip aggregation).
- Ollama documented alternative (deployment guide entry; no code changes required if HF interface is abstracted properly).
- New bright-line `ai_generated_confirmed` per §3.3 (requires `docs/03-master-policy.md` amendment; routes through `policy-author` and `classifier-translator`).
- Full reason-code mapping for the new bright-line and the detector-unavailable case.
- L3 vocabulary review for whether a new `method:cheapfake` value is warranted -- see §8 open question 4.

This tier is the most thorough scope. It is also the most material-touching: the new bright-line is a public-artifact change (it lands in `docs/03-master-policy.md`) and the new L3 value (if adopted) lands in `docs/08-v5-ontology.md`. Per the fifth atomic amendment escalation field convention in `docs/memos/2026-05-24-parallel-cowork-tracks.md`, both decisions floor to `route-to-steven`.

**Recommendation:** Demo tier (§5.2). The marginal value of Full over Demo is concentrated in the new bright-line, which is a separable amendment that can ship later without rework. Demo is the sweet spot between portfolio visibility and dispatch budget.

## 6. Portfolio framing -- AI T&S

The framing language throughout the deliverable must position SafeEval as a policy-framework demonstration, not a detector. A hiring policy analyst at an AI Trust & Safety org cares whether the candidate can:

- *Write policy for what happens when synthetic media is detected* -- the bright-line definition, the disposition floor, the evidence-handling rules, the human-review escalation criteria, the reason codes.
- *Reason about detector signal as one input among many* -- weighting, calibration, fallback layers, low-confidence-band handling.
- *Defend the framing against scope-creep questions* -- when is the system the detector vs. the policy layer? How does the framework degrade gracefully when the detector is wrong?

The deliverable's value proposition is the policy framework around detection, not the detector itself. UI copy, README copy, and any external comms must reinforce this distinction. Recommended framing language for the upload UI:

> SafeEval ingests external detector signals as evidence for fraud classification.
> SafeEval does not detect deepfakes; it applies its fraud policy framework once a
> detector has scored an artifact.

This framing is also the liability mitigation per §7 R3 -- SafeEval is not positioned as authoritative on synthetic-media identification, so misclassification of a legitimate AI-generated artifact as fraud does not implicate SafeEval as a detection authority.

## 7. Risk assessment

- **R1: Detector false positives on legitimate AI-generated content.** AI-generated marketing imagery, AI-assisted art, and AI-generated illustrative content are routinely scored high-synthetic by purpose-built detectors. A naive bright-line on `synthetic_confidence > 0.85` would auto-escalate every AI-generated marketing image to human review even when no fraud context is present. Mitigation: the existing bright-line `realtime_synthetic_media_executive_impersonation` already encodes the contextual gate (impersonation + fraud frame); preserve that gate. The proposed new bright-line `ai_generated_confirmed` (Full tier only) routes to `human_review` rather than `block` -- review is the right disposition for high-confidence synthetic content of unknown context, and a reviewer can reach `allow` quickly when the context is benign.

- **R2: Detector false negatives on adversarial deepfakes.** State-of-the-art deepfakes increasingly evade off-the-shelf detection; adversarial deepfakes are specifically designed to score low on common detectors. Mitigation: low precision is acceptable for the portfolio demo and documented as a known limitation. The framing language (§6) does not position SafeEval as authoritative; the demo's value is the policy framework, which behaves correctly even when the detector misses. If a deepfake artifact scores low-synthetic, the surrounding textual frame (impersonation, urgency, wire-transfer instructions) still fires the existing typology classification via `prompt_context`. The detector's false negative is the detector's failure, not the policy framework's.

- **R3: Liability if SafeEval is positioned as an authoritative deepfake detector.** A misclassification (legitimate artifact flagged as deepfake; deepfake artifact flagged as legitimate) could expose SafeEval to a liability claim if the framing positions SafeEval as the authority. Mitigation: framing language at every user-facing surface -- the upload UI copy, the result card copy, the README, the policy-spec text -- consistently reinforces that SafeEval consumes detector signal as evidence and is not the detector. The §6 boilerplate is the canonical phrasing.

- **R4: Free-tier rate limits in production demo if traffic spikes.** Hugging Face Inference API free tier is approximately 30 requests per minute; Gemini Flash free tier is approximately 1500 per day. A portfolio demo that gets unusual traffic could exhaust either limit mid-day. Mitigation: cache `synthetic_confidence` by media content hash (per §3.2 step 1), so identical artifacts uploaded multiple times do not re-query the detector. Document the rate limits in the upload UI's empty state. If a request fails the rate limit, the Stage 0 detector-failure path (§3.2 step 3) routes to `human_review` with the same reason code as other detector failures.

- **R5: Privacy / PII concerns if uploaded artifacts contain identifying content.** A user uploading a video clip may inadvertently expose a real person's face / voice / likeness to the detector and to any logging the demo retains. Mitigation: do not persist uploaded artifacts beyond the immediate request lifecycle; store only the content hash and the score in any caching layer. Document the no-retention guarantee in the upload UI. The Ollama alternative (§4) is the strict-privacy deployment option for users who do not want any artifact to leave their machine.

## 8. Open questions -- escalation field per fifth atomic amendment

Per the closure-report convention codified as the fifth atomic amendment in `docs/memos/2026-05-24-parallel-cowork-tracks.md` §6, each open question carries an inline `escalation:` field marking the question for routine auto-accept (`default-accept`) or for Steven's adjudication (`route-to-steven`). The three framework-level always-escalate triggers (adversarial-review self-flag, public-artifact materiality, project-boundary crossing) floor the field regardless of track confidence.

1. **Scope tier selection -- MVP, Demo, or Full?** `escalation: route-to-steven, reason: product scope decision touching public-artifact materiality (the upload UI is hiring-reader-visible)`. The §5 recommendation is Demo; Steven adjudicates.

2. **New bright-line `ai_generated_confirmed` -- include in this scope or defer?** `escalation: route-to-steven, reason: bright-line addition is a public-artifact material change (lands in docs/03-master-policy.md) and triggers always-escalate per §6.X clause 2`. Included only in Full tier per §5.3; Steven adjudicates whether to keep it scoped that way or to lift it earlier.

3. **Detector default choice -- HF Inference, Gemini, or Ollama as primary signal?** `escalation: default-accept, rec: HF Inference as primary signal for image and audio modalities; Gemini Flash as reasoning fallback on the medium-confidence band; Ollama documented as the privacy-preferring alternative`. Recommendation is the §4 stack; no public-artifact change at this layer; routine product-implementation choice.

4. **New L3 `method:cheapfake` for low-effort manipulations -- include or defer?** `escalation: default-accept, rec: defer to a future scope-tier expansion`. Cheapfakes (cheap edits, miscaptioned authentic media, recontextualized authentic clips) are arguably a different fraud surface from deepfakes -- the artifact may be entirely authentic but the *framing* is fraudulent. The existing `context_marker:` mechanism in §3.4 may already cover this case (a miscaptioning is a framing claim, not an artifact manipulation), so adding a separate L3 value risks the four-dimension conflation the 2026-05-27 four-dimension-ontology-separation memo just resolved. Default is to defer; if cheapfake-specific cases arise in case-study analysis, revisit then.

5. **Ontology version bump for the schema extension -- patch (5.2.x) or minor (5.3) promotion?** `escalation: default-accept, rec: defer to the engine-wiring dispatch and align with the prevailing ontology_version state at that time`. The schema extension is additive (no field removed or renamed), which sits at the patch-bump threshold under the 5.2 -> 5.2.1 precedent in the pipeline-optimization §7 amendment-log entry. The actual decision belongs to the dispatch that ships the schema change, not to this scoping memo.

6. **Reason-code mapping integration -- block on the pending reason-code work or duck-type integrate?** `escalation: default-accept, rec: integrate at the Demo tier per §5.2 (reason code naming aligns with the §3.13 vocabulary in the pipeline-optimization brief 0063); the actual reason-code name (detector_unavailable vs media_artifact_detector_failure) is for the §3.13 vocabulary owner to call`. No cross-project boundary crossed.

The three `route-to-steven` questions (scope tier, new bright-line, plus the implicit framework decision in question 5 if the bump is contested) are the ones that should pause auto-chaining; the four `default-accept` questions can proceed once the route-to-steven calls are made.

## 9. Alternatives considered + rejected

- **A. Build a custom deepfake detector in-house.** Rejected. This is an ML/CV research project, not a policy project. The hiring readers the deliverable is targeted at do not care whether SafeEval can outperform Hugging Face on deepfake detection; they care whether SafeEval can write the policy for what happens when one is detected. Building a detector also conflicts with the framing in §6 -- positioning SafeEval as a detector creates liability per §7 R3 without adding portfolio signal. The detector-as-third-party-input architecture is the same architecture used by every real AI Trust & Safety stack inside major platforms; mirroring that architecture is itself a portfolio signal.

- **B. Use Claude or GPT-4 Vision as the primary detector.** Rejected. General-purpose multimodal models are not purpose-built deepfake detectors. They can reason about visible AI artifacts (smearing, biometric inconsistencies, missing reflections) and are useful as a reasoning layer on the medium-confidence band, but they are not calibrated for deepfake detection specifically and will both miss adversarial deepfakes and hallucinate AI artifacts on legitimate content. The §4 architecture uses Gemini Flash as the reasoning fallback layer rather than as the primary signal exactly because of this distinction. A purpose-built detector (HF) is the primary signal; the multimodal model is the reasoning augmentation.

- **C. Skip detection entirely and rely on a user-reported "this is a deepfake" flag.** Rejected. A user flag is too low-signal for the policy framework to be defensible -- the user's claim becomes input to the cascade, but the cascade has no way to evaluate the claim, so the bright-line either always fires (anyone can mark anything as a deepfake) or never fires (the flag is purely advisory). Neither failure mode demonstrates the policy framework's value. The detector signal -- even a low-precision one -- gives the framework an external anchor to apply policy against, which is the entire point of the scope.

- **D. Build the detection layer as a standalone microservice / sidecar.** Rejected for this scope (worth revisiting at a Full+ tier). A sidecar architecture would isolate detector calls from the main classification pipeline, which is technically clean but adds operational complexity (deployment, monitoring, latency budget) that exceeds the portfolio demo's scope. The HF Inference API serves the same isolation purpose at zero operational cost. If SafeEval ever migrates to a production posture (which is out of scope per the deliverable's framing), a sidecar may be the right shape; for the portfolio demo it is overengineering.

- **E. Treat synthetic-media detection as a new typology rather than as an input plumbing extension.** Rejected. The four-dimension-ontology-separation memo (2026-05-27) established that typology, persona, pretext, and context-marker are separate dimensions and that synthetic-media-as-method is a *method* dimension (`method:deepfake_video` etc.), not a typology dimension. The existing ontology is correct; this scope is plumbing, not a typology addition. Creating a new typology would re-conflate exactly the four dimensions the prior memo just separated.

## 10. Decisions-log entry (for docs/policy-spec-v5.0.md section 9)

Not applicable. This memo is scoping / input-architecture scope, not a FAF-policy decision in the §9 sense (typology / sub-typology / bright-line / threshold / L1/L2/L3 enum / disposition-rule change). If the Full scope tier is adopted and the new bright-line `ai_generated_confirmed` lands, *that* dispatch produces a §9 entry via `policy-author` and `classifier-translator`; the §9 entry is downstream of the bright-line decision, not of this scoping memo. The decisions this memo enumerates are product-scope and architecture-shape decisions, which sit in the design-memo layer and do not promote to §9.

## 11. Adversarial review

The reviewer this section is written for is Steven reading the memo with a hiring-reader frame: does the scope solve the stated problem, or does it add a feature surface that distracts from the policy framework?

- **"The detector signal is the load-bearing part; the policy framework is decoration on top of an HF API call."** Strongest version of the framing-collapse critique. Response: the policy framework is exactly what distinguishes this from a wrapped HF endpoint -- the cascade's consumption of the score as evidence (not as disposition), the bright-line gating (impersonation context required for the existing bright-line), the human-review escalation criteria, the reason-code emission, the low-confidence-band handling, and the multi-signal aggregation are all policy decisions visible nowhere in the underlying detector. A hiring reader looking at the demo sees the score and immediately sees what the policy framework *does* with the score; the score by itself is not interesting. If the framing in §6 is enforced consistently across surfaces, the policy-vs-detection distinction is the visible value.

- **"The new bright-line `ai_generated_confirmed` reinvents the existing bright-line's failure mode -- a high-confidence score on synthetic-but-benign content auto-escalates legitimate use."** Strongest version of R1. Response: the §3.3 disposition floor on the new bright-line is `human_review`, not `block`. Review is the right disposition for high-confidence synthetic content of unknown context; reviewer reaches `allow` quickly when context is benign. The cost of the false-positive escalation is one reviewer-minute, not a blocked legitimate use. The existing bright-line's contextual gating is preserved unchanged for the impersonation case; the new bright-line covers only the "high-confidence synthetic but no context provided" gap, which today maps to `allow` by default and arguably should not. That said: the Full tier is the only tier that adopts the new bright-line, and the scope-tier recommendation in §5 is Demo (which excludes the new bright-line). If Steven prefers Demo, this risk is moot for the initial ship.

- **"The scope is over-engineered for a portfolio demo; MVP would ship faster and demonstrate the same point."** Strongest version of the scope-rightsizing critique. Response: MVP is genuinely viable and explicitly offered as §5.1. The case for Demo over MVP is the upload UI -- without UI, a hiring reader has to read the README to understand what `media_artifact` mode does; with UI, the policy framework is visible at first glance. The 2-3 vs 4-6 dispatch delta is the upload UI plus the audio modality plus the Gemini reasoning layer; each component independently adds visible policy-framework signal. If dispatch budget is tighter than expected, MVP is a defensible fallback.

- **"The framing in §6 is wishful -- a hiring reader who sees the demo will conclude SafeEval is positioning itself as a detector regardless of what the boilerplate says."** Strongest version of R3. Response: this is a real concern and the mitigation depends on the framing being enforced *consistently* at every surface -- not just the upload UI but the result card, the README, and any external comms. If the framing slips on any one surface (e.g. the README describes SafeEval as "detecting deepfakes"), the framing is broken everywhere. The mitigation is review discipline at copy ship-time; the convention is the right one even if enforcement is the failure mode.

## 12. Closure (for the dispatch shipping this memo)

This memo is a scoping memo. The deliverable is the memo itself; no schema is changed, no engine code is touched, no bright-line is amended. Downstream of Steven's adjudication on §8 question 1 (scope tier), the next dispatch is the schema extension brief (or, if Full is adopted, the bright-line amendment first via `policy-author` and `classifier-translator`).

The commit-bounce brief for this memo is filed at the next available pending ID per the venue-rules. The bounce-brief scope is single-file: commit and push `docs/memos/2026-05-28-synthetic-media-detection-scoping.md`; no lockstep delta, no schema delta, no build delta.

**Open questions enumerated:** 6 (questions 1, 2, 3, 4, 5, 6 in §8).
**Of which `route-to-steven`:** 2 (scope tier, new bright-line).
**Of which `default-accept`:** 4 (detector choice, cheapfake L3, version bump, reason-code integration).
