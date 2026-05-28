# Reviewer SOP -- envelope deep-dive on a flagged case

**Rule:** any envelope routed to `human_review` (and, more broadly, any flagged envelope a reviewer is asked to confirm or challenge)
**Applies to:** all `disposition.action == "human_review"` cases regardless of `triggered_by.rules`, plus audit-mode reviews of `block` / `safe_completion` / `allow` envelopes
**Spec source:** `docs/04-enforcement-design.md` (pipeline shape), `docs/07-v5-schema.md` (envelope shape), `docs/08-v5-ontology.md` (closed-set vocabulary), `docs/03-master-policy.md` (typology framework), `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` (conversation mode and `arc:` / `cadence:` semantics)
**Last updated:** 2026-05-28

---

## 1. What this disposition means

This SOP is the cross-cutting one. The other SOPs in this directory key off a specific cascade rule (Rule 1.5 is the canonical example); this one applies whenever a reviewer at any AI Trust & Safety team needs to deep-dive a classifier envelope. Use it as the reference workflow when no rule-specific SOP exists, and as the inspection backbone when one does.

You are answering one operational question with three legal outcomes: **trust** and confirm; **challenge** because the structured evidence does not converge with the disposition; or **escalate** to policy, ops, or the engineering venue because the case is outside the SOP's design envelope. You are NOT inventing a fifth verb -- the closed four-verb vocabulary (`allow`, `safe_completion`, `human_review`, `block`) is the universe of outcomes. If a case feels like it needs a fifth, that is the escalation signal (section 9).

---

## 2. Reading the envelope -- evidence to read first

Read these fields in this order. Structured evidence sets the substantive ground; the disposition tells you what the system did with it; the narrative is the prose explanation, weighted last as a tiebreaker rather than as primary evidence.

1. **`input.kind` and the input itself.** Prompt envelope (`input.kind == "prompt"`, read `input.text`) or conversation envelope (`input.kind == "conversation"`, read `input.conversation.turns[]`). The rest of the inspection branches on this -- conversation envelopes carry Stage 0 trace and `evidence.per_turn`.
2. **`classification.l1`, `l2`, `l3`.** Read in L1 -> L2 -> L3 order. L1 is the closed domain (one of seven values: `benign`, `security_education`, `ambiguous_dual_use`, `deceptive_fraud`, `cyber_intrusion`, `privacy_abuse`, `ai_enabled_abuse`). L2 is the closed risk pattern constrained by L1. L3 is the multi-valued tag set with per-assignment confidences -- the system's structured "why" (method, tactic, target, context_marker, overlap, risk_marker, plus the new `arc:` and `cadence:` categories for conversation envelopes). If these three do not tell a coherent story, the disposition is downstream of a confused classification.
3. **`disposition.action` and `disposition.triggered_by`.** The action is one of the four verbs. `triggered_by.rules` names the cascade rule(s) that fired (`bright_line_forces_block`, `multi_risk_marker_review`, `low_l2_confidence_review`, `stage_0_parse_failure`, etc.); `triggered_by.bright_lines` carries the bright-line evidence; `policy_note` documents non-negotiability or routing rationale. Empty `rules` means the model adjudicated; a named rule means the action was locked deterministically before the model wrote prose.
4. **`evidence.bright_lines`.** When non-empty, the list pins the disposition per the Section 5 non-negotiability rule in enforcement-design, with the narrow Rule 1.5 carve-out as the documented exception. When empty on a prompt that smells dangerous, work out whether the aggregate score path or the L3 risk-marker rules carried the disposition, or whether the system missed something a bright-line should have caught (escalation candidate).
5. **`evidence.component_scores`, `evidence.aggregate_score`, `evidence.process_flags`.** The FAF substrate -- five 0-3 component signals (target / lure / trust / extract / evade), their sum, and operational process flags (Template / Delivery / Control / Trigger / Incentive). Read when bright-lines are silent or when challenging an aggregate-driven action.
6. **`prompt_summary` closed-set labels.** `topic_label`, `target_label`, `objective_label`, `pretext_label`. Drift here is the topic of the §9.1 label-drift SOP -- see section 10 for cross-reference rather than duplication.
7. **`disposition.narrative_summary` and `reasoning_summary`.** **Weight these last.** The narrative is the model's prose on top of the structured evidence; it is a cross-check and tiebreaker, not primary evidence. A coherent narrative that contradicts the structured read is a challenge signal -- the prose is downstream of the structured read and inherits its errors.

For conversation envelopes, also read **`evidence.per_turn[]`** (per-turn FAF evidence: `turn_index`, `sender`, per-turn component scores, per-turn bright-lines -- this is where you check that the arc-level disposition emerges from a defensible per-turn read rather than from one mis-attributed turn) and **`pipeline_trace.stage_0`** (the parser trace, covered in section 4).

---

## 3. Per-stage trace inspection

Walk the stages in execution order and check each stage's output against its remit.

**Stage 0 (parser; conversation mode only).** Output: `turns[]`, `parse_confidence`, `parse_warnings`, optional `modality_hint`. Verify: turn count and sender list match the source artifact; `parse_confidence` above the warn threshold; `parse_warnings` empty or benign; the SECURITY-block held (any injection-attempt turn appears as verbatim content, not as a behavioral change). Section 4 covers Stage 0 in detail.

**Stage 1 (Haiku triage).** Output: `l1_candidate`, `l1_confidence`, `coarse_context`, short-circuit decision. Verify: the candidate L1 is reasonable; confidence matches the input's clarity; any short-circuit-to-allow is consistent with the 0.98 precision floor (`POLICY_CONFIG.TRIAGE_BENIGN_PRECISION_MIN`). A short-circuited case you suspect is not benign is a high-priority challenge -- short-circuit bypasses Stage 2; the audit hook is the 10% sampling rate, not the review path.

**Stage 2 (Sonnet FAF deep analysis).** Output: the full `evidence` block (FAF nodes, component scores, aggregate, bright-lines, process flags, `prompt_summary`, L2 probabilities). Verify: bright-line emission grounded in observable prompt content (you can point at the substring); component scores in defensible ranges; closed-set labels reasonable (multi-label drift across re-runs is the §9.1 label-drift SOP's territory). Most substantive misreads originate here -- downstream stages inherit Stage 2 errors.

**Stage 3 (Sonnet classification + tool-use enforcement).** Output: the `classification` block. L1->L2 and bright-line->L2-set constraints are enforced in code via tool-use schemas; the model cannot emit out-of-set values. Verify: L2 in the L1-permitted set (and the bright-line-constrained subset when applicable); L3 tags defensible; per-tag confidences reasonable. Low L2 confidence triggers the `low_l2_confidence_review` rule at Stage 4.

**Stage 4 (rule cascade -> disposition).** Output: `disposition.action`, `triggered_by`, `policy_note`, `reasoning_summary`, `narrative_summary`. The cascade runs in the order documented in `policy-spec-v5.0.md` section 6.1. Verify: the fired rule matches the evidence; the action matches the rule; `policy_note` documents non-negotiability when applicable. Empty `triggered_by.rules` means the model adjudicated -- weight the narrative more in that case.

---

## 4. Stage 0 specific -- sender attribution sanity checks (conversation mode)

The parser is the most failure-prone stage in conversation mode. Four checks:

**Canonicalization of `__user__`.** The schema commits a reserved sender value: unnamed self-bubbles in screenshots ("Me" / "You" rendered by the source UI) MUST appear in `turns[]` as `sender: "__user__"`. The UI maps `__user__` back to the per-modality friendly label at render time -- in the envelope you see `__user__`; in the result card you see "Me" or "You". Both are correct. A literal `"Me"` or `"You"` in the envelope's sender list is a Stage 0 contract violation -- escalate to the engineering venue.

**Named senders stay verbatim.** Bubbles with a real name or handle keep that name (whitespace trimming only). A named sender collapsed to `__user__` or to a generic role like "scammer" means the parser is forward-contaminating the classifier -- escalate.

**`modality_hint` when present.** Closed set: `imessage`, `whatsapp`, `sms`, `email`, `slack`, `generic`. When present, it tells you which UI mapping the renderer will use. When absent, the renderer defaults to "Me" for self-bubbles and the audit reader infers modality from context.

**Re-parse triggers.** When `parse_confidence` is below the warn threshold, `parse_warnings` flags sender ambiguity across multiple turns, or the canonical turn list disagrees with the source artifact on turn count or order, re-parse via the preview-confirm step (the per-turn override lets the user correct the parser before the conversation reaches Stage 1). A posted envelope's sender list is already canonicalized -- the reviewer's job at confirmation time is to verify the canonicalization read the conversation correctly. If a posted envelope is wrong and the user already confirmed, escalate to the engineering venue with the source artifact attached.

---

## 5. When to trust the classifier output

Trust by default when all five hold:

- **Internal consistency.** L1 / L2 / L3 / disposition / bright-lines tell the same story; bright-lines fall in the L2-permitted set; L2 in the L1-permitted set; the disposition matches what the cascade should produce.
- **Evidence convergence.** Multiple structured signals point the same way. A `block` on `phishing_attack` with an `mfa_or_otp_harvesting` bright-line plus two relevant L3 method / tactic tags plus a high aggregate is convergent; the same disposition supported by only the bright-line is thinner.
- **Confidence patterns.** The `confidence_path` string (`triage:X -> faf:Y -> classify:Z -> disposition:W`) is climbing or stable on a confident action. A path that wavers across stages is the system narrowing-then-doubting -- weight that as a challenge signal even when the final action is clear.
- **Narrative coherence.** The `narrative_summary` reads as a fair summary of the structured evidence. Coherence is necessary but not sufficient.
- **No silent stage failure.** The `errors` array is empty or carries only benign entries (a Stage 4 timeout that fell back to the rule-derived disposition is documented degradation, not a challenge trigger on its own).

When all five hold, confirm the disposition.

---

## 6. When to challenge

Challenge when any two diverge, or when any one diverges starkly:

- **Bright-lines fire but the disposition is not `block`.** Either Rule 1.5 fired (defer to that rule's dedicated SOP) or this is a cascade-routing anomaly. If `triggered_by.rules` does not name a documented carve-out, escalate.
- **L2 names a typology with no L3 support.** L2 says `business_email_compromise` but the L3 list contains zero fraud-relevant tags (no `method:pretexting_email`, no `arc:role_stability_breach`, no `arc:money_ask_pivot`). The L2 selection is unsupported.
- **Narrative contradicts the disposition.** The prose describes an MFA-intercept request but the action is `safe_completion`. The model's prose and the cascade's action are reading the same envelope differently.
- **Low confidence on a high-stakes action.** `block` or `allow` with `disposition.confidence < 0.70`. High-stakes actions deserve high confidence; low confidence on either pole signals upstream uncertainty.
- **Per-turn evidence does not support the arc-level disposition** (conversation mode). The arc-level routing fired on `arc:money_ask_pivot` plus `cadence:escalation_compression`, but `evidence.per_turn[]` shows the pivot turn was attributed to the wrong sender, or the compression is a timestamp-parse artifact rather than real cadence. Per-turn drift corrupts arc-level reads.

---

## 7. The new `arc:` and `cadence:` L3 categories -- reviewer angle

The `arc:` and `cadence:` categories landed in ontology 5.1 as part of the conversation-evaluation goal (see the v5.1 conversation-evaluation vocabulary memo for the closed-set definitions). They describe conversation-shape signals -- trajectory and timing -- that single-prompt classification cannot see. Per-tag, here is what supports the tag and what should make a reviewer question it:

- **`arc:trust_ramp`** -- multiple early turns build rapport / authority / intimacy *before* extraction. Expect low extract scores on early turns climbing later. Question when extract scores are non-zero across the whole arc -- the shape requires a transition, not uniform extraction.
- **`arc:money_ask_pivot`** -- an identifiable pivot turn from non-monetary to money-related content. Expect one specific turn (or small cluster) where the topic shifts. Question when money content is uniformly distributed -- no pivot, just a money-themed conversation throughout.
- **`arc:contact_channel_jump`** -- one side proposes or executes a move to a different channel. Expect a turn naming the destination channel (WhatsApp / Signal / private email / phone). Question when the new channel is inferred only from a `modality_hint` change, not from explicit turn content.
- **`arc:advisor_isolation`** -- sustained pressure to keep the conversation away from family, advisors, bank, lawyers, police. Expect *multiple* turns carrying isolation pressure -- a single-turn "don't tell anyone" is a Control flag (`secrecy_directive`), not an arc-level signal.
- **`arc:role_stability_breach`** -- one side breaks a previously-established role mid-arc (the "vendor" asks for a payroll change). Expect early turns showing consistent role behavior and a later turn breaking it. Question when there is no early role-baseline against which to read the breach.
- **`cadence:always_available`** -- one side responds within minutes across hours or days. Requires timestamps on enough turns to measure (minimum 6 turns over 24+ hours). Question when timestamps are absent or sparse -- the schema does not fabricate timestamps.
- **`cadence:escalation_compression`** -- inter-turn intervals shorten markedly as the arc approaches a money-ask, threat, or pivot. Expect a clear timestamp inflection (e.g., turns 1-4 over 3.5 hours, turns 5-12 over 30 minutes). Question when compression is purely visual without timestamp evidence.

**Vocabulary gap escalation.** When a conversation exhibits an arc the seven entries do not capture, escalate to policy for vocabulary review rather than force-fit an entry. An L3 tag that does not mean what the reviewer needs it to mean corrupts downstream audit queries.

---

## 8. Ontology 5.2 case-study vocabulary -- reviewer angle

Ontology 5.2 (shipped 2026-05-27 alongside engine commit `8d59762`) added one bright-line and ten L3 values derived from real-world case-study analyses in [`docs/policy-reviews/2026-06-case-study-analysis.md`](../../policy-reviews/2026-06-case-study-analysis.md). The closed-set definitions and prose-to-label mapping tables live in [`docs/08-v5-ontology.md`](../../08-v5-ontology.md) §§3.1, 3.3, 3.4, 3.5, 5. This section is the reviewer angle: what evidence should be on the envelope before you trust each tag, and what should make you challenge.

### 8.1 The new bright-line: `realtime_synthetic_media_executive_impersonation`

Case 4 / Arup deepfake-CFO BEC ([case-study analysis](../../policy-reviews/2026-06-case-study-analysis.md) §4) is the canonical case. The bright-line fires when the prompt evidences a *live, interactive* deepfake of a corporate executive used to direct a payment or wire transfer. Forced L2 set is `['phishing_attack', 'impersonation_scam']`, parallel to `executive_impersonation_payment`'s severity-of-evidence semantics (ontology §5).

When this bright-line fires, verify in order: (i) the prompt content evidences *real-time interactivity* (turn-taking, live call, live video conference) -- not a pre-recorded clip used as a one-shot prop, which is `method:deepfake_video` / `method:deepfake_audio` without the new bright-line; (ii) the impersonation target is a *corporate executive* directing a payment, not an arbitrary impersonation; (iii) `method:realtime_synthetic_media` co-fires as an L3 tag (it should, given the bright-line semantics); (iv) the disposition is `block` -- if not, this is a cascade-routing anomaly per section 6.

Challenge if the prompt describes only pre-recorded deepfake artifacts (the realtime axis is what makes the case 4 pattern operationally distinct from generic deepfake fraud). Challenge if the new bright-line fires without `method:realtime_synthetic_media` in L3 -- they were designed to co-occur and a divergence is a Stage 2 / Stage 3 disagreement worth escalating.

### 8.2 Per-vocab L3 reviewer guidance

**`method:realtime_synthetic_media`** (case 4). Fires when synthetic media is interactive with the target. Expect co-occurrence with `method:deepfake_video` or `method:deepfake_audio` (the method tag and the modality tag both fire). Question when only the modality tag fires and the prose describes a one-shot artifact -- there is no realtime axis to support the new label.

**`method:advance_fee_inheritance` / `_lottery` / `_customs` / `_business_partnership` / `_lawyer_fee`** (case 3 / Black Axe). Five sub-vocabulary values that decompose the prior single `method:advance_fee` label by pretext. Discriminator guidance lives at [`docs/05-classifier-guidance.md`](../../05-classifier-guidance.md) §3.3.1 -- read that table before challenging a pick. Multiple variants firing on one prompt is expected when the pretext stack hybridizes (e.g., "inheritance held by a lawyer awaiting customs clearance"). Challenge when a variant fires with no prose evidence of its pretext (a "lottery" variant on a prompt that names no lottery surface is misclassification).

**Specific challenge for `method:advance_fee_lawyer_fee` on recovery-fraud envelopes (2026-05-27 clarification).** When `method:advance_fee_lawyer_fee` appears in an L3 list whose L2 is `recovery_fraud` and which carries `overlap:secondary_victimization` and/or `context_marker:victim_list_purchased`, treat the lawyer-fee tag as a likely stray firing and challenge. The discriminator requires both (a) a claimed lawyer / barrister / attorney persona AND (b) a net-new legal entitlement (estate, judgment, probate release) the lawyer is *processing on the target's behalf*. Recovery-service / asset-tracing / "recovery investigator" personas fail condition (a) even when the fee is termed a "retainer" or "case-opening retainer". Trace the Stage 2 evidence prose: if the attacker persona is not a named lawyer / barrister / attorney / solicitor / chambers actor, the lawyer-fee tag is noise, not signal. Boundary fixtures for calibration: `tests/golden/case-study-tier-1/06-method-advance-fee-lawyer-fee.json` (positive; barrister + estate retainer) vs `09`, `16`, `17`, `19` (negatives; recovery-service personas where the lawyer-fee tag was historically over-emitted -- documented in [Tier 1 phase-3 qa audit](../../qa/audits/2026-05-27-tier-1-vocabulary-audit.md) §4 P2-3). The over-emission does not change `disposition.action` (recovery-fraud envelopes still block on the recovery-fraud frame), so the issue is L3 noise on reviewer-facing evidence rather than a disposition error -- but document the challenge in your review notes so policy can monitor whether the discriminator-clarification holds in production traffic.

**`target:affinity_community`** (case 2 / CryptoFX). Fires when the targeting motion treats a trust-bonded community (religious, ethnic, professional, language-based) as a *unit*, typically through a trusted community leader's endorsement -- not when individuals from a demographic happen to be victims. Expect prose naming a community surface (church group, business association, language community). Challenge when the prompt names only individual demographic attributes ("elderly", "Spanish-speaking") without a unit-level targeting motion -- the SEC/FBI affinity-fraud frame requires community as the targeting unit, not as the victim demographic.

**`context_marker:victim_list_purchased`** (case 6 / MoneyBack). Fires when the prompt evidences operational knowledge of prior victimization -- specific named scams, loss brackets, acquired victim lists. Expect prose naming the source of the list or the prior scam by name. Challenge when the prompt targets a vulnerable demographic speculatively ("people who appear elderly and lonely") -- that is targeting, not list-driven recovery fraud.

**`context_marker:ai_pretext_claimed`** (case 2 / CryptoFX). Fires when AI capability is a *claim* in the marketing layer -- not when AI is the actual attack mechanism. The discriminator is operational vs claimed: "expert AI trading bots" with no real AI behind the pitch fires this; a live deepfake call fires `method:realtime_synthetic_media` instead. Challenge when AI is operationally present in the prompt's attack mechanic -- the right tag is the method tag, not this context marker. Challenge when AI is mentioned only incidentally without a credibility-borrowing role in the pitch.

**`overlap:secondary_victimization`** (case 6 / MoneyBack). Fires when the current attack mechanically depends on a prior fraud against the same victim -- recovery fraud canonical, sextortion follow-up another. Expect prose naming the prior harm as the leverage or credibility mechanism. Frequently co-occurs with `context_marker:victim_list_purchased`. Challenge when the prompt generically enables downstream harm without depending on a specific prior fraud against the same victim.

### 8.3 Case-study cross-links

Per-vocab additions are motivated by these case-study sections. Read them when you need the full why-this-tag-exists context:

- Case 2 / CryptoFX (affinity_community, ai_pretext_claimed): [`docs/policy-reviews/2026-06-case-study-analysis.md`](../../policy-reviews/2026-06-case-study-analysis.md) §2, recommendations 1 and 2.
- Case 3 / Black Axe (five advance-fee variants): [`docs/policy-reviews/2026-06-case-study-analysis.md`](../../policy-reviews/2026-06-case-study-analysis.md) §3.
- Case 4 / Arup deepfake-CFO BEC (realtime_synthetic_media bright-line + method tag): [`docs/policy-reviews/2026-06-case-study-analysis.md`](../../policy-reviews/2026-06-case-study-analysis.md) §4, recommendation 2.
- Case 6 / MoneyBack (victim_list_purchased, secondary_victimization): [`docs/policy-reviews/2026-06-case-study-analysis.md`](../../policy-reviews/2026-06-case-study-analysis.md) §6, recommendations 1 and 2.

**Vocabulary gap escalation.** As with the `arc:` / `cadence:` categories (section 7), if a case exhibits a chain-of-fraud or AI-enablement pattern the ontology 5.2 entries do not capture, escalate to the policy track for vocabulary review rather than force-fit an existing entry.

---

## 9. Escalation criteria

Three escalation paths, each with a specific trigger:

- **Escalate to the policy track** (channel: `handoff/board/inbox/policy.md` in this project; the equivalent policy-owner queue in production) when the typology framework does not capture the observed pattern, when L2 / L3 selection is clearly wrong on the substantive read, when a vocabulary gap blocks confident classification, or when the case sits at a policy-novel intersection. Bring: the envelope, the source artifact, a one-paragraph statement of what the vocabulary should have captured.
- **Escalate to the ops track** (channel: `handoff/board/inbox/ops.md`) when this SOP is unclear, when the decision criteria are not bright enough to discriminate the case, or when reviewer escalation paths need refinement. Bring: the envelope, the SOP section you found insufficient, a recommendation.
- **Escalate to the engineering venue** (channel: `handoff/board/inbox/vscode.md` in this project; the engineering team that owns the classifier in production) when an envelope shows a Stage 0 contract violation (literal "Me" / "You" in the sender list), a cascade-routing anomaly (bright-lines fire with no documented carve-out and disposition is not `block`), a stage failure not represented in the `errors` array, or any envelope shape that does not match the published v5 schema. Bring: the envelope, source artifact when relevant, the specific contract violation.

A fourth escalation -- above the reviewer line -- applies when human safety is at acute risk or when the case sits at a policy-novel intersection the SOP cannot adjudicate. Use the platform's standard above-the-line channel; the path varies by deployment.

---

## 10. Cross-reference: §9.1 label-drift SOP, do not duplicate

When the case is specifically closed-set label drift across two runs of the same input -- different `topic_label` / `target_label` / `pretext_label` / `objective_label` / process-flag labels with stable L2 and stable disposition -- defer to `docs/04-enforcement-design.md` section 9.1 ("Closed-set label drift across audits"). That SOP carries the four-case decomposition (case A benign drift, case B drift-with-disposition-shift, case C multi-label drift on a single envelope pair, case D prose-only drift) and the per-case action. This SOP does not re-author that framework; route to it for the case assignment.

---

## 11. Outcome recording

Record the decision in your deployment's case-management surface. At minimum, log: (i) the disposition you confirmed -- or, when closing a `human_review` case, the verb you routed to (`allow`, `safe_completion`, or `block`); (ii) the structured-evidence basis (bright-lines, L3 tags, or rule firings that carried your judgment); (iii) whether you escalated and to which owner; (iv) any signal the SOP or classifier should learn from. The closed four-verb vocabulary applies to your recorded outcome as it does to the cascade's.
