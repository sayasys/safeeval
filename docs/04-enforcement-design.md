# Enforcement Design
**SafeEval - Document 04 of 06**
*Version 5.0.1 - May 2026*

---

## 1. What this document is

This is the enforcement architecture for the SafeEval fraud and scams pipeline. The audience is a fraud-policy reviewer who wants to know how a prompt gets from "raw text submitted to an API" to "decision the platform will act on" without reading the code. The goal of the next ten minutes is for you to be able to argue about the trade-offs, not just describe them.

The headline decision is this. SafeEval v5 replaces the v4.0 single-call classifier with a four-stage pipeline. v5.0 originally reserved an optional fifth adversarial-review stage; v5.0.1 removed it once the policy contradiction it could produce -- downgrading a non-negotiable bright-line block on a re-argument -- was identified and judged unacceptable. The role Stage 5 was filling (re-arguing borderlines) is now covered by the deterministic `low_l2_confidence_review` rule at Stage 4, which routes Stage 3 outputs below the L2 confidence threshold to `human_review` without a second model call. The pipeline is built around three convictions: classification and disposition are different questions and should be answered separately; obvious benign traffic should not pay the cost of deep analysis; and the riskiest dispositions are the ones most likely to be wrong, so they deserve to be routed to human review on explicit uncertainty rather than re-argued by another model call.

Everything below explains how that shape supports those convictions, and where the architecture deliberately makes a worse trade so a more important one can be made better.

---

## 2. The pipeline at a glance

The pipeline runs in four stages:

1. **Stage 1 - Triage (Haiku).** A cheap routing pass that decides whether the prompt looks plainly benign, plainly worth a deeper look, or somewhere in between. Stage 1 is never allowed to block. The short-circuit-to-allow path is gated on a measured Haiku benign-precision floor (see Section 9).
2. **Stage 2 - FAF Deep Analysis (Sonnet).** The substantive policy call. This is where the Fraud Analysis Framework (CONTEXT / PROCESS / OBJECTIVE) is applied: component scores are assigned, bright lines are flagged, process flags are emitted, and L2 probabilities are produced. This is the closest analogue to the entire v4.0 system.
3. **Stage 3 - Classification (Sonnet).** Translates evidence into the v5 envelope: an L1 domain (closed, mutually exclusive), an L2 risk pattern (closed, constrained by L1), and a multi-valued L3 tag set (open, categorized as method / tactic / target / context_marker / overlap / risk_marker). L3 tags carry per-assignment confidences.
4. **Stage 4 - Disposition (rules first, then Sonnet on unhandled cases).** Applies deterministic rules against the evidence to choose one of four actions: `allow`, `safe_completion`, `human_review`, or `block`. When a rule decides, the reasoning summary is generated from the rule + evidence (no second "did the rule decide correctly?" model loop). When no rule fires, the model adjudicates and emits the action plus reasoning. Disposition is final at Stage 4.

Each stage has a narrow remit and a narrow output schema. The pipeline never asks one stage to do two jobs.

v5.0 reserved a Stage 5 adversarial-review slot. v5.0.1 removed it -- see Section 6.

---

## 3. Why four stages instead of one

The four questions the pipeline is asking are not the same question asked four times. They have different cost-accuracy curves, and conflating them is the main thing v4.0 gets wrong.

Stage 1 is a routing question. The cost of being wrong is small in either direction: a false benign gets caught at Stage 2, a false suspicious wastes one Haiku call. Haiku is cheap and fast, and a high-confidence benign verdict at this stage saves three downstream Sonnet calls. That is where the cost advantage of the whole architecture comes from: in mixed traffic, a meaningful fraction of prompts never need the deeper stages at all.

Stage 2 is a policy question. The cost of being wrong is large in both directions, the evidence is rich, and the prompt deserves the most capable model with the most context. This is where the FAF lives.

Stage 3 is a translation question. The hard work is already done at Stage 2; Stage 3 maps evidence into a stable, closed-enum envelope that downstream consumers can program against. The structural value comes from constraining the model with tool-use schemas so it literally cannot emit an L2 value that does not exist. This eliminates a class of parsing errors that no single-call architecture can prevent.

Stage 4 is an enforcement question, and enforcement should be deterministic where it can be. A bright-line feature must always force a block. An aggregate score over a threshold must always force a block. A benign L1 with a low aggregate must always allow. None of these decisions should depend on whether the model felt confident this morning. Stage 4 runs the rules first; the model only writes the human-readable summary on rule-fired cases and adjudicates the cases no rule decided. The rule cascade also includes two explicit-uncertainty rules -- `multi_risk_marker_review` (two or more risk-marker L3 tags with no bright lines route to human review) and `low_l2_confidence_review` (L2 confidence below the threshold routes to human review). Together those rules absorb the case for an inline adversarial stage: borderline cases route deterministically to human review without a second model call.

---

## 4. What each stage decides, and what it deliberately does not

The narrowness of each stage is not an accident. It is the part of the design that holds together under load.

**Stage 1 decides routing. It does not decide enforcement.** Triage produces an L1 candidate, a confidence, and a coarse context. If `l1_candidate == "benign"` and `l1_confidence >= 0.92` and the coarse context surfaces no risk markers, the pipeline short-circuits to `allow` and stops. In every other case, Stage 1 hands off to Stage 2 with a hint. Stage 1 is structurally incapable of producing a `block` or a `human_review`. This means a Haiku miscalibration cannot escalate a benign prompt to a punitive action.

**Stage 2 decides evidence. It does not assign the final disposition.** The Sonnet call here produces the entire `evidence` block: the FAF nodes, the component scores (target, lure, trust, extract, evade, each 0-3), the aggregate score, the bright-line list, the process flags, the L2 probabilities. Stage 2 is allowed to flag any of the bright-line features, but it does not decide what happens next. Separating evidence from action is what makes the pipeline auditable: you can change disposition policy without re-running the model.

**Stage 3 decides classification. It does not invent evidence.** Stage 3 sees prompt, Stage 1 output, and Stage 2 evidence, and emits the `classification` object: L1 + confidence, L2 + confidence, and a list of L3 tags each with their own confidence. The L2 value is constrained by the L1 value (an L1 of `cyber_intrusion` cannot have an L2 of `romance_fraud`). Stage 3 is also constrained by Stage 2: if `evidence.bright_lines` contains `mfa_or_otp_harvesting`, the L2 must come from {`credential_theft`, `account_takeover`}. These constraints live in code, not in model instruction. The model cannot forget them.

**Stage 4 decides disposition. The model is the smaller half of this stage.** Rules run first, in the order documented in `policy-spec-v5.0.md` Section 6.1. Any bright line forces `block` -- and the resulting block is marked non-negotiable in the audit trail via `disposition.triggered_by.policy_note`, so no downstream consumer or future stage can read the output as "tentative." The one narrow exception is **Rule 1.5** (`bright_line_with_defender_framing_routes_to_review`), inserted between the bright-line rule and the aggregate-score rule and scoped to the two AI-Enabled-Abuse bright-lines (`prompt_injection_payload`, `ai_model_impersonation`) only: when the envelope carries a defender-framing L3 conjunction (an `academic_research` / `defensive_analysis` / `authorized_pentest_claimed` context_marker plus `authorization_unverifiable` and no operationalization markers), the disposition routes to `human_review` rather than `block`, the bright-line evidence is retained in `triggered_by.bright_lines` for audit, and a `policy_note` records the routing. The carve-out is bounded by ontology vocabulary alone and does not introduce a new disposition verb (see Section 5). An aggregate score of at least 10 forces `block`. An aggregate of at most 3 with L1 = `benign` forces `allow`. L1 = `ambiguous_dual_use` defaults to `human_review`. L1 = `security_education` with no bright lines maps to `safe_completion`. Two or more risk-marker L3 tags route to `human_review`. L2 confidence below the threshold also routes to `human_review`. Only cases that fall through the full cascade reach the model, which then chooses among the remaining actions. The `disposition.triggered_by` field records which rule fired and which evidence supported it, which is the audit artifact a reviewer needs to defend the action later. The model is asked to write reasoning_summary and narrative_summary; on rule-fired cases the action is locked before the model runs.

**Stage 4 model-unavailable fallback.** When the Stage 4 model adjudication is unavailable (timeout, API failure, malformed response), the pipeline does not fail the request. It emits the disposition the deterministic rule cascade would have produced, with `reasoning_summary = "Model unavailable; rule-derived disposition."` and an entry appended to the response's `errors` array. Rule-fired cases are unaffected because their action was locked before the model ran -- only the human-readable summary is degraded. For cases that would have required model adjudication (the no-rule-decided path), the disposition falls back to `human_review` and `validation_fallback` is added to `triggered_by.rules`. This is intended behavior, not an error condition: the rule cascade was designed to stand alone for exactly this reason. See Section 9 for the full per-stage failure-mode table, including the symmetric fallbacks for Stages 2 and 3.

**Disposition is final at Stage 4.** There is no inline second-opinion stage. Borderline routing happens at the rule level (`multi_risk_marker_review`, `low_l2_confidence_review`) by sending uncertain cases to `human_review` -- a deterministic, audit-clear path that costs no second model call and cannot contradict a bright-line block. See Section 6 for the v5.0 -> v5.0.1 design change.

---

## 5. Bright lines override aggregate scores, and the override is non-negotiable

A bright-line feature is not a tag and not a score. It is an enforcement-grade signal that overrides the aggregate. The v5 bright-line list inherits from v4.0 and includes signals like `mfa_or_otp_harvesting`, `credential_harvesting_page`, `money_mule_job_posting`, `executive_impersonation_payment`, and `fake_regulatory_document`. The full list lives in the policy spec.

The override rule is one sentence. If `evidence.bright_lines` is non-empty, `disposition.action` must be `block`, regardless of the aggregate score or the model's confidence. The rule fires at Stage 4 before the model is consulted for content reasoning. The reasoning surfaces in `disposition.triggered_by.bright_lines`, naming the specific feature(s) that fired, and `disposition.triggered_by.policy_note` records the non-negotiability explicitly: "Bright-line match: non-negotiable. No downstream stage may downgrade this disposition."

That note exists for one reason. v5.0 reserved an adversarial-review stage that, on paper, could re-argue a bright-line block when the prompt happened to claim a legitimate framing. That design carried a policy contradiction: a non-negotiable rule cannot be re-argued by a model call without the rule ceasing to be non-negotiable. v5.0.1 removes the adversarial stage entirely; the policy_note is the audit-trail evidence that whatever consumer reads the output -- reviewer queue, UI, future automated stage -- sees the disposition as a closed policy outcome, not a tentative recommendation. Bright lines are the set of signals where the fraud-policy team has decided that no legitimate context survives. A user who is asking for an MFA-intercept page is not running a tabletop exercise. Allowing any later stage to wash out a bright-line trigger would defeat the purpose of having one.

The aggregate score path remains the primary route for most blocks, because most fraud does not present a clean bright-line trigger. It accumulates: a high target score, a high lure score, a high extract score, a high evade score, and the aggregate exceeds the threshold. The aggregate is the floor, the bright lines are the ceiling, and Stage 4 picks the more restrictive of the two.

### 5.1 Rule 1.5 -- the narrow defender-framing carve-out for two AI-Enabled-Abuse bright-lines

The non-negotiability above holds for twelve of the fourteen bright-lines without qualification. For two of them -- `prompt_injection_payload` and `ai_model_impersonation`, both in the AI-Enabled-Abuse family -- a narrow exception runs in the disposition cascade between the bright-line rule and the aggregate-score rule. The rule is named `bright_line_with_defender_framing_routes_to_review` and is referred to throughout this document and the policy spec as **Rule 1.5**.

The motivation, in one sentence: master policy section 3.9 enumerates academic publication for safety research as a legitimate use of these two bright-lines' subject matter, and the classifier-guidance rationale describes the bright-line as a conjunction ("injection framing combined with fraud or deception intent"); Rule 1.5 is the engine path that operationalizes that conjunction at the disposition layer without changing the Stage 2 evidence contract. The spec source is `docs/memos/2026-05-25-policy-case07-defender-framing.md` section 6 (now archived under policy's case-07 adjudication); this section paraphrases it for the enforcement-design audience and is intentionally not the canonical statement of the rule.

**What Rule 1.5 changes, and what it does not.** Stage 2 still emits the bright-line code on the same evidence it does today; the detection contract is preserved. What changes is the disposition consequence: when all five preconditions below hold, the cascade routes to `human_review` rather than `block`, the forced L2 set becomes `{borderline_security_research, borderline_red_team}` under L1 `ambiguous_dual_use` rather than `prompt_injection_attack` / `ai_model_impersonation` under L1 `cyber_intrusion`, and the bright-line evidence is retained in `triggered_by.bright_lines` so a reviewer can see exactly what fired and why the cascade routed it as it did. When any precondition fails, the existing rule 1 (`bright_line_forces_block`) fires unchanged.

**Preconditions (all five must hold for Rule 1.5 to fire):**

1. `evidence.bright_lines` is non-empty AND contains at least one of `prompt_injection_payload` or `ai_model_impersonation`.
2. `evidence.bright_lines` contains NO other bright-line beyond those two. If any of the twelve non-AEA bright-lines co-occurs in the same envelope (e.g., `executive_impersonation_payment` alongside `prompt_injection_payload`), Rule 1.5 does NOT fire and rule 1 fires unchanged. The carve-out is for AEA-on-its-own, not for AEA-mixed-with-others.
3. `classification.l3.context_marker` contains at least one of `academic_research`, `defensive_analysis`, `authorized_pentest_claimed`.
4. `classification.l3.risk_marker` contains `authorization_unverifiable`.
5. `classification.l3.risk_marker` does NOT contain any of `specific_victim_targeted`, `payment_instruction_embedded`, `scale_enablement_requested`.

**Outputs when Rule 1.5 fires:**

- `disposition.action = 'human_review'`
- `disposition.safe_completion_guidance = null`
- `disposition.policy_note` records the routing rationale (defender framing claimed but unverifiable; no operationalization markers; bright-line evidence retained for audit; routed per master-policy section 3.9 legitimate-use clause).
- `triggered_by.rules = ['bright_line_with_defender_framing_routes_to_review']`.
- `triggered_by.bright_lines` is unchanged from what Stage 2 emitted (the AEA bright-line remains visible in the envelope as evidence).

**Why the non-negotiability claim above still holds.** The carve-out is a routing change, not a downgrade. The bright-line evidence stays in the envelope; the disposition is `human_review`, not `allow` or `safe_completion`; a reviewer makes the call rather than a model re-arguing it. The "non-negotiable" claim in Section 5 is that no *downstream model stage* may downgrade a bright-line block; Rule 1.5 is a *deterministic upstream cascade rule* gated on L3 surface signals the classifier already emits. The architectural invariant from Section 5 -- no second model call may re-argue a bright-line decision -- is preserved.

**Spoofability bound.** Condition 1 alone is trivially fakeable. Conditions 1+2+3+4+5 together require the engine itself to set `authorization_unverifiable` (a Stage 3 judgment, not a user-asserted claim) and require the prompt to be free of operationalization signals (specific victim, payment instructions, scale-enablement asks). A fraudster who wants the escape valve must produce a sanitized academic-framed prompt that the engine reads as unverifiable -- which is substantially less useful as a fraud prompt -- and the resulting disposition is `human_review`, not a free pass. The design accepts theoretical spoof risk because `human_review` is the correct disposition for that case.

**Reviewer SOP.** When a reviewer's queue surfaces an envelope with `triggered_by.rules` containing `bright_line_with_defender_framing_routes_to_review`, the decision they are being asked to make is whether the defender framing is credible enough to release the bright-line block (i.e., produce a `safe_completion`-style response with explicit defender framing) or whether the framing is insufficiently substantiated to release the block (i.e., the bright-line block stands and the request is denied with policy explanation). The SOP for that decision lives under `docs/ops/reviewer-sops/bright-line-with-defender-framing.md`.

---

## 6. From Stage 5 calibration insurance to deterministic uncertainty routing

The empirical observation behind v5.0's Stage 5 was that wrong dispositions in a single-pass enforcement system cluster around two failure modes: confident blocks against legitimate dual-use requests, and confident allows against borderline-deceptive ones. Stage 5 was designed to catch the first by re-arguing the case and downgrading the action one level if the counterargument was materially convincing.

Two problems with that design surfaced.

The first is the policy contradiction described in Section 5: Stage 5 could in principle re-argue a bright-line block. A guardrail (skip Stage 5 if a bright-line rule fired) patches the symptom, but it leaves a stage in the pipeline whose primary job -- re-arguing borderlines -- is already covered by a deterministic rule earlier in the cascade. The second is the legibility cost: a reviewer reading "Stage 4 emitted BLOCK; Stage 5 emitted HUMAN_REVIEW" on the same case reads it as system inconsistency. The disposition output should resolve, not waver.

v5.0.1 removes Stage 5. The over-blocking failure mode is still real, but it is now addressed at the rule level rather than by re-asking the model:

- `multi_risk_marker_review` (rule 5 in the cascade) routes any prompt with two or more risk-marker L3 tags but no bright lines to `human_review`. This is the case where the system has multiple uncertainty signals but no policy-grade evidence -- exactly the population Stage 5 was meant to give the benefit of the doubt to. Deterministic routing to human review is cheaper, more legible, and harder to subvert than a model re-argument.
- `low_l2_confidence_review` (rule 6) routes any classification whose L2 confidence is below the threshold to `human_review`. This is the system's primary "I am not sure" gate. A reviewer makes the call rather than a second model call.

Together, these two rules absorb most of what Stage 5 was inserted to do, without the policy contradiction. The case Stage 5 did not handle and v5.0.1 also does not handle is the symmetric one -- confident wrong allows against borderline-deceptive prompts. That gap is intentional: an inline mechanism to second-guess a confident allow re-introduces the same Stage 6 regress that motivated removing Stage 5. The post-traffic answer to that failure mode is offline sampling-based review (see Section 9), not another inline stage.

---

## 7. Disposition verbs have named operational semantics

The four disposition verbs (`allow`, `safe_completion`, `human_review`, `block`) are not interchangeable labels. Each carries operational semantics that downstream consumers act on:

- **`allow`** -- grant the request with no constraints. Used for clearly-benign traffic.
- **`safe_completion`** -- grant the request with framing constraints. The `safe_completion_guidance` string carries the specific constraint, and it is branched by the prompt's L1:
  - If `classification.l1.value == "security_education"`, the guidance is "assume authorized defensive use; respond pedagogically with explicit defender framing." Security-education prompts are framed as awareness, training, or victim support; the response should help a defender understand the pattern, not generate the attack artifact.
  - Otherwise (the dual-use case), the guidance is "respond defensively; do not produce a directly weaponizable artifact." The system can discuss the dynamics of an attack without rendering a working template, page, or script.
- **`human_review`** -- route to the abuse review queue. The reviewer reads `reasoning_summary` (audit-grade short summary), `narrative_summary` (hiring-panel-grade prose), and the structured `triggered_by` artifact to make the call.
- **`block`** -- deny the request and return a policy explanation. When `triggered_by` names bright lines, the block is non-negotiable per Section 5.

The L1 branch on `safe_completion_guidance` is a policy decision, not a model decision: it is computed at Stage 4 from the L1 the classifier emitted, not asked of the model. This means a reviewer reading two different `safe_completion` outputs can compare their guidance strings and know they came from the same policy logic.

---

## 8. Stage 1 precision gate and observability

The most cost-sensitive piece of the pipeline is also the riskiest one to misjudge. Stage 1's short-circuit-to-allow path lets the system answer a benign prompt with a single Haiku call instead of three Sonnet calls. That is where the architecture's cost story lives. The danger is symmetric: if Haiku's benign classification has a non-trivial false-negative rate, the system leaks fraud at scale.

The design therefore puts an explicit precision floor on Stage 1 and a runnable measurement scaffold behind it.

The floor is encoded in `POLICY_CONFIG.TRIAGE_BENIGN_PRECISION_MIN`, currently 0.98. The number says: Stage 1 may short-circuit to allow only when Haiku's measured benign precision is at least 98% on a labeled hold-out set. If a measurement run returns below the floor, Stage 1's short-circuit is disabled and Stage 2 receives every prompt. This is a policy decision (cost-of-leak is high enough that the cheaper path requires evidence) and it is enforceable as a runnable check.

The measurement is in `scripts/measure-haiku-precision.js`. The script reads a labeled JSONL dataset, runs Haiku against each prompt, and computes the false-negative rate on the benign-labeled cases. A pass returns 0; a failure returns 1 and prints which cases were misclassified. The seed dataset at `data/haiku-precision-seed.jsonl` is small and curated; downstream users can swap in larger label sets without changing the harness.

Observability is the second half of the gate. Even when the precision check passes, the system samples a fraction of Stage 1's short-circuited-allow outputs (`POLICY_CONFIG.TRIAGE_OBSERVABILITY_SAMPLE_RATE`, currently 10%) and marks them in `pipeline_trace.stage_1.sampled_for_offline_review`. Sampling is deterministic on a hash of the prompt so the same prompt always samples the same way -- no replay drift. An out-of-band batch job is expected to find those marked traces and re-run them through the full pipeline; any case where Stage 1 said allow and the full pipeline disagrees becomes a data point for the next precision measurement.

Together, the gate (precision floor) and the audit hook (deterministic sampling) make Stage 1's cost story falsifiable. The claim is not "Haiku is precise enough." The claim is "Haiku's precision is measured against a 0.98 floor, and 10% of its short-circuit decisions are logged for re-evaluation."

---

## 9. Failure-mode design: graceful degradation, not all-or-nothing

A four-stage pipeline has four times the chances to fail, and the v4.0 baseline has none. That is the central operational risk of this design. The mitigation is that no stage's failure can break the pipeline outright; each stage degrades into a defined fallback, and the response carries an `errors` array documenting what happened.

The degradation rules:

- **Stage 1 fails.** Pipeline runs Stage 2 with no triage hint. No short-circuit available; cost rises but correctness is unaffected.
- **Stage 2 fails.** Pipeline returns classification with `evidence` partially populated and forces `disposition.action = "human_review"` with a reasoning summary noting the failure. The system never silently blocks or silently allows when its substantive analysis call failed.
- **Stage 3 fails.** Pipeline derives a coarse classification from Stage 2's `l2_probabilities` (highest-probability L2 plus its parent L1) and skips L3 entirely. Disposition rules continue to run against the evidence.
- **Stage 4 fails.** Pipeline emits the deterministic disposition from rules only, with `reasoning_summary = "Model unavailable; rule-derived disposition."`. This is a degraded but correct outcome: the rules are designed to stand alone. When no rule had decided (the model-adjudicated path), the disposition falls back to `human_review` and `validation_fallback` is added to `triggered_by.rules`. (Section 4's Stage 4 description carries a short summary of this fallback so a reader scanning "what stage 4 does" sees it without having to find Section 9; the canonical rules live here.)

The response always carries an `errors` array. A consumer that sees a non-empty array knows the response is best-effort, not a clean run. This is how the system stays useful when one of its parts is broken; an all-or-nothing pipeline would simply 5xx and force the upstream system to either fail-open (allow everything) or fail-closed (block everything), both of which are worse than a documented partial response.

This degradation discipline is a direct improvement over v4.0. The single-call system today is "all or nothing on a single Sonnet call." A timeout is a 500. The v5 pipeline can lose any single stage and still produce a usable, attributable answer.

---

## 10. Disposition phase signals (relationship_phase in Stage 4)

The FAF evidence object carries a `context.relationship_phase` field with one of seven values: `targeting`, `contact`, `engagement`, `conversion`, `extraction`, `escalation`, `evasion`. The classification layer (L1/L2/L3) does not surface phase -- it is preserved in evidence specifically so disposition can read it.

This matters because the same L2 typology can carry very different urgency depending on phase. A romance-fraud prompt at the `engagement` phase is a developing pattern; the same prompt at the `extraction` phase is an active money-movement event. Stage 4's `multi_risk_marker_review` and `low_l2_confidence_review` rules can read `evidence.faf_nodes.context.relationship_phase` to apply phase-specific routing without changing the L1 or L2 -- a way to keep the classification stable while making the disposition phase-aware.

The current rule cascade does not yet use phase as a primary input (rules 1-8 in `policy-spec-v5.0.md` Section 6.1 fire on bright lines, aggregate score, L1, L3 risk-marker count, and L2 confidence). Phase is preserved in evidence and surfaced in `pipeline_trace.stage_2.output.faf_nodes.context.relationship_phase` so that future rules can route on it without re-running Stage 2. This is the standard pattern in mature T&S systems: evidence is generous; rules are surgical.

---

## 11. What this design buys you, in one paragraph

The pipeline trades cost on suspicious traffic for speed on benign traffic, depth of analysis for the cases that need it, deterministic enforcement on the cases where policy is clear, and deterministic routing to human review on the cases where the system is explicitly uncertain. The audit artifact is a `triggered_by` block that names the specific rule and evidence that justified the action, with `policy_note` flagging non-negotiable rules so they cannot be silently downgraded. The disposition output carries both a 280-char `reasoning_summary` (audit-grade) and a 600-char `narrative_summary` (stakeholder-readable prose), with a `confidence_path` string showing the per-stage confidence trajectory. The Stage 1 short-circuit is gated on a measured Haiku precision floor and 10% of its decisions are sampled for offline re-evaluation, so the cost story is falsifiable. The failure mode is graceful: any stage can drop out and the pipeline still answers. The price is engineering complexity and average latency on the long-tail-suspicious slice of traffic. For a fraud and scams system, those are the right things to spend on.

---

*Previous: [03 - Master Policy](./03-master-policy.md) | Next: [05 - Classifier Guidance](./05-classifier-guidance.md)*
