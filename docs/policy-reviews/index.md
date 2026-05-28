# Policy review case study -- real-world fraud through the FAF lens

**Date:** 2026-06 (corpus + analysis dated 2026-05-27; portfolio wrapper 2026-05-27)
**Framework:** SafeEval Fraud Analysis Framework (FAF) -- ontology v5.2, schema v5.1 (analysis authored against v5.1; ontology 5.2 shipped the case-study-motivated bright-line + L3 vocabulary on 2026-05-27)
**Author:** Steven Sayasy

This is a worked policy review. Eight real-world fraud cases, drawn from public sources (FBI IC3, DOJ unsealed indictments, FTC consumer alerts, investigative journalism), run through SafeEval's closed-set v5 typology. The goal is not "the framework classified everything correctly." The goal is the policy analyst's operating motion: take adversarial behavior, run it through the lens, find where the lens holds and where it cracks, and document a specific improvement.

**The headline finding: every case in the corpus surfaces a policy gap.** Two are bounded variance the typology can absorb with documentation; six motivate concrete vocabulary, bright-line, or structural amendments. The three highest-leverage improvements are flagged for adoption.

---

## Executive summary

The corpus spans the five mandatory L1/L2 diversity rows plus three seam-testers chosen specifically to stress the closed-set ontology. Cases 1 and 2 cover romance-investment and standalone investment fraud; case 3 covers advance-fee; case 4 is the Arup deepfake-CFO BEC; case 5 is the Genesis Market credential marketplace; case 6 is government-impersonation recovery fraud; case 7 is the composite cross-typology arc against one victim; case 8 is the AI-voice-clone grandparent-scam wave. Each case is analyzed across six subsections: scenario, evaluable input, predicted v5 classification, classification verdict, gap surfaced, recommended improvement.

The corpus selection deliberately biased toward seam-testers per the risk that a closed-set typology run only against clean cases would over-validate itself. Five of eight cases (1, 4, 5, 6, 7) were chosen because the framework was predicted to strain. The analysis confirmed: six of eight cases motivate a concrete amendment ("Option A" framing); two classify cleanly enough that the recommendation is documentation only ("Option B" framing). The two framings are defined in the [analysis method note](2026-06-case-study-analysis.md#method-note----two-framings-for-the-no-gap-reading). Case 8 in particular recommends *restraint* -- the corpus flagged an AI-vocabulary question, but on analysis the marginal value of adding modality-specific method tags is small once case 4's bright-line amendment is adopted.

The three highest-leverage improvements, ordered by structural ambition:

1. A **case-level classification surface** is missing from the v5 envelope (cases 5 and 7). Single-prompt mutual-exclusivity on L1 is correct for prompt-mode and wrong for case-mode.
2. A **`realtime_synthetic_media_executive_impersonation` bright-line** is missing from the v5 ontology (case 4). The Arup deepfake-CFO case is the canonical evidence.
3. **Chain-of-fraud vocabulary** (`context_marker:victim_list_purchased`, `overlap:secondary_victimization`) is missing from L3 (cases 6 and 7). Recovery fraud is structurally different from generic government impersonation and the typology cannot currently represent why.

All three are additive amendments under ontology §7 extension policy. None require a v6 break. Improvements 2 and 3 shipped as ontology 5.2 on 2026-05-27 (engine commit `8d59762`): the case 4 `realtime_synthetic_media_executive_impersonation` bright-line and the case 6 chain-of-fraud L3 vocabulary (`context_marker:victim_list_purchased`, `overlap:secondary_victimization`) plus 9 other case-motivated L3 values are now live in the v5 ontology and the engine. Improvement 1 (case-level surface from case 5 + case 7) is structural Tier 2 work flagged for follow-on design memos and remains unshipped. The arc the case study traces -- identify gap, propose amendment, adopt amendment -- is closed for improvements 2 and 3.

The corpus has three honest scope limitations flagged in the analysis: no sextortion case (the `cadence:escalation_compression` L3 is unexercised); no pure `platform_abuse` or `cyber_intrusion`-only case (the corpus tilts 6/8 toward `deceptive_fraud`); no `ai_model_impersonation` case (the only L2 that is also a bright-line code is unexercised). These are flagged as known scope rather than fixed in this iteration.

---

## How to read this document

Three reading paths are supported.

For the **two-minute skim**: this index, the exec summary above, and the [Three highest-leverage improvements](#three-highest-leverage-improvements) section below. The exec summary names the headline findings; the improvements section gives the case-cited reasoning behind each.

For the **methodology read**: skim this index, then read [Methodology and corpus selection](#methodology-and-corpus-selection). The corpus-selection document (`2026-06-corpus-selection.md`) defends every case included and explicitly names the alternatives rejected.

For the **full analytical read**: read this index for context, then read the analysis document (`2026-06-case-study-analysis.md`) end-to-end. The analysis is ~9,100 words across eight cases plus framing and verdict sections. The three seam-tester cases (4, 5, 7) each run >1,000 words and carry the structural argument.

The corpus selection is at [`2026-06-corpus-selection.md`](2026-06-corpus-selection.md). The full per-case analysis is at [`2026-06-case-study-analysis.md`](2026-06-case-study-analysis.md). The originating scoping memo (orchestrator-authored, decisions adjudicated before phase 1) lives in the gitignored handoff scaffolding.

---

## Methodology and corpus selection

The eight-case corpus was selected against five criteria: public and citable; sufficiently detailed for typology mapping; typology-relevant with non-trivial mapping decisions; surfaces something (either confirms a design choice under adversarial pressure or reveals a specific gap); and collectively covers the mandatory L1/L2 diversity table.

Source mix is roughly 50% FBI IC3 / DOJ / SEC / FTC primary, 30% investigative news (ProPublica, Krebs on Security, NYT, Reuters, BBC), 20% framing context. Famous corporate-securities fraud (Theranos, Madoff, FTX, Wirecard) was rejected as out-of-domain: the v5 ontology is built for prompt-level classification of in-flight adversarial behavior, not post-hoc accounting-fraud analysis. Pure cyber-intrusion / ransomware cases (Change Healthcare) were rejected because the fraud-and-scams analytical leverage is thin. Single-perpetrator romance scams (Tinder Swindler) were rejected in favor of at-scale pig-butchering coverage as more representative of the typology.

Anonymization is conservative throughout. Victim names from public sources are replaced with role descriptors ("a retired woman in the U.S. Pacific Northwest") even when the source named them. Defendant names are kept only where the source is a charging document in a fully adjudicated case; otherwise anonymized. Dollar amounts are kept to order-of-magnitude precision ("approximately $1.2M") unless the exact figure is load-bearing. Specific platforms (Telegram, WhatsApp, named exchanges) are kept when the source names them.

No model calls were made. This is analytical work -- reasoning about how the v5 typology *would* classify each case, not running a classifier against fixtures. Where a Stage 0-4 pipeline behavior is cited, it is reasoned from the ontology spec and the threat-model documents, not from a runner output. This is a known scope: the v5.1 conversation-mode engine is authored in the spec but not yet on production traffic, so the pig-butchering arc classification in case 1 is an ontology-level cleanness, not an empirical one.

---

## Three highest-leverage improvements

These are the three improvements the analysis flags as the candidacy-strongest. Each is anchored back to the originating case(s) and cross-references the case-by-case treatment in the analysis document.

<a id="improvement-1-case-level-classification-surface"></a>

### Improvement 1 -- Case-level classification surface (cases 5, 7)

**The gap.** v5's L1 mutual-exclusivity rule (ontology §1) is correct for classifying a single prompt and wrong for representing a case that spans domains. The Genesis Market takedown (case 5) is irreducibly tri-domain: `cyber_intrusion` infrastructure operated upstream of `privacy_abuse` (account takeover) execution, which fed `deceptive_fraud` downstream amplification. Each surface classifies cleanly in isolation; the case as-a-whole has no L1. The "Robin" cross-typology arc (case 7) sharpens the observation from the victim side: one victim, three operators sharing a victim-list pipeline, three L2s under one L1. Each conversation classifies cleanly in v5.1; the chain does not.

**The recommendation.** Author a design memo proposing an additive case-level surface. Proposed shape: a new envelope variant (or top-level field) `case` with structure `{ case_id, surfaces: [{prompt_id, classification, ...}], case_level: { l1_vector, dominant_l1, disposition_rollup, overlap_chain } }`. This is the structural analogue of the conversation-eval vocabulary memo -- an additive surface, not a v6 break. Case 7 extends this further to a *victim-journey* artifact (one entity, multiple cases, temporal chain) but that is a follow-on, not the first step.

**Status.** Proposed. The design memo proposing the case-level surface is the immediate next dispatch the analysis flags for the policy track. Structural Tier 2 work; no classifier-code change in flight.

**Interview-citable framing.** The single most-policy-actionable observation in the corpus: SafeEval as currently scoped is a content classifier. The policy-analyst working motion needs an additional analytical layer above the classifier that the v5 envelope does not provide. The strongest single piece of evidence is the Genesis Market case -- four classifiable surfaces, three L1 domains, one case.

See: [analysis case 5, §§5.4-5.6](2026-06-case-study-analysis.md), [analysis case 7, §§7.4-7.6](2026-06-case-study-analysis.md), [analysis §9.5 cross-case pattern](2026-06-case-study-analysis.md).

<a id="improvement-2-realtime-synthetic-media-bright-line"></a>

### Improvement 2 -- Realtime synthetic media bright-line (case 4)

**The gap.** The v5 ontology has bright-line feature `executive_impersonation_payment` (ontology §5). It fires correctly on the Arup deepfake-CFO case (~US$25M lost across 15 transactions, Hong Kong police, 2024) and on a conventional written BEC alike. But the two attacks are not the same severity of evidence. A written BEC email from a spoofed CFO can be defended by the canonical reviewer SOP: "call the executive at a known number." A live deepfake video conference defeats that defense -- the deepfake *was* the CFO on the known number, video and voice. The disposition is correct (`block` for both); the severity weighting that drives reviewer SOP and threat-intel watching is collapsed.

**The recommendation.** Add a new bright-line `realtime_synthetic_media_executive_impersonation` to ontology §5, with a separate L3 method `method:realtime_synthetic_media` to distinguish interactive synthetic-persona attacks from pre-recorded deepfake artifacts. Cross-amend `docs/threat-models/03-phishing-spearphishing.md` with a "Real-time synthetic media BEC" sub-section documenting the Arup case as canonical, cross-linked to `docs/threat-models/09-ai-enabled-abuse.md`. Per ontology §7 extension policy, this is a minor 5.1 -> 5.2 bump.

**Status.** Shipped 2026-05-27 as ontology 5.2 (engine commit `8d59762`). The bright-line `realtime_synthetic_media_executive_impersonation` and the L3 `method:realtime_synthetic_media` value are now live in `docs/08-v5-ontology.md` §§3.1, 5 and in `src/lib/safeeval-v5.js`. Schema stays at 5.1 per the additive-amendment rule. The case 4 prompt the recommendation was motivated by would now fire the new bright-line.

**Interview-citable framing.** The fix is sharp because the gap is sharp. Case 4 demonstrates that the existing bright-line surface conflates two attacks with materially different defensibility. The corpus has stronger structural recommendations (improvement 1), but this is the most adoptable one.

See: [analysis case 4, §§4.4-4.6](2026-06-case-study-analysis.md).

<a id="improvement-3-chain-of-fraud-vocabulary"></a>

### Improvement 3 -- Chain-of-fraud vocabulary (cases 6, 7)

**The gap.** Recovery fraud (case 6) is structurally different from generic government impersonation because the attacker has *operationally-confirmed* victim identity -- they bought the victim list or ran the original fraud. That structural fact is what makes "I know exactly what happened to you" the credibility mechanism. The v5 L3 surface has `target:recent_fraud_victim`, which describes the victim's status but not the attacker's knowledge-and-acquisition of the victim list. The Robin arc (case 7) extends this: the cross-operator victim-list pipeline is the highest-leverage policy-intervention surface in the entire corpus, and v5 has no representation for it.

**The recommendation.** Three coupled amendments. (1) Add `context_marker:victim_list_purchased` to ontology §3.4 -- "the prompt evidences operational knowledge that the target was previously defrauded." (2) Add `overlap:secondary_victimization` to ontology §3.5 -- "the current attack exploits a prior fraud against the same victim, using the prior harm as a leverage or credibility mechanism." (3) Amend `docs/04-enforcement-design.md` with a reviewer-SOP note that recovery-fraud disposition should floor at `block` when `target:recent_fraud_victim` and `risk_marker:payment_instruction_embedded` co-occur, regardless of whether the government-impersonation bright-line fires. The rationale is pre-existing harm: the floor disposition is higher for victims known to be already harmed.

**Status.** Shipped 2026-05-27 as ontology 5.2 (engine commit `8d59762`). The `context_marker:victim_list_purchased` and `overlap:secondary_victimization` L3 values are now live in `docs/08-v5-ontology.md` §§3.4-3.5 and in `src/lib/safeeval-v5.js`; the reviewer-SOP floor for recovery-fraud is documented in `docs/04-enforcement-design.md`. Schema stays at 5.1 per the additive-amendment rule.

**Interview-citable framing.** This recommendation is the corpus's strongest example of the policy-analyst pattern of "decomposing what the typology collapses." The current L3 carries some of the recovery-fraud structure, but the attacker-side knowledge and the chain-across-operators are different categories and need different vocabulary. The Robin arc surfaces the cross-operator victim-list pipeline as the upstream policy-intervention target -- the most consequential observation the corpus surfaces about where policy intervention has highest leverage.

See: [analysis case 6, §§6.4-6.6](2026-06-case-study-analysis.md), [analysis case 7, §§7.4-7.6](2026-06-case-study-analysis.md).

---

## Future architectural work -- case-level and victim-journey surfaces

Improvement 1 above proposes a case-level classification surface. The analysis (case 7) argues that a victim-journey artifact is a coupled but separate future amendment: one victim, multiple cases over time, an inter-case relational chain. The two recommendations are coupled -- a case-level surface without a victim-journey surface still cannot represent Robin's arc; a victim-journey surface without a case-level surface has no per-case classification to chain across.

The right sequence is the case-level memo first (less ambitious, sets up the substrate), the victim-journey memo second (more ambitious, depends on the substrate). Both are policy-track design memos under the SafeEval design-memo-author convention; neither is a v6 break. The case-level surface is structurally analogous to how v5.1 added conversation evaluation -- an additive surface that does not require ontology renumbering. The victim-journey surface is more structurally ambitious because it crosses the boundary between content classification and analytical artifact: it is fed by classifications but is not itself a classification.

The structural observation buried in this work: a fraud-and-scams policy analyst needs both content classification (which SafeEval provides) and a layer for case-and-victim analytics on top of it (which SafeEval does not provide). Whether that analytical layer lives inside SafeEval or downstream of it is the open design question. The future memos will adjudicate.

---

## Known scope limitations

Three honest limitations of the corpus, flagged so a reader can audit whether the document over-claims coverage.

The corpus has **no sextortion case**. Phase 1 corpus selection (§3.1) explicitly rejected sextortion in favor of fraud-vs-cyber boundary cases. The cost is that the `cadence:escalation_compression` L3 was not stress-tested -- sextortion is the prototype use case for that vocabulary per the conversation-eval memo, and the corpus does not exercise it.

The corpus has **no pure `platform_abuse` or `cyber_intrusion`-only case**. Six of eight cases anchor in `deceptive_fraud`. The two cross-boundary cases (5 with `cyber_intrusion` infrastructure, 8 with `impersonation_scam`) still anchor in `deceptive_fraud` adjacency. Ad-fraud botting (`platform_abuse / automation_botting`) or pure malware distribution (`cyber_intrusion / malware_distribution`) would test L1 domains the corpus does not exercise.

The corpus has **no `ai_model_impersonation` case**. A case where a fake "Claude" persona on a dating app extracts money would be highly relevant for an AI trust and safety reading and would test the only L2 in the ontology that is also a bright-line code (the co-occurrence rule in ontology §5). This is the most analytically-relevant gap in the corpus and is flagged as known scope for a future case-study expansion.

These three gaps do not invalidate the corpus -- the eight cases together cover all five mandatory diversity rows, surface gaps in six of eight cases, and motivate the three highest-leverage improvements above. But the document over-claims if it presents the corpus as exhaustive.

---

## Documents in this case study

- [`2026-06-corpus-selection.md`](2026-06-corpus-selection.md) -- corpus selection. Eight cases with full source attribution, factual summary per case, "why this case" rationale tied to selection criteria. ~4,000 words.
- [`2026-06-case-study-analysis.md`](2026-06-case-study-analysis.md) -- per-case analysis. Each case across six subsections: scenario, evaluable input, predicted classification, verdict, gap surfaced, recommended improvement. ~9,100 words; seam-tester cases (4, 5, 7) each >1,000 words.
- This document (`index.md`) -- portfolio wrapper. ~2,400 words.

The corpus selection and analysis documents are the analytical heart. This wrapper is the navigation surface; it does not duplicate the analytical density.

---

*This case study is part of the SafeEval portfolio. SafeEval is an AI trust and safety policy framework, demonstrated through the fraud-and-scams subdomain. The live app is at https://safeeval.vercel.app.*
over-claims if it presents the corpus as exhaustive.

---

## Documents in this case study

- [`2026-06-corpus-selection.md`](2026-06-corpus-selection.md) -- corpus selection. Eight cases with full source attribution, factual summary per case, "why this case" rationale tied to selection criteria. ~4,000 words.
- [`2026-06-case-study-analysis.md`](2026-06-case-study-analysis.md) -- per-case analysis. Each case across six subsections: scenario, evaluable input, predicted classification, verdict, gap surfaced, recommended improvement. ~9,100 words; seam-tester cases (4, 5, 7) each >1,000 words.
- This document (`index.md`) -- portfolio wrapper. ~2,400 words.

The corpus selection and analysis documents are the analytical heart. This wrapper is the navigation surface; it does not duplicate the analytical density.

---

*This case study is part of the SafeEval portfolio. SafeEval is an AI trust and safety policy framework, demonstrated through the fraud-and-scams subdomain. The live app is at https://safeeval.vercel.app.*
