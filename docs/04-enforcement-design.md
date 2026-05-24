# Enforcement Design
**SafeEval - Document 04 of 06**
*Version 5.0 - May 2026*

---

## 1. What this document is

This is the enforcement architecture for the SafeEval fraud and scams pipeline. The audience is a fraud-policy reviewer who wants to know how a prompt gets from "raw text submitted to an API" to "decision the platform will act on" without reading the code. The goal of the next ten minutes is for you to be able to argue about the trade-offs, not just describe them.

The headline decision is this. SafeEval v5 replaces the v4.0 single-call classifier with a four-stage pipeline, plus an optional fifth stage that runs only on borderline cases. The pipeline is built around three convictions: classification and disposition are different questions and should be answered separately; obvious benign traffic should not pay the cost of deep analysis; and the riskiest dispositions are the ones most likely to be wrong, so they deserve a second opinion.

Everything below explains how that shape supports those convictions, and where the architecture deliberately makes a worse trade so a more important one can be made better.

---

## 2. The pipeline at a glance

The pipeline runs in four required stages and one conditional stage:

1. **Stage 1 - Triage (Haiku).** A cheap routing pass that decides whether the prompt looks plainly benign, plainly worth a deeper look, or somewhere in between. Stage 1 is never allowed to block.
2. **Stage 2 - FAF Deep Analysis (Sonnet).** The substantive policy call. This is where the Fraud Analysis Framework (CONTEXT / PROCESS / OBJECTIVE) is applied: component scores are assigned, bright lines are flagged, process flags are emitted, and L2 probabilities are produced. This is the closest analogue to the entire v4.0 system.
3. **Stage 3 - Classification (Sonnet).** Translates evidence into the v5 envelope: an L1 domain (closed, mutually exclusive), an L2 risk pattern (closed, constrained by L1), and a multi-valued L3 tag set (open, categorized as method / tactic / target / context_marker / overlap / risk_marker). L3 tags carry per-assignment confidences.
4. **Stage 4 - Disposition (rules first, then Sonnet).** Applies deterministic rules against the evidence to choose one of four actions: `allow`, `safe_completion`, `human_review`, or `block`. The model only writes the reasoning summary and adjudicates cases the rules do not decide.
5. **Stage 5 - Adversarial Review (Sonnet, optional).** Runs only when the disposition is borderline. Argues the strongest case that the disposition is wrong, and downgrades the action one level if the counterargument is materially convincing.

Each stage has a narrow remit and a narrow output schema. The pipeline never asks one stage to do two jobs.

---

## 3. Why four stages instead of one

The four questions the pipeline is asking are not the same question asked four times. They have different cost-accuracy curves, and conflating them is the main thing v4.0 gets wrong.

Stage 1 is a routing question. The cost of being wrong is small in either direction: a false benign gets caught at Stage 2, a false suspicious wastes one Haiku call. Haiku is cheap and fast, and a high-confidence benign verdict at this stage saves three downstream Sonnet calls. That is where the cost advantage of the whole architecture comes from: in mixed traffic, a meaningful fraction of prompts never need the deeper stages at all.

Stage 2 is a policy question. The cost of being wrong is large in both directions, the evidence is rich, and the prompt deserves the most capable model with the most context. This is where the FAF lives.

Stage 3 is a translation question. The hard work is already done at Stage 2; Stage 3 maps evidence into a stable, closed-enum envelope that downstream consumers can program against. The structural value comes from constraining the model with tool-use schemas so it literally cannot emit an L2 value that does not exist. This eliminates a class of parsing errors that no single-call architecture can prevent.

Stage 4 is an enforcement question, and enforcement should be deterministic where it can be. A bright-line feature must always force a block. An aggregate score over a threshold must always force a block. A benign L1 with a low aggregate must always allow. None of these decisions should depend on whether the model felt confident this morning. Stage 4 runs the rules first; the model only writes the human-readable summary and resolves the cases the rules do not.

Stage 5 is calibration insurance. Most pipelines do not have this. The reasoning is that the cases where the system is most likely to be wrong are exactly the cases where confidence is borderline, where the L1 was `ambiguous_dual_use`, or where a block was issued against a prompt that also had a plausible legitimate use. On those cases, and only those, the pipeline asks itself "what is the strongest argument that this disposition is wrong?" and shifts the action one level less severe if the counterargument lands. This is cheap insurance against the failure mode that matters most: a confident wrong block.

---

## 4. What each stage decides, and what it deliberately does not

The narrowness of each stage is not an accident. It is the part of the design that holds together under load.

**Stage 1 decides routing. It does not decide enforcement.** Triage produces an L1 candidate, a confidence, and a coarse context. If `l1_candidate == "benign"` and `l1_confidence >= 0.92` and the coarse context surfaces no risk markers, the pipeline short-circuits to `allow` and stops. In every other case, Stage 1 hands off to Stage 2 with a hint. Stage 1 is structurally incapable of producing a `block` or a `human_review`. This means a Haiku miscalibration cannot escalate a benign prompt to a punitive action.

**Stage 2 decides evidence. It does not assign the final disposition.** The Sonnet call here produces the entire `evidence` block: the FAF nodes, the component scores (target, lure, trust, extract, evade, each 0-3), the aggregate score, the bright-line list, the process flags, the L2 probabilities. Stage 2 is allowed to flag any of the bright-line features, but it does not decide what happens next. Separating evidence from action is what makes the pipeline auditable: you can change disposition policy without re-running the model.

**Stage 3 decides classification. It does not invent evidence.** Stage 3 sees prompt, Stage 1 output, and Stage 2 evidence, and emits the `classification` object: L1 + confidence, L2 + confidence, and a list of L3 tags each with their own confidence. The L2 value is constrained by the L1 value (an L1 of `cyber_intrusion` cannot have an L2 of `romance_fraud`). Stage 3 is also constrained by Stage 2: if `evidence.bright_lines` contains `mfa_or_otp_harvesting`, the L2 must come from {`credential_theft`, `account_takeover`}. These constraints live in code, not in model instruction. The model cannot forget them.

**Stage 4 decides disposition. The model is the smaller half of this stage.** Rules run first. Any bright line forces `block`. An aggregate score of at least 10 forces `block`. An aggregate of at most 3 with L1 = `benign` forces `allow`. L1 = `ambiguous_dual_use` defaults to `human_review`. L1 = `security_education` with no bright lines maps to `safe_completion`. Only cases that fall through this rule cascade reach the model, which then chooses among the remaining actions and writes the reasoning summary. The `disposition.triggered_by` field records which rule fired and which evidence supported it, which is the audit artifact a reviewer needs to defend the action later.

**Stage 5 decides whether to downgrade. It cannot upgrade.** Stage 5 runs only when triggered (low-confidence human_review, block against a prompt with plausible legitimate use, ambiguous_dual_use that did not get human review). It produces a counterargument and a re-scored confidence. If the new confidence shifts by more than 0.15 in the direction of "this action is wrong," the pipeline drops the action one level (`block` to `human_review`, `human_review` to `safe_completion`) and surfaces the counterargument in `disposition.reasoning_summary`. Stage 5 cannot escalate. It exists to catch over-blocking, not to find new violations.

---

## 5. Bright lines override aggregate scores

A bright-line feature is not a tag and not a score. It is an enforcement-grade signal that overrides the aggregate. The v5 bright-line list inherits from v4.0 and includes signals like `mfa_or_otp_harvesting`, `credential_harvesting_page`, `money_mule_job_posting`, `executive_impersonation_payment`, and `fake_regulatory_document`. The full list lives in the policy spec.

The override rule is one sentence. If `evidence.bright_lines` is non-empty, `disposition.action` must be `block`, regardless of the aggregate score or the model's confidence. The rule fires at Stage 4 before the model is consulted. The reasoning surfaces in `disposition.triggered_by.bright_lines`, naming the specific feature(s) that fired.

This is deliberately stricter than the aggregate-score path. The bright-line list is the set of signals where the fraud-policy team has decided that no legitimate context survives. A user who is asking for an MFA-intercept page is not running a tabletop exercise. Allowing aggregate signals to wash out a bright-line trigger would defeat the purpose of having one.

The aggregate score path remains the primary route for most blocks, because most fraud does not present a clean bright-line trigger. It accumulates: a high target score, a high lure score, a high extract score, a high evade score, and the aggregate exceeds the threshold. The aggregate is the floor, the bright lines are the ceiling, and Stage 4 picks the more restrictive of the two.

---

## 6. Stage 5 as calibration insurance

The empirical observation that justifies Stage 5 is that the wrong dispositions in any single-pass enforcement system cluster around two failure modes. Confident blocks against legitimate dual-use requests, and confident allows against borderline-deceptive ones. The first costs you trusted users. The second costs you victims.

Stage 5 only addresses the first. It exists because there is no symmetric mechanism that catches the second failure mode without inviting a regress (a Stage 6 to second-guess Stage 5, and so on). The asymmetry is deliberate: over-blocking is the easier failure to detect post-hoc, but the harder one to undo in the moment, because the user is already gone. Catching it inline matters more than catching it at audit.

Stage 5 fires on three conditions:

1. `disposition.action = "human_review"` with `confidence < 0.75`, where the system itself was not sure.
2. `disposition.action = "block"` paired with `evidence.legitimate_use_possible = true`, where the evidence had a plausible defense.
3. `classification.l1 = "ambiguous_dual_use"` paired with `disposition.action != "human_review"`, where the L1 acknowledged ambiguity but the disposition did not.

On those cases, Stage 5 is given the full evidence and disposition and asked to argue the case for the opposite verdict. If the resulting counterargument shifts a re-scored confidence by more than 0.15, the action drops one level. Otherwise the original disposition stands, and the counterargument is logged but not surfaced.

This is the cheapest mechanism the pipeline has for reducing confident-wrong blocks without inviting model self-doubt on every call.

---

## 7. Failure-mode design: graceful degradation, not all-or-nothing

A four-stage pipeline has four times the chances to fail, and the v4.0 baseline has none. That is the central operational risk of this design. The mitigation is that no stage's failure can break the pipeline outright; each stage degrades into a defined fallback, and the response carries an `errors` array documenting what happened.

The degradation rules:

- **Stage 1 fails.** Pipeline runs Stage 2 with no triage hint. No short-circuit available; cost rises but correctness is unaffected.
- **Stage 2 fails.** Pipeline returns classification with `evidence` partially populated and forces `disposition.action = "human_review"` with a reasoning summary noting the failure. The system never silently blocks or silently allows when its substantive analysis call failed.
- **Stage 3 fails.** Pipeline derives a coarse classification from Stage 2's `l2_probabilities` (highest-probability L2 plus its parent L1) and skips L3 entirely. Disposition rules continue to run against the evidence.
- **Stage 4 fails.** Pipeline emits the deterministic disposition from rules only, with `reasoning_summary = "rule-derived; model unavailable"`. This is a degraded but correct outcome: the rules are designed to stand alone.
- **Stage 5 timeout.** Stage 4's output ships unchanged. The pipeline does not block on a stage whose purpose is to catch a minority of cases.

The response always carries an `errors` array. A consumer that sees a non-empty array knows the response is best-effort, not a clean run. This is how the system stays useful when one of its parts is broken; an all-or-nothing pipeline would simply 5xx and force the upstream system to either fail-open (allow everything) or fail-closed (block everything), both of which are worse than a documented partial response.

This degradation discipline is a direct improvement over v4.0. The single-call system today is "all or nothing on a single Sonnet call." A timeout is a 500. The v5 pipeline can lose any single stage and still produce a usable, attributable answer.

---

## 8. What this design buys you, in one paragraph

The pipeline trades cost on suspicious traffic for speed on benign traffic, depth of analysis for the cases that need it, deterministic enforcement on the cases where policy is clear, and a structured second opinion on the cases where it isn't. The audit artifact is a `triggered_by` block that names the specific rule and evidence that justified the action. The failure mode is graceful: any stage can drop out and the pipeline still answers. The price is engineering complexity and average latency on the long-tail-suspicious slice of traffic. For a fraud and scams system, those are the right things to spend on.

---

*Previous: [03 - Master Policy](./03-master-policy.md) | Next: [05 - Classifier Guidance](./05-classifier-guidance.md)*
