# Report generator scoping -- audience-tailored reports from persisted evaluations

**Status:** draft, recommends-only (memo scopes a new post-Stage-4 consumer feature; no engine changes, no schema changes, no track-framework amendment applied in this commit).
**Date:** 2026-05-28
**Author:** `safeeval-policy` (Cowork), via `safeeval-agents:design-memo-author` (mode A).
**Companion to:** `docs/memos/2026-05-28-data-track-scoping.md` (the persistence layer this feature depends on; §4 PII sanitization spec; §5 schema sketch; §7 Compliance-ready tier as the sequencing gate), `docs/memos/2026-05-24-parallel-cowork-tracks.md` (parallel-tracks framework; §6 dispatch ritual; fifth atomic amendment escalation-field convention used in §10 below), `docs/06-stakeholder-brief.md` (the senior calibration for register-distinct communication -- the pattern this memo applies to per-evaluation outputs), `docs/03-master-policy.md` (the FAF policy surface every audience-tailored report ultimately reports on), `docs/04-enforcement-design.md` (the four-stage pipeline whose envelope outputs are the report generator's input), `docs/07-v5-schema.md` (the envelope shape the report generator reads from).
**Related skill:** `safeeval-agents:stakeholder-communicator` -- the policy-thesis-to-register pattern this memo mirrors for per-evaluation outputs. Stakeholder-communicator translates *the framework* into four registers (exec brief, legal explainer, GTM talking points, external comms draft); the report generator translates *each evaluation* into four (and eventually five) registers (reviewer, T&S lead, legal, exec summary, end_user).
**Scope:** scope the report generator feature -- a closed-set audience vocabulary, a hybrid pre-gen / on-demand generation strategy conditioned on disposition, an audit-metadata-keyed cache, and architectural placement as a post-Stage-4 consumer (not a new engine stage). The implementation is gated on the data track shipping Compliance-ready tier; this memo authors the scoping work in parallel. Three of Steven's locked choices are baked in (the closed five-audience set; end_user deferred to a later memo; markdown canonical with PDF / HTML rendered on download) -- those are recorded as decisions, not re-opened as alternatives.

## 1. Problem statement

The SafeEval v5 engine produces structured evaluation envelopes optimized for engine consumption -- closed-set disposition vocabularies, audit-metadata fields (`stage1..4_prompt_hash`, `cache_key`, `ontology_version`, `schema_version`), reason codes, component scores with rubric references, and a `triggered_by` block attributing the disposition to specific signals. The envelope is shaped for replayability, lockstep verification, and downstream programmatic consumption. It is NOT shaped for human reading.

Different stakeholders need different views of the same finding, and today there is no path from envelope to audience-tailored output:

- **Fraud reviewers** adjudicating a `human_review` case need the full envelope, the reason codes, the component scores with rubric references, the discriminator-boundary paragraph that fired in Stage 2, and links to the lockstep section the disposition rule lives in. They need detail and traceability; a summary loses the signal they are paid to weigh.
- **Trust & Safety leads** deciding on policy escalation or customer comms need a plain-language summary of what happened, the severity in human terms, the policy implications (does this pattern need a typology amendment), and a recommended next action. Raw component scores at this register are noise; they slow the read without changing the decision.
- **Legal / compliance counsel** reviewing a case for regulatory exposure need the regulatory framework mapping (which IC3 / FTC / NIST category applies), the audit-metadata fields for chain-of-custody (prompt hashes, `cache_key`, `ontology_version`), the retention pointer, and precise non-marketing language. The audit metadata is load-bearing in this register; in the T&S lead register it is invisible.
- **Executives** consuming a leadership briefing or board-deck input need an 80-word top-line: disposition, one-sentence rationale, cross-evaluation pattern flag if applicable. Anything more is bookkeeping at this register.

Today everyone reads the same raw envelope or asks someone to translate. The raw envelope is unreadable for three of the four registers (only reviewer can use it directly); the translation tax falls on whichever person is fastest at converting envelopes to prose, which is a poor allocation of senior time and a precision risk every time it happens. The cost is structural and recurring: every evaluation that needs cross-register communication is paid for again.

The proposal is a report generator that lives downstream of the engine, reads the persisted envelope, and produces one report per audience tailored to the finding. This mirrors the architectural pattern established by `safeeval-agents:stakeholder-communicator` (single policy thesis -> register-specific outputs in exec, Legal, GTM, external voices) but applies it to per-evaluation outputs instead of framework-level communication. The thesis the existing stakeholder brief defends -- that translating intent into structure a downstream consumer can build against without losing the signal is the senior thing -- recapitulates exactly here. The envelope is the structure; the audience-tailored report is the translation; losing the signal is what happens today when everyone reads the same raw output.

## 2. Alternatives considered

- **A. The hybrid strategy (recommended).** Pre-generate the four implemented audiences (`reviewer`, `trust_safety_lead`, `legal`, `exec_summary`) at evaluation time, but only for `block` and `human_review` dispositions. On-demand generation only for `allow` and `safe_completion`. Audit-metadata-keyed cache. Per-audience report-prompt hashes mirror engine prompt-hash discipline.
- **B. Pre-generate all audiences for all evaluations.** Every classification triggers four report generations regardless of disposition. Highest latency safety; highest per-evaluation cost. Rejected -- see §3.B.
- **C. On-demand only for everything.** No pre-generation at any disposition. Every audience report is requested by a consumer (UI click, API call). Lowest baseline cost; highest reviewer-workflow latency on the cases that matter most. Rejected -- see §3.C.
- **D. One generic report, no audience tailoring.** Single human-readable summary template per evaluation, same output for every reader. Misses the central feature value; included for completeness. Rejected -- see §3.D.
- **E. Generate reports inside the engine as Stage 5.** Couple report generation to the engine surface as an additional stage in the pipeline. Rejected -- see §3.E.

Alternative F (skip the feature, accept the manual-translation status quo) is named here but not evaluated as a serious alternative -- the cost of the gap is the problem statement; doing nothing is the default outcome the memo proposes to displace, not a real candidate.

## 3. Evaluation

### 3.A The hybrid strategy (pre-gen on block / human_review; on-demand for allow / safe_completion)

Cost: medium engineering for the initial land (audience-vocabulary closed set + four prompt skeletons + generation-pipeline wiring + cache + on-demand endpoint). Steady-state API cost is the load-bearing analysis -- the cost model is laid out explicitly in §5 below; in summary, pre-gen on block / human_review at the projected ~10% disposition share adds approximately ten percent to total API spend.

Buys: latency safety on the cases that matter most. A reviewer opening a `human_review` case in the reviewer UI sees four reports already generated and cached; the audit-metadata cache means a second reviewer opening the same case minutes later pays nothing. A T&S lead asked to comment on a `block` decision sees the plain-language register already prepared, not a raw envelope they have to interpret on the spot. An exec briefing being assembled at week-close pulls the 80-word top-lines from cache. The cases that drive escalation and customer impact are the cases the system pre-pays for; the cases nobody reads in practice (the vast majority of `allow`) are not pre-paid for.

Where this sits in FAF terms: the report generator is a defense-in-depth layer for *communication*, in the same architectural position the engine's `safe_completion` disposition occupies for *response*. Both surfaces accept that the source artifact (envelope; in-flight input) is shaped for one consumer and that a different shape is required for a different consumer; both surfaces refuse to compromise the source artifact's shape to serve the second consumer. The engine envelope stays machine-shaped; the report generator builds the human-shaped derivatives.

Where this sits in lockstep terms: the audience definitions are closed-set ontology vocabulary, the prompt skeletons are sole-writer artifacts owned by the policy track, and the per-audience prompt hashes mirror the engine's stage prompt hashes. Lockstep extends to the report layer cleanly because the artifacts at this layer have the same structural properties as the engine artifacts -- closed sets, hashed prompts, replayable outputs.

The strategy's defensible-against-criticism property: the hybrid is the only alternative that pays a marginal cost proportional to the marginal value at every disposition. Block and human_review are the cases the reviewer-UI / T&S workflow / legal / exec consumers will read; allow and safe_completion are the cases that, in steady-state, the system never opens unless a spot-check or audit is in progress. Spot-checks pay the on-demand cost the first time and the cache cost every time after; that is the correct allocation.

### 3.B Pre-generate all audiences for all evaluations

Cost: doubles per-evaluation cost (from the §5 cost-per-evaluation math). Buys: zero on-demand latency for any case, including the cases nobody reads.

The fatal objection is that the marginal cost is paid against a near-zero marginal probability of read. SafeEval's expected disposition distribution -- conservatively ~85% `allow` + `safe_completion`, ~15% `block` + `human_review` -- means pre-generating all four audiences for every evaluation burns 4x the report-generation budget on the 85% that are unlikely to be read at any audience. The on-demand path costs $0 until requested; pre-generation costs the report budget at generation time and never recovers if the report is not read. For a portfolio project this is wasted spend on the wrong axis. For a hypothetical productized SafeEval at higher volume, the cost ratio is worse, not better, because the proportion of unread reports does not shrink with volume.

A second-order objection: pre-generating the four audiences at the same moment as the engine evaluation increases the latency of the engine's reply path, because the report generation has to land somewhere -- either inline (worst case, the user-facing response waits for it) or async (a queue that has to be drained). Pre-gen-on-everything pushes the worst case onto the most-latency-sensitive path; pre-gen-on-block-plus-human-review keeps the most-latency-sensitive path (the user-facing `allow` and `safe_completion` flows) free of any report-generation work.

### 3.C On-demand only for everything

Cost: lowest baseline (zero report cost until a request lands). Buys: a clean architectural story where the engine has one job and the report generator is purely a consumer.

The objection is reviewer workflow latency on `human_review` cases. When a reviewer opens a case to adjudicate it, the worst time to pay 1-3 seconds of report-generation latency is the moment they start reading -- the friction tax is paid at the highest-attention moment in the workflow. Pre-generating reports for the cases that need adjudication amortizes this latency away from the reviewer's interactive path; on-demand-only puts it back in.

A second objection: `block` decisions occasionally need customer-facing comms within minutes of the block firing. T&S leads pulling the plain-language register at the moment a customer escalation lands need the report ready, not a generation-on-demand path that has to be queued and waited on. Pre-generating these reports at decision time means the comms are available within the same minute as the block decision.

A third objection: cache effectiveness. The audit-metadata cache hits when a second reader opens the same evaluation later. On-demand-only means the first reader of every evaluation pays full generation cost; only the second-and-onwards reader gets the cache. Pre-gen-on-block-plus-human-review means the first reader of every consequential case gets the cache too.

Partial-adopt note: if the cost analysis in §5 turns out to underestimate the block / human_review share substantially (Steven's open question Q2 below), the right correction is to widen the on-demand window, not to pre-generate everything. The hybrid is robust against cost-share misestimation in the right direction.

### 3.D One generic report, no audience tailoring

Cost: lowest engineering (single prompt skeleton, single cache key). Buys: a single human-readable summary per evaluation that any audience can read.

The objection is that the central value of the feature is the audience-tailored translation, not the human-readable property. A generic report optimized for "any audience" lands at the median across registers and is wrong at every register: too detailed for the exec read, too high-level for the reviewer adjudication, missing the regulatory mapping the legal register needs, and including too much engine-internal vocabulary for the T&S lead. The thesis the report generator defends -- that different stakeholders need different views of the same finding -- is exactly what this alternative refuses to provide.

A secondary objection: a generic report cannot serve as the chain-of-custody record the legal audience needs while also serving as the 80-word top-line the exec audience needs. The two registers' format requirements are mutually exclusive; any single output that tries to serve both produces neither well.

This alternative is rejected as inconsistent with the problem statement, not on cost grounds. Named in §2 because "is the feature itself necessary" deserves a rejection-with-reasoning rather than silent omission.

### 3.E Generate reports inside the engine as Stage 5

Cost: medium engineering; engine surface change. Buys: a single integrated pipeline that produces the envelope and the audience-tailored derivatives in one pass.

The objection is architectural invariant violation. The engine's stages are defined by their role in the closed-set FAF-to-disposition pipeline: Stage 1 triage, Stage 2 typology classification, Stage 3 component scoring, Stage 4 disposition cascade. Each stage's output is shaped for the next stage's consumption, and the envelope at Stage 4 is the engine's terminal output. Adding a Stage 5 that produces audience-tailored reports couples the engine to consumer use cases -- a `reviewer` report shape change is no longer a consumer concern, it is an engine-surface change that has to land in lockstep with policy text, classifier guidance, and the schema. The same invariant the engine has been built around -- "the engine produces envelopes, full stop" -- is what enables the hybrid generation strategy to exist as a separable layer at all.

A second objection: pre-generation at the engine layer would have to occur on every evaluation (no Stage 5 only-runs-conditionally pattern is precedented in the v5 design), which collapses to alternative B (pre-generate all audiences for all evaluations) with worse engineering ergonomics.

A third objection: replayability. The engine's replayability story relies on the stage prompt hashes being load-bearing across the closed-set pipeline. Adding a Stage 5 whose output is consumer-shaped (and therefore changes shape more often than typology vocabulary) drags the replayability story into a domain where the artifacts churn. The architectural invariant the engine maintains is precisely what protects the replay surface from this churn.

## 4. The four-audience scope (this memo)

Each audience is a closed-set ontology vocabulary entry. The slot is reserved by the audience name; the prompt skeleton, the format envelope, and the visibility constraints are policy-authored artifacts subject to lockstep with the audience vocabulary. The vocabulary is closed: adding a new audience requires policy-track scoping work analogous to a new L1 typology, not a runtime concern.

### 4.1 `reviewer`

**Who reads it.** Internal fraud reviewer adjudicating a case routed to the reviewer queue (predominantly `human_review` disposition; occasionally `block` cases pulled into spot-check).

**Action taken after reading.** Adjudicate the case: confirm the engine's disposition, override to a different disposition, or flag for policy escalation. Reviewer adjudication is the reviewer-override surface the ops track's runbooks describe.

**Length envelope.** ~400-600 words.

**MUST see.** The full envelope contents (disposition, L1/L2/L3, sub-typology labels, component scores, reason codes, `triggered_by` block); component scores with rubric references to the §3 master-policy section that defined them; the discriminator-boundary paragraph from Stage 2 that fired (the prose, not just the boundary marker); the lockstep section reference for the disposition rule that produced the cascade decision; links to fixture cases of similar dispositions if available; the audit-metadata fields (prompt hashes, `cache_key`, `ontology_version`) for replay.

**MUST NOT see.** Stripped. The reviewer audience sees everything that has been sanitized at the PII layer (per `docs/memos/2026-05-28-data-track-scoping.md` §4 sanitization spec) -- which is to say, the reviewer sees the sanitized envelope with placeholders, not the raw input. Unredacted access is reserved for the `pii_reviewer` role per the data track's two-key access tier; that surface is separate from the reviewer report and is not within this memo's scope.

### 4.2 `trust_safety_lead`

**Who reads it.** T&S manager or lead reviewing a case to decide on policy escalation, customer communication, or workflow change. Often reading 10-30 cases in a session to spot pattern movement.

**Action taken after reading.** Decide whether to escalate (file a typology-amendment request through the policy track), whether to engage customer comms (route to T&S communication workflow), or whether to record the case as routine. T&S leads also commission threat-model refreshes when a case suggests a new TTP.

**Length envelope.** ~250-350 words.

**MUST see.** Plain-language summary of what happened (no engine vocabulary; "the user attempted to..." not "the engine classified at L2 `business_email_compromise`"); severity in human terms ("high" / "moderate" / "routine" with explanation, not the raw numeric component scores); policy implications (does this look like a known typology pattern or something new); recommended next action (escalate / comms / file / spot-check).

**MUST NOT see.** Raw component scores (the numeric values are below the T&S lead's threshold-of-actionability -- the engine handles that level of precision); system-prompt internals (the prompts themselves are not within the T&S register's read); audit-metadata fields (the legal audience needs these; the T&S lead does not).

### 4.3 `legal`

**Who reads it.** Legal / compliance counsel reviewing a case for regulatory exposure. Predominantly reading `block` and high-severity `human_review` cases; occasionally reading sampled `safe_completion` for the disposition-evidence record.

**Action taken after reading.** Determine regulatory exposure (does the case implicate a reportable offense; does the disposition meet the standard of care the regulatory framework requires); confirm chain-of-custody for the audit record; document the regulatory categorization for the audit trail.

**Length envelope.** ~350-500 words.

**MUST see.** Regulatory framework mapping -- which IC3 / FTC / NIST / FinCEN / equivalent category the case falls under, with the framework's own vocabulary applied accurately; the audit-metadata fields for chain-of-custody (`stage1..4_prompt_hash`, `cache_key`, `ontology_version`, `schema_version`, evaluation timestamp); the retention pointer (where the source envelope lives, retention tier, expected expiry per the data track's 90-day live-tier policy); the disposition rule cited by its lockstep section reference; the access-control record (was unredacted access invoked, by whom).

**MUST NOT see.** Marketing language ("our system detected..." -- replaced with neutral phrasing "the engine classified..."); ambiguous severity labels ("high" without quantitative anchor -- replaced with the component-score values when they bear on regulatory categorization); recommendations that overcommit ("we should escalate" -- replaced with "the case meets the criteria for [framework] escalation"). The legal register is precision-first; ambiguity is a liability.

### 4.4 `exec_summary`

**Who reads it.** Leadership consuming a briefing or pulling content for a board deck. Predominantly reading aggregated rollups; occasionally pulling individual cases when a high-profile incident lands.

**Action taken after reading.** Form a top-of-mind picture of the case; decide whether to ask follow-up questions; include in a leadership briefing or external comms thread.

**Length envelope.** ~80-100 words.

**MUST see.** Top-line disposition (one of the four verbs, in human-readable form); one-sentence rationale (the load-bearing why); cross-evaluation pattern flag if applicable ("third case in 30 days matching this pattern"; absent if not applicable).

**MUST NOT see.** Reviewer-specific detail (component scores, reason codes, discriminator-boundary text); implementation detail (prompt hashes, cache keys); legal regulatory vocabulary (the exec register does not need IC3 category names). Anything that does not fit in 80-100 words is by definition out.

## 5. The fifth audience -- `end_user` -- named but deferred

The fifth audience reserves the ontology slot but the implementation scope for this memo covers only the four audiences in §4. The `end_user` name is recorded in the closed-set vocabulary so that subsequent additions do not collide with it and so that the place where the deferred work belongs is visible.

**Why deferred.** End-user reports explain *why* a request was blocked or safe-completed to the user whose request the engine acted on. The disclosure problem is non-trivial: an end-user report that explains "your request was blocked because it exhibited markers of business email compromise (specifically: claimed-identity escalation, payment instruction, urgency)" hands the evasion playbook to the next adversarial user who reads it. The bright-line indicators the engine relies on are public if the report says them; once public, they degrade in fraud-detection value because adversarial users avoid them. The implementation of an end-user report has to navigate a disclosure-policy tradeoff that does not exist for the four internal audiences, none of which face the disclose-vs-protect problem.

**Why reserving the slot now matters.** Adding a fifth audience after the four are shipped is a vocabulary-extension event with all the lockstep cost the closed-set vocabulary discipline implies. Reserving the slot in the vocabulary now, with the deferral made explicit, means the future memo that authors the disclosure policy lands cleanly into a known-shape slot, not into a vocabulary that has to be re-opened.

**What unblocks the deferred work.** A separate scoping memo authoring the disclosure policy -- what end-user reports may say about the disposition rationale, what they may NOT say, how the policy interacts with regulatory disclosure requirements that may compel saying more than the bright-line-protection consideration would prefer, and how the report shape stays stable under both the protective and the compulsory disclosure regimes. That memo is the disclosure-policy prerequisite for the Full scope tier in §7 below.

The deferral is explicit and time-bound (it is the subject of a separate scoping memo, queued in §10 as an open question with `default-accept` recommendation), not an indefinite punt. §11's adversarial review takes up the strongest case for *not* deferring and refutes it.

## 6. Generation strategy -- hybrid conditioned on disposition

The recommended strategy is alternative A in §3 above, summarized here as the operational specification:

**Pre-generate at evaluation time for `block` and `human_review` dispositions only.** When the engine returns a final disposition of `block` or `human_review`, the report generator runs immediately against the persisted envelope, producing all implemented audience reports (four, per §4) and writing them to the report store. The pre-generation runs asynchronously to the engine's user-facing response path -- the response to the original API caller is not blocked on report generation; report generation completes within seconds of the evaluation landing in persistence.

**On-demand only for `allow` and `safe_completion`.** No report is generated at evaluation time for these dispositions. When a consumer (reviewer UI, API endpoint, audit job) requests a report for an `allow` or `safe_completion` evaluation, the report generator runs against the persisted envelope at request time and writes the result to the cache. Subsequent requests for the same evaluation + audience combination hit the cache.

**Cache keyed on audit-metadata fields.** The cache key is the composition `(stage1_prompt_hash, stage2_prompt_hash, stage3_prompt_hash, stage4_prompt_hash, cache_key, audience, report_<audience>_prompt_hash)`. The stage prompt hashes capture the engine surface that produced the envelope; the `cache_key` captures the input + the ontology / schema versions; the audience labels the register; the `report_<audience>_prompt_hash` captures the report-prompt-side state. A change at any layer invalidates the cache for the affected combinations only.

**Per-audience report-prompt hash mirrors engine prompt-hash discipline.** Each audience prompt skeleton is hashed exactly like an engine stage prompt; the hash is stored on the report record (not on the engine envelope -- see §10 Q3) and participates in the cache key. The hash discipline gives report generation the same replayability property the engine has: a re-run against the same envelope with the same prompt produces the same report (modulo any temperature parameters, which should be pinned at zero for the report generator's API calls).

**Replay and regression behavior.** Replaying an evaluation that has a cached report hits the cache. Replaying after a prompt-skeleton revision (new `report_<audience>_prompt_hash`) misses the cache and regenerates. Replaying after an ontology amendment (new `ontology_version` in `cache_key`) misses the cache at both the engine and the report layer, regenerates the envelope, and then regenerates the reports. These behaviors are the report-layer analogues of the engine's existing replay properties.

## 7. Cost model

The cost model is the load-bearing analysis behind the hybrid recommendation; if the numbers are wrong, the alternative ranking shifts.

**Per-evaluation engine cost today.** A v5 four-stage evaluation costs approximately $0.001 - $0.003 in API spend, depending on input length, the discriminator-boundary path taken in Stage 2, and whether the Stage 4 adversarial-review path fires. The midpoint is roughly $0.002 per evaluation; the high end (worst case, all stages fire, adversarial review triggers) is about $0.003.

**Per-audience report cost.** A single audience-tailored report is approximately $0.0005 - $0.002 in API spend, with the variance driven by the envelope size (input to the report prompt), the audience's length envelope (the legal register's ~350-500 words is the high end; the exec register's ~80-100 words is the low end), and the model used (the report generator should run on Sonnet; running on Haiku would cut cost but the register-distinction precision is exactly where Sonnet earns its keep). Conservatively assume $0.001 per audience report as the planning number.

**Pre-generating 4 audiences for every evaluation.** 4 audiences * $0.001 per audience = $0.004 per evaluation in report cost, on top of the ~$0.002 engine cost. Total per-evaluation cost approximately triples. At any meaningful traffic this is the budget killer; for a portfolio project at low traffic it is wasteful spend on reports the system will not read.

**Pre-generating 4 audiences for only block + human_review.** Assume the block + human_review share is approximately 10-15% of traffic (the conservative side of the distribution; production fraud-detection systems land in this range for the union of the two enforcement-action dispositions). At 10%, the marginal report cost is 0.10 * 4 * $0.001 = $0.0004 per evaluation, or approximately a 20% bump on the ~$0.002 engine baseline at the per-evaluation level -- which corresponds to approximately a +10% bump on total API spend once you normalize against the fact that report generation only fires on a fraction of total volume. At 15%, the bump is closer to +15% total spend. Both are acceptable for a portfolio project; both stay acceptable at production scale.

**On-demand reports for allow + safe_completion.** Zero additional cost until a consumer requests them. When a request lands, the first generation costs the per-audience figure ($0.001 nominal); the cache cost is approximately zero for subsequent reads. For the realistic spot-check pattern -- a weekly audit reads a sampled subset of `allow` decisions, each spot-check audience is generated once and then served from cache for any subsequent re-read -- the steady-state cost is dominated by the first-read generation cost and is small in aggregate.

**Sensitivity to disposition share.** The +10% spend assumption depends on block + human_review staying at or below approximately 15% of volume. If the share is higher (Steven's Q2 below tracks this as the dominant cost-model risk), the hybrid becomes more expensive linearly -- at 25% share, the spend bump is approximately +25%. The bound at which the hybrid loses to "on-demand for everything" is approximately the share at which the cost of pre-generated reports for unread cases exceeds the cost of on-demand reports for read cases; given that block / human_review reports are nearly-always read by at least one audience, the hybrid stays defensible up to relatively high shares (well above 50%).

**Marginal cost of the closed-set vocabulary.** Adding a fifth audience (`end_user` per §5, in the eventual Full scope tier) at the same +10% disposition share is a 25% increase in the per-evaluation report cost (from 4 audiences to 5) -- so approximately a +12.5% total spend bump rather than +10%. Still within acceptable bounds; flagged here so the future Full-tier cost analysis lands on a consistent baseline.

## 8. Architectural placement -- NOT an engine stage

The report generator is a post-Stage-4 consumer, not a new engine stage. This is the load-bearing architectural invariant the feature respects, and it is the property that makes the hybrid strategy implementable as a separable layer.

**Reads persisted envelopes from the data track's Postgres store.** The report generator reads the persisted envelope record (sanitized by default per the data track's PII sanitization spec at `docs/memos/2026-05-28-data-track-scoping.md` §4) and produces report records that reference back to the envelope by `evaluation_id`. The dependency on the data track shipping Compliance-ready tier is explicit and load-bearing: the report generator cannot start implementation until persistence exists.

**Lives in `src/lib/report-generators/`.** The module path is intentionally separate from `src/lib/safeeval-v5.js` and `src/lib/safeeval.js` -- the engine modules stay pure; the report generator is a downstream consumer with its own module tree. The internal shape (one file per audience, plus a shared utility module for prompt assembly and cache interaction, plus an index) is an implementation concern for the implementation dispatch; the architectural placement is the scoping memo's concern.

**Audience definitions as closed-set ontology vocabulary.** The audience names (`reviewer`, `trust_safety_lead`, `legal`, `exec_summary`, `end_user`) are closed-set vocabulary; each audience name has an associated prompt skeleton in the policy-owned artifact directory (proposed `docs/report-prompts/<audience>.md` -- the exact path is an implementation detail). The closed-set discipline means lockstep applies: the audience set in code must match the audience set in docs, and the per-audience prompt files must be referenced by `report_<audience>_prompt_hash` in the report record.

**Writes reports to a `reports` table in the data track store.** One row per `(evaluation_id, audience, report_prompt_hash)` combination; the table participates in the data track's PII redaction conventions (reports inherit the sanitization of the source envelope -- placeholders flow through into the report text). The schema is the data track's authorship surface; the report generator's contract with the table is "given an evaluation_id and an audience, produce a report record; given an evaluation_id and an audience, look up an existing report record."

**Sanitized by default; two-key access for legal.** The default read path returns reports whose underlying envelope was the sanitized version (placeholders for redacted PII). The `legal` audience is the one register that, depending on regulatory context, may require unredacted access -- not for the user-PII-protection bright-lines policy reasons that motivated the sanitization spec, but for chain-of-custody record-keeping where the unredacted input is the actual evidence the regulatory framework requires. The data track's two-key access tier (the `pii_reviewer` role per `docs/memos/2026-05-28-data-track-scoping.md` §4.5) is the existing surface; the legal audience report can optionally re-run against the unredacted envelope when the role-check passes. Whether this is gated on an explicit role-check or always permitted within the legal audience is one of the open questions in §10 (Q4).

## 9. Three scope tiers

**MVP scope (~1-2 dispatch budgets).** `reviewer` + `exec_summary` audiences only. Pre-gen on block / human_review. No caching layer (every read regenerates if no record exists; the report record itself serves as the cache substrate but no explicit invalidation logic ships). On-demand endpoint for allow / safe_completion. The two audiences picked are the two with the highest read-rate-times-value-per-read score (reviewer reads on every human_review; exec reads on every leadership briefing cycle); shipping these two first delivers the most representative slice of the audience tailoring story.

**Standard scope (recommended) (~3-4 dispatch budgets).** All four implemented audiences (`reviewer`, `trust_safety_lead`, `legal`, `exec_summary`). Pre-gen on block / human_review. Audit-metadata-keyed cache with explicit invalidation on prompt-hash or ontology-version change. Per-audience prompt hashes stored on the report record. Two-key access path for the legal audience (gating decision deferred to Q4). The Standard tier is the recommended floor; it is the tier at which the feature delivers the full audience-distinction value and the cost model holds.

**Full scope (~5-6 dispatch budgets + a disclosure-policy memo as prerequisite).** Standard + `end_user` audience. Requires the disclosure-policy memo (the prerequisite flagged in §5 and queued in §10 Q1) to land before implementation can begin. Implementation extends the closed-set vocabulary, adds the fifth audience prompt skeleton, and applies the disclosure-policy constraints to the prompt (the constraints are policy-track artifacts written by the disclosure-policy memo). Full tier is the destination, not the immediate ship.

**The deferral at the tier boundary.** Standard is shipped without `end_user`; Full is unblocked when the disclosure-policy memo lands. The recommendation is to ship Standard now (post-data-track) and defer Full pending the disclosure-policy memo. The escalation in §10 Q1 records this as `default-accept` per Steven's locked choice.

## 10. Risks

**R1. End-user disclosure policy slips and customer-facing reports get demanded before the guardrails exist.** The Full tier requires the disclosure-policy memo; if a stakeholder (Legal, GTM, customer success) requests end-user-facing report capability before that memo lands, the team is in a position of either shipping end-user reports without the disclosure guardrails (a permanent corpus-degradation event, since once the bright lines are public they are no longer load-bearing in fraud detection) or refusing to ship and absorbing the stakeholder pressure. Mitigation: §5's explicit deferral and the §11 adversarial-review treatment, plus the open question in §10 Q1 surfacing the disclosure-policy memo as a named queued artifact rather than an implied dependency.

**R2. Pre-generation cost ratio misestimated.** The +10% spend assumption depends on block + human_review staying at or below approximately 15% of volume. If the share is higher -- because the engine is tuned to be more cautious at the disposition cascade, or because traffic skews more adversarial than baseline -- the hybrid's cost bump is proportionally larger. At a 25% share the bump is +25%; at higher shares it stays linear. Mitigation: the cost model is sensitive to disposition share and the planning numbers should be refreshed against actual production traffic in the first month post-ship of Standard tier; the §10 Q2 open question routes the Standard tier adoption through Steven for the scope decision rather than treating the cost analysis as settled.

**R3. Audience prompt drift across reports for the same evaluation.** If the per-audience prompt skeletons are revised without versioning discipline, two reports for the same evaluation could be generated against different prompt skeletons and produce subtly different content for the same audience. Mitigation: per-audience `report_<audience>_prompt_hash` in the report record (and in the cache key) means any prompt revision lands as a new hash and the cache misses cleanly; the report record's hash is the authoritative version pointer for what produced the content. This mirrors the engine's stage-prompt-hash discipline.

**R4. Cache invalidation gaps when ontology / policy amendments land.** When the FAF gets a typology amendment, an L3 vocabulary addition, or a threshold revision (the kinds of changes the policy track routinely lands), the `ontology_version` participates in the engine's `cache_key`, which means the envelope cache for affected evaluations invalidates. The report cache must also invalidate at this boundary. Mitigation: the `cache_key` is already a component of the report cache key per §6, so the existing data-track invalidation flow extends to the report layer for free. The risk is that this property is documented but not tested; a regression test in the implementation dispatch should exercise the ontology-amendment cache-invalidation path end-to-end.

**R5. Report generator as a parallel surface for prompt injection.** The envelope contains the sanitized original input as a placeholder-redacted field. The placeholders themselves are deterministic strings (per the data track's spec) but the surrounding text -- the sanitized version of the input -- could in principle contain prompt-injection content that survived sanitization. The report generator's LLM call therefore consumes attacker-controllable text. Mitigation: defensive prompting at the report-generator layer (system prompt explicitly bounds the output format; the input envelope is wrapped in delimiters; the prompt instructs the model to treat the envelope contents as content-to-summarize, not as instructions); threat model documents this surface in the same way the engine's input-handling does; the implementation dispatch includes adversarial test fixtures targeting injection through the envelope's input field. The threat-modeler skill should produce a per-audience threat model addendum at implementation time.

## 11. Alternatives evaluated (rejected)

The rejected alternatives from §2 / §3, gathered with their dispositive reasons in compact form for §9-style downstream summary:

**B. Pre-generate all audiences for all evaluations.** Rejected -- doubles the per-evaluation cost on the 85%+ of cases that go unread; pushes the cost of unread reports onto the most-latency-sensitive engine response path; produces no marginal value over the hybrid for the cases that matter.

**C. On-demand only for everything.** Rejected -- adds latency to the reviewer workflow at the highest-attention moment in the adjudication interaction; means the first reader of every consequential case pays full generation cost rather than reading from cache; breaks the customer-comms latency expectation for T&S leads who need plain-language reports within minutes of a block decision.

**D. One generic report, no audience tailoring.** Rejected -- misses the central feature value (the entire feature is the audience-tailored translation); cannot satisfy mutually-exclusive format requirements (chain-of-custody legal record + 80-word exec top-line); lands at the median across registers and is wrong at every register.

**E. Generate reports inside the engine as Stage 5.** Rejected -- couples the engine to consumer use cases and violates the "engine stays pure" architectural invariant; collapses to alternative B with worse engineering ergonomics; drags the engine's replayability story into a domain (consumer-shaped output) where artifacts churn at a different cadence than the engine's closed-set vocabulary.

## 12. Open questions for Steven (escalation field per fifth atomic amendment §6 convention)

1. *(escalation: default-accept, rec: defer end_user to a separate disclosure-policy memo)* **End-user audience deferral -- confirm the deferral and ship Standard tier without it?** Per §5 and §9, the recommendation is to ship the four implemented audiences as Standard tier and defer end_user pending a separate disclosure-policy memo. The deferral is explicit, time-bound by the disclosure-policy memo's authoring, and refused-as-an-unforced-error in §11's adversarial review. Default-accept: confirm the deferral unless Steven wants to commission the disclosure-policy memo as a same-cycle prerequisite.

2. *(escalation: route-to-steven, reason: scope-tier decision affects work plan and is a public-artifact materiality trigger per §6.1 #2 -- the audience set is hiring-reader-visible once Standard tier ships)* **Standard scope tier (four audiences) -- adopt?** MVP (two audiences) is the minimal demonstration; Standard (four audiences) is the recommended floor; Full (five audiences) is gated on the disclosure-policy memo. The Standard recommendation balances feature completeness against dispatch budget and is the tier at which the closed-set vocabulary delivers its load-bearing property. Route to Steven for the scope decision because the audience set, once shipped, is the public-artifact surface the feature presents to a hiring reader; the visible scope is the scope.

3. *(escalation: default-accept, rec: store per-audience prompt hashes on the report record only, not in the engine envelope)* **Per-audience prompt hashes -- envelope or report record?** The audit-metadata fields on the engine envelope (`stage1..4_prompt_hash`) capture the engine surface; adding `report_<audience>_prompt_hash` to the envelope would churn the engine schema for a consumer concern. Storing them only on the report record keeps the engine envelope stable and lets the report layer evolve its prompt set without dragging the engine schema with it. Default-accept: store on report record only unless Steven wants the report prompt hashes to be visible at the envelope layer for replay-API uniformity.

4. *(escalation: route-to-steven, reason: touches compliance posture; the access-control gating for the legal audience is the load-bearing access-control decision at the report layer)* **Legal audience access to unredacted envelope -- gated on explicit role check or always permitted within the legal audience?** The data track's two-key access tier provides the `pii_reviewer` role on a per-row basis; the question is whether the legal audience's report-generation path can always re-run against the unredacted envelope (because the legal audience IS the audience that needs unredacted access for chain-of-custody) or whether the role-check is required even within the legal audience (because the role-check is the access-control surface and bypassing it for a class of audiences weakens the safety property). Route to Steven because the decision is a compliance-posture question, not a cost or ergonomics question; the right answer depends on what regulatory framework the system claims to operate under.

5. *(escalation: default-accept, rec: match the data track's 90-day live tier for report retention)* **Report cache TTL -- bounded at 90 days matching the data track live tier, or unlimited within Postgres?** The source envelope ages out of the live tier at 90 days per the data track's two-tier-storage decision; if the report record outlives the envelope, the report references a row that no longer exists in live storage (and reads have to hit the archive tier for the underlying envelope, slowly). Matching the report TTL to the envelope TTL keeps the report and source retention aligned and avoids the cross-tier-reference problem. Default-accept: match the 90-day live tier unless Steven wants longer-horizon report retention for the audit trail.

## 13. Adversarial review

Required by the design-memo-author skill (mode C is the dedicated adversarial-review mode; mode A memos still include an adversarial review section to satisfy the same property). Two strongest counter-arguments, each with a refutation.

### 13.1 The strongest case against the hybrid generation strategy

> *Pre-generating only for block / human_review means reviewers handling allow / safe_completion cases pay a latency tax when they spot-check, and spot-checking is exactly the discipline a false-positive audit program needs. The hybrid optimizes for the cases reviewers will see anyway and disinvests in the cases the audit program is supposed to surface. A serious false-positive program reads allow / safe_completion as a working discipline, not as an exceptional event; the latency the hybrid imposes on the working discipline is a false economy.*

Refutation in three parts:

**(a) Spot-checking happens at known cadences, latency is acceptable at those cadences.** False-positive audit programs run as weekly or biweekly batch reviews, not as interactive real-time inspection. A reviewer pulling a batch of 50 sampled allow / safe_completion cases for the weekly audit can absorb 1-3 seconds of generation latency on the first read of each case (50-150 seconds total across the batch). This is not the latency-critical reviewer workflow; the latency tax is paid in a batch context where it is negligible.

**(b) The audit-metadata cache means once a spot-checked case has been viewed, subsequent reads are free.** A spot-checked case that gets discussed in a follow-up review meeting, referenced in a typology amendment proposal, or cited in a legal exposure analysis is read multiple times by multiple consumers. The first read pays the on-demand cost; every subsequent read hits the cache. The total cost of the audit program over the cases it actually surfaces is dominated by the first reads and amortizes against subsequent reads.

**(c) The alternative (pre-gen everything) burns 10x the budget for marginal latency improvement on rarely-read reports.** Pre-generating all audiences for all evaluations means the system pays the full audience-set cost on the ~85% of evaluations that the audit program will never sample. The audit program reads a small fraction of allow / safe_completion (call it 1-5% of those dispositions, conservatively); pre-generating for 100% to serve a sample of <5% is the wrong cost-per-utility ratio. The hybrid is the correct allocation; the counter-argument's premise is right (false-positive auditing is load-bearing) but its solution (pre-generate everything) is wrong (the cost is mis-allocated).

The adversarial review can downgrade confidence on the hybrid recommendation, per the design-memo-author skill rule that adversarial review can argue defer-instead-of-accept or partial-adopt-instead-of-full-accept. The downgrade available here is partial: if the audit program turns out to be reading a significantly larger fraction of allow / safe_completion than the cost model anticipates (say >15-20%), the right correction is to widen the pre-generation window for allow / safe_completion to include cases sampled by the audit program (a configurable hybrid threshold), not to flip to pre-gen-everything. The recommendation remains Standard hybrid; the partial downgrade is "revisit the pre-gen threshold after one full audit cycle's worth of data."

### 13.2 The strongest case for INCLUDING end_user in this memo's scope

> *Deferring end_user creates an artifact gap where the system can block users but not explain why, which is itself a customer-trust and regulatory exposure. The four implemented audiences are all internal; an external-facing feature that produces a report for the regulator (legal) but no report for the actual person who was blocked is a half-finished public-policy story. Shipping internal reports without the end-user counterpart looks like a deliberate choice to inform every internal stakeholder about a block decision except the person the decision was about. That is a story that does not survive a hostile read.*

Refutation in three parts:

**(a) The deferral is explicit and time-bound, not an indefinite punt.** The disclosure-policy memo is named in §5 as the prerequisite; the open question in §10 Q1 records the deferral with `default-accept` and the recommended path forward. The artifact the deferral produces is a queued memo, not an unspoken gap. The half-finished story criticism applies to a deferral with no successor; the deferral here has a named successor.

**(b) Shipping end-user reports without disclosure policy is worse than not shipping them.** The bright-line indicators the engine relies on are public-once-revealed; once revealed they degrade in fraud-detection value because adversarial users avoid them. An end-user report that says "you were blocked because the engine detected [bright-line indicator]" hands the evasion playbook to the next adversarial user who reads it. The damage is not recoverable -- the bright line is publicly known thereafter, the corpus of evaluations the engine produces is permanently shifted toward whatever evasions the new public knowledge enables. Shipping reports without disclosure policy creates a worse outcome than shipping no end-user reports at all; the half-finished story is the lesser harm.

**(c) The four implemented audiences cover the consumers who need reports most urgently.** Reviewers adjudicating cases, T&S leads handling escalations, legal counsel reviewing exposure, and execs receiving briefings are the four readers whose lack of report access translates to a direct operational cost today (the manual-translation tax in §1). The end_user audience's lack of report access translates to a customer-experience cost that is real but lower-velocity (the user has already been blocked; the report is post-hoc context). Prioritizing the four whose lack of access is acute over the one whose lack of access is chronic-but-tractable is the correct sequencing for a Standard tier ship.

The adversarial review can downgrade confidence on the end_user deferral by arguing for a tighter time-bound on the disclosure-policy memo's authoring -- "defer with a named due date" rather than "defer with a named successor memo." That is a reasonable concession the recommendation can absorb: the disclosure-policy memo should be queued as a follow-up dispatch within the same scoping-memo cycle as this one, not left as a vague future intention. §14 closure restates this as the action item: file the disclosure-policy scoping brief at the same time as filing the report-generator implementation dispatch.

## 14. Sequencing dependency

Implementation gates on the data track shipping Compliance-ready tier (per `docs/memos/2026-05-28-data-track-scoping.md` §7.2). The report generator reads persisted envelopes from the data track's Postgres store; without persistence, there is nothing to read from. The data track's PII sanitization spec (`docs/memos/2026-05-28-data-track-scoping.md` §4) is also load-bearing: the report generator's default read path consumes sanitized envelopes, so the sanitizer must be implemented before the report generator can produce reports against real evaluations.

**The scoping memo can author NOW in parallel with data track implementation.** The audience definitions, the generation strategy, the cost model, the architectural placement, and the open questions are all independent of whether the persistence layer is shipped yet. The scoping work is the artifact this memo produces; the implementation is a separable downstream artifact.

**Implementation cannot start until persisted envelopes exist.** The implementation dispatch -- a `src/lib/report-generators/` module land, four audience prompt skeletons, a cache layer, an on-demand endpoint, a `reports` table migration on the data track's store -- has no testing surface and no integration target until the data track is at Compliance-ready. Filing the implementation brief before the data track ships is premature.

**Recommended filing pattern.** File the report-generator implementation brief AFTER the data track Compliance-ready ship. Concurrently with this scoping memo's commit-bounce, file the disclosure-policy scoping brief (the §11 adversarial review's partial-downgrade absorption) so that the end_user deferral has a named, queued successor memo and is not a vague future intention.

## 15. Track ownership

Cross-cutting work. **Policy is the primary owner** -- audience definitions and per-audience prompt skeletons are policy artifacts subject to lockstep with the audience vocabulary; the audience set is a closed-set ontology that follows the same authorship and amendment conventions as the L1/L2/L3 typology vocabularies. Per-audience prompt revisions are policy-track changes that participate in the existing FAF revision discipline; the prompt-hash bookkeeping at the report layer extends the engine's prompt-hash discipline to a new surface.

**Engineering wires the generation pipeline and caching.** The `src/lib/report-generators/` module, the on-demand endpoint, the cache logic, the prompt-hash computation, and the integration with the data track's `reports` table are engineering-owned. The engineering surface implements the policy-authored audience specifications; the policy surface owns what the audience reports must contain and not contain.

**Data track stores the report records.** The `reports` table DDL, the indexes, the relationship to the `evaluations` table, the participation in the PII sanitization conventions, and the two-tier-storage interaction (do reports get archived to the cold tier along with their source envelopes at 90 days, per Q5) are all data-track-owned.

**Architect gates the sequencing.** The cross-track dependency (engineering blocked on data track; policy authors the prompt skeletons in parallel) is the architect's coordination surface. The implementation dispatch's existence is gated on the architect confirming that the data track has shipped Compliance-ready and that the policy track has authored the prompt skeletons; the architect's gating role is the standard cross-track sequencing role per the parallel-tracks framework.

The tracks involved -- policy, engineering, data, architect -- are all existing tracks. No new track is required; no atomic amendment to the parallel-tracks framework is required for this feature.

## 16. Closure

Scoping memo ready now (recommends-only; the substantive content is the audience vocabulary, the hybrid generation strategy, the cost model, the architectural placement, and the open questions); implementation blocked on data track Compliance-ready ship; end_user audience requires a separate disclosure-policy memo authored in parallel with this scoping cycle as a queued follow-up dispatch before Full-tier scope expansion.

**Decisions-log entry NOT generated.** This memo is a feature-scoping document, not a FAF-policy decision in the `docs/policy-spec-v5.0.md` section 9 sense. The closed-set audience vocabulary, when ratified by the implementation dispatch landing, becomes a vocabulary-extension event that may merit a section 9 entry at that point; the scoping decision itself does not.
