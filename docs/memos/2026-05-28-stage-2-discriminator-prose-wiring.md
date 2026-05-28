---
title: Stage 2 discriminator-prose wiring for advance-fee L3 boundary discrimination
date: 2026-05-28
track: policy
authority: design-memo-author (recommends-only; Phase 2 engine wiring is vscode)
predecessor-brief: handoff/board/pending/0048-policy-vscode-advance-fee-stage-2-discriminator-wiring.md
predecessor-memo: docs/memos/2026-05-27-policy-advance-fee-stage-3-discriminator-clarification.md (Path A doc-only)
predecessor-observations:
  - handoff/board/observations/qa-2026-05-27-advance-fee-discriminator-doc-only-clarification-did-not-move-engine.md
  - handoff/board/observations/qa-2026-05-27-co-emit-fixture-20-reinforces-0048-lawyer-fee-noise.md
related-decisions: docs/policy-spec-v5.0.md §9 (decisions log; this memo proposes a new entry for Phase 2 sign-off)
ontology-version: 5.2
schema-version: 5.1
engine-surface: src/lib/safeeval-v5.js SYSTEM_STAGE_2_FAF (lines 703-895)
framing: AI Trust & Safety -- LLM classifier prompt engineering for fraud-typology boundary discrimination
---

# Stage 2 discriminator-prose wiring -- closing the docs-versus-engine seam exposed by brief 0040 Path B

## 1. Problem statement

Brief 0040 Path A (shipped 2026-05-27) sharpened the `method:advance_fee_lawyer_fee` discriminator across three doc surfaces (`docs/08-v5-ontology.md` §3.1, `docs/05-classifier-guidance.md` §3.3.1, `docs/ops/reviewer-sops/envelope-deep-dive.md` §8.2). The clarification established that `method:advance_fee_lawyer_fee` requires *both* (a) a claimed lawyer / barrister / attorney / solicitor persona, AND (b) a net-new legal entitlement (estate distribution, court judgment, foreign-client claim, probate release) the lawyer persona is processing on the target's behalf. Recovery-service personas with retainer-style fees were named as the canonical negative pattern.

Brief 0040 Path B's live-engine verification against `https://safeeval.vercel.app/api/evaluate?v5=1` (qa, 2026-05-27, N=5) plus the brief-0041 co-emission stress fixture (qa, same date, N=1) produced an N=6 evidence set showing the doc-only clarification did not propagate to engine behavior:

| Fixture | Pattern | Expected `method:advance_fee_lawyer_fee` | Actual | Confidence |
|---------|---------|------------------------------------------|--------|-----------|
| 06 | Lawyer persona + estate-process retainer (positive) | FIRES | FIRES | 0.95 -- correct |
| 09 | Recovery-investigator persona + retainer (negative) | NO FIRE | **FIRES** | 0.92 -- noise persists |
| 16 | Recovery-service persona + processing fee (negative) | NO FIRE | NO FIRE | -- cleared (lone clear) |
| 17 | Asset-tracing service + case-opening retainer (negative) | NO FIRE | **FIRES** | 0.88 -- noise persists |
| 19 | Class-action settlement processing + retainer (negative) | NO FIRE | **FIRES** | 0.92 -- noise persists |
| 20 | Nigerian estate attorney + customs fee (co-emit stress) | NO FIRE (third-pretext shape) | **FIRES** | 0.93 -- noise on a structurally adjacent persona |

Four of five recovery-fraud negatives and the new co-emit fixture mis-fire. The block disposition is unaffected (every misfire is still blocked by other firing bright lines), so the operational impact is calibration noise rather than enforcement failure -- but the noise is empirically robust, observed at three structurally distinct pretext shapes, and survived a doc-side clarification that policy authors expected to land. The discriminator clarification has no enforcement surface in the engine prompt path; the closed-set enum delivers L3 candidate values to the model with no per-value discriminator prose constraining when they should fire.

A separate L2-tier drift was also observed on the same four fixtures (all classified L2 = `advance_fee_fraud` (0.99) rather than the expected L2 = `recovery_fraud`). This memo flags that drift for follow-up in §5 but does not adjudicate it; L2 picker behaviour is a different surface from L3 method discrimination.

## 2. Root cause analysis -- why the Path A doc-only clarification did not propagate

The Path A closure note reasoned that because `src/lib/safeeval-v5.js` Stages 2 and 3 contain no advance-fee discriminator prose -- only a bare closed-set enum at lines 274-305 listing the five `method:advance_fee_*` L3 values without per-value description -- there was "no behavior-change opportunity for Path A." That reasoning is literally correct (the engine carries no discriminator prose for these values) but inverts the implication: the absence of discriminator prose in the engine is precisely the problem, not a justification for limiting the fix to docs.

The mechanism by which the doc-only clarification fails to propagate is structural. The Stage 2 system prompt (`SYSTEM_STAGE_2_FAF`, lines 703-895) does deliver discriminator prose for some closed-set vocabularies -- the bright-line `realtime_synthetic_media_executive_impersonation` gets a dedicated paragraph at lines 783-791, the Template / Delivery / Control closed-set values each get one-line descriptors at lines 740-770, and the L2 picker gets a worked example at lines 811-815 -- but the L3 method enum is not in scope for Stage 2 emission at all. Stage 2 emits `l2_probabilities` and `prompt_summary` labels; the L3 method values are emitted at Stage 3 by `SYSTEM_STAGE_3_CLASSIFY` (lines 897-919), which receives the L3 vocabulary via the `emit_classification` tool's enum constraint rather than via system-prompt prose. The tool description references the categories but does not carry per-value discriminator language. The model picks `advance_fee_lawyer_fee` based on lexical co-occurrence (mentions of "retainer", "recovery service", "case-opening fee", and the legal-adjacent vocabulary that surrounds them in the prompt) because nothing in the engine context tells it that the persona-plus-entitlement test is load-bearing.

The Path A doc surfaces (ontology §3.1 prose-to-label, classifier-guidance §3.3.1, reviewer-SOP §8.2) are reference documents for human reviewers and policy authors. They are not engine inputs. The closed-set discipline introduced in v5.0 (and reinforced through the Tier 1 vocabulary work shipped 2026-05-27) gave us countability and lockstep verification, but it did so by stripping per-value semantics from the wire format. That trade-off works well for vocabularies where each value is self-descriptive in name (`method:phishing`, `target:elderly_individual`, `tactic:urgency`); it fails for boundary-sensitive vocabularies where two values share extraction-surface vocabulary and differ structurally on persona-plus-entitlement, as `method:advance_fee_lawyer_fee` versus `L2:recovery_fraud + overlap:secondary_victimization` do.

The pattern -- closed-set enum delivers a candidate value to the model, model picks it on lexical adjacency without applying a discriminator that lives only in docs -- is not unique to this case. It is a general structural seam that any doc-only discriminator clarification will hit if the value sits in a closed-set vocabulary delivered to the engine as a bare enum.

## 3. Proposed architecture for discriminator wiring -- three alternatives

This section weighs three real architectures and recommends one. A memo without alternatives is not a memo; the rejected options below carry rationale strong enough that a future reviewer can re-litigate from the same primitives.

### (a) Per-value descriptor strings appended inline to the L3 enum

Augment the closed-set enum at the point of delivery so each L3 token carries a one-line descriptor. The shape, illustrated for the five advance-fee values:

```
method (single-valued per slot, multi-emit allowed):
  advance_fee_inheritance      -- claimed inheritance / estate-distribution pretext requiring upfront fee.
  advance_fee_lottery          -- claimed lottery / sweepstakes win requiring upfront fee.
  advance_fee_customs          -- claimed customs / clearance fee blocking release of larger sum.
  advance_fee_business_partner -- claimed business partnership requiring upfront capital / fee.
  advance_fee_lawyer_fee       -- claimed lawyer / barrister / attorney persona AND net-new legal
                                  entitlement (estate, judgment, probate) the lawyer is processing
                                  on the target's behalf. Recovery-service personas with retainer-
                                  style fees fail the persona test; classify as L2:recovery_fraud
                                  with overlap:secondary_victimization instead.
```

This is the most uniform architecture: every L3 value gets a descriptor; the enum and the prose are co-located so they cannot drift; lockstep extension is straightforward (`scripts/check-lockstep.js` would verify the descriptor strings match the canonical source per ontology §3.1). The cost is prompt budget. Stage 2's system prompt is already ~3,175 tokens prompt-mode / ~4,280 tokens conversation-mode (per the prompt-caching cost-efficiency brief 0044 measurements). Adding per-value descriptors for all eight L3 categories -- method (25 values), tactic (8), target (15), context_marker (10), overlap (8), arc (5), cadence (2), risk_marker (6) -- would add roughly 700-1,200 tokens to Stage 2's system prompt. With prompt caching wired (commit 558c5c9), the marginal token cost on cache-hit calls is small. But the prompt-injection surface area grows with each descriptor sentence, and the engineering-cost-to-value ratio is high when only a handful of L3 values have empirically observable boundary issues.

### (b) Surgical discriminator paragraph appended to Stage 2 for empirically observed FP hotspots [recommended]

Add a new section to `SYSTEM_STAGE_2_FAF` -- "Discriminator boundaries" -- containing prose for the specific L3 values where boundary discrimination has empirical FP signal in qa audit data. The first iteration targets only `method:advance_fee_lawyer_fee` versus the recovery-fraud pretext shape. Future iterations add other pairs as qa surfaces them. The shape:

```
Discriminator boundaries (apply when emitting the relevant L3 / L2 values):

  method:advance_fee_lawyer_fee requires BOTH (a) the attacker persona is a
  claimed lawyer / barrister / attorney / solicitor / legal-chambers actor
  (named role, named chambers, named bar number, or equivalent legal-profession
  framing) AND (b) the thing the target is claimed to be owed is a net-new
  legal entitlement -- an estate distribution, a court judgment, a foreign-
  client claim, a probate release. Recovery-service / asset-tracing / "recovery
  investigator" / "FTC-licensed recovery investigator" / "romance-fraud
  recovery specialist" / "class-action settlement processing service" personas
  fail condition (a) even when the fee is termed a "retainer" or "case-opening
  fee". Those patterns are L2:recovery_fraud with overlap:secondary_victimization,
  not method:advance_fee_lawyer_fee. The shared word "retainer" is not the
  discriminator; the persona-plus-entitlement pair is.
```

Recommended. This option targets only the L3 values where qa has produced empirical FP evidence, so it adds ~150-250 tokens rather than 700-1,200. The discriminator language is identical to the doc-side canonical source in `docs/08-v5-ontology.md` §3.1 (a deliberate redundancy that becomes a lockstep verification opportunity; see §6). The architecture admits incremental extension: a second boundary pair (for example `method:realtime_synthetic_media` versus pre-recorded `method:deepfake_audio` / `method:deepfake_video`, which already has the discriminator paragraph at lines 783-791 and serves as the precedent) can be added in the same section without reshaping the rest of Stage 2. The surgical scope also avoids prematurely paying the per-value descriptor cost of (a) for boundaries that have not yet been observed to misfire.

The risk of (b) relative to (a) is that the surgical surface implicitly creates a two-tier discrimination regime: a few L3 values get discriminator prose, the rest do not. Future authors may inherit the prose-bearing values without grepping the descriptor body, mirror them inaccurately, or fail to extend the discriminator section when a new FP pattern surfaces. Mitigation: the lockstep rule proposed in §6 verifies that the prompt-side discriminator matches the ontology-side discriminator verbatim (modulo ASCII-safe normalization), which forces engineering attention to the discriminator surface every time the underlying policy text moves.

### (c) Stage 2.5 -- a confirmation-pass LLM call for boundary-sensitive L3 predictions

Insert a new lightweight LLM call between Stages 2 and 3 (or fold into Stage 3 as a re-entrant pass) whose only job is to validate whether the Stage 2 evidence supports the boundary-sensitive L3 predictions that Stage 3 is about to emit. For `method:advance_fee_lawyer_fee` specifically, Stage 2.5 would be handed the Stage 2 evidence (faf_nodes.context.persona, prompt_summary.pretext_label, the bright-line set) and asked: "Does the evidence satisfy both (a) claimed lawyer persona and (b) net-new legal entitlement? Yes / no." Stage 3 then conditions its L3 emission on the Stage 2.5 answer.

Rejected for this iteration. The cost-benefit profile is unfavorable: Stage 2.5 adds a fourth (or fifth, in conversation-mode) round-trip per evaluation, raising per-evaluation latency by ~700-1,200 ms and per-evaluation Anthropic-API cost by the system-prompt + tool-call overhead of one additional call. Prompt caching helps but does not eliminate the marginal cost. The architecture is also overpowered for the observed problem: a single discriminator pair with an empirically narrow miss rate (4 of 5 recovery-fraud fixtures, all at confidence 0.88-0.93) does not warrant a new pipeline stage. (c) becomes worth re-litigating only if (b) demonstrably fails to land the discriminator at acceptable acceptance-criteria thresholds, or if Stage 2 prompt budget becomes the binding constraint and the discriminator-bearing paragraphs cannot fit. Neither is the current state.

## 4. Draft discriminator prose for `method:advance_fee_lawyer_fee`

The exact prose proposed for insertion into `SYSTEM_STAGE_2_FAF`, anchored to the canonical doc-side wording in `docs/08-v5-ontology.md` §3.1:

> **Discriminator boundaries.** `method:advance_fee_lawyer_fee` requires BOTH (a) the attacker persona is a claimed lawyer, barrister, attorney, solicitor, or legal-chambers actor (named role, named chambers, named bar number, or equivalent legal-profession framing) AND (b) the thing the target is claimed to be owed is a net-new legal entitlement -- an estate distribution, a court judgment, a foreign-client claim, a probate release, or a similar legal-process release the lawyer persona is processing on the target's behalf. Recovery-service personas, asset-tracing investigators, "recovery investigator" personas, "FTC-licensed recovery investigator" framings, "romance-fraud recovery specialist" framings, and "class-action settlement processing service" personas fail condition (a) even when the fee is termed a "retainer", "case-opening fee", or "processing fee". Those patterns are `L2:recovery_fraud` with `overlap:secondary_victimization`, not `method:advance_fee_lawyer_fee`. The shared extraction-surface vocabulary ("retainer", "case fee", "processing fee") is not the discriminator; the persona-plus-entitlement pair is.

Word count: ~165 words; token estimate ~210 tokens. Suggested insertion point: after the bright-lines section that ends at line 791 and before the L2 probability map section that begins at line 793. The Stage 2 prompt's existing precedent for per-value discriminator prose (the `realtime_synthetic_media_executive_impersonation` paragraph at 783-791) sits immediately above, and the new section reads as a continuation of the same engineering pattern.

The negative-example list (recovery investigator, asset-tracing service, FTC-licensed recovery investigator, romance-fraud recovery specialist, class-action settlement processing service) is the same list the Path A doc fix added to `docs/08-v5-ontology.md` §3.1. Verbatim mirroring is deliberate: the lockstep rule proposed in §6 will verify this mirror.

## 5. Other L3 values that may need discriminator wiring -- Phase 2 scope candidates

Brief 0048 explicitly scopes Phase 2 to `method:advance_fee_lawyer_fee` only. This memo flags adjacent boundary pairs that qa observation data already suggests may need discriminator wiring; whether to fold any into Phase 2 or queue them as separate follow-ups is an open question for Steven (see §7).

The candidates, ranked by empirical FP signal:

1. **`method:advance_fee_lawyer_fee` versus L2:recovery_fraud + overlap:secondary_victimization.** Primary Phase 2 target; N=5 evidence (fixtures 09 / 17 / 19 / 20 plus the cleared 16). Discriminator prose drafted in §4.
2. **L2 picker drift on recovery_fraud (fixtures 09 / 16 / 17 / 19 classified L2 = advance_fee_fraud at 0.99 not L2 = recovery_fraud).** Adjacent to (1) but a different surface -- this is the Stage 2 L2 probability map (lines 793-822) rather than Stage 3 L3 emission. The Stage 2 system prompt already carries one worked example for the L2 map (the BEC example at lines 811-815). A parallel worked example for the recovery-fraud-versus-advance-fee-fraud boundary would address the same persona-plus-entitlement test at the L2 layer. Pending brief `0035-policy-bright-line-forced-l2-recovery-fraud-drift.md` is the canonical home for this question; not in this memo's adjudication scope.
3. **`method:advance_fee_lawyer_fee` persona discriminator sharpening on "estate attorney" pretext.** Fixture 20's "Nigerian estate attorney" persona structurally satisfies condition (a) of the §4 discriminator (it is a claimed legal-profession persona) and condition (b) is structurally satisfied (estate distribution as the entitlement). The mis-fire here is *not* a discriminator failure in the §4 sense -- it is closer to a co-emission stress test where `method:advance_fee_inheritance` and `method:advance_fee_customs` correctly fire (the canonical co-emit of the fixture's design intent) and `method:advance_fee_lawyer_fee` *also* fires at 0.93 because the legal-attorney persona is genuinely present. Whether this is a true positive (lawyer persona + estate-process role) or a noise emission depends on whether qa intends fixture 20's expected_v5 to allow `method:advance_fee_lawyer_fee` as a third co-emit. Flagged for Steven; the §4 discriminator's persona test does not exclude this case as written.
4. **`method:realtime_synthetic_media` versus `method:deepfake_audio` / `method:deepfake_video`.** The Stage 2 prompt already carries discriminator prose for this pair (lines 783-791); brief 0041's fixture 21 (`tests/golden/case-study-tier-1/21-coemit-realtime-synthetic-media-plus-deepfake-video.json`) reports that all three co-fire (realtime + deepfake_video + bonus deepfake_audio). Whether the deepfake_audio emission is a true positive (audio is genuinely part of the interactive impersonation) or noise has not been adjudicated. Out of scope for this memo; flagged for follow-up.
5. **`overlap:secondary_victimization` Stage 3 false positives on fixtures 01 + 05.** Per the qa audit (P1-3, 2026-05-27), the `overlap:secondary_victimization` tag fires on prompts that do not have a prior-victim pretext. Pending brief `0037-policy-secondary-victimization-false-positive-cleanup.md` is the canonical home. Architecturally adjacent to the `method:advance_fee_lawyer_fee` discriminator (the overlap value travels with the L2:recovery_fraud path that the discriminator excludes from `advance_fee_lawyer_fee`), so a Phase 2 wiring may want to mention it parenthetically; full adjudication is out of scope.

Recommendation: Phase 2 wires the §4 discriminator for `method:advance_fee_lawyer_fee` only. The L2 drift (candidate 2) is a Stage 2 L2 picker question, separately briefed in 0035; the "estate attorney" case (candidate 3) needs an expected_v5 decision from qa before discriminator-text changes can adjudicate it; the deepfake co-emit case (candidate 4) needs a separate observation pass; the secondary_victimization case (candidate 5) is briefed in 0037. Folding any of (2)-(5) into Phase 2 would expand scope past the brief 0048 boundary and is not recommended without explicit Steven sign-off.

## 6. Migration plan for Phase 2 (VS Code venue)

Phase 2 is VS Code venue work per `handoff/README.md` venue rules: it touches `src/lib/safeeval-v5.js`, requires lockstep extension, and includes live-engine verification. The migration plan below is recommends-only; the receiving VS Code session adjudicates implementation details.

### 6.1 Files to touch

`src/lib/safeeval-v5.js`. Single insertion in `SYSTEM_STAGE_2_FAF`, between the bright-lines section (ending line 791) and the L2 probability map section (beginning line 793). Exact text in §4 above. ASCII-safe per the repo's ASCII-safety rule on `.js` files (em dashes already rendered as `--` in §4; smart quotes already rendered as straight quotes).

`scripts/check-lockstep.js`. New lockstep rule (see §6.3 below) verifying the prompt-side discriminator paragraph matches the ontology-side canonical source at `docs/08-v5-ontology.md` §3.1 verbatim. Implementation: extract the discriminator paragraph from each surface; normalize whitespace; assert string equality.

No schema change (the closed-set L3 enum is unaffected). No ontology version bump (the prose lives in the engine surface; the doc-side text was already at ontology 5.2 from Path A). No fixture authoring (the existing 5-fixture matrix from brief 0040 plus fixture 20 from brief 0041 is the acceptance test set).

### 6.2 Test approach

Local: `node tests/runner.js` against fixtures 06 / 09 / 16 / 17 / 19 / 20 to verify the expected pattern (06 fires, 09 / 16 / 17 / 19 do not, 20 deferred pending the candidate-3 decision in §5). Local runner uses temp 0.1 on Stage 2 / Stage 3, so single-run results are subject to ~10-20% variance; a 3-run local sanity pass is recommended before pushing.

Live: `curl POST https://safeeval.vercel.app/api/evaluate?v5=1` against the same six fixtures post-deploy. Single-run live evidence is acceptable for acceptance-criteria sign-off if results match the expected pattern; if any of 09 / 16 / 17 / 19 still mis-fire on first live run, run a second pass to distinguish discriminator failure from sampling variance.

Regression: full 19-fixture case-study-tier-1 sweep against live to confirm no other fixture's L3 emission changed. Particular attention to fixtures 06 (the positive) and any fixture whose envelope already contains `method:advance_fee_*` values.

### 6.3 Acceptance criteria for Phase 2

1. `SYSTEM_STAGE_2_FAF` contains the discriminator-boundaries paragraph from §4, inserted between the bright-lines section and the L2 probability map section, ASCII-safe.
2. Live API run against `https://safeeval.vercel.app/api/evaluate?v5=1` for fixtures 06, 09, 16, 17, 19 produces: 06 fires `method:advance_fee_lawyer_fee`; 09 / 16 / 17 / 19 do not. ≥5 of 6 of {06 fires, 09 no-fire, 16 no-fire, 17 no-fire, 19 no-fire} -- so the acceptance band is "06 must fire AND at least 4 of the 4 recovery-fraud negatives must clear." (Fixture 20 deferred pending the candidate-3 decision in §5.)
3. Full case-study-tier-1 N=19 live sweep confirms no L3-emission regression on fixtures 01-08, 10-15, 18 (the fixtures whose envelopes do not depend on the discriminator).
4. `node scripts/check-lockstep.js` PASS, including the new discriminator-mirror lockstep rule from §6.4.
5. `docs/policy-spec-v5.0.md` §9 decisions-log entry shipped citing this memo + brief 0048 + the N=6 evidence.
6. `npm run build` PASS; CI green; Vercel deploy HTTP 200.

### 6.4 Lockstep implications

The discriminator prose now lives in two surfaces: `docs/08-v5-ontology.md` §3.1 (the canonical policy source) and `src/lib/safeeval-v5.js` `SYSTEM_STAGE_2_FAF` (the engine surface). Without a lockstep rule, these will drift: the next policy author who sharpens the discriminator in the ontology will not know to mirror the change into the engine prompt.

Proposed lockstep rule (`scripts/check-lockstep.js`, new function `checkDiscriminatorBoundaryLockstep`):

> Extract the discriminator-boundaries paragraph from `SYSTEM_STAGE_2_FAF`. Extract the canonical discriminator clarification from `docs/08-v5-ontology.md` §3.1 (the "Discriminator clarification (Stage 3 prose-to-label, 2026-05-27)" paragraph -- amend the section header date if the doc-side text is re-dated). Normalize both to ASCII-safe form, collapse multi-space sequences, trim trailing whitespace. Assert string equality. On mismatch, emit the diff and FAIL with exit code 1.

Implementation alternative: rather than verbatim mirror, extract a structured shape (persona-test bullet, entitlement-test bullet, negative-example list) from both surfaces and assert set equality on the negative-example list plus paragraph-level prose containment for the test bullets. This is more flexible to phrasing drift but harder to specify and harder to debug on failure. Recommend verbatim mirror for v1; revisit if drift between doc-tone and engine-tone proves a recurring friction.

The lockstep rule is a forcing function for an alternative architecture that some authors have raised in adjacent memos: a single source of truth (the ontology) with the engine prose programmatically extracted at build time. See §7 question 3.

### 6.5 Sequencing and venue scope

Phase 2 is single-session VS Code work: one prompt insertion, one lockstep rule extension, one live verification pass, one commit. No worktree isolation (handoff/CURRENT.md must stay valid per `CLAUDE.md`). Standard ship ritual; no parallelism with other vscode dispatches needed.

Phase 3 qa re-verify (per brief 0048 phase structure) is a separate dispatch after Phase 2 ships. Phase 3 runs the same N=6 matrix from a qa-credentialed live-deploy run and closes brief 0048 (and supersedes brief 0040 Path B) on success.

## 7. Open questions for Steven

1. **Architecture choice -- (a), (b), or (c)?** Recommendation is (b) -- surgical extension targeting empirically observed FP hotspots, not blanket per-value descriptors for every L3 value. The rationale is in §3: (b) is the minimum-blast-radius option that addresses the observed problem and admits incremental extension without prematurely paying the per-value descriptor cost of (a) or the per-evaluation-call cost of (c). Confirm or override.

2. **Phase 2 scope breadth -- just `method:advance_fee_lawyer_fee`, or also the adjacent boundary pairs?** Brief 0048 scopes Phase 2 narrowly to the §4 discriminator. The L2 drift (candidate 2 in §5), the estate-attorney persona question (candidate 3), the deepfake co-emit case (candidate 4), and the secondary_victimization FPs (candidate 5) are all flagged but parked. Recommendation: keep Phase 2 narrow; queue the adjacent work as separate follow-up briefs. Confirm or override.

3. **Lockstep regime -- doc-and-engine duplication with verbatim verification, or single-source-of-truth with build-time extraction?** Recommendation (per §6.4) is verbatim duplication with the new `checkDiscriminatorBoundaryLockstep` rule. The alternative -- discriminator prose lives only in the ontology and is programmatically extracted into the engine prompt at build time -- has the advantage of zero drift risk but adds a build step, makes the engine prompt non-obvious to read in source, and complicates ASCII-safety handling (the ontology is UTF-8; the engine surface must be ASCII). Verbatim duplication is the lower-risk choice for v1; the single-source-of-truth architecture becomes worth revisiting if the lockstep rule itself becomes a recurring friction. Confirm or override.

## 8. Decision-log placeholder

A `docs/policy-spec-v5.0.md` §9 decisions-log entry is proposed for Phase 2 sign-off, in the shape:

> **Decision 19 (2026-05-28).** Stage 2 carries per-value discriminator prose for `method:advance_fee_lawyer_fee` (architecture (b) -- surgical extension). The discriminator requires (a) claimed lawyer / barrister / attorney persona AND (b) net-new legal entitlement; recovery-service personas with retainer-style fees are excluded. Lockstep rule `checkDiscriminatorBoundaryLockstep` verifies prompt-side prose mirrors ontology §3.1 canonical source. Evidence base: brief 0048; N=6 fixture matrix (case-study-tier-1 06 / 09 / 16 / 17 / 19 / 20). Architectures (a) per-value-descriptor blanket and (c) Stage 2.5 confirmation pass evaluated and rejected per memo §3.

This entry is placeholder text; the policy-spec amendment lands in VS Code Phase 2 alongside the engine edit, not in this Cowork phase.

## 9. Adversarial review of this memo

What this memo gets right: it engages the structural seam (closed-set enum stripping per-value semantics) rather than treating brief 0040 Path B as an isolated mis-prediction. It draws an explicit line between (a) blanket descriptors, (b) surgical extension, and (c) a new pipeline stage, and it justifies the surgical-extension recommendation on minimum-blast-radius plus precedent (the `realtime_synthetic_media_executive_impersonation` paragraph already establishes the engineering pattern). It surfaces adjacent boundary pairs (§5) without folding them into Phase 2, preserving the brief's scope discipline. It proposes a lockstep rule that prevents the doc-versus-engine drift mechanism from recurring.

What this memo could get wrong: the surgical-extension architecture creates a two-tier discrimination regime (some L3 values get prose, most do not) that future authors must remember to extend when new FP patterns surface. The lockstep rule partially mitigates this -- it forces engineering attention every time the underlying policy text moves -- but the rule cannot detect a *new* boundary that has not yet been added to the discriminator section. The forcing function for adding new boundaries is qa observation data plus operator dispatch discipline, not the lockstep rule. If that discipline lapses, the discriminator section silently rots into incompleteness. (a) does not have this failure mode because every L3 value carries a descriptor by construction; the cost of (a) is paid eagerly.

A second risk: the discriminator prose for `method:advance_fee_lawyer_fee` as written in §4 may not actually move the engine, even with the wiring in place. The Stage 2 -> Stage 3 information flow goes via the Stage 2 `prompt_summary.pretext_label` (closed-set, single-valued) and the L2 probability map, not via per-L3-value prose from Stage 2 to Stage 3. The discriminator paragraph in Stage 2 conditions the model's understanding of the Stage 2 emission (the pretext label, the L2 map), which then feeds Stage 3. If Stage 3's L3 emission is sufficiently lexically driven that the Stage 2 evidence does not weight it, the discriminator may still fail to land. The Phase 2 live-verification gate (§6.3 acceptance criterion 2) is the empirical test; if it fails, the architecture re-opens to consider (c) Stage 2.5 confirmation pass as the next iteration.

A third risk: the L2-tier drift on fixtures 09 / 16 / 17 / 19 (all classified L2 = advance_fee_fraud not L2 = recovery_fraud) is upstream of the L3 discriminator. If the L2 picker is selecting `advance_fee_fraud` on these prompts, Stage 3 receives a forced L2 context that may make `method:advance_fee_lawyer_fee` lexically natural to emit regardless of the discriminator paragraph. The L2 drift work (brief 0035) and this discriminator work may need to be sequenced jointly. Flagged for orchestrator consideration in the Phase 2 dispatch ordering.

---

**End of memo.**

Cross-track posts: vscode inbox (Phase 2 wires this memo's §4 discriminator prose + §6.4 lockstep rule); orchestrator digest (this memo + Phase 2 commit-bounce brief). qa inbox optional (qa's N=6 evidence matrix is preserved verbatim here; no new qa work requested in Phase 1).
