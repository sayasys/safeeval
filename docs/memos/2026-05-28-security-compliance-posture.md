# Security and compliance posture -- parallel-tracks framework concern

**Status:** draft, recommends-only (memo proposes a phased model; no track additions applied, no framework amendment authored here)
**Date:** 2026-05-28
**Author:** `safeeval-tracks-architect` (Cowork), via `safeeval-agents:design-memo-author` (mode A)
**Companion to:** `docs/memos/2026-05-24-parallel-cowork-tracks.md` (canonical parallel-tracks framework, §4 track scope, §4.4 ownership map, §4.6 architect scope, §4.9 per-track observational lens added in the third atomic amendment 2026-05-27), `docs/memos/2026-05-27-tracks-refinement-audit.md` (architect's per-track instruction refinement), `docs/memos/2026-05-27-proactive-discovery-generalized.md` (precedent for architect-track proactive cadence), `handoff/reference/07-dispatch-integration.md` (Dispatch routing layer; prefix grammar that would need extending if sec / compl become tracks), `docs/OPERATOR-QUICKSTART.md` (project-instruction prompt index that would grow if new tracks are added).
**Scope:** decide whether security and compliance should join policy, design, engineering, QA, and the in-flight data track as parallel SafeEval tracks; propose a phased model with concrete promotion criteria; specify what a follow-on seventh atomic amendment must add if Phase 1 is approved. The memo does not author that amendment.

## 1. Problem statement

Steven asked the architect whether security and compliance should become parallel tracks alongside policy, design, engineering, QA, and the data track (which is being scoped separately right now and is queued as the sixth atomic amendment). The naive answer is yes -- add two more tracks, mirror the existing track shape, give each a CURRENT file, a dispatch prefix, a Cowork space, a weekly digest row, and a session-start ritual. The naive answer is wrong at this stage of the framework's life.

This memo argues that security and compliance are real and load-bearing concerns for SafeEval, but the work they generate today is episodic rather than continuous. The throughput-vs-ceremony principle -- which the parallel-tracks framework was constructed to honor -- says that a track without continuous in-flight work generates more ceremony than throughput. The right structural answer is a phased model: start as role-prefixed asks within the architect track, promote to siloed agents when episodic cadence sustains, and only promote to full tracks if SafeEval's posture changes materially (commercial product, paying customers, customer-facing SLA, continuous backlog).

The memo's purpose is to (a) record the decision and its reasoning so it is not re-litigated each time a new concern arrives, (b) specify the promotion criteria so the decision is by-data rather than by-vibe, and (c) name what the seventh atomic amendment to the parallel-tracks memo must add if Phase 1 is approved.

## 2. The throughput-vs-ceremony principle

The parallel-tracks memo §4 codifies the framework axiom that every track carries a fixed coordination tax: a CURRENT file written and read every session, a dispatch prefix in the routing layer, a weekly digest row, a per-track inbox, a Cowork space's project-instruction prompt, session-start and session-end rituals, and a place in cross-track pattern scans. That tax pays for itself only when the track has continuous in-flight work -- a steady stream of asks that benefit from the persistent identity, the predecessor-archive read, the per-track observational lens (added in the third atomic amendment §4.9), and the digest-surfacing of in-flight state.

A track that generates episodic work -- one or two asks per month, separated by quiet stretches -- pays the same coordination tax without the throughput to justify it. The CURRENT file lives empty for weeks at a time. The digest row reads "no in-flight" most weeks, draining attention from the rows that have substance. The session-start ritual becomes performative because there is no predecessor-archive worth reading. The track becomes a backdoor for the architect to do work that would have been faster as a direct ask.

The framework already encodes this distinction implicitly. The architect track itself (§4.6) carries a hard guard against forwarded work and a scope statement that names cross-cutting concerns -- meta-coordination -- as its work. Cross-cutting concerns that arrive episodically (a memo amendment, a retro analysis, a cross-track pattern scan) are correctly served by the architect rather than spawning their own track. The proactive-discovery generalization memo (2026-05-27) made the same point for proactive discovery -- a concern can be served by an architect cadence without becoming a track.

Making the principle explicit here so future "should X be a track?" questions resolve by reference rather than re-litigation:

> A new parallel track is justified when, and only when, the work it would carry is continuously in flight. Episodic work is correctly served by a role-prefixed architect ask, an agent or skill, or a recurring proactive cadence. The coordination tax of a track is fixed; the throughput must be sustained to justify it.

This principle has three corollaries:

- **A concern can be load-bearing without being a track.** Security and compliance are load-bearing for any AI Trust & Safety system; they need not be tracks to be honored.
- **Promotion is by metric, not by enthusiasm.** A concern earns a track when its asks-per-week sustain at a threshold over a window, not when stakeholders feel strongly about it.
- **De-promotion is also valid.** If a track's throughput collapses, the framework should be able to collapse it back into the architect's scope rather than leaving an empty CURRENT file forever. (This memo does not author the de-promotion path, but flags it as a corollary worth recording for symmetry.)

## 3. The phased model -- three phases with promotion criteria

The memo proposes a three-phase progression for security and compliance, each phase with explicit triggers for promotion to the next.

### Phase 1 (NOW) -- role-prefixed asks within architect track

Security and compliance work enters the system as role-prefixed asks against the existing architect-track dispatch surface:

- `/safeeval-arch sec: <ask>` -- a security review, a threat-model review with a sec lens, a credential-handling audit, a posture check on a specific surface.
- `/safeeval-arch compl: <ask>` -- a compliance assessment, a regulatory-boundary check, a data-handling review with a regulatory lens, a record-of-processing audit.

The architect track already has cross-cutting view, memo amendment authority, retro discipline, and the proactive-cadence affordance generalized by the 2026-05-27 memo. It is the natural home for episodic cross-cutting work that does not justify a dedicated track. Adding two role prefixes against the existing dispatch surface costs the architect almost nothing: no new Cowork space, no new project-instruction prompt, no new CURRENT file, no new digest row beyond a sub-bullet under the architect's existing row.

Memos produced by `/safeeval-arch sec:` and `/safeeval-arch compl:` file under subdirectories to keep the architect's filing surface organized:

- `docs/memos/sec/YYYY-MM-DD-{topic}.md`
- `docs/memos/compl/YYYY-MM-DD-{topic}.md`

This is a small filing-convention addition. The seventh amendment §10 codifies it as a framework convention so it does not drift back to flat `docs/memos/` filing under per-author discretion.

**Promotion criterion (Phase 1 -> Phase 2):** when role-prefixed asks against either lens hit roughly one to two per week sustained over a four-week window, the lens has earned a siloed agent. The four-week window is the framework's standard "is this a pattern or a fluctuation" threshold (matches the variance-pattern-hint convention added in the second atomic amendment §5.7).

### Phase 2 (FUTURE -- when triggered) -- siloed agents

When Phase 1 promotion criterion fires for a lens, that lens becomes a siloed agent following the existing `safeeval-agents:*` pattern. Working names:

- `safeeval-agents:security-reviewer`
- `safeeval-agents:compliance-auditor`

Each agent is invoked on demand by the architect, by any track, or by Steven directly. The agent carries its own operating rules, its own mode references (analogous to design-memo-author's mode A / B / C / D), and its own filing conventions. It does not carry a CURRENT file, a dispatch prefix, or a weekly digest row. It is reachable through the Skill tool when needed; otherwise it is silent.

This is the same architectural pattern that `safeeval-agents:enforcement-designer`, `safeeval-agents:policy-author`, `safeeval-agents:classifier-translator`, and `safeeval-agents:design-memo-author` (the agent this memo was written through) already use. The pattern is proven, has known performance characteristics, and integrates with the existing bundle-agent-skill workflow.

**Promotion criterion (Phase 2 -> Phase 3):** SafeEval becomes a commercial product with paying customers AND security or compliance work is continuous -- multiple simultaneous in-flight reviews, not episodic asks. The continuous-backlog requirement is the load-bearing piece. A commercial posture alone does not justify a track; many commercial products serve security and compliance via on-demand agents or contracted reviewers. A track is justified only when the throughput of in-flight work makes the coordination tax pay for itself.

### Phase 3 (UNLIKELY in current scope) -- full tracks

A full track for security or compliance means dedicated CURRENT files (`CURRENT_sec.md`, `CURRENT_compl.md`), dispatch prefixes (`/safeeval-sec`, `/safeeval-compl`), weekly digest rows, dedicated Cowork spaces with project-instruction prompts, per-track inboxes (`inbox/sec.md`, `inbox/compl.md`), per-track observational lenses surfaced in the framework, and session-start rituals.

This is the right shape only when there is a customer-facing SLA on response time (a security finding must be triaged in N hours) AND continuous backlog (multiple simultaneous in-flight reviews). For SafeEval today -- a portfolio AI Trust & Safety framework demo with no paying customers and no SLA -- Phase 3 is overkill. The memo documents Phase 3 specifically so future readers do not backslide into "we should just make them tracks" without re-encountering the throughput-vs-ceremony argument.

If Phase 2 promotion criterion fires (which today seems unlikely on a horizon shorter than commercialization), the architect track at that time re-authors this memo's §3 to update the Phase 3 trigger language with the then-current evidence.

## 4. What Phase 1 work looks like in practice -- concrete examples

Four worked examples of Phase 1 asks, each grounded in actual or near-future SafeEval surfaces:

- **`/safeeval-arch sec:` -- threat-model review of the data track's PII sanitization design (cross-cuts engineering + data + compliance).** The data track is being scoped in parallel with this memo; its anticipated remit includes a PII sanitization step before fixtures and audit logs leave the local boundary. A sec lens asks: does the sanitization design fail open or fail closed? What is the residual reidentification risk after sanitization? Is the cryptographic boundary the right shape, or is plaintext fingerprintable? The output is a memo under `docs/memos/sec/` recording the review, the threats considered, the residual risk, and any recommendations routed back to the data track via `inbox/data.md`.

- **`/safeeval-arch sec:` -- credential-handling audit before SafeEval API endpoints launch publicly.** The synthetic-media scoping memo and the broader portfolio direction both contemplate a public API surface. A sec lens asks: how are detector API keys (HF, Gemini) provisioned, rotated, scoped, and logged? Does the envelope schema expose them inadvertently? Are rate-limit signals from upstream detectors leaked to clients in a way that helps a probe map the stack? The output is a memo under `docs/memos/sec/` and recommendations routed back to engineering via the standard inbox pattern.

- **`/safeeval-arch compl:` -- review whether the audit-metadata fields satisfy GDPR Article 30 ("record of processing") requirements.** SafeEval's classification envelope carries audit metadata (timestamps, model versions, ontology versions, disposition rationale). A compl lens asks: do those fields meet GDPR Article 30's record-of-processing requirements (purpose, categories of data subjects, categories of personal data, recipients, retention)? Are there gaps that would block an EU-resident user from exercising data-subject rights against a SafeEval deployment? The output is a memo under `docs/memos/compl/` with a gap analysis and recommendations.

- **`/safeeval-arch compl:` -- assess whether the PII redaction spec is sufficient for HIPAA-adjacent workloads (in case a healthcare customer ever asks).** SafeEval has no healthcare customer today. The compl lens asks the speculative-but-cheap version of the question: if such a customer asked tomorrow, would the existing PII redaction approach pass a HIPAA covered-entity workload? What would have to change in the data-handling spec to make the answer yes? The output is a memo under `docs/memos/compl/` framed as a posture check, not a current-conformance claim.

Each example shows the pattern: an architect ask under a sec or compl lens produces a memo under the corresponding subdirectory, with recommendations routed back to the owning track via the standard inbox-notification mechanism. The architect does not implement the recommendation; the owning track adopts or rejects per its normal cadence. The architect's lens is recommends-only by construction, mirroring qa's recommends-only discipline codified in the parallel-tracks memo §4.8.

## 5. Cross-cutting concerns the architect already owns vs. what is new

The architect already handles framework changes (memo amendments, §4.6), retro discipline (cross-track pattern scans, retro analyses), proactive-cadence work (the generalized affordance from the 2026-05-27 memo), and meta-coordination questions ("should this be a track?" -- the question this memo answers). Security and compliance reviews are a natural extension: each asks a cross-cutting question with a specific lens applied to an existing design, amendment, or proposed change. They are not a new architect function; they are two new lenses through which the architect's existing cross-cutting view operates.

Framed this way:

- **Architect's existing scope:** "Does this design, amendment, or proposed change introduce framework drift, ownership ambiguity, or coordination overhead?"
- **New sec lens:** "Does this design, amendment, or proposed change introduce a security risk that the owning track is not equipped to evaluate?"
- **New compl lens:** "Does this design, amendment, or proposed change cross a regulatory boundary that the owning track is not equipped to evaluate?"

All three are recommends-only architect outputs. All three route findings back to the owning track via the standard inbox mechanism. None of them implement the fix.

This framing is load-bearing because it answers the strongest argument for promoting sec and compl to tracks now (the adversarial review in §11): the work is not a new architect function, it is the existing function with two additional lenses. The lenses cost less than a track each precisely because the cross-cutting view they sit on top of already exists.

## 6. What gets filed under sec and compl in Phase 1 specifically

Concrete filing conventions for the seventh amendment to codify:

- **Memos:** `docs/memos/sec/YYYY-MM-DD-{topic}.md` and `docs/memos/compl/YYYY-MM-DD-{topic}.md`. Subdirectory naming keeps the architect's filing surface organized; the existing flat `docs/memos/` directory has 29 entries today and will grow continuously. Subdirectories prevent the sec / compl memos from drowning the architect's other memo output (framework amendments, retros, scoping memos for non-sec / non-compl concerns).
- **Architect digest sub-bullets:** the architect's existing weekly digest row gains two sub-bullet lanes -- `sec:` and `compl:` -- under which each Phase 1 ask is enumerated with a one-line status. The sub-bullets surface the asks at digest time without requiring a separate digest row for either lens. The architect digest template gains a "sec/compl pending" count field per §8's mitigation against deprioritization.
- **No CURRENT files for sec or compl in Phase 1.** Asks live in the architect's CURRENT.md as needed; when the ask completes, its closure is logged in the architect's normal closure flow. The absence of a CURRENT_sec.md and CURRENT_compl.md is intentional and load-bearing -- it is the structural assertion that sec and compl are lenses, not tracks.
- **Routing back to owning tracks:** findings from a sec or compl memo route to the owning track's inbox (`inbox/policy.md`, `inbox/engineering.md`, `inbox/data.md`, `inbox/design.md`, `inbox/qa.md`) using the existing inbox-notification mechanism. The owning track adopts or rejects per its normal cadence. The architect does not enforce adoption; the architect surfaces.
- **Promotion to Phase 2** requires creating the agent definitions (`safeeval-agents:security-reviewer` and `safeeval-agents:compliance-auditor` skill bundles), reorganizing the existing Phase 1 memos under the agent's own filing convention (likely still `docs/memos/sec/` and `docs/memos/compl/` but with the agent named as the author in the memo frontmatter rather than the architect), and updating the seventh amendment to record the Phase 2 promotion as it happens.

## 7. Risks of the phased approach

Five named risks. Each is real, each is mitigated in §8, none individually is dispositive against the phased model.

- **R1: Security work gets deprioritized because it is "just an architect ask" not a track with its own throughput pressure.** A track's CURRENT file generates pressure to advance it; an architect ask competes against other architect asks and may be deferred indefinitely if higher-priority cross-cutting work arrives.
- **R2: Compliance reviews happen reactively (when a customer asks) instead of proactively.** Without a track's cadence pressure, compliance work tends to be reactive: a regulatory inquiry, a customer questionnaire, a contract negotiation. A reactive posture is dangerous because compliance gaps tend to surface in the worst possible context (an audit, a breach disclosure, a regulator letter).
- **R3: Architect track becomes overloaded if Phase 2 trigger conditions are not watched.** The phased model relies on the promotion criterion firing when sustained throughput justifies a siloed agent. If the architect absorbs sec / compl asks indefinitely without surfacing the throughput growth, the architect's bandwidth degrades while the data that would trigger promotion never gets surfaced.
- **R4: Sub-directory convention (`docs/memos/sec/`, `docs/memos/compl/`) drifts if not codified.** A convention introduced by this memo without a framework amendment will erode within a few cycles -- some sec memos will land flat under `docs/memos/`, the subdirectories will be inconsistent, future readers will not know whether to look in `docs/memos/sec/` or `docs/memos/`.
- **R5: Promotion criteria too soft, leading to premature track creation OR too hard, leading to permanent under-investment.** The "one to two asks per week sustained over four weeks" threshold is a guess. If too soft, the architect will create a track for a temporary spike of asks that subsides after the spike passes (the track becomes ceremony again, exactly the failure mode the principle in §2 names). If too hard, sec / compl will remain in Phase 1 indefinitely even when promotion is warranted.

## 8. Mitigations for each risk

Each mitigation is concrete and implementable in the seventh amendment or in adjacent architect cadence.

- **M1 (against R1):** the architect's weekly digest template gains a `sec/compl pending` count field surfacing the number of in-flight asks under each lens. Deprioritization becomes visible at the cadence the digest reads, not buried in the architect's CURRENT history.
- **M2 (against R2):** the architect pre-commits to a recurring `/safeeval-arch compl:` posture check on a monthly cadence (the first Friday of each month, say). The cadence is recorded in the architect's project-instruction prompt and surfaced in the digest. Compliance work happens proactively because the cadence forces it, not because a customer asked.
- **M3 (against R3):** the architect tracks the Phase 2 trigger metric (asks-per-week per lens, sustained-week-window) in the digest from day one of Phase 1. The metric is visible at every digest reading; when it crosses the promotion threshold, the architect proposes Phase 2 promotion in the next architect-track ask cycle. The metric is also the early-warning signal for architect overload -- if the metric is climbing but Phase 2 has not been triggered yet, the architect has cover to push back on lower-priority cross-cutting asks while the promotion ships.
- **M4 (against R4):** the seventh atomic amendment codifies the `docs/memos/sec/` and `docs/memos/compl/` filing convention as a framework rule, with a one-line entry in the parallel-tracks memo's §4 or §5 (architect's filing-convention sub-section). Filing-convention drift is recoverable when the rule is in the framework; not recoverable when it lives only in a working memo.
- **M5 (against R5):** the promotion threshold (one to two asks per week sustained over four weeks) is recorded in the seventh amendment with explicit language that the threshold is calibrated downstream by data, not by intuition. The architect's first quarterly retro after Phase 1 ships includes a "did the threshold fire correctly?" question. If the threshold is wrong, the retro proposes a recalibration via an eighth atomic amendment. The threshold is by design tunable rather than load-bearing.

## 9. Alternatives evaluated

Five alternatives considered, three explicitly rejected, two implicit in the phased model itself.

- **A. Add sec and compl as full tracks now.** Rejected. This is the naive answer the §1 problem statement names. It creates ceremony without throughput (R1 inverted -- the tracks would have empty CURRENT files most weeks), dilutes architect authority by removing cross-cutting concerns from the architect's natural scope, doubles the dispatch routing surface for episodic work, and forces calibration of two new track identities (project-instruction prompts, session-start rituals, observational lenses per §4.9) at a moment when neither lens has the sustained ask volume that would let calibration converge. The Phase 1 -> Phase 2 -> Phase 3 progression in §3 routes around all four costs while preserving the option to promote when the data demands it.

- **B. No sec / compl framework at all -- handle ad-hoc.** Rejected. Ad-hoc handling means sec and compl work happens when someone notices it and falls off when they do not. There is no audit trail of what was reviewed, no filing convention to find prior reviews, no cadence to surface deprioritization, and no metric that would trigger promotion. The phased model preserves the lightweight character of ad-hoc handling (no new tracks) while adding the minimum structure to make the work visible and auditable (subdirectory filing, digest sub-bullets, promotion metric).

- **C. One combined "risk" track covering sec + compl + threat-modeling.** Rejected. The strongest version of this argument is: all three are recommends-only review functions with overlapping cross-cutting concerns; bundling them reduces architectural surface. The argument fails because sec and compl have structurally different question shapes:
   - **Sec asks "what can go wrong technically?"** -- threat model, attack surface, vulnerability, residual risk after mitigation. The lens is engineering-adjacent.
   - **Compl asks "what regulatory boundary applies?"** -- GDPR, HIPAA, TCPA, FCC, state law. The lens is legal-adjacent and varies by jurisdiction.
   - **Threat-modeling** is already its own skill (`safeeval-agents:threat-modeler`) with its own filing convention (`docs/threat-models/*.md`) and its own promotion mechanism (the parallel-tracks memo names it as a phase-1-only artifact under policy, transferring to a future research track in phase 2).

   A combined "risk" track would muddy three distinct lenses and create cross-disciplinary handoff friction at every memo (which sub-lane does this ask go to?). The phased model keeps sec and compl as parallel lenses with no overlap and preserves threat-modeling under its existing home.

- **D. (Implicit in the phased model) Add the sec / compl agents now, skip Phase 1 entirely.** Considered briefly; rejected on the same throughput logic that recommends Phase 1. An agent without sufficient ask volume is over-engineered: the agent's mode references go un-tested by real cases, its filing convention drifts because the body of work is too small to anchor it, and its calibration converges on a small sample that may not generalize. Phase 1 produces a body of role-prefixed-ask memos that, at promotion time, becomes the calibration corpus for the Phase 2 agent. Skipping Phase 1 forfeits the calibration corpus.

- **E. (Implicit in the phased model) Make sec and compl agents now AND set them as default skills surfaced to every track.** Considered briefly; rejected. Default-surfacing the agents (analogous to the policy track's default skills per the 2026-05-27 tracks-refinement memo) would amount to "every track does its own sec review and its own compl review," which is exactly the failure mode the architect's cross-cutting view exists to prevent. The whole point of the cross-cutting position is that one neutral lens applies across tracks; surfacing the agent to every track decentralizes the lens and recreates the ad-hoc failure mode of Alternative B.

## 10. What the seventh atomic amendment to the parallel-tracks memo must add

This memo does not author the amendment; the amendment is a separate self-amend dispatch from the architect track if Phase 1 is approved. The amendment must include exactly four additions, each with a specific anchor in the parallel-tracks memo:

1. **Add a sub-section "Cross-cutting concerns within architect" naming sec and compl as lenses.** Suggested anchor: parallel-tracks memo §4.6 (architect scope), as a new sub-section §4.6.x or §4.6.4. The sub-section names the two lenses, restates the §2 principle of this memo, names the filing convention, and points to this memo as the source.

2. **Document the `docs/memos/sec/` and `docs/memos/compl/` filing convention.** Suggested anchor: parallel-tracks memo §4.6 (next to the new sub-section in item 1), or as a sub-bullet under the architect's existing artifact-ownership row in §4.4. The filing convention is one sentence; the rule that it survives drift is its presence in the framework.

3. **Document the promotion criteria.** Suggested anchor: parallel-tracks memo §4.6 (in the same architect-scope expansion), or as a numbered list under the new sub-section in item 1. The criterion to promote Phase 1 -> Phase 2 (one to two asks per week sustained over four weeks) is recorded as the trigger threshold; the criterion to promote Phase 2 -> Phase 3 (commercial product + continuous backlog + customer-facing SLA) is recorded as a longer-horizon threshold not expected to fire in the current scope.

4. **Update the architect digest template to surface `sec/compl pending` count.** Suggested anchor: parallel-tracks memo §5 (coordination surface, where the digest template lives) or the architect's per-track row in §5.x. The digest gains a sec / compl sub-bullet pair under the architect's row with a pending-count field; the four-week-window asks-per-week metric is logged in the same digest.

The amendment is itself a §4.6 architect-track artifact (self-amend), which is the cleanest filing path. The §11 adversarial review in this memo passes specifically on the self-amend framing (the alternative -- filing as a separate brief routed through orchestrator -- adds coordination overhead without changing the substance). Open question 4 below confirms this framing with Steven.

## 11. Adversarial review (pass 2026-05-28)

### Strongest case against the conclusion

The strongest counterargument is the one Steven anticipated in the brief: *security is the kind of work where you only know you needed it after you have been breached, so under-investing now is a one-bit-of-information regret.* The argument generalizes to compliance: regulatory enforcement is sporadic and high-impact, and a posture that handles compliance reactively is a posture that learns about its gaps the worst possible way -- via a regulator letter, an audit finding, or a public breach disclosure.

Under this critique, the phased model is a Type II error: failing to build infrastructure for a class of work where the cost of failure dwarfs the cost of the infrastructure. The framework's throughput-vs-ceremony principle (§2) is well-calibrated for design or QA or engineering work where the cost of episodic-vs-continuous is symmetric. It is mis-calibrated for sec and compl, where the cost asymmetry runs in the direction of over-investment-is-safer.

A second adversarial framing: the promotion criterion ("one to two asks per week sustained over four weeks") is set against asks-volume rather than asks-impact. A single high-impact sec ask (a real vulnerability) per quarter is more load-bearing than four low-impact asks per week. Asks-per-week is the wrong metric; severity-weighted-throughput would be a better one. By setting a volume metric, the phased model risks under-promoting when the work is rare-but-critical.

### Specific weaknesses in the reasoning

- **Weakness 1 (the strongest):** the §2 principle is generic. The memo applies it to sec and compl without showing that those concerns have the same asks-distribution as design or QA. Sec asks may be Poisson-distributed with low rate and high impact; design asks are roughly uniform with bounded impact. Applying a uniform-distribution principle to a Poisson-distribution domain is a category error.
- **Weakness 2:** the four worked examples in §4 are all framed as low-stakes posture checks. A real sec ask -- a discovered vulnerability, an active probe, a credential leak -- looks nothing like the four examples and would be intolerably slow as an architect ask competing with other cross-cutting work.
- **Weakness 3:** §8 M2 (proactive monthly compliance posture check) is a load-bearing mitigation against R2, but it is buried in the mitigations list rather than centered. If the proactive cadence is the load-bearing mechanism that makes Phase 1 viable, it should be in §3 as part of Phase 1's definition, not as a §8 mitigation.

### Recommended adjustment

**HOLD with two amendments.** The phased model survives the steel-manned critique but should be sharpened in two ways before promotion to the decisions log:

- **Amendment A (in §3):** elevate the proactive monthly compliance posture check from §8 M2 to a load-bearing component of Phase 1. Phase 1 is not just "role-prefixed asks within architect" -- it is "role-prefixed asks within architect PLUS a recurring proactive cadence." The cadence is what protects against R2 (reactive-only compliance) and is also a forcing function that surfaces deprioritization (R1). The memo's recommendation is to amend §3 Phase 1 description to include "AND a recurring monthly proactive `/safeeval-arch compl:` posture check" before the seventh amendment is authored.

- **Amendment B (in §8 M5):** the volume-based promotion criterion is acknowledged-imperfect; add an explicit "OR severity-weighted exception" path. Any single sec ask that surfaces a P0-grade real vulnerability (active probe, credential leak, real bypass of policy) triggers Phase 2 promotion immediately regardless of volume. The memo's recommendation is to amend §3 Phase 1 -> Phase 2 promotion language to include the severity-weighted exception path before the seventh amendment is authored.

Both amendments are small and surgical. Neither flips the conclusion. Phase 1 starts as recommended; the two amendments harden it against the steel-manned critique.

### What I cannot do here

Per the design-memo-author mode C rule, adversarial review can only downgrade confidence -- ACCEPT -> PARTIAL ADOPT -> DEFER. It cannot flip REJECT to ACCEPT, and it cannot promote Phase 1 to Phase 2 (which would amount to flipping a rejected alternative -- Alternative A -- into the chosen path). The review's authority here is to amend the phased model's §3 and §8 language as in Amendment A and B; the conclusion remains HOLD on the phased model itself.

If the steel-manned case had been stronger (e.g., evidence that a real vulnerability has surfaced and Phase 1 cannot triage it fast enough), the right action would be REROUTE: write a new draft-design-memo with the alternative "make sec a track now" proposal, separate from this memo. That route is not invoked here because the steel-manned case is precautionary rather than evidentiary.

## 12. Closure

Phase 1 starts immediately on memo approval (subject to Adversarial Review Amendments A and B); the Phase 2 trigger is the metric in the architect digest with the severity-weighted exception path; Phase 3 is parked indefinitely.

## 13. Open questions -- escalation field per fifth atomic amendment

Per the closure-report convention codified as the fifth atomic amendment in `docs/memos/2026-05-24-parallel-cowork-tracks.md` §6, each open question carries an inline `escalation:` field marking the question for routine auto-accept (`default-accept`) or for Steven's adjudication (`route-to-steven`). The three framework-level always-escalate triggers (adversarial-review self-flag, public-artifact materiality, project-boundary crossing) floor the field regardless of track confidence.

1. **`docs/memos/sec/` and `docs/memos/compl/` subdirectories, or flat under `docs/memos/` with a prefix?** `escalation: default-accept, rec: subdirectories`. Reason: the existing flat `docs/memos/` directory has 29 entries today and grows continuously; subdirectories prevent the sec / compl memos from drowning out the architect's other memo output. Prefix-only filing (e.g. `docs/memos/sec-YYYY-MM-DD-{topic}.md`) is structurally equivalent for grep purposes but is harder to read at directory-listing time. Either choice is reversible if the convention proves wrong in practice.

2. **Monthly proactive compliance posture check cadence -- adopt now?** `escalation: route-to-steven, reason: commits the architect track to a recurring work cadence, which affects bandwidth available for cross-cutting work; low cost per cycle but compounds over time`. The §11 adversarial review's Amendment A elevates this from a §8 mitigation to a load-bearing component of Phase 1, so the decision matters more than it does in §8 alone. Recommendation is to adopt; Steven adjudicates whether the cadence is the right shape (monthly first-Friday vs. quarterly vs. event-driven only).

3. **Phase 2 trigger threshold -- one to two asks per week sustained over four weeks -- calibrated right?** `escalation: default-accept, rec: adopt the threshold and recalibrate in the first quarterly retro after Phase 1 ships`. The §11 adversarial review's Amendment B adds a severity-weighted exception path that protects against the rare-but-critical failure mode; with that path in place, the volume-based primary threshold is acceptable as a starting point and tunable downstream.

4. **Should the seventh amendment be authored as a follow-on to this memo (architect self-amends), or filed as a separate brief?** `escalation: default-accept, rec: self-amend`. Reason: this memo is architect-track work; the amendment that codifies the §10 four-item additions is also architect-track work; routing the amendment through a separate brief adds orchestrator overhead without changing the substance. The 2026-05-27 atomic amendments (second and third) are precedent for architect self-amendment. The §11 adversarial review explicitly noted this framing passes; HOLD.

The single `route-to-steven` question (the proactive compliance cadence) is the one that should pause auto-chaining; the three `default-accept` questions can proceed once the route-to-steven call is made.

## 14. Decisions-log entry (for docs/policy-spec-v5.0.md section 9)

Not applicable. This memo is framework-scope (parallel-tracks governance), not a FAF-policy decision in the §9 sense (typology / sub-typology / bright-line / threshold / L1/L2/L3 enum / disposition-rule change). The Phase 1 adoption and the subsequent seventh atomic amendment both land in `docs/memos/2026-05-24-parallel-cowork-tracks.md` as amendment-log entries, not in `docs/policy-spec-v5.0.md` §9. The decisions this memo enumerates are framework-shape decisions which sit in the design-memo layer and do not promote to §9.

**Open questions enumerated:** 4 (questions 1, 2, 3, 4 in §13).
**Of which `route-to-steven`:** 1 (proactive monthly compliance cadence).
**Of which `default-accept`:** 3 (subdirectory filing, promotion threshold, self-amend framing).
