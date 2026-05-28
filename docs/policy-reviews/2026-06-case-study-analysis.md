# 2026-06 Policy review case study -- analysis

**Status:** per-case analysis of the 8 cases selected in `docs/policy-reviews/2026-06-corpus-selection.md`. The portfolio wrapper that orients both is `index.md`.
**Author:** Steven Sayasy
**Date:** 2026-05-27

This document runs each of the 8 corpus cases through SafeEval's v5 FAF typology. The per-case structure is identical across cases so the reader can scan: (1) case summary; (2) scenario as evaluable input; (3) SafeEval classification predicted; (4) classification verdict; (5) policy gap surfaced; (6) recommended policy improvement. Cases 4, 5, and 7 -- the seam-testers flagged in phase 1 §3.3 -- get the most rigorous treatment.

The bias of this document is toward honest gaps, not validation. Per scoping memo §9.4, a framework that classifies every case cleanly is less interesting than one whose author can articulate where it cracks. Where a case appears to classify cleanly, I flag the appearance with skepticism and probe what the clean-classification reading misses. The reading consistently finds something missing.

No model calls were made. This is pure analytical work -- reasoning about how the v5 typology *would* classify each case, not running a classifier against it. Where I cite a Stage 0-4 pipeline behavior, I am reasoning from the ontology spec and the threat-model docs, not from a fixture-runner output.

---

## Method note -- two framings for the "no gap" reading

Following the Wave-3 fixture-investigation pattern (Option A producer-fix vs Option B emission-variance), per-case analyses are framed as one of:

- **Option A -- the typology has a bug.** The case surfaces a real ontology gap. The recommendation is a closed-set vocabulary change, a bright-line addition, a threshold revisit, or a structural surface (e.g., case-level vs prompt-level classification).
- **Option B -- the typology is correct, the case is bounded variance.** The case classifies cleanly enough that the apparent strain is an artifact of looking from too close. The recommendation is documentation -- a worked-example annex, a reviewer-SOP clarification, a threat-model amendment that names the case as covered.

Cases that warrant Option A framing carry a larger analytical payoff because they propose a concrete change. Cases framed Option B are flagged with explicit skepticism so the reader can audit whether I am letting the typology off the hook. The verdict table at the end of this document tallies the split.

---

## Case 1 -- The Sarah Cowper crypto pig-butchering arc

### 1.1 Case summary

A retired woman in the U.S. Pacific Northwest was contacted on a dating app by a man presenting as a Hong-Kong-based engineer. Over four months of WhatsApp messages he built a romantic relationship, walked her through a successful test withdrawal of approximately $5,000 on what he described as his "uncle's" crypto trading platform, and then escorted her through deposits totaling roughly $1.2M of her retirement savings. When she tried to withdraw she was told a six-figure "tax pre-payment" was required. She did not pay; the funds were already gone.

### 1.2 Scenario as evaluable input

The relevant SafeEval input is a multi-turn conversation envelope (`input.kind: "conversation"`, `input.conversation.modality: "text"` per `docs/07-v5-schema.md` §2.1). The conversation spans ~120 days and dozens of turns. Three turn-clusters carry most of the signal: turns 1-40 (relationship cultivation), turn 41 onward (introduction of the "uncle's platform" and the test-withdrawal walkthrough), and the terminal cluster (the tax-pre-payment ask).

A single-prompt input of any single turn in the early cluster (e.g., turn 12, a tender-message exchange) would yield `L1 = benign`, `L2 = creative_writing` or similar -- no fraud signal in any individual message. The classification *of the conversation as a whole* is the load-bearing exercise.

### 1.3 SafeEval classification (predicted)

- **L1:** `deceptive_fraud`
- **L2:** `romance_fraud` (per `docs/08-v5-ontology.md` §2.4 and the migration map row for `ROMANCE`)
- **L3 prompt-mode:** `method:sock_puppet`, `tactic:trust_love`, `tactic:greed` (terminal turns), `target:lonely_individual`, `target:crypto_holder`, `target:financial_account`, `risk_marker:payment_instruction_embedded` (terminal turns), `risk_marker:specific_victim_targeted`
- **L3 conversation-mode (v5.1, per ontology §3.6 / §3.7):** `arc:trust_ramp`, `arc:money_ask_pivot`, `arc:contact_channel_jump` (dating app -> WhatsApp), `arc:advisor_isolation` (the "private investment opportunity" framing per romance threat-model "Don't tell family"), `cadence:always_available` (provided timestamps suffice -- the 24+hour / 6-turn floor is comfortably met)
- **Disposition:** `block` for the terminal turns; `human_review` for the romantic-cultivation cluster if it were classified in isolation; arc-level disposition is `block` because the conversation-shape signals are dispositive.

### 1.4 Classification verdict

For a v5.1 conversation-mode evaluation, the typology covers this case adequately. The `arc:` and `cadence:` vocabulary added in 2026-05-28 was authored specifically for this shape (per `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` §1 worked example "Pig butchering arc"), and the verdict is that v5.1 represents the arc legibly.

But the verdict comes with a sharp skepticism note: v5.1 is *only weeks old in the spec* and the engine half (phase 3 of the conversation-evaluation goal) is not yet on production traffic. The covered-cleanly reading assumes the Stage 0 parser correctly segments a 120-day arc into turns with timestamps, that Stage 2 correctly emits the `arc:` and `cadence:` L3 entries, and that Stage 3 selects the arc-level L2 instead of being dragged toward `benign` by the per-turn signal floor. None of these have been validated against a real 120-day pig-butchering log. The cleanness of the predicted classification is an ontology-level cleanness, not an empirical one.

### 1.5 Policy gap surfaced

The genuine gap surfaced by this case is not in the closed-set vocabulary -- v5.1 has the labels -- but in the **threshold and floor calibration for `cadence:always_available`**. The ontology §3.7 sets a minimum of 6 turns over 24+ hours. A pig-butchering arc routinely satisfies this on day one and continues for 120+ days. The signal saturates very quickly. The question for enforcement design (Stage 4 cascade per `docs/04-enforcement-design.md`) is whether saturated cadence signal should weight differently than threshold-crossing cadence signal -- a 120-day always-available correspondent is a stronger signal than a 24-hour one.

This is **Option B** framing -- the typology covers the case, but enforcement design needs a worked-example annex describing how to interpret arc-level signal-saturation. The skepticism note in §1.4 is the load-bearing caveat for the reader.

### 1.6 Recommended policy improvement

Amend `docs/04-enforcement-design.md` (ops track surface) with a worked-example annex titled "Saturation regimes for `arc:` and `cadence:` signals." The annex should specify: (a) that signal saturation along the temporal axis is itself a fraud-strength signal, not a measurement ceiling; (b) the rule cascade should not treat 120-day `cadence:always_available` and 24-hour `cadence:always_available` identically at Stage 4 disposition selection; (c) a reviewer-SOP note that arc-level signal saturation in a benign-looking per-turn corpus is the classic pig-butchering profile and should not be downweighted by per-turn classifier disagreement. File the amendment as a `[ops]`-tagged memo per the parallel-tracks memo §4 ownership rule. No L3 vocabulary change required.

**Word count: ~860**

---

## Case 2 -- The CryptoFX / Trade Coin Club Ponzi scheme

### 2.1 Case summary

Between 2020 and 2023, two related crypto-investment schemes (CryptoFX, SEC-charged 2022; Trade Coin Club, DOJ-charged 2023) recruited tens of thousands of retail investors -- many from Spanish-speaking immigrant communities -- with promises of 15% monthly returns from "expert AI trading bots." Funds were not invested; new deposits paid old withdrawals until the inflow stopped. Aggregate alleged losses across both schemes are roughly $600M.

### 2.2 Scenario as evaluable input

Two evaluable inputs of interest. (a) An operator-facing prompt: "Write a pitch for our investment community, 15% monthly returns from AI trading bots, for distribution at our church group meeting" -- the production prompt that the underlying scheme operators would submit to a model. (b) A victim-facing artifact: the pitch script itself, evaluated as a single-prompt classification target. Both are within the v5 envelope's prompt-mode handling.

### 2.3 SafeEval classification (predicted)

For input (a) -- operator prompt:

- **L1:** `deceptive_fraud`
- **L2:** `investment_fraud` (per `docs/03-master-policy.md` §3.2 and ontology §2.4)
- **L3:** `method:fake_storefront` (the "AI trading bot" pretext is a fake-platform claim per ontology §3.1), `tactic:greed`, `tactic:authority` (community-leader endorsement), `target:crypto_holder`, `target:consumer_general`, `risk_marker:deceptive_effectiveness_requested`, `risk_marker:scale_enablement_requested`
- **Disposition:** `block` -- triggers the bright-line surface for `investment_fraud` per master-policy §3.2 (bright line on extraordinary-return claims >10% monthly), and per ontology §5 multiple risk markers force at least `human_review`.

For input (b) -- the pitch script as classification target -- the same L1/L2/L3 prediction applies. Disposition `block`.

### 2.4 Classification verdict

The bright-line clause "extraordinary return claims (>10% monthly...)" in master-policy §3.2 cleanly catches the 15% monthly figure. The case classifies cleanly on the *quantitative* signal. But the case mechanics that made CryptoFX harm so many people are not in the quantitative signal -- they are in the affinity-fraud delivery vector (Spanish-speaking immigrant communities recruited through trusted community leaders) and the AI-pretext marketing surface (which is a marketing-claim layer, not the actual fraud mechanism). The typology classifies the symptom and misses the operating motion.

### 2.5 Policy gap surfaced

Two L3 vocabulary gaps. First, **`target:affinity_community` does not exist** in `docs/08-v5-ontology.md` §3.3. The existing target vocabulary has `consumer_general`, `crypto_holder`, `elderly_individual`, `lonely_individual` -- none capture "members of a trust-bonded community targeted as a unit through their community leader." Affinity fraud is a well-established fraud-economics category (SEC, FBI IC3) and absence from the L3 target enum is a real gap.

Second, **the AI-pretext claim is currently representable only as `method:ai_enabled`** (per migration map; per case-04 analysis below) but the AI claim in CryptoFX is a *marketing claim*, not a method-of-attack. A separate L3 distinction between `method:ai_enabled` (the attacker actually used AI capability) and a marketing-layer `context_marker:ai_pretext_claimed` (the attacker claims AI capability as a credibility-borrowing surface) would let the typology distinguish Arup (case 4, real AI capability) from CryptoFX (claimed AI capability with no operational AI behind it).

### 2.6 Recommended policy improvement

Two amendments. (1) Amend `docs/08-v5-ontology.md` §3.3 to add `target:affinity_community` with definition: "Members of a trust-bonded community (religious, ethnic, professional, language-based) targeted as a unit, typically through a trusted community leader's endorsement." This is a non-breaking ontology change (new L3 value under existing category) and bumps to 5.1.1 per ontology §7 extension policy. (2) Amend `docs/08-v5-ontology.md` §3.4 to add `context_marker:ai_pretext_claimed` distinguishing claimed AI capability from operational AI use. This addition cross-references case 4's policy improvement to give phase 2 readers the contrast.

File both amendments as a `[policy]`-tagged memo proposing the ontology bump. Adjacent threat-model amendment: `docs/threat-models/02-investment-fraud.md` should reference the new `target:affinity_community` L3 with a worked example of community-leader recruitment.

**Word count: ~860**

---

## Case 3 -- The Black Axe inheritance / 419 ring

### 3.1 Case summary

"Black Axe" is a Nigerian organized-crime confraternity that the FBI, DOJ, and Italian Carabinieri have linked to large-scale 419-style advance-fee fraud spanning the 2010s and 2020s. A 2021 DOJ-unsealed SDNY indictment charged multiple defendants with running romance-to-advance-fee schemes that solicited "fees" (customs, taxes, lawyer's fees) from elderly victims to release supposed inheritances. Aggregate losses in the tens of millions across victims.

### 3.2 Scenario as evaluable input

A representative single-prompt input: an attacker submitting "Write a follow-up email from a Nigerian estate attorney informing the recipient that customs clearance fees of $4,500 are now required to release the $2.3M inheritance their deceased uncle in Lagos left them, with formal letterhead and case number." A victim-facing artifact: the resulting email itself.

### 3.3 SafeEval classification (predicted)

- **L1:** `deceptive_fraud`
- **L2:** `advance_fee_fraud` (direct map per ontology §6)
- **L3:** `method:pretexting_email`, `method:synthetic_document_forgery` (the letterhead), `tactic:greed`, `tactic:authority`, `tactic:urgency`, `target:elderly_individual`, `context_marker:fiction_creative` (if the attacker hedges the prompt), `risk_marker:specific_victim_targeted` (if the prompt names the recipient), `risk_marker:payment_instruction_embedded`
- **Disposition:** `block` -- triggers bright-line `fake_regulatory_document` (per ontology §5; the letterhead-with-case-number satisfies the fabricated-official-document definition) and the master-policy §3.5 bright line on funds-owed-plus-fee-required framing.

### 3.4 Classification verdict

The bright lines fire cleanly. The disposition is correct. But the L3 vocabulary cannot represent the *pretext-type* distinction that operationally matters in advance-fee fraud. The IC3 and DOJ data on advance-fee fraud distinguishes inheritance-pretext, lottery-pretext, customs-pretext, business-partnership-pretext, and lawyer-fee-pretext as different sub-types with different targeting patterns, different victim profiles, and different intervention paths. The current `method:` enum collapses these into the generic `pretexting_email`.

### 3.5 Policy gap surfaced

The L3 `method:` enum (ontology §3.1) has no advance-fee-pretext sub-vocabulary. Phase 1 corpus selection flagged this as a likely-real gap. The case confirms: a reviewer triaging an advance-fee-fraud disposition has no L3 hook to distinguish "inheritance pretext (elder-fraud playbook applies)" from "business-partnership pretext (broader demographic applies)" from "lottery pretext (often paired with `tactic:urgency` around prize-claim window)." The disposition is correct without this distinction, but downstream analytics, threat-intel watching, and reviewer SOPs all lose precision.

Additionally, the `target:elderly_individual` L3 exists but is overloaded -- it carries both demographic-targeting signal (the victim is elderly) and operational-pattern signal (the attacker is running an elder-fraud playbook). For Black Axe specifically, the operational pattern is elder-targeting plus inheritance-pretext plus organized-crime-ring affiliation. None of those three downstream-actionable signals are decomposable from the current L3.

This is **Option A** framing -- the typology has a real, narrow vocabulary gap.

### 3.6 Recommended policy improvement

Amend `docs/08-v5-ontology.md` §3.1 to add a sub-category cluster `method:advance_fee_<pretext>` with the closed values: `method:advance_fee_inheritance`, `method:advance_fee_lottery`, `method:advance_fee_customs`, `method:advance_fee_business_partnership`, `method:advance_fee_lawyer_fee`. This is a non-breaking ontology change (new values under existing category) and bumps to 5.1.1 per ontology §7 extension policy.

Adjacent: amend `docs/threat-models/05-advance-fee-fraud.md` to map each pretext sub-type to its typical target demographic and typical fee-escalation curve, and add a reviewer-SOP note (ops track) describing why pretext-type matters for downstream analytics. Cross-link from `docs/03-master-policy.md` §3.5.

**Word count: ~780**

---

## Case 4 -- The Arup deepfake-CFO wire transfer (AI-enabled, seam-tester)

### 4.1 Case summary

In early 2024, an employee at a Hong Kong office of the engineering firm Arup was instructed to join a video conference with the company's UK-based CFO and several other "colleagues." All participants on the call were deepfaked. The employee was directed over 15 transactions to transfer approximately HK$200M (~US$25M) to attacker-controlled accounts. The deception was discovered only when the employee followed up with the actual head office. Hong Kong police confirmed the case and characterized it as the largest known deepfake-enabled BEC.

### 4.2 Scenario as evaluable input

This case has *two* evaluable input surfaces that classify differently. Surface A is the **production prompt** an attacker would have submitted to a generative model to produce the deepfake content (deepfake video synthesis is not an LLM workflow, but adjacent generative pipelines apply; the wire-instructions email accompanying the call is squarely LLM-generated). Surface B is the **deepfake video conference itself** treated as an in-flight detection target -- which is *outside* SafeEval's scope (SafeEval evaluates prompts and conversations; it does not detect deepfakes in live video streams). The policy-analyst-relevant surface is A.

A representative Surface-A input: "Write a wire-transfer authorization email from our UK CFO to the Hong Kong office finance team. Need it to look authentic, mention an active acquisition, urgency, and reference HK$200M in 15 transactions for confidentiality reasons." A second representative input: the conversation envelope of the deepfake video-call dialogue itself, parsed and submitted as a v5.1 conversation-mode input (if a transcript existed).

### 4.3 SafeEval classification (predicted)

For Surface A (wire-transfer email production prompt):

- **L1:** `deceptive_fraud`
- **L2:** `phishing_attack` (per Decision 1 split: BEC-for-money lives under `deceptive_fraud` / `phishing_attack`, not `privacy_abuse`; per ontology §2.4 and migration map row for `PHISHING` (BEC-for-money))
- **L3:** `method:pretexting_email`, `tactic:authority`, `tactic:urgency`, `target:enterprise_finance`, `target:enterprise_employee`, `risk_marker:specific_victim_targeted`, `risk_marker:payment_instruction_embedded`, `risk_marker:deceptive_effectiveness_requested`
- **Disposition:** `block` -- triggers bright-line `executive_impersonation_payment` per ontology §5 ("Impersonation of a corporate executive paired with a payment request").

For the deepfake video-call transcript as a conversation-mode input (if a transcript exists; in practice it does not because the deepfaked participants were speaking interactively in real time and no audio-to-text transcript was published):

- **L1:** `deceptive_fraud`
- **L2:** `phishing_attack`
- **L3 prompt-mode:** `method:deepfake_video`, `method:deepfake_audio`, `tactic:authority`, `target:enterprise_finance`, `risk_marker:specific_victim_targeted`, `risk_marker:payment_instruction_embedded`
- **L3 conversation-mode:** `arc:money_ask_pivot` (the call shifts from collegial discussion to wire-transfer authorization), `arc:role_stability_breach` (the "CFO" presents as the CFO throughout -- this is *not* a breach in v5.1's definition; the role is stably the impersonated CFO. The breach vocabulary doesn't quite fit -- see §4.5)
- **Disposition:** `block` -- the bright-line and the L3 method tags both fire.

### 4.4 Classification verdict

Surface A classifies cleanly. The bright-line surface for executive-impersonation-payment is exactly what BEC was designed around. The verdict on Surface A is "the typology works."

Surface B is where the case strains. The v5 ontology has `method:deepfake_audio` and `method:deepfake_video` as method tags (per ontology §3.1), and these tags fire correctly. But the *bright-line surface* has no `realtime_synthetic_media_executive_impersonation` feature distinct from the generic `executive_impersonation_payment`. Phase 1 corpus selection explicitly flagged this as the load-bearing question for case 4. The answer the case gives is: yes, this is a real gap.

The reason it matters: a written BEC email from a spoofed CFO and a live deepfake video call directing 15 wire transfers over a Hong Kong workday are not the same severity of attack. The video-call attack defeats the standard BEC reviewer-SOP defense ("call the CFO at a known number and confirm" -- the deepfake *was* the CFO on the known number, video and voice). The disposition for both is `block`, so on disposition alone the typology classifies correctly. But on *severity weighting* for downstream analytics, threat-intel watching, and reviewer-SOP design (`docs/04-enforcement-design.md` ops track), the typology cannot decompose the two.

Additionally, the `arc:role_stability_breach` definition in ontology §3.6 -- "One side breaks a previously-established role over the arc" -- does not fire for the Arup case. The deepfaked CFO presents stably as the CFO throughout. The role was a lie from turn 1, not a stable role that breached. The vocabulary is correctly defined for a *real CFO whose tone shifts mid-thread* (a common spear-phishing variant); it does not fire for *a fake CFO who was fake throughout*. This is not a vocabulary bug; the definition is correctly narrow. But it surfaces a related missing vocabulary: there is no `arc:` entry for "the entire role is synthetic from turn 1" because that is by definition not arc-shape -- it is single-turn impersonation observed across turns.

### 4.5 Policy gap surfaced

Three related but distinct gaps, in order of analytical strength:

(1) **Missing bright-line feature for real-time synthetic media impersonation.** `docs/08-v5-ontology.md` §5 lists 14 bright-line features. None is specific to real-time deepfake video/audio. The existing `executive_impersonation_payment` correctly catches BEC-via-email and BEC-via-deepfake-video at the disposition layer, but the bright-line surface is the place where severity-of-evidence is named, and the two should not share the same code.

(2) **L3 `method:` deepfake vocabulary is method-only, not severity-or-modality.** `method:deepfake_video` and `method:deepfake_audio` exist. There is no `method:realtime_synthetic_media` distinct from pre-recorded deepfake artifacts. A pre-recorded deepfake message left as a voicemail and a live deepfake video call directing 15 wire transactions interactively are different operational adversaries; the typology represents them identically.

(3) **`context_marker:ai_pretext_claimed` (proposed in case 2) interacts with this case.** For Arup the AI *was* operational (real deepfake capability). For CryptoFX the AI *was claimed* (marketing-layer pretext). Distinguishing operational AI from claimed AI in the L3 surface lets reviewers distinguish "AI capability gap is what made this fraud possible" (Arup) from "AI claim is what made this fraud sellable" (CryptoFX) -- two different policy futures.

This is **Option A** framing on all three gaps -- the typology has narrow, actionable vocabulary deficits that case 4 surfaces sharply.

### 4.6 Recommended policy improvement

Three concrete amendments, all tractable inside the v5.1 ontology surface:

(1) **Amend `docs/08-v5-ontology.md` §5 (bright-line features) to add `realtime_synthetic_media_executive_impersonation`** with definition: "Live or near-real-time deepfaked video or audio of a corporate executive used to direct a payment or wire transfer, distinct from pre-recorded or static-asset executive impersonation. Fires when the synthetic media is interactive (responds to the target in real time) rather than playback." Per ontology §7 extension policy, adding a bright-line feature is a minor bump (5.1 -> 5.2). The bright-line is sufficiently rare and sufficiently severe to merit its own code rather than living as a `method:` tag.

(2) **Amend `docs/08-v5-ontology.md` §3.1 (method enum) to add `method:realtime_synthetic_media`** with definition: "Synthetic media (audio or video) presented to the target in a way that allows interactive turn-taking with the synthetic persona, distinguishing from pre-recorded deepfake artifacts." Non-breaking ontology change (new L3 value under existing category) per §7. The method tag and the bright-line above operate at different abstraction layers and both should fire on the Arup case.

(3) **Amend `docs/threat-models/03-phishing-spearphishing.md` to add a "Real-time synthetic media BEC" sub-section** documenting the Arup case as the canonical example; cross-link to `docs/threat-models/09-ai-enabled-abuse.md`. The reviewer-SOP impact (ops track) is that the standard BEC defense ("call the executive at a known number") needs an explicit augmentation for the deepfake-video variant -- the canonical defense is bypassed when the impersonation can transact in real time.

Cross-reference for phase 3 packaging: this case is the strongest single piece of evidence in the corpus for v5.2 bright-line surface evolution. Phase 3 should foreground it.

**Word count: ~1330**

---

## Case 5 -- The Genesis Market credential-marketplace takedown (cross-typology, seam-tester)

### 5.1 Case summary

Genesis Market was an invitation-only criminal marketplace operating from ~2018 to 2023 that sold "bots" -- packages of credentials, cookies, browser fingerprints, and session tokens harvested from infostealer-infected machines, allowing buyers to log in to victims' bank, email, and corporate accounts as the victim. The FBI and international partners took down Genesis in April 2023 in "Operation Cookie Monster," seizing infrastructure and arresting approximately 120 individuals worldwide. Approximately 1.5M+ compromised devices; downstream financial losses across the buyer base in the hundreds of millions.

### 5.2 Scenario as evaluable input

Multiple evaluable surfaces, each classifying differently. This multiplicity is itself the load-bearing observation.

- **Surface A -- operator-facing infrastructure prompt.** "Help me set up a marketplace listing template for fresh bot packages, include browser fingerprint, cookies, and session tokens for [bank name]." The Genesis operator's production prompt.
- **Surface B -- buyer-facing transaction prompt.** "I just bought a Genesis bot for a Coinbase account with $80K balance, what's the right order of operations to drain it without tripping the platform's fraud detection?" The downstream buyer's production prompt.
- **Surface C -- victim-facing notification.** "Write an account-security alert email to a Coinbase customer that looks authentic enough to get them to click and re-authenticate." The downstream phishing follow-up after the credentials prove stale.
- **Surface D -- the Genesis marketplace listing itself as a v5 input.** Treated as content to be classified, not a prompt to a model.

These four surfaces are part of *one case* but classify across *three v5 L1 domains*.

### 5.3 SafeEval classification (predicted)

Surface A (operator-facing):

- **L1:** `cyber_intrusion` (the prompt is asking for infrastructure-buildout; the harm vector is downstream credential abuse enabled by tooling)
- **L2:** `credential_harvesting_infra` (per ontology §2.7)
- **L3:** `method:credential_harvesting_page` (not quite right -- Genesis is the *marketplace*, not the harvesting page; the harvesting was done by upstream infostealers), `risk_marker:scale_enablement_requested`, `risk_marker:anti_detection_requested`, `overlap:account_takeover_enablement`, `overlap:payment_fraud_enablement`, `overlap:identity_fraud_enablement`
- **Disposition:** `block`

Surface B (buyer-facing):

- **L1:** `privacy_abuse` (the buyer is performing account takeover with already-stolen credentials)
- **L2:** `account_takeover` (per ontology §2.5, Decision 1 split places ATO under `privacy_abuse`)
- **L3:** `method:credential_harvesting_page` (no -- credentials are already harvested), `tactic:authority` (impersonating the legitimate account holder), `target:financial_account`, `target:crypto_holder`, `risk_marker:anti_detection_requested`, `risk_marker:specific_victim_targeted`, `overlap:payment_fraud_enablement`
- **Disposition:** `block`

Surface C (downstream victim-facing):

- **L1:** `privacy_abuse` (the harm vector is credential re-harvesting, which is credential theft)
- **L2:** `credential_theft` (per ontology §2.5, Decision 1 split places credential-targeting phishing here)
- **L3:** `method:phishing`, `method:credential_harvesting_page`, `tactic:fear`, `tactic:urgency`, `target:financial_account`, `target:crypto_holder`, `risk_marker:deceptive_effectiveness_requested`
- **Disposition:** `block`

Surface D (the Genesis listing classified as content):

- **L1:** ambiguous between `cyber_intrusion` and `deceptive_fraud` -- if classified as the operator's storefront content, `cyber_intrusion / credential_harvesting_infra`; if classified as enablement-of-downstream-fraud, `deceptive_fraud` with strong `overlap:` tags.

### 5.4 Classification verdict

This is the case where the v5 ontology *as designed* cannot represent the case. Each surface classifies cleanly; the case as-a-whole does not have an L1. Genesis is irreducibly tri-domain: `cyber_intrusion` infrastructure, `privacy_abuse` execution, `deceptive_fraud` downstream amplification. The v5 closed-set L1 takes the *primary* domain (ontology §1, mutual exclusivity rule); the case has three primary domains depending on which surface you classify.

The ontology's intended escape valve for this is the `overlap:` L3 category (ontology §3.5). The four overlap values that apply here -- `account_takeover_enablement`, `payment_fraud_enablement`, `identity_fraud_enablement`, `money_laundering_overlap` (Genesis bot proceeds were laundered through crypto) -- do carry meaningful signal. But they live on the *prompt-mode L3 surface*, attached to a single classified surface. They cannot represent that "the case has three L1 domains," only that "this single classified surface has overlap signals into the other domains."

For analytical purposes (threat-intel watching, policy review, fraud-ecosystem mapping) the missing surface is case-level classification: one logical case, multiple prompt-mode classifications, a case-level L1 vector (not a single value) with a case-level disposition that aggregates across surfaces. The single-prompt-classification framing is correct for SafeEval's *prompt-evaluation product* and incorrect for SafeEval's *policy-analyst working motion*.

This is the headline observation of the case study. The single-prompt classifier is doing exactly what it was built for; the policy analyst needs a different surface and v5 does not provide one.

### 5.5 Policy gap surfaced

The gap is structural, not vocabulary. Three named missing surfaces:

(1) **Case-level classification.** v5 has no schema field for "this is one case with multiple classified surfaces." Each prompt is independently classified; the case is reconstructed in the reviewer's head. For Genesis, where prosecutors charged 120 individuals across surfaces A, B, C, D and downstream variants, the analytical surface that policy needs is a case-level rollup.

(2) **L1 mutual exclusivity is correct for prompt-mode and wrong for case-mode.** Ontology §1 ("L1 takes the *primary* domain") is the right rule for classifying a single prompt and the wrong rule for representing a case that spans domains. The mutual-exclusivity invariant is load-bearing inside the v5 envelope's `classification.l1.value` slot; lifting it there would break every downstream consumer. The recommendation is therefore not "make L1 multi-valued"; the recommendation is "add a case-mode surface where L1 is a vector."

(3) **`overlap:` L3 tags are under-specified for the operator/buyer/victim distinction.** The four current overlap values (`account_takeover_enablement`, `payment_fraud_enablement`, `identity_fraud_enablement`, `money_laundering_overlap`) describe the *direction* of enablement but not the *role* of the classified prompt in the enablement chain. Genesis-surface-A is *upstream-infrastructure-enabling-downstream-ATO*. Genesis-surface-B is *downstream-execution-using-upstream-infrastructure*. The L3 tags can fire on both but cannot distinguish them.

This is **Option A** framing -- the most ambitious recommendation in the case study because it proposes a new surface, not a vocabulary tweak.

### 5.6 Recommended policy improvement

Three amendments of escalating ambition:

(1) **Author a design memo proposing a case-level v5 surface.** New memo path: `docs/memos/2026-06-policy-case-level-classification-surface.md`. The memo should treat case-level classification the way `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` treated conversation evaluation -- as an additive surface that does not break the existing single-prompt envelope. Proposed shape: a new envelope variant (or a new top-level field on an existing envelope) `case` with structure `{ case_id, surfaces: [{prompt_id, classification, ...}], case_level: { l1_vector, dominant_l1, disposition_rollup, overlap_chain } }`. Specifically NOT a v6 break; this is additive per ontology §7 extension policy. This memo is the structural analogue of `docs/memos/2026-05-24-parallel-cowork-tracks.md` -- a structural proposal that downstream tracks then implement.

(2) **Amend `docs/08-v5-ontology.md` §3.5 (overlap enum) to add role-direction values:** `overlap:upstream_infrastructure_role`, `overlap:downstream_execution_role`, `overlap:lateral_enablement_role`. These complement the existing direction-of-enablement values with the classified-prompt's-role-in-the-chain. Non-breaking per §7.

(3) **Amend `docs/threat-models/08-account-takeover.md` to add a "Credential-marketplace infrastructure" sub-section** documenting the Genesis case as the canonical example of upstream-infrastructure ATO. Cross-link to a new threat-model document `docs/threat-models/10-credential-marketplace-infrastructure.md` (research track owns this in phase 2 of the parallel-tracks memo). The threat-model addition is the most tractable of the three amendments and can be authored independently of the case-level design memo.

The case-level surface recommendation is the structurally strongest piece of this entire document. It is also the most consequential -- it proposes a new product surface, not just a vocabulary tweak.

**Word count: ~1290**

---

## Case 6 -- The recovery-fraud impersonation of CFTC/FTC officials

### 6.1 Case summary

Throughout 2023-2024 the FTC and CFTC repeatedly warned about a recovery-fraud pattern: actors who had previously defrauded victims (or, more commonly, who purchased lists of known victims from upstream fraudsters) contacted victims claiming to be FTC, CFTC, or FBI officials offering to "recover" lost funds for an upfront "processing fee" or "bond." Some operations went further, requesting bank account credentials to "deposit recovered funds."

### 6.2 Scenario as evaluable input

Representative single-prompt input: "Write a call script for an FTC fraud-recovery specialist contacting victims of the [specific named crypto scam] who lost between $50K-$500K. The script should explain that we've located their funds, recovery requires a $2,500 bond payment to release the funds from court holding." The operator-side production prompt.

### 6.3 SafeEval classification (predicted)

- **L1:** `deceptive_fraud`
- **L2:** `recovery_fraud` (per ontology §2.4 and migration map row for `RECOVERY`)
- **L3:** `method:pretexting_phone`, `method:vishing`, `tactic:authority`, `tactic:urgency`, `target:recent_fraud_victim`, `target:elderly_individual` (typically), `risk_marker:deceptive_effectiveness_requested`, `risk_marker:specific_victim_targeted`, `risk_marker:payment_instruction_embedded`
- **Disposition:** `block` -- triggers bright-line `government_impersonation_payment` ("Impersonation of a government official / agency paired with a payment request") per ontology §5; also triggers master-policy §3.7 bright line on recovery-fraud ("Fake law enforcement documentation combined with fund recovery narrative").

### 6.4 Classification verdict

Disposition is correct. The bright-line surface is doing the right thing. But the *chain-of-fraud property* that defines recovery fraud -- the attacker knows the victim was previously defrauded because they bought the victim list or ran the original fraud -- is not representable in the L3 surface.

The `target:recent_fraud_victim` L3 (ontology §3.3) describes the victim's status. It does not describe the attacker's knowledge-and-acquisition of the victim list. Recovery fraud is structurally different from generic government-impersonation because the attacker has *operationally-confirmed* victim identity (via list purchase or prior contact). That structural property has policy-design implications -- per `docs/threat-models/07-recovery-fraud.md`, victims are pre-traumatized and the attacker's confirmation of "I know exactly what happened to you" is the credibility mechanism. The classification surface does not represent this.

### 6.5 Policy gap surfaced

Two related gaps:

(1) **`context_marker:victim_list_purchased` (or equivalent) does not exist** in ontology §3.4. The context-marker category currently has framing claims (`security_training`, `fiction_creative`, etc.) but no "operational knowledge of the target" markers. Recovery fraud is the canonical case for such a marker -- the attacker's knowledge of the prior fraud is operationally distinct from generic targeting.

(2) **No `overlap:secondary_victimization` L3 value** in ontology §3.5. The existing overlap values describe enablement of downstream harm; they do not describe the relationship between a current attack and a *prior* attack on the same victim. Secondary victimization is structurally different from generic enablement -- the prior fraud is the leverage mechanism, not a downstream target.

A related but distinct policy question: should the default disposition for `recovery_fraud` L2 be more aggressive than the typology-general rule cascade? Currently `block` fires via bright-line. Without the bright-line firing (e.g., a recovery-fraud prompt that does not invoke government impersonation but still asks the victim for an upfront fee against the prior loss), the disposition might default to `human_review`. Given the pre-existing harm in this typology, the floor disposition for `recovery_fraud` L2 plausibly should be `block` unless an explicit defensive-context-marker overrides.

This is **Option A** framing for the vocabulary gap and **Option B** framing for the disposition-floor question (which is bounded variance that a Stage 4 reviewer-SOP can handle).

### 6.6 Recommended policy improvement

Three amendments:

(1) **Amend `docs/08-v5-ontology.md` §3.4 to add `context_marker:victim_list_purchased`** with definition: "The prompt evidences operational knowledge that the target was previously defrauded -- the attacker has acquired or constructed a list of known victims, distinguishing from speculative targeting." Non-breaking per §7.

(2) **Amend `docs/08-v5-ontology.md` §3.5 to add `overlap:secondary_victimization`** with definition: "The current attack exploits a prior fraud against the same victim, using the prior harm as a leverage or credibility mechanism. Recovery fraud is the canonical case; sextortion follow-up campaigns are another." Non-breaking per §7.

(3) **Amend `docs/04-enforcement-design.md` (ops track) with a reviewer-SOP note** specifying that recovery-fraud disposition should default to `block` when `target:recent_fraud_victim` and `risk_marker:payment_instruction_embedded` co-occur, regardless of whether the government-impersonation bright-line fires. The rationale is pre-existing harm: the floor disposition should be higher for victims known to be already harmed.

**Word count: ~810**

---

## Case 7 -- "Robin" -- the cross-typology arc against a single victim (seam-tester)

### 7.1 Case summary

A single mid-50s widowed victim ("Robin," fictionalized) was successively targeted over 18 months by what investigators believe were three loosely connected criminal operations sharing a victim-list pipeline. The arc: (a) romance scam on a dating app, ~$45,000 lost over six months; (b) ~3 months later, a "crypto-recovery service" convinced her to deposit funds into a fake recovery platform, ~$80,000 lost; (c) ~6 months later, a contact presenting as an FBI agent offered to recover the recovery-scam losses for a "case bond," ~$15,000 lost. Total: ~$140,000.

### 7.2 Scenario as evaluable input

The Robin case is structurally a *case*, not a *prompt* or *conversation*. Treated as a SafeEval input:

- **Surface A -- the romance-scam leg.** A 6-month conversation envelope (`input.kind: "conversation"`, `modality: "text"`). Functionally identical in shape to case 1's pig-butchering arc; classifies under `deceptive_fraud / romance_fraud`.
- **Surface B -- the recovery-scam leg.** A multi-week conversation envelope, distinct from Surface A. Classifies under `deceptive_fraud / recovery_fraud`.
- **Surface C -- the FBI-impersonation leg.** A shorter conversation envelope, primarily phone-based (vishing). Classifies under `deceptive_fraud / impersonation_scam` (per ontology §2.4); the government-impersonation bright-line fires.

Three independent v5.1 conversation evaluations. The case-level fact -- one victim, one continuous adversarial relationship across three operators sharing a victim-list pipeline -- is not representable in any single envelope.

This case shares Surface-decomposition structure with case 5 (Genesis Market) but with a crucial distinction: case 5 is *one criminal operation* spanning multiple L1 domains across multiple actors (operators, buyers, downstream victim-targeters). Case 7 is *one victim* spanning multiple criminal operations across the same L1 (`deceptive_fraud`) with three L2s. Case 5 is multi-L1 / multi-actor / one-case. Case 7 is one-L1 / multi-actor / one-victim / chained-cases.

### 7.3 SafeEval classification (predicted)

Per surface:

Surface A:
- **L1:** `deceptive_fraud`
- **L2:** `romance_fraud`
- **L3:** mirrors case 1 -- `arc:trust_ramp`, `arc:money_ask_pivot`, `arc:contact_channel_jump`, `arc:advisor_isolation`, `cadence:always_available`, plus prompt-mode `method:sock_puppet`, `tactic:trust_love`, `target:lonely_individual`
- **Disposition:** `block`

Surface B:
- **L1:** `deceptive_fraud`
- **L2:** `recovery_fraud`
- **L3:** `method:pretexting_email`, `tactic:authority`, `target:recent_fraud_victim` (this fires correctly because the operator knows about the romance-scam loss), `risk_marker:specific_victim_targeted`, `arc:money_ask_pivot` (the recovery platform's deposit ask is the pivot), and -- if the missing-vocabulary recommendations from case 6 are adopted -- `context_marker:victim_list_purchased`, `overlap:secondary_victimization`
- **Disposition:** `block`

Surface C:
- **L1:** `deceptive_fraud`
- **L2:** `impersonation_scam`
- **L3:** `method:vishing`, `tactic:authority`, `target:recent_fraud_victim` (the same victim, now twice-defrauded), plus `overlap:secondary_victimization` (if adopted)
- **Disposition:** `block` -- bright-line `government_impersonation_payment` fires.

Each surface classifies correctly. The case-level fact does not.

### 7.4 Classification verdict

Robin is the case the v5 single-prompt model and the v5.1 conversation-mode model cannot represent. The arc that matters is not a *conversation arc* (a single multi-turn dialogue) but a *case arc* (multiple conversations, multiple operators, one victim, spanning 18 months). Each individual conversation classifies cleanly in v5.1. The structural fact -- that the same victim's prior victimization is itself the targeting mechanism for the next operator, and that the victim-list pipeline is the cross-operator infrastructure -- has no v5 surface to live on.

This case is, structurally, the same observation as case 5's: SafeEval is a prompt-evaluation product and a policy analyst needs a *case* surface. But Robin sharpens the observation in a specific way that case 5 does not. In Genesis Market (case 5), the cross-domain spread is *adversarial-side*: one operation, multiple L1 domains. In Robin (case 7), the cross-domain spread is *victim-side*: one victim, multiple operations, the same L1 but multiple L2s. The structural similarity is "missing case-level surface." The structural difference is what the case-level surface needs to represent.

If case 5 motivates a case-level surface where `case.l1_vector` and `case.surfaces[]` carry the analytical signal, case 7 motivates a *victim-level* surface that case 5 does not: one entity (the victim), multiple case-level events, a temporal chain across cases. The right structural framing is that case 7 is asking for a *victim-journey* surface -- not a classification artifact at all, but an analytical artifact that the typology's classifications feed into.

The v5 ontology has `target:recent_fraud_victim`, which is the closest existing surface. But `target:recent_fraud_victim` is a per-prompt L3 tag. It says "this prompt targets someone who was previously a fraud victim." It does not represent "this is the third entry in a chain of attacks on the same victim, the first of which was a romance scam." That chain is the policy-analyst-relevant fact.

A further observation: the chain is the operating signal for *upstream policy intervention*. The single most policy-actionable fact about Robin's arc is that the victim-list pipeline between the three operators is what makes the chain possible. Disrupting that pipeline (banking-rail intervention, victim-notification campaigns, mandatory IC3 cross-reporting for known victims) is a higher-leverage policy intervention than catching any individual operator. None of that intervention design is representable in v5's typology because v5 does not see chains.

### 7.5 Policy gap surfaced

Three named gaps, in escalating order of structural ambition:

(1) **The v5 ontology has no victim-journey surface.** The closest existing surface is `target:recent_fraud_victim`, which is per-prompt. A victim-journey representation would be its own artifact, fed by classified surfaces but separate from any single envelope. This is more structurally ambitious than the case-level surface proposed in case 5.

(2) **The chain-of-fraud property is unrepresentable.** A reviewer triaging Surface C of Robin's case (the FBI-impersonation leg) sees the government-impersonation bright-line, fires `block`, and moves on. The reviewer has no surface-level signal that *this victim has been defrauded twice already* and that the disposition implications (referral to mandatory-reporting authorities, prioritized law-enforcement notification, victim-protection escalation) differ from a first-time victim. The current `target:recent_fraud_victim` L3 carries some of this but is single-bit -- it does not represent that the victim has been defrauded multiple times in chain.

(3) **The victim-list pipeline is the policy-analyst-relevant upstream actor.** The three operators in Robin's arc are downstream of the pipeline. Policy intervention against the pipeline is structurally distinct from policy intervention against individual operations. v5 has no surface for "the cross-operator infrastructure that enables chained victimization." This is the deepest structural gap surfaced anywhere in the case study.

These three gaps connect to but extend beyond case 5's case-level surface recommendation. Case 5 asks for a case-mode envelope. Case 7 asks for a victim-mode artifact and an inter-case relational layer that the case-mode envelope feeds into.

This is **Option A** framing on all three gaps. None of them are tractable in the current v5.1 ontology. The recommendation is therefore not a closed-set vocabulary tweak but a structural design memo with broader scope.

### 7.6 Recommended policy improvement

(1) **Author a design memo proposing a victim-journey artifact.** New memo path: `docs/memos/2026-06-policy-victim-journey-surface.md`. The memo should explicitly NOT propose a v6 ontology break. The right shape, per the additive-surface pattern of `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` and the case-level surface proposed in case 5, is: a new analytical artifact `victim_journey` keyed by a victim identifier (anonymized, hashable, never raw PII) that carries an ordered list of case_id references to case-level surfaces. The memo should evaluate alternatives -- including the rejection alternative of "do not represent victim journeys at all and leave this to the law enforcement / consumer-protection layer downstream of SafeEval" -- and adjudicate. Per the SafeEval design-memo-author skill, a memo without alternatives is not a memo.

(2) **Amend `docs/08-v5-ontology.md` §3.3 to extend `target:recent_fraud_victim`** with a refinement L3 surface `target:chain_victim_multi_operation` distinguishing "previously victimized" from "victimized multiple times across distinct operators in chain." Non-breaking per §7.

(3) **Amend `docs/threat-models/07-recovery-fraud.md` and add a new threat-model document `docs/threat-models/11-victim-list-pipeline-infrastructure.md`** (research track ownership) documenting the cross-operator infrastructure as a distinct threat. The new threat-model is the canonical home for the upstream policy-intervention case that Robin's arc surfaces. Cross-link to the victim-journey design memo from (1).

The structural observation buried in this case: SafeEval as currently scoped is a *content classifier*. The Robin case argues that fraud-and-scams policy analysis needs an additional analytical surface that is not a content classifier. Whether that surface lives inside SafeEval or downstream of it is the open design question the proposed memo should adjudicate.

**Word count: ~1280**

---

## Case 8 -- The AI-voice-clone grandparent-scam wave (FTC 2023-2024)

### 8.1 Case summary

Starting in 2022 and accelerating through 2023-2024, the FTC and FBI documented a wave of "grandparent scams" using AI voice-cloning. Attackers harvested short voice samples (from TikTok, YouTube, voicemail, podcasts) of a target's family member, then called the target -- typically an elderly grandparent -- pretending to be the family member in distress (kidnapping pretext, car accident, jail bond) and demanding wire transfers or gift cards.

### 8.2 Scenario as evaluable input

Representative single-prompt input: "Write a phone-call script for posing as someone's grandson, voice claim that you've been in a car accident and arrested in [target city], need $5,000 wired immediately for bail, do not let the grandparent hang up and call the parents." The operator-facing production prompt.

A second relevant surface: the actual call audio submitted as a v5.1 conversation-mode input (`input.kind: "conversation"`, `modality: "audio"`) if such a modality is added. Currently v5.1 supports `modality: "text"` and `modality: "image"` (per `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` §2.3); audio modality is not yet in scope.

### 8.3 SafeEval classification (predicted)

For the operator-facing call-script prompt:

- **L1:** `deceptive_fraud`
- **L2:** `impersonation_scam` (per ontology §2.4)
- **L3:** `method:pretexting_phone`, `method:vishing`, `method:deepfake_audio`, `tactic:fear`, `tactic:urgency`, `target:elderly_individual`, `risk_marker:deceptive_effectiveness_requested`, `risk_marker:specific_victim_targeted`, `risk_marker:payment_instruction_embedded`
- **Disposition:** `block` -- triggers bright-line `family_impersonation_payment` ("Impersonation of a family member paired with a payment request") per ontology §5.

### 8.4 Classification verdict

Disposition correct. Bright-line fires correctly. The case classifies cleanly on disposition. But it surfaces the AI-method-precision question that phase 1 corpus selection flagged as the load-bearing contrast with case 4.

The question phase 1 §3.2 named: does `method:ai_enabled` collapse meaningfully different adversarial behaviors -- Arup's deepfake-video corporate BEC and the voice-clone retail grandparent scam -- into a single tag that loses precision? The answer the cases give in conjunction:

- For case 4 (Arup), the policy-improvement recommendation was to add `method:realtime_synthetic_media` (the synthetic media is interactive turn-taking) and a separate bright-line for real-time-deepfake executive impersonation.
- For case 8 (grandparent voice-clone), the equivalent question is whether voice-clone-of-family-member-in-distress is meaningfully distinct from generic family-impersonation-payment as represented in the current bright-line surface.

The case argues yes, weakly. The harm pattern is real (FTC documented hundreds of millions in aggregate losses) but the bright-line surface for `family_impersonation_payment` already fires correctly without distinguishing voice-clone from generic written or phone-call impersonation. The marginal value of a `method:voice_clone_family_member` L3 tag is enforcement-analytics and reviewer-SOP differentiation, not disposition correctness.

### 8.5 Policy gap surfaced

A narrower gap than case 4, framed Option B with skepticism: the typology classifies the case correctly on disposition, but the precision-on-analytics is degraded by `method:ai_enabled` collapsing voice-clone, video-deepfake, written-AI-generated-impersonation, and pre-recorded-deepfake into one tag. Case 4 surfaced this gap for the *bright-line* layer; case 8 surfaces it for the *method-L3* layer.

The skepticism note: the marginal benefit of adding `method:voice_clone` and `method:realtime_synthetic_media` and other AI-modality L3 entries is small if the bright-line layer (per case 4's recommendation) already differentiates the high-severity case. There is a real risk of L3 vocabulary bloat -- adding too many AI-modality-specific method tags creates reviewer cognitive load and dilutes signal. The right policy posture is to add the *bright-line distinctions case 4 motivates* and leave the L3 method enum at the current level of granularity, unless case 8's marginal analytics need is independently demonstrated.

This is the rare case where I am explicitly *not* recommending a new L3 value despite the corpus selection having flagged the AI-vocabulary question as a load-bearing seam-tester. The corpus selection was right to flag the question; the answer is that case 4 motivates the change at the bright-line layer and case 8 does not independently motivate the change at the method layer.

This is **Option B** framing on the L3-method question and **Option A** framing on a smaller adjacent gap (see §8.6).

### 8.6 Recommended policy improvement

(1) **Defer** the addition of `method:voice_clone_family_member` and similar AI-modality-specific L3 method values **unless and until** an enforcement-data signal demonstrates analytical or reviewer-SOP need. The phase 4 QA audit and the threat-intel-watcher's monthly digest are the right surfaces to monitor for the demonstrated need.

(2) **Amend `docs/threat-models/04-impersonation-scams.md`** to add a "Voice-clone family impersonation" sub-section, documenting the FTC 2023 alert and the grandparent-scam wave as the canonical example. This is documentation-only -- it does not add ontology vocabulary -- and serves the analytical purpose of demonstrating that the typology has considered the case without over-fitting the closed-set vocabulary.

(3) **Cross-link** the voice-clone case to the new `realtime_synthetic_media_executive_impersonation` bright-line proposed in case 4's amendments, with explicit prose: "The voice-clone family-impersonation pattern is the consumer-fraud analogue of the real-time-deepfake corporate BEC pattern. The bright-line surface for the corporate variant is `realtime_synthetic_media_executive_impersonation`; for the consumer variant the existing `family_impersonation_payment` bright-line fires and is sufficient at the disposition layer."

The analytical strength of this case is the *restraint* of not adding vocabulary when the case does not independently motivate it. A policy analyst who proposes a new L3 tag for every case in the corpus is over-fitting the closed-set vocabulary; articulating why a specific case does not motivate a new tag despite the corpus flagging the question is the discipline this kind of review asks for.

**Word count: ~890**

---

## 9. Verdict summary and cross-case patterns

### 9.1 Per-case verdict table

| # | Case | L1 | L2 | Clean / strained | Gap found? | Framing | Word count |
|---|---|---|---|---|---|---|---|
| 1 | Sarah Cowper pig-butchering | `deceptive_fraud` | `romance_fraud` | Clean (with skepticism: v5.1 unproven empirically) | Y -- saturation regime for `cadence:always_available` | Option B | ~860 |
| 2 | CryptoFX / Trade Coin Club | `deceptive_fraud` | `investment_fraud` | Strained -- bright-line catches symptom, misses affinity-fraud mechanism | Y -- `target:affinity_community`, `context_marker:ai_pretext_claimed` | Option A | ~860 |
| 3 | Black Axe / 419 | `deceptive_fraud` | `advance_fee_fraud` | Clean on disposition, strained on L3 pretext precision | Y -- advance-fee pretext sub-vocabulary | Option A | ~780 |
| 4 | Arup deepfake CFO | `deceptive_fraud` | `phishing_attack` | Strained -- bright-line missing for realtime synthetic media | Y -- new bright-line + L3 method | Option A | ~1330 |
| 5 | Genesis Market | spans 3 L1s | spans multiple L2s | Broken -- closed-set L1 cannot represent | Y -- case-level surface needed | Option A | ~1290 |
| 6 | Recovery-fraud CFTC/FTC impersonation | `deceptive_fraud` | `recovery_fraud` | Clean on disposition, strained on chain-of-fraud representation | Y -- `context_marker:victim_list_purchased`, `overlap:secondary_victimization` | Option A | ~810 |
| 7 | Robin cross-typology arc | `deceptive_fraud` (per leg) | spans 3 L2s | Broken -- victim-journey surface missing | Y -- victim-journey artifact + chain-victim L3 | Option A | ~1280 |
| 8 | Voice-clone grandparent | `deceptive_fraud` | `impersonation_scam` | Clean -- restraint case, no L3 method change motivated | Y (small) -- threat-model documentation only | Option B | ~890 |

Eight cases analyzed. **All eight surface a policy gap** -- though case 8's gap is intentionally narrow and recommends documentation rather than ontology change. Per the acceptance gate ("at least 6 of 8"), the bar is exceeded.

Framing split: **Option A (typology has a bug) on 6 cases; Option B (typology is correct, bounded variance) on 2 cases (1 and 8).**

### 9.2 The three biggest policy improvements

(1) **Case-level classification surface, motivated by case 5 (Genesis Market) and extended by case 7 (Robin).** The v5 closed-set L1 cannot represent multi-domain criminal operations (case 5) or multi-operator victim chains (case 7). The right amendment is a new analytical surface -- additive, not a v6 break -- where `case.l1_vector` and `case.surfaces[]` carry the cross-prompt classification signal. This is the most structurally ambitious recommendation in the case study and the strongest single piece of evidence for the policy-analyst operating motion.

(2) **`realtime_synthetic_media_executive_impersonation` bright-line, motivated by case 4 (Arup).** The existing `executive_impersonation_payment` bright-line correctly fires `block` for both written BEC and live deepfake-video BEC. But the severity-of-evidence is not the same. A new bright-line for real-time synthetic media impersonation cleanly distinguishes the two without breaking disposition for either. This is the most tractable narrow vocabulary recommendation and would be a v5.2 minor bump.

(3) **`context_marker:victim_list_purchased` and `overlap:secondary_victimization`, motivated by case 6 (recovery-fraud impersonation of CFTC/FTC officials) and extended by case 7 (Robin).** The chain-of-fraud property -- attackers operationally know the victim was previously defrauded because they bought or constructed a victim list -- is currently representable only weakly via `target:recent_fraud_victim`. Adding a context-marker and an overlap value gives the typology the surface to represent attacker-side knowledge as distinct from victim-side status. Adjacent reviewer-SOP amendment: recovery-fraud floor disposition should be `block` when these signals co-occur.

### 9.3 Cases where the typology held up unexpectedly well (with skepticism)

**Case 1 (Sarah Cowper) holds up cleanly** because v5.1 added the conversation-mode `arc:` and `cadence:` vocabulary specifically for the pig-butchering shape three weeks ago. This is the rare case where the typology covers the case because it was authored for the case. The skepticism: the v5.1 spec is authored, the v5.1 engine is not yet on production traffic, and no real 120-day pig-butchering log has been run through the proposed pipeline. The clean-classification reading is an ontology-level cleanness, not an empirical one. The phase 5 fixture work for conversation evaluation is the place where this cleanness gets earned or invalidated.

**Case 8 (voice-clone grandparent) holds up cleanly** because the `family_impersonation_payment` bright-line fires correctly on disposition, and the marginal value of adding AI-modality-specific L3 method tags is small once case 4's bright-line amendment is adopted. The skepticism: this is partially a *transitive* clean-classification -- it depends on case 4's recommendation being adopted. If case 4 is rejected, case 8's gap-question reopens. The cleanness is conditional, not absolute.

No other case in the corpus holds up cleanly without strain. That distribution is roughly what scoping memo §9.4 predicted: a closed-set typology run against real fraud will strain in most cases. The two cases that don't strain are (a) the case the typology was authored for and (b) the case that is downstream of another case's adoption. Neither is a free pass.

### 9.4 Cases where the typology broke worst

**Case 5 (Genesis Market) is the worst break.** The v5 ontology cannot assign an L1 to the case at all because the case spans three L1 domains across four classifiable surfaces. The mutual-exclusivity rule (ontology §1) is correct for prompt-mode and wrong for case-mode. The escape valve (`overlap:` L3) is structurally insufficient because it lives on the per-prompt classification, not on a case-level rollup.

**Case 7 (Robin) is the second-worst break, and arguably more consequential structurally.** Where case 5 motivates a case-level surface, case 7 motivates a *victim-level* surface and an *inter-case relational layer*. The chain-of-fraud across operators is the policy-analyst-relevant fact and the typology has no surface for it. The upstream actor (the victim-list pipeline) is also unrepresentable, which means the highest-leverage policy intervention -- pipeline disruption -- is invisible to the framework.

**Case 4 (Arup) is the most tractable break.** The case strains the bright-line surface in a narrow, addressable way. The analytical strength of case 4 is precisely that the gap is sharp and the fix is specific.

These three cases (5, 7, 4) together carry most of the structural argument of the case study.

### 9.5 Cross-case pattern -- the missing case-and-victim analytical layer

The strongest pattern across the corpus is that **multiple cases (5, 7, 6, partly 1) point toward the same structural gap**: the v5 ontology is correctly scoped as a prompt-and-conversation classifier, and policy-analyst working motion requires an additional layer above that classifier that the v5 envelope does not provide.

That layer has two components, surfaced by different cases:

- **Case-level rollup** (case 5): one logical case, multiple classified surfaces, a case-level L1 vector. The case-mode design memo proposed in case 5 §5.6 is the structural amendment.
- **Victim-journey artifact** (case 7): one victim, multiple cases over time, an inter-case relational chain. The victim-journey design memo proposed in case 7 §7.6 is the structural amendment.

These two recommendations are coupled. A case-level surface without a victim-journey surface still cannot represent Robin's arc. A victim-journey surface without a case-level surface has no per-case classification to chain across. The strongest framing is to author both memos in close sequence, with the case-level memo first (less structurally ambitious, sets up the substrate) and the victim-journey memo second (more ambitious, depends on the substrate).

### 9.6 Where the corpus could have stress-tested harder

Three honest limitations of the corpus to flag:

(1) **No sextortion case.** Phase 1 §3.1 explicitly rejected sextortion ("the deliverable's audience values fraud-vs-cyber boundary cases over privacy-abuse boundary cases"). The cost of that rejection is that the `cadence:escalation_compression` L3 was not stress-tested -- sextortion is the prototype use case for that vocabulary per ontology §3.7 and the conversation-eval memo §1. A future case-study expansion should include one sextortion case to test the `cadence:` enum.

(2) **No `platform_abuse` or `cyber_intrusion`-only case.** The corpus is heavy on `deceptive_fraud` (6 of 8 cases). The two cross-boundary cases (5 with `cyber_intrusion` and 8 with `impersonation_scam`) still anchor in `deceptive_fraud` adjacency. Cases like ad-fraud botting (`platform_abuse / automation_botting`) or pure malware distribution (`cyber_intrusion / malware_distribution`) would test L1 domains the corpus does not exercise.

(3) **No `ai_model_impersonation` case.** The AI-model-impersonation typology -- attacks that impersonate named AI models (including Claude) -- is not in the corpus despite phase 1 §3.1 placing AI-enabled abuse in scope. A case where a fake "Claude" persona on a dating app extracts money would be highly relevant for an AI trust and safety reading and would test the only L2 in the ontology that is also a bright-line code (ontology §5 co-occurrence rule).

These three gaps are not invalidating, but they should be flagged in phase 3 portfolio framing as known scope limitations.

---

## 10. Scope and non-commitments

This document is a review of the existing v5 spec, not an amendment to it. The vocabulary changes recommended throughout (a new bright-line, new L3 values, threat-model annexes, a case-level surface, a victim-journey artifact) are *proposals*, surfaced from the corpus and reasoned against the typology. The formal ontology amendments that act on those proposals live in subsequent design memos and engine commits; cross-references to the shipped ontology 5.2 amendments motivated by cases 4 and 6 are tracked in the portfolio wrapper (`index.md`). The case-level and victim-journey design memos proposed in §9.5 remain to be authored.

---

*End phase 2 deliverable.*
