# Four-dimension ontology separation for the PROMPT_SUMMARY result-card section

**Date:** 2026-05-27
**Author:** Cowork policy track
**Dispatched by:** orchestrator (plan `ontology-4-dimension-separation`, phase 1)
**Status:** policy memo for Steven's adjudication. Decision pending. Closed-set vocabulary drafting (phase 1b) is gated on this memo's resolution.
**Scope:** the ontology of the PROMPT_SUMMARY result-card section. The current emission conflates four orthogonal dimensions (fraud typology, attacker persona, attacker pretext, contact context) into two structured fields (PERSONA and PRETEXT) plus one undifferentiated tag row (TARGET attributes). This memo proposes splitting them into four closed-set L3 categories, evaluates four alternatives, and commits to the four-dimension separation as the recommended move.
**Companion files:** `docs/07-v5-schema.md` (envelope reference; current `prompt_summary` shape), `docs/08-v5-ontology.md` (closed-set L3 categories; this memo proposes additions), `docs/memos/2026-05-26-policy-v5-classifier-display-vocabulary.md` (the precedent that authored the existing Topic/Target/Objective/Pretext closed sets), `src/lib/safeeval-v5.js` (`TARGET_LABELS`, `PRETEXT_LABELS`, `populateTargetAttributesFromL3()` -- the producers this memo's resolved decision would re-shape in phase 3).

---

## 1. Problem

The PROMPT_SUMMARY section of the v5 result card classifies a fraud prompt along several axes that policy reviewers, hiring panelists, and downstream auditors all want to be able to count, group, and report on. The current ontology emits four-or-five visible fields per envelope, but on closer inspection three of those fields are not what they appear to be: they each carry more than one semantic dimension, and the resulting card is harder to read, harder to audit, and harder to defend as a serious fraud-policy artifact.

The canonical evidence is a recently-evaluated pig-butchering fixture (`tests/golden-conversations/03-romance-ramp-then-money-ask.json`, rendered against the live v5 app). The result card shows:

```
TOPIC:    relationship_grooming   -- "Pig-butchering romance-to-crypto pivot message"
TARGET:   lonely_individual       [pills: trust_love | lonely_individual | greed | financial_account | crypto_holder | +3 more]
OBJECTIVE: money_transfer
PRETEXT:  romantic_partner        -- "Romantic partner sharing personal crypto gains"
PERSONA:  "Romantic partner / dating app match"
```

Three problems are visible in that emission, and each of them is a distinct ontology defect rather than a rendering bug.

### 1.1 The PERSONA field is doing two jobs

PERSONA today is a free-text prose string emitted by Stage 2 (see `src/lib/safeeval-v5.js`, `assembleEnvelope()`, `prompt_summary.persona`). The fixture above produces `"Romantic partner / dating app match"`. The slash is the tell. This is not one piece of information; it is two:

- An **identity claim** -- who the attacker says they are. Here: `romantic_partner`.
- A **contact-context claim** -- how the attacker reached the target. Here: `dating_app_origin`.

These two facts are orthogonal. The same persona (`romantic_partner`) can reach a target through several channels (dating app, social-media DM, unsolicited SMS, mutual-acquaintance referral, in-person at a community event). The same contact context (`dating_app_origin`) hosts several persona types (romantic interest, fake recruiter, investment-coach pretender, scam-recovery service). Conflating them inside a slash-separated prose string forfeits both axes for counting -- a downstream reviewer cannot ask "how many romance prompts arrive through dating apps vs. social-media DMs" against this data, because both halves are buried inside the same free-text emission.

The redundancy with PRETEXT compounds the problem. In the fixture, PRETEXT = `romantic_partner` and the prose half of PERSONA also says "Romantic partner". The two fields are emitting the same fact in two different shapes, and the only new information PERSONA adds (the "dating app match" half) belongs to a different dimension entirely.

### 1.2 The TARGET row mixes three semantic types

The TARGET row in the fixture shows the closed-set label `lonely_individual` followed by a pill row containing `trust_love`, `lonely_individual` (a second time), `greed`, `financial_account`, `crypto_holder`, and (per the "+3 more" affordance) several additional tags. This row is read by the user as "things about the target," but the pills are actually three different semantic types stacked into one display:

- **Target persona / demographic:** `lonely_individual` -- who the victim is.
- **Psychological lever / tactic:** `trust_love`, `greed` -- what feeling the attacker exploits. These are FAF `Trigger` tags, classified as `tactic:` in the L3 ontology (`docs/08-v5-ontology.md` section 3.2).
- **Target attributes / asset class:** `financial_account`, `crypto_holder` -- what the victim is presumed to have.

The producer is `populateTargetAttributesFromL3()` in `src/lib/safeeval-v5.js` (line 2382), which copies the union of all L3 values prefixed `target:` or `tactic:` into `prompt_summary.target_attributes[]`. The classifier-display vocabulary memo (`2026-05-26-policy-v5-classifier-display-vocabulary.md` section 3.5) explicitly authored this union as the alias contract -- the prompt-summary surface was supposed to lift L3 target and tactic tags into one convenient row. In practice, surfacing two different L3 categories into one display row produces three readability defects:

- The duplicate `lonely_individual` is the cleanest symptom. `target_label` already says `lonely_individual` (single-valued, prominent), AND the L3 envelope carries `target:lonely_individual` which gets copied into `target_attributes`. The render shows the same value twice. (Likely interpreted as a dedup bug; the underlying cause is that two layers carry the same fact and both surface to the same row.)
- The reader cannot tell which pills are about *the victim* and which are about *the attacker's lever* without referring back to the L3 envelope. `greed` is a feeling the attacker is exploiting; `financial_account` is something the victim has. These have no business being adjacent chips in the same row.
- Counting "how many prompts target crypto-holders" against this surface is unreliable because the same pill row also mixes in non-target tags. An auditor pulling the column has to filter post-hoc, and the filter has to know the L3 prefix rules to disambiguate.

### 1.3 The TOPIC field conflates fraud typology with prompt subject

TOPIC = `relationship_grooming` in the fixture, drawn from the closed set authored in `2026-05-26-policy-v5-classifier-display-vocabulary.md` section 3.1 (`TOPIC_LABELS` in the engine). The closed set is twelve values: `document_generation`, `messaging_or_outreach`, `credential_or_access`, `payment_or_transfer`, `relationship_grooming`, `recovery_or_followup`, `investment_or_market`, `platform_mechanic`, `model_attack`, `awareness_or_education`, `general_information`, `other`.

That set conflates two things. Five of the twelve values are fraud-typology adjacent (`relationship_grooming` ~ romance fraud, `recovery_or_followup` ~ recovery fraud, `investment_or_market` ~ investment fraud, `platform_mechanic` ~ platform abuse, `model_attack` ~ cyber intrusion). The other seven are prompt-shape values (`document_generation`, `messaging_or_outreach`, `credential_or_access`, `payment_or_transfer`, `awareness_or_education`, `general_information`, `other`) describing what the prompt is asking for rather than what fraud typology it instantiates.

For pig-butchering specifically, `relationship_grooming` describes the persuasion arc but says nothing about the financial endpoint (crypto investment platform). A reviewer asking "how does this break out across the fraud typologies the IC3 reports against" cannot use TOPIC directly -- they need a separate typology field, and the closest one in the current envelope is L2 (`romance_fraud`, `investment_fraud`, `advance_fee_fraud`, etc.). But L2 is a domain-internal classifier output, not a top-line fraud-economics typology, and the L2 closed set was scoped to FAF v5 policy categories rather than alignment with IC3 / FTC Sentinel typology conventions.

The result: there is no single field in the current envelope that says "this is a pig-butchering case" in vocabulary an external fraud analyst would recognize. The fixture above is a textbook pig-butchering scenario, but a reviewer extracting structured data from the result card cannot file it that way without manually combining `topic_label=relationship_grooming`, `pretext_label=romantic_partner`, and (some) L3 tags.

### 1.4 What this looks like together

The four conflations are not independent. The `target_attributes` row mixes target with tactic because the row's job is "attributes of the victim," and tactic (psychological lever) was the closest thing in the existing L3 ontology when the alias contract was written. The PERSONA prose field carries both persona claim and contact context because no closed set for contact context exists at the prompt-summary surface -- the L3 category `context_marker:` exists in the ontology but is currently scoped to *framing claims* (`security_training`, `roleplay_hypothetical`, `victim_list_purchased`) rather than channel claims. TOPIC carries both typology and shape because the original authoring (memo 2026-05-26) framed it as a single "substantive subject" axis without separating those two facets.

Each defect is real on its own. Together they make the PROMPT_SUMMARY section less than the sum of its parts -- a card where five fields are visible but only two of them (`target_label`, `objective_label`) cleanly answer the question they label.

---

## 2. Why this matters for fraud policy work

This memo is making an ontology-redesign argument, which is the kind of argument that costs lockstep time, schema-bump time, fixture-migration time, and reviewer-SOP time. The cost has to clear the bar before the proposal is worth shipping. The argument that it clears the bar is in three pieces.

### 2.1 Countability and frequency analysis

The substantive job of a fraud-classification ontology is to make counting work. "How many BEC prompts per week?" "What share of incoming traffic is recovery fraud targeting prior investment-fraud victims?" "Has the share of romance-to-crypto pivot patterns moved this quarter?" These questions are routine in any operational fraud function -- in a financial institution's fraud team, in an FTC/FBI investigation unit, in a Trust & Safety team at a marketplace or AI platform.

For counting to work, each dimension the analyst wants to count on has to live in a *separate, closed-set field*. The PROMPT_SUMMARY today fails this on three of the five visible axes -- TOPIC bundles typology with shape, PERSONA bundles identity with channel, TARGET pills bundle three semantic types into one row. An analyst trying to use the structured envelope for counting has to either (a) write category-aware parsing logic that knows the prefix conventions, or (b) accept that some axes can't be counted from the envelope at all. Both are below the bar for "audit-grade" data.

The four-dimension separation proposed in section 3 moves each of the conflated axes into its own closed-set L3 category, which is the same architecture v5 already uses for `method:`, `tactic:`, `target:`, `context_marker:`, `overlap:`, `arc:`, and `cadence:`. The argument here is consistency, not novelty: bring the prompt-summary surface in line with the L3 design pattern v5 has already committed to.

### 2.2 Alignment with how external fraud analysts categorize

External fraud-reporting taxonomies categorize on fraud typology as a primary axis. The FBI Internet Crime Complaint Center (IC3) annual report breaks down crime types by typology -- Confidence/Romance, Investment, Tech Support, Government Impersonation, Business Email Compromise, Advance Fee, and others. The FTC Consumer Sentinel network uses a hierarchical taxonomy under Imposter Scams -- Romance Scams, Family/Friend Impersonation, Business Impersonation, Government Impersonation, Tech Support Scams. NIST's published guidance on synthetic identity fraud (NIST IR 8344) treats fraud type as a top-line dimension distinct from method.

The SafeEval envelope today has L1 (the domain: `deceptive_fraud`, `privacy_abuse`, etc.) and L2 (the FAF policy pattern: `romance_fraud`, `phishing_attack`, etc.), but L2's value set was scoped for FAF policy reasoning rather than for fraud-typology alignment with IC3 / FTC. Some L2 values do map cleanly (`romance_fraud` ~ Confidence/Romance), but others don't (`phishing_attack` covers BEC-for-money in L2, but BEC is a top-line IC3 category in its own right with much higher reported financial loss than non-BEC phishing). The result is that the envelope cannot generate a "by fraud typology" cut directly comparable to IC3 / FTC tables -- the analyst would need a translation layer.

Adding `typology:` as an explicit L3 closed-set category aligned with IC3 / FTC conventions gives a clean translation point. It also unlocks the kind of comparative narrative that a portfolio reader (hiring manager, policy analyst, GRC reviewer) finds load-bearing: "SafeEval categorizes against the same fraud-typology axes the FBI and FTC use, plus the policy-internal L2 patterns the FAF needs for its disposition logic." Two parallel cuts, designed deliberately.

### 2.3 Defending the system to a senior reviewer

The third argument is about how the system reads to a hiring policy analyst, a senior counsel reviewer, or any external evaluator looking at the v5 result card as evidence of what SafeEval is. A card where TOPIC says `relationship_grooming` and PERSONA says `"Romantic partner / dating app match"` is a card a reader has to interpret -- the labels are real but the slash in the prose string and the duplicate `lonely_individual` in the pill row are visible defects that a senior reader will notice immediately.

A card where TYPOLOGY says `romance_fraud.pig_butchering`, PERSONA says `romantic_partner`, PRETEXT says `investment_success_share`, and CONTEXT says `dating_app_origin` reads as a system that has thought about what the axes are. The visible cleanliness is itself a policy-credibility signal. SafeEval is a portfolio artifact; the difference between "looks like a working classifier" and "looks like a working classifier designed by someone who has thought carefully about fraud ontology" is exactly the difference this memo's resolved decision would produce in the card chrome.

This is not a vanity argument. The JD signal the policy track is meant to demonstrate is "develops and communicates policy positions to diverse stakeholders." The result card is the most-visible policy artifact SafeEval has. Cleaning up the ontology so the card emits crisp, separable, countable dimensions is the highest-leverage move available to that signal.

---

## 3. Proposed separation -- four orthogonal closed-set dimensions

The proposal is to split the four conflated axes into four separate L3 closed-set categories, each with v1 vocabulary in the 10-20-entries range, each with explicit inclusion / exclusion criteria, each engine-emitted alongside the existing per-prompt fields and rendered as its own chip row in the result card. The four are: `typology:`, `persona:`, `pretext:`, `context_marker:` (the last already exists; the proposal extends its scope to include channel claims).

The vocabularies below are v1 drafts at the memo level, calibrated for an initial cut. The actual closed-set drafting -- including the full inclusion / exclusion criteria, the prose-to-label mapping tables in the style of `docs/08-v5-ontology.md` sections 3.1-3.5, and the cross-reference to fixtures -- is **out of scope for this memo**. It would be authored in phase 1b after Steven's adjudication, as the post-memo policy-author work.

### 3.1 `typology:` -- fraud typology aligned with IC3 / FTC conventions

Closed set, single-valued per prompt. The primary fraud typology the prompt instantiates. Aligned with FBI IC3 and FTC Consumer Sentinel Imposter Scams categories where the alignment is clean; SafeEval-internal where the external taxonomies disagree or omit.

Proposed v1 vocabulary (16 values):

| Value | Definition (one-liner; full criteria in phase 1b) |
|---|---|
| `romance_fraud` | Confidence/romance fraud; affection-based grooming for financial extraction. |
| `pig_butchering` | Sub-pattern of romance/investment fraud; sustained relationship grooming converging on a crypto / investment ask. Distinct enough from baseline romance fraud that IC3 / FTC treat it as its own pattern. |
| `investment_fraud` | Fake investment platforms, Ponzi / pyramid, pump-and-dump, fake crypto schemes. |
| `tech_support_scam` | Impersonation of tech-vendor support (Microsoft, Apple, ISP, bank IT). |
| `government_impersonation` | Impersonation of IRS, FBI, SSA, court, regulator, foreign government. |
| `family_emergency` | Impersonation of a family member in crisis (grandparent scam, "stuck abroad"). |
| `executive_impersonation` | BEC-style impersonation of a corporate executive for wire transfer. |
| `advance_fee_fraud` | 419, lottery/inheritance/customs/business-partnership variants. |
| `recovery_fraud` | Secondary victimization; "recovery services" targeting prior fraud victims. |
| `phishing_credential` | Credential-targeting phishing where the harm vector is account access, not money. |
| `account_takeover` | Direct ATO via credential stuffing, SIM swap, social-engineering recovery. |
| `identity_fraud` | Use of synthetic or stolen identities for downstream fraud. |
| `marketplace_fraud` | Fake listings, counterfeit goods, off-platform payment scams. |
| `platform_abuse` | Multi-accounting, promo abuse, fake reviews, ban evasion -- platform-mechanic exploitation. |
| `model_attack` | Prompt injection, model jailbreak, model impersonation. |
| `other_or_unclear` | Closed-set audit-affordance default for cases the v1 vocabulary doesn't cover. |

Notes on the v1 cut:

- `pig_butchering` is included as a separate value rather than rolled into `romance_fraud` because IC3 reporting treats it as a distinct enough pattern to track separately, and the financial-loss curve for pig butchering specifically is what drives most of the recent regulatory attention. (See open question 8.1 -- is this a hierarchical value or a separate top-level?)
- `phishing_credential` and `account_takeover` are typology values because the harm vector is account compromise, not money transfer. Phishing-for-money is folded into `executive_impersonation` (when BEC-shaped) or stays under its harm-vector value (`investment_fraud`, `advance_fee_fraud`, etc.) -- following the v5 PHISHING split (`docs/policy-spec-v5.0.md` Decision 1).
- `model_attack` consolidates the cyber-intrusion patterns into one typology value at this layer; the L2 disambiguation between `prompt_injection_attack` / `model_jailbreak` / `ai_model_impersonation` stays unchanged and remains the finer-grained classifier output.

Inclusion / exclusion boundaries to settle in phase 1b: the `pig_butchering` vs. `romance_fraud` vs. `investment_fraud` boundary is the prototypical hard case; the BEC vs. `executive_impersonation` vs. `phishing_attack`-for-money boundary is the second hardest.

### 3.2 `persona:` -- closed-set identity claim by the attacker

Closed set, single-valued per prompt. The identity the attacker claims, independent of the channel they reached the target through and independent of the pretext (the story they're telling under that identity).

Proposed v1 vocabulary (15 values):

| Value | Definition (one-liner; full criteria in phase 1b) |
|---|---|
| `romantic_partner` | The attacker performs a romantic / dating relationship. |
| `family_member` | The attacker claims to be (or to represent) a family member. |
| `coworker_peer` | The attacker claims to be a colleague or peer-level employee. |
| `corporate_executive` | The attacker claims to be a C-suite or senior corporate figure. |
| `it_support_internal` | The attacker claims to be the target's own IT / helpdesk / security team. |
| `tech_support_external` | The attacker claims to be tech support for a third party (Microsoft, Apple, bank IT). |
| `vendor_or_supplier` | The attacker claims to be a business counterparty -- vendor, supplier, invoicing party. |
| `customer_or_buyer` | The attacker claims to be a customer, marketplace buyer, or service requester. |
| `government_official` | The attacker claims a government / regulator / law-enforcement identity. |
| `lawyer_or_legal_agent` | The attacker claims a lawyer / barrister / legal-chambers identity. |
| `recovery_investigator` | The attacker claims to be a recovery / asset-tracing / fraud-investigator service. |
| `investment_advisor` | The attacker claims to be an investment professional -- broker, fund manager, crypto coach. |
| `dating_app_match` | The attacker claims to be a connection from a dating app, with no further relationship claim yet. (Use when persona is asserted but the persona type is just "match.") |
| `community_member` | The attacker claims to be a member of the target's community (religious, ethnic, professional, language-based) -- the affinity-fraud persona. |
| `unknown_or_other` | Closed-set audit-affordance default. |

Notes:

- This list intentionally mirrors most of the existing `PRETEXT_LABELS` in `src/lib/safeeval-v5.js` (`it_support`, `executive_directive`, `government_or_regulator`, `family_emergency`, `tech_support_scam`, `romantic_partner`, `investment_advisor`, `recovery_agent`, `vendor_or_customer`, `peer_or_colleague`), with renames to clarify the "who is the attacker" framing rather than "what is the attacker's story" framing. The renaming is deliberate: PRETEXT today is doing persona-work because no persona field exists. After the split, the existing `PRETEXT_LABELS` values that are persona-shaped (`it_support` ~ `it_support_internal`, `executive_directive` ~ `corporate_executive`, etc.) migrate to `persona:`, and PRETEXT gets a fresh closed set scoped to actual pretext (section 3.3).
- `lawyer_or_legal_agent` and `recovery_investigator` are split because the case-study work (`docs/policy-reviews/2026-06-case-study-analysis.md` cases 3 and 6) established that they are different attacker identities even when both invoke "retainer" language. The lockstep discriminator already lives in `docs/08-v5-ontology.md` section 3.1 (the `method:advance_fee_lawyer_fee` discriminator); keeping the persona split mirrors that work.
- `dating_app_match` is included as a transitional persona for fixtures where the attacker has not yet escalated to `romantic_partner` -- the first turn of a pig-butchering arc, before trust-ramp. Phase 1b should decide whether this is one persona or whether dating-app context is a `context_marker:` value and the persona stays `romantic_partner` from turn one. (See open question 8.2.)

Inclusion / exclusion boundary: the `family_member` vs. `family_emergency` distinction -- `family_member` is the persona, while the emergency framing is the pretext (section 3.3, `emergency_money`). Same persona can have non-emergency pretexts (a "long-lost cousin needs help with an inheritance" pretext is `family_member` persona + `inheritance_release` pretext, not `family_emergency`).

### 3.3 `pretext:` -- closed-set cover story for the ask

Closed set, single-valued per prompt. The framing the attacker uses to motivate the ask, distinct from who the attacker claims to be. A `romantic_partner` persona can use several pretexts; a `government_official` persona can use several pretexts; the same pretext can be carried by several personas. Two axes, not one.

Proposed v1 vocabulary (16 values):

| Value | Definition (one-liner; full criteria in phase 1b) |
|---|---|
| `investment_success_share` | "Look at the gains I've been making; you should get in too." -- the pig-butchering pivot pretext. |
| `urgent_payment_authorization` | "Approve this wire today; the deal closes at 5 PM." -- BEC canonical. |
| `account_verification` | "Confirm your account by clicking / responding to this." -- credential / ATO canonical. |
| `password_reset_required` | "Your password has expired / been compromised; reset here." -- credential phishing canonical. |
| `legal_settlement_release` | "You are owed funds in a legal proceeding; pay the processing fee to release." -- lawyer-fee advance-fee. |
| `inheritance_release` | "You are named in a foreign client's estate; pay customs / clearance to receive." -- inheritance advance-fee. |
| `lottery_prize_release` | "You have won a lottery / sweepstakes; pay processing to claim." |
| `customs_clearance_fee` | "Funds / goods are in customs and require a fee to release." |
| `partnership_opportunity` | "Lucrative partnership; small upfront capital required." -- business-partnership advance-fee. |
| `tax_or_regulator_demand` | "You owe the IRS / SEC / agency; pay or face consequences." -- government impersonation canonical. |
| `family_emergency_money` | "Your relative is in trouble / hospital / jail; send money now." -- grandparent / family-emergency canonical. |
| `tech_support_remediation` | "Your computer / account has a problem; let me fix it / sell you a fix." -- tech-support-scam canonical. |
| `recovery_service_offer` | "We can help you recover funds you lost in a prior scam; pay the bond." -- recovery-fraud canonical. |
| `vendor_invoice_change` | "Please update our payment details to this new account." -- BEC vendor-change canonical. |
| `mule_recruitment_offer` | "Easy work-from-home job processing payments." -- fraud-infrastructure canonical. |
| `other_or_unclear` | Closed-set audit-affordance default. |

Notes:

- The vocabulary is anchored on the *what is the attacker asking the target to do, under what rationale* axis. Compared to the existing PRETEXT vocabulary (which mixed persona and pretext), this list is purely the rationale axis.
- `urgent_payment_authorization` is the BEC pretext, distinct from `executive_directive` (which was persona-shaped in the old PRETEXT vocabulary). After the split, BEC reads as `persona:corporate_executive` + `pretext:urgent_payment_authorization` -- two clean axes.
- `family_emergency_money` is the pretext that pairs with `persona:family_member` to produce a grandparent-scam classification. Compare to `inheritance_release`, which can also pair with `persona:family_member` (a distant-relative pretext) -- same persona, different pretext.

Inclusion / exclusion boundary: the `account_verification` vs. `password_reset_required` distinction is intentional even though both are credential-targeting -- the request shape matters for review SOPs. The first asks the target to confirm something they already have; the second walks them through resetting and capturing. Phase 1b should write the discriminator.

### 3.4 `context_marker:` -- contact channel and framing (extended scope)

`context_marker:` already exists as an L3 category in `docs/08-v5-ontology.md` section 3.4. Its current scope is *framing claims*: `security_training`, `internal_simulation_claimed`, `authorized_pentest_claimed`, `journalism_claimed`, `fiction_creative`, `academic_research`, `defensive_analysis`, `roleplay_hypothetical`, `victim_list_purchased`, `ai_pretext_claimed`. Eleven values, all about how the prompt frames its purpose.

The proposal here is to **extend the scope** of `context_marker:` to also include **contact channel / origin** claims. The existing values stay; new channel-oriented values join the same category. Multi-valued (a prompt can carry both a framing claim and a channel claim simultaneously).

Proposed v1 additions to `context_marker:` (10 new values, joining the existing 11):

| New value | Definition |
|---|---|
| `dating_app_origin` | The contact originated on a dating app (Tinder, Bumble, Hinge, Coffee Meets Bagel, ethnic / niche dating apps). |
| `social_media_dm_origin` | The contact originated as a direct message on a social media platform (Instagram, Twitter/X, Facebook, LinkedIn, TikTok). |
| `unsolicited_sms_origin` | The contact arrived as an unsolicited text message; sender unknown to the target. |
| `unsolicited_email_origin` | The contact arrived as an unsolicited email; sender unknown to the target. |
| `cold_call_origin` | The contact arrived as an unsolicited phone call. |
| `marketplace_listing_origin` | The contact originated via a marketplace / classifieds listing (Craigslist, Facebook Marketplace, eBay). |
| `professional_network_origin` | The contact originated via a professional network (LinkedIn, recruiter outreach, conference networking). |
| `in_app_chat_origin` | The contact originated within a platform's in-app chat (gaming, marketplace, dating app post-match). |
| `referred_by_third_party` | The contact was made via introduction by another party (community leader, mutual acquaintance, prior victim referral). |
| `community_or_affinity_origin` | The contact originated within an affinity community (religious group, ethnic community, professional association). |

Notes on scoping `context_marker:` to include channel:

- This is a scope extension of an existing category, not a new category. Per the ontology extension policy (`docs/08-v5-ontology.md` section 7), adding values within an existing L3 category is a patch-version bump (5.2 -> 5.2.1) or, with this many additions and the semantic broadening, a minor bump (5.2 -> 5.3).
- The alternative -- creating a brand-new L3 category called `channel:` or `origin:` -- is considered and rejected in section 4 (alternative b). The short version: the framing-claim and channel-claim axes both answer "context about the contact," they multi-value naturally, and a single category is more discoverable than two parallel ones.
- Phase 1b would author full inclusion / exclusion criteria including the `dating_app_origin` vs. `in_app_chat_origin` boundary (a Tinder match who escalates to private messaging is `dating_app_origin`; a Discord guild member who DMs another guild member is `in_app_chat_origin`).

### 3.5 Free-text descriptor fields stay; their scope tightens

The existing `topic_explanation` and `pretext_explanation` prose fields stay in the envelope. Their role is unchanged from the `2026-05-26-policy-v5-classifier-display-vocabulary.md` section 3.5 commitment -- carry the *specific* noun ("California Driver's Licence," "Romantic partner sharing personal crypto gains") that the closed-set label cannot.

The PERSONA prose field today is doing double duty (identity claim + channel claim mashed together). After the four-dimension separation, PERSONA prose is no longer load-bearing -- the identity-claim half goes to `persona:` (closed set), and the channel-claim half goes to `context_marker:` (closed set). The proposal is to **deprecate the PERSONA prose field** from the visible card chrome (keep it as a backward-compat envelope alias during dual-emit, then drop it).

A new `persona_description` prose field could be added for human-reviewer narrative (the equivalent of `topic_explanation` for the persona axis), but the case is weak -- the closed-set `persona:` value already captures the audit-relevant claim, and the additional context goes into `pretext_explanation` or the reviewer's narrative summary. Phase 1b decision; default is to *not* add `persona_description` unless a fixture survey shows recurring loss of detail.

---

## 4. Alternatives considered

### 4.1 Alternative (a): persona-only split; leave PRETEXT and `context_marker:` conflated

**Considered, rejected.** The minimal version of this proposal: split PERSONA into its two halves (identity + channel), but leave PRETEXT scoped as it is today (the mixed persona+pretext vocabulary) and leave `context_marker:` scoped to framing claims only. The change is just at the PERSONA seam.

This is rejected for two reasons.

First, the change is **asymmetric**: it splits one of the three conflated axes and leaves the other two unchanged. The result would be a card where PERSONA cleanly separates identity from channel, but PRETEXT still mixes persona-shaped values (`it_support`, `executive_directive`) with rationale-shaped values, and TOPIC still bundles fraud typology with prompt shape. A reviewer reading the card would notice the inconsistency immediately -- one axis is clean, two are not, and the most visible chip rows of the surface still produce slash-separated and pill-duplicated emissions. The defects in sections 1.1, 1.2, 1.3 are coupled; addressing one without addressing the others leaves the system in an awkward middle state.

Second, the work to land just the persona half is roughly the same shape as the work to land all four: schema bump, Stage 2 system-prompt extension, fixture re-mapping (the persona-bearing fixtures are the same ones that need pretext re-mapping), lockstep validator extension. Doing one and deferring the others incurs almost-full migration cost twice. Better to bundle.

### 4.2 Alternative (b): persona + pretext split, leave `context_marker:` for channel as descriptors only

**Considered, rejected.** A halfway-house alternative: split PERSONA into identity-claim + (free-text channel descriptor), split PRETEXT into the pretext-only closed set proposed in section 3.3, but don't formalize a closed set for channel / contact origin -- let it stay as prose in a `persona_description` or `context_description` field.

This is rejected because the argument the memo opened with -- conflation lives in prose fields because descriptors are catch-alls -- returns. A channel descriptor field would absorb the same conflation that PERSONA prose absorbs today. The first time a fixture says "originated on Bumble, escalated to WhatsApp," the descriptor would carry two channels in one prose string and the auditor would be back to parsing slashes. The same problem.

The reason `context_marker:` already exists as a closed set is that *framing claims* hit the same problem with the same dynamics. Channel claims are no different in shape. Either the surface has a closed set for channel, or it has the same conflation problem just relocated. The cost of authoring 10 channel values is small; the cost of leaving the door open to conflation is exactly what this memo is trying to close.

### 4.3 Alternative (c): make `typology:` a top-level structured field rather than an L3 category

**Considered, partial accept with deferred adjudication; current memo recommendation is L3.** The argument for top-level: fraud typology is the *primary* axis fraud analysts categorize on, and the IC3 / FTC convention is to treat it as the report's headline cut. A top-level `classification.typology` field, parallel to `classification.l1`, `classification.l2`, `classification.l3[]`, would be discoverable, prominent, and unambiguous about its primary status.

The argument for L3 (the current memo recommendation): consistency with the existing closed-set-on-L3 pattern. `method:`, `tactic:`, `target:`, `context_marker:`, `overlap:`, `arc:`, `cadence:` are all on L3. Adding `typology:` as a new L3 category fits the existing discipline: closed sets at L3 are how SafeEval is shaped. A top-level structured field would introduce a *new envelope shape* for one specific axis, which is harder to defend on architectural-symmetry grounds than another L3 category addition.

The tradeoff is real but not load-bearing. Both shapes can support the IC3 / FTC alignment narrative; both shapes are countable; both shapes can be displayed prominently in the result card. The L3 shape is one less envelope-architectural decision to defend, and the closed-set discipline is identical either way.

**Recommendation: L3.** Open question 8.3 flags this for Steven, with the option to bump it to top-level if the portfolio narrative leans on "fraud typology is the primary axis" hard enough to want the structural prominence.

### 4.4 Alternative (d): keep the current ontology, fix only the rendering bug

**Considered, rejected.** A minimal-change alternative: the duplicate `lonely_individual` in the pill row is fixable by deduping `target_attributes` against `target_label` at render time, and the PERSONA slash-string is fixable by splitting on the slash and rendering as two chips. No ontology change.

This is rejected because the rendering bugs are *symptoms*. The duplicate `lonely_individual` exists because `target:` lives in two layers (the dedicated `target_label` and the `target_attributes` alias). Deduping at render time hides the fact that the same value is being emitted twice in different shapes. Splitting the PERSONA slash hides the fact that the producer is putting two semantic types into one prose string. The fixes work for the specific instances visible today; they don't prevent the next instance.

The deeper principle: if the producer is structurally capable of conflating dimensions, render-side cleanup is a holding action. The producer needs to emit clean separated dimensions. That's the ontology argument; rendering is downstream.

There is a weaker version of this alternative -- "fix the rendering now while the ontology work is in flight" -- which is defensible as a stopgap. This memo does not block that work, but flags that it should not be considered the resolution.

---

## 5. Migration plan sketch

### 5.1 Schema version bump

Current schema is 5.2 (per the most recent ontology amendment in `docs/08-v5-ontology.md`). The proposed changes are: (a) one new L3 category (`typology:`) -- a minor breaking change per the ontology extension policy; (b) one scope-extension of an existing L3 category (`context_marker:` gains channel-origin values) -- a minor change; (c) one new L3 category (`persona:`) replacing the old PRETEXT vocabulary's persona-shaped values -- a minor breaking change; (d) the existing PRETEXT vocabulary gets reshaped into pretext-only values -- a closed-set renaming, which per the extension policy is a major breaking change.

The conservative read: **bump to 5.3** for the additive parts (typology + persona + context_marker extension) and treat the PRETEXT reshape as a managed deprecation -- keep the old PRETEXT vocabulary live during a dual-emit window, emit the new PRETEXT alongside, deprecate the old.

A more aggressive read: bump to 6.0 because the PRETEXT vocabulary rename is technically a breaking change. The case against 6.0: no production consumer reads PRETEXT today other than the v5 UI itself; the dual-emit window has historically absorbed this kind of vocabulary-shape change at minor-version cost (precedent: the 2026-05-26 vocabulary memo added seven new closed sets under a minor bump).

**Memo recommendation: 5.3 with managed dual-emit for PRETEXT.** Open question 8.4 flags this for confirmation.

### 5.2 Stage 2 system prompt changes

`src/lib/safeeval-v5.js` `SYSTEM_STAGE_2_FAF` (lines ~510-593) currently instructs Stage 2 to emit `prompt_summary.{persona, topic_label, topic_explanation, target_label, target_attributes, objective_label, pretext_label, pretext_explanation}`. The phase-3 vscode dispatch would extend this to emit:

- The new `classification.l3[]` entries for `typology:`, `persona:`, and extended `context_marker:` channel values.
- A reshaped `prompt_summary.pretext_label` drawn from the new pretext-only closed set.
- Optionally, a new `prompt_summary.typology_label` as a card-level alias mirroring the L3 typology value (same pattern as `prompt_summary.target_attributes` aliases L3 target+tactic today).

The system-prompt token cost grows modestly. Existing prompt-summary fields stay populated as backward-compat aliases during the dual-emit window.

### 5.3 Fixture migration

`tests/golden-conversations/*.json` and any prompt-mode fixtures currently carry `persona`, `pretext_label`, `target_attributes` expectations baked into expected outputs (sometimes in `expected_v5` fields, sometimes only as narrative notes). Per-fixture migration plan:

- Map each existing `pretext_label` value to its (`persona:`, `pretext:`) split. The mapping is mechanical for most fixtures because the existing PRETEXT_LABELS values are persona-shaped: `it_support` -> `persona:it_support_internal`, `executive_directive` -> `persona:corporate_executive` + `pretext:urgent_payment_authorization`, `family_emergency` -> `persona:family_member` + `pretext:family_emergency_money`, etc.
- For fixtures with rich PERSONA prose ("Romantic partner / dating app match"), parse the slash and assign `persona:romantic_partner` + `context_marker:dating_app_origin`.
- For fixtures with `topic_label=relationship_grooming`, decide whether to add `typology:pig_butchering` or `typology:romance_fraud` based on the financial endpoint (crypto pivot -> pig_butchering; sustained romance without investment endpoint -> romance_fraud).

The migration is mechanical-with-occasional-judgment-calls. Best estimate: ~30 fixtures touched, ~1 hour of careful policy-author work, plus lockstep verification.

### 5.4 Lockstep validator extension

`scripts/check-lockstep.js` currently verifies the seven memo-introduced closed sets (TEMPLATE_LABELS, DELIVERY_LABELS, CONTROL_LABELS, TOPIC_LABELS, TARGET_LABELS, OBJECTIVE_LABELS, PRETEXT_LABELS) plus the L3 closed sets, bright lines, and disposition verbs. The validator would gain checks for:

- The new `typology:` closed set against `docs/08-v5-ontology.md` section 3.x and the engine constant.
- The new `persona:` closed set, same shape.
- The extended `context_marker:` set, same shape (existing check, new values appended).
- The reshaped PRETEXT vocabulary, same shape (existing check, vocabulary replaced; dual-emit handling means the old and new are both valid for a window).

Additive work; no existing check is invalidated.

### 5.5 Result-card render

The result card's PROMPT_SUMMARY section would gain three new chip rows (TYPOLOGY, PERSONA, CONTEXT) and re-scope its existing PRETEXT row to the new pretext-only vocabulary. The TARGET row would be cleaned up to show only `target:` L3 values (with `tactic:` values surfaced elsewhere or omitted from this section).

This is phase 2 design work, gated on the resolved memo. The phase-2 design dispatch would author the layout, hover behavior, and visual hierarchy per the new four-dimension model.

### 5.6 Backward compatibility

Old envelopes (schema 5.1 / 5.2) need a graceful read path:

- The UI renderer detects schema version on envelope load and falls back to the legacy PRETEXT/PERSONA rendering for older envelopes.
- The `target_attributes` field continues to populate from L3 `target:` + `tactic:` for the dual-emit window; the new design displays it differently but the producer code is unchanged.
- The reviewer SOP at `docs/04-enforcement-design.md` is unaffected -- it reads `disposition`, `triggered_by`, `bright_lines`, and L1/L2 directly, not the prompt-summary surface.

---

## 6. Risk assessment

### 6.1 Vocabulary completeness risk

The core risk: do the v1 closed sets in sections 3.1-3.4 actually cover the prompt and conversation patterns the eval set encounters? If not, fixtures will land on `other_or_unclear` more than rarely, and that defeats the countability argument.

**Mitigation.** Each closed set includes an `_other` / `_unclear` escape hatch (per ontology section 7 extension policy). The phase-1b authoring step includes a fixture survey: re-map every existing fixture to the new vocabularies, count `other` landings, and amend the vocabulary before lockstep. The acceptance bar for v1 should be `other < 10% of fixtures per category`; categories that exceed get expanded vocabulary before phase 2.

A residual risk is that the eval set is not representative of production traffic patterns SafeEval would see at scale. The eval set is small (20 conversation fixtures, ~30 prompt fixtures) and is curated to exercise specific FAF patterns rather than to mirror an empirical IC3-distribution sample. Phase 1b should flag a follow-up brief to re-sample once SafeEval has any production traffic to learn from.

### 6.2 Backward compatibility risk

Old envelopes (5.1, 5.2) and any cached / archived analyses need to keep rendering. The risk: a schema-version-aware code path is one more place a regression can land.

**Mitigation.** Standard dual-emit window. Engine continues to emit the old PRETEXT vocabulary alongside the new during a transition window (default: until v6.0 or 90 days post-ship, whichever is longer). Renderer falls back to the legacy rendering when the new fields are absent. Existing alias-population code (`populateTargetAttributesFromL3()`) stays functional.

The risk specific to PRETEXT vocabulary reshape: a fixture that previously matched `pretext_label=executive_directive` will not match `pretext_label=urgent_payment_authorization` if the test compares exact strings. The fixture migration step (section 5.3) handles this; lockstep verifies it; CI catches any missed fixtures. Low residual risk.

### 6.3 Coverage / loss-of-detail risk

The current PERSONA prose field captures detail that the closed-set `persona:` value drops -- "Romantic partner / dating app match" carries both the persona type and the channel, both of which the new model captures separately, but it also occasionally carries operator-readable nuance (the slash was in fact the rendering of "this is a dating-app match where the persona is escalating from match to romantic partner"). After the split, that nuance lives in the `persona_description` prose field if added (deferred to phase 1b) or in the reviewer's narrative summary.

**Mitigation.** Phase 1b authors a coverage audit: re-map current fixtures' PERSONA prose to the new model, count cases where prose detail is lost, decide whether to add `persona_description`. If `persona_description` is added, it's an additive change (new prose field, no semantic loss).

### 6.4 Ontology-overreach risk

The fourth risk is structural: this memo proposes adding two new L3 categories (`typology:`, `persona:`) and extending a third (`context_marker:`), which is a lot of L3 surface area to add in one phase. The L3 ontology is already 8 categories with significant complexity; adding two more pushes the cognitive load on reviewers, the rendering complexity on the UI, and the system-prompt token cost on Stage 2.

**Mitigation.** Sequence the changes. Phase 1b authors `typology:` first (highest portfolio leverage, cleanest standalone story). Phase 1c authors `persona:` and the `context_marker:` extension together (they're tightly coupled to the PERSONA split). Phase 2 + 3 ship in the same release window to keep the visible card consistent.

The alternative is to commit to all three in phase 1b and ship together. The argument for sequencing: it lets `typology:` land and stabilize before the bigger PERSONA / PRETEXT reshape. The argument against: the migration cost (Stage 2 prompt edits, fixture re-mapping, lockstep extension) is the same either way; sequencing roughly doubles it.

**Memo recommendation: bundle in phase 1b, ship sequenced in phase 3** -- Stage 2 system prompt and fixtures migrated in one phase 1b pass; vscode landing the engine changes in phase 3 with a feature-flag gating the new rendering until phase 2 design is ready. Open question 8.5 flags this.

---

## 7. Recommendation

**Accept the four-dimension separation.** Add `typology:` and `persona:` as new L3 closed-set categories, extend `context_marker:` to include channel-origin values, reshape the existing PRETEXT vocabulary to be pretext-only (rationale-shaped), and deprecate the PERSONA prose field from the visible card chrome (keep as a backward-compat envelope alias during dual-emit).

This is the right move now for three reasons.

**The defect is real and visible.** Section 1's evidence -- the duplicate `lonely_individual`, the slash-separated PERSONA, the typology / shape conflation in TOPIC -- is on the live result card today. Any portfolio-visible review of the v5 surface will catch it. Cleaning it up before a hiring panelist or external reviewer sees the card is high-leverage.

**The architecture supports the change.** v5 has already paid the closed-set-on-L3 cost ten times over (`method:`, `tactic:`, `target:`, `context_marker:`, `overlap:`, `arc:`, `cadence:`, plus the seven prompt-summary closed sets from the 2026-05-26 memo). Adding two more L3 categories and extending a third is well within the design pattern. The migration burden is real but bounded; the precedent for absorbing it during dual-emit is the 2026-05-26 work landing on schema 5.0 -> 5.1 with seven new closed sets at once.

**The story is defensible.** Aligning `typology:` with IC3 / FTC reporting categories gives the result card a vocabulary an external fraud analyst recognizes, without forcing the L2 FAF policy classifier to bend its scope. Two parallel cuts -- the FAF policy view (L1/L2) and the fraud-economics view (`typology:`) -- is exactly the kind of thoughtful axes-design that a senior policy reviewer expects to see in a serious classifier.

The alternatives examined in section 4 each lose on one of the three counts above. Persona-only (4.1) leaves the asymmetry. Halfway-house with descriptor channel (4.2) re-imports the conflation. Top-level typology (4.3) is defensible but loses the architectural-consistency argument. Render-only fix (4.4) treats symptoms not causes.

The deferred work (sections 5, 6) is real and not trivial -- vocabulary completeness audit, fixture migration, lockstep extension, schema bump, dual-emit window, optional `persona_description` field. None of it is novel or out-of-pattern for the v5 line. All of it is what shipping a four-dimension separation looks like done seriously.

---

## 8. Open questions for Steven

These are decisions the memo cannot make unilaterally. Phase 1b is gated on resolving 8.1-8.5; 8.6-8.7 can be resolved at phase 2 or 3 if convenient.

**8.1 -- Sub-typology shape.** Is `pig_butchering` a separate top-level `typology:` value (peer to `romance_fraud` and `investment_fraud`), or a hierarchical value within `romance_fraud` / `investment_fraud` (notated `typology:romance_fraud.pig_butchering` or `typology:romance/pig_butchering`)?

The case for separate top-level: IC3 reporting tracks pig butchering as a distinct pattern with its own loss-curve. The case for hierarchical: it preserves the romance/investment lineage that pig butchering is structurally a hybrid of, and the v5 ontology doesn't yet use any hierarchical L3 values (precedent argues for flat). The memo's tentative recommendation is **separate top-level value** for v1, on the IC3-alignment ground, with a follow-up brief to consider hierarchical if other typologies (BEC vs. executive-impersonation, advance-fee variants) accumulate enough sub-pattern surface area to need it.

**8.2 -- `typology:` field placement.** L3 category (current memo recommendation) or top-level structured field (`classification.typology`)?

The memo recommends L3 on architectural-symmetry grounds (section 4.3), but a hiring-narrative case for top-level is real -- it positions typology as a primary axis the way IC3 / FTC reports do. If the portfolio narrative leans on "we classify by IC3 typology" as a headline, top-level is more discoverable. Either shape supports the FAF policy work; the choice is more about presentation than about semantics.

**8.3 -- Duplicate `lonely_individual` interpretation.** Is the duplicate in the screenshot a deduplication bug at the render layer, or is `lonely_individual` legitimately appearing in both `target_label` and `target_attributes` because two L3 categories carry the value?

Reading `populateTargetAttributesFromL3()`: the function copies all L3 `target:` and `tactic:` values into `target_attributes`. `target:lonely_individual` is the L3 value. `target_label` is the prompt-summary-level closed-set label that maps from the L3 `target:` set. So both *do* carry the same value, by design -- the render is correctly showing what the envelope says. The "bug" is at the design layer (why is the same fact in two places?) not the rendering layer (which is faithfully displaying both). The four-dimension separation resolves this naturally: after the split, `target_label` stays single-valued and the new pill rows show *different* dimensions (persona, tactic, context_marker), not the same dimension twice.

The memo's tentative answer: **not a render bug; an ontology layering artifact.** Confirming in this open question because the framing affects how to communicate the fix.

**8.4 -- Schema version.** 5.3 (managed dual-emit, additive), or 6.0 (treat PRETEXT reshape as breaking)?

Memo recommends 5.3 (section 5.1). The argument for 6.0 is conservatism on vocabulary renames; the argument against is no production consumer reads PRETEXT today and the dual-emit precedent is well-established. Flagging for confirmation.

**8.5 -- Phase 1b scope and sequencing.** Three options for the post-memo work:

- **Option A:** Bundle all three (`typology:`, `persona:`, `context_marker:` extension) into one phase 1b. Single fixture-migration pass, single lockstep extension. Memo recommendation.
- **Option B:** Sequence `typology:` first, then `persona:` + `context_marker:` extension as phase 1c. Lower per-phase blast radius; doubles total migration work.
- **Option C:** Phase 1b authors only the vocabulary closed sets in `docs/08-v5-ontology.md`; the Stage 2 / fixture / lockstep / render work is deferred to a separate phase 3. This is the cleanest "memo lands the policy, vscode lands the implementation" split.

Memo tentatively recommends Option A on consolidated-cost grounds; happy to switch to C if the venue-boundary discipline matters more than the bundling.

**8.6 -- `persona_description` prose field: add or omit?** Section 3.5 defers this to phase 1b. The default is omit; phase 1b's coverage audit (section 6.3) decides. Flagging here because it affects the final envelope shape -- if added, it's another field for phase 3 to wire up; if omitted, it's not.

**8.7 -- Channel value granularity.** Section 3.4 proposes ten new channel-origin values. Is the granularity right? Examples of judgment calls phase 1b would make:

- One `social_media_dm_origin` or split by platform family (`facebook_origin`, `instagram_origin`, `twitter_origin`, etc.)? Memo tentatively recommends one consolidated value; counting at the platform level can use a `platform:` sub-tag if needed.
- One `dating_app_origin` or split by app type (`mainstream_dating_app`, `niche_dating_app`, `ethnic_dating_app`)? Memo tentatively recommends one consolidated value; sub-stratification deferred.
- Should `referred_by_third_party` be a `context_marker:` value or move to a separate `relationship_marker:` category? Memo tentatively recommends keeping in `context_marker:`; defer separate-category authoring unless the value accumulates company.

---

## 8.1 Adjudication (2026-05-27, policy track, delegated by Steven)

Steven delegated decisions on §8.1-§8.7 plus two sequencing decisions (Path (a) and Phase 1b scope) to the policy track. Each decision below is the chosen path, the one-line rationale, and the named tradeoff accepted. The default for each is the memo's own tentative recommendation; departures from the default are flagged.

**§8.1 -- Sub-typology shape for pig butchering.** *Decision: separate top-level value (`typology:pig_butchering`, peer to `typology:romance_fraud` and `typology:investment_fraud`).* The IC3 reporting convention treats pig butchering as a distinct pattern with its own loss-curve, and the closed-set discipline at L3 has no precedent for hierarchical values (every existing L3 category is flat). Following the memo's tentative recommendation. *Tradeoff accepted:* the romance/investment lineage that pig butchering is structurally a hybrid of is not visible in the typology value alone; reviewers who want that decomposition must read `typology:` jointly with `L2` (`romance_fraud` or `investment_fraud`) and `arc:trust_ramp` + `arc:money_ask_pivot` (which carry the hybrid trajectory in the conversation surface).

**§8.2 -- `typology:` field placement.** *Decision: L3 category.* Eight L3 categories already exist (`method:`, `tactic:`, `target:`, `context_marker:`, `overlap:`, `risk_marker:`, `arc:`, `cadence:`); `typology:` as a ninth is architecturally symmetric and reuses existing schema-validator scaffolding. A top-level `classification.typology` field would introduce a new envelope shape for one axis and force re-litigation of every schema-rule that currently scopes "structured classification" to L1/L2/L3. The IC3 / FTC alignment story is rendered at the *card chrome* layer (TYPOLOGY gets its own chip row in phase 2), not at the envelope-shape layer. *Tradeoff accepted:* `typology:` is one-of-nine at the envelope level rather than visually-prominent at the top level, so a reader skimming raw JSON sees it nested under `classification.l3[]`. The result-card render compensates by promoting `typology:` to its own chip row alongside L1/L2.

**§8.3 -- Duplicate `lonely_individual` interpretation.** *Decision: ontology layering artifact, not a render bug.* `populateTargetAttributesFromL3()` copies all L3 `target:` and `tactic:` values into `prompt_summary.target_attributes`, and `target_label` independently maps from the same L3 `target:` set -- two layers carry the same fact by design. The four-dimension separation resolves this naturally: after the split, `target_label` stays single-valued (the dominant target persona) and the new pill rows show *different* dimensions (`persona:`, `tactic:`, `context_marker:`), not the same dimension twice. *Tradeoff accepted:* until the dual-emit window closes, old envelopes will continue to surface the duplicate; phase 2's render is responsible for hiding the redundancy on schema-5.3+ envelopes and falling back to the legacy display on schema-5.2- envelopes.

**§8.4 -- Schema version.** *Decision: ontology 5.2 -> 5.3 (additive), `schema_version` unchanged.* The proposed work adds two new L3 categories (`typology:`, `persona:`), extends `context_marker:` with ten channel-origin values, and reshapes the existing PRETEXT vocabulary. The envelope *shape* is unchanged -- new L3 entries drop into the existing `classification.l3[]` array, and the prompt-summary fields stay populated as backward-compat aliases during the dual-emit window. Per the §7 extension policy, adding L3 categories is a minor ontology bump (5.x -> 5.x+1). The PRETEXT reshape is the only candidate for a major bump, but no production consumer reads `prompt_summary.pretext_label` other than the v5 UI itself, and the dual-emit precedent (2026-05-26 vocabulary memo absorbed seven new closed sets at one minor bump) is well-established. *Tradeoff accepted:* the PRETEXT vocabulary rename is a value-rename in the strict §7 reading, which the policy classifies as a major break; treating it as a minor under managed dual-emit makes the spec slightly less strict in its own terms. Documented explicitly here so future audits know the precedent.

**§8.5 -- Phase 1b scope and sequencing.** *Decision: Option C (vocab-only).* Phase 1b drafts the four closed-set vocabularies with full inclusion / exclusion criteria and prose-to-label mapping tables in `docs/08-v5-ontology.md`, runs the fixture survey, and writes the lockstep extension plan. Stage 2 system-prompt edits, schema constant updates, fixture migration, lockstep validator code, and result-card render are deferred to phase 3 (vscode). The venue-boundary discipline (CLAUDE.md "Cowork writes policy, vscode writes engine") is load-bearing for this size of change -- the cleanest "policy lands the policy, vscode lands the implementation" split keeps each venue's work auditable in isolation. Departing from the memo's tentative Option A (bundle everything in 1b). *Tradeoff accepted:* phase 1b ships without engine-side proof; the vocabulary survives only as policy text until phase 3 wires it. Risk that vocabulary defects surface only at engine integration time is real but bounded by the survey (§8.1b below).

**§8.6 -- `persona_description` prose field.** *Decision: omit for v1.* The closed-set `persona:` value plus the existing `pretext_explanation` prose field already cover the audit-relevant identity-claim narrative; adding a third prose field invites the same conflation drift that PERSONA prose suffers today (slash-separated values, mixed dimensions). The fixture survey below (§8.1b) confirms zero fixtures lose load-bearing narrative when PERSONA prose is dropped. *Tradeoff accepted:* operator-readable nuance ("dating-app match escalating to romantic partner over three turns") that was occasionally carried by the slash in PERSONA prose now must live in `pretext_explanation` or `arc:` entries; a one-line narrative loss for the most-nuanced 5-10% of fixtures.

**§8.7 -- Channel value granularity.** *Decision: ten consolidated values as proposed in §3.4; no platform-family or app-type subdivision.* Counting at the platform level (Tinder vs Bumble vs Hinge) can layer on later via a `platform:` sub-tag or as `risk_marker:` annotation; the v1 cut keeps `dating_app_origin` as a single value across all mainstream + niche + ethnic dating apps. `referred_by_third_party` stays in `context_marker:` rather than moving to a hypothetical `relationship_marker:` category -- the value-count threshold for promoting to a new category is roughly five values, and the affinity-referral surface has one. *Tradeoff accepted:* Tinder-specific vs Bumble-specific frequency analysis is not directly possible from the L3 emission alone; downstream analytics need a second axis to disaggregate.

### Sequencing decision (a) -- P1 follow-ups vs Phase 1b

*Decision: Path (a)(i) -- surgical-first.* The three P1 dispatches (0035 BRIGHT_LINE_FORCED_L2 recovery-fraud drift; 0036 realtime-synthetic-media bright-line celebrity false-positive; 0037 `overlap:secondary_victimization` false-positive cleanup) are scoped to surfaces that the four-dimension reshape does not touch: 0035 is engine `BRIGHT_LINE_FORCED_L2` set composition (no new L3 categories needed); 0036 is bright-line precondition language (the bright-line set itself is unaffected by the reshape); 0037 is Stage 3 prose-to-label discrimination on an existing L3 `overlap:` value. None of the three depends on `typology:`, `persona:`, the reshaped PRETEXT vocabulary, or the extended `context_marker:`. Folding them into Phase 1b would couple three small, separately-shippable fixes to a ~4-week reshape, and would force each P1's live-engine verification gate (all three require it per their acceptance criteria) to wait on the broader migration. Surgical-first ships the P1 fixes against current ontology 5.2, lets each one verify against live, and lets Phase 1b proceed independently to 5.3 once they close. *Tradeoff accepted:* the documentation has two ontology bumps in close succession (5.2 patch-level for the P1 fixes, then 5.3 for the four-dimension reshape) rather than one consolidated bump; the audit trail is slightly noisier but each change is independently reviewable.

**P1 brief disposition.** Briefs 0035, 0036, 0037 are filed in `handoff/board/pending/` (already in place per the post-Tier-1 follow-up queue). They are NOT dispatched in this policy turn; Steven dispatches them when API credits are restored, per the credit-blocked status of their live-verification gates. This memo's §8.1 Adjudication is the trigger for the path-(a)(i) sequencing decision; the briefs themselves stay in pending until Steven promotes them.

### Sequencing decision (b) -- Phase 1b scope

Reiterating: Option C as per §8.5. Phase 1b in this dispatch authors the closed-set vocabularies (typology + persona + pretext reshape + context_marker extension), runs the fixture survey, and writes the lockstep extension plan. Stage 2 system-prompt edits, schema-constant updates, fixture migration, lockstep validator code, and result-card render are deferred to phase 3 (a separate vscode dispatch, gated on this memo's resolution + the P1 follow-ups closing).

### §8.1b -- Phase 1b deliverables tracker

The Phase 1b vocabulary lands in `docs/08-v5-ontology.md` as new sections 3.8 (`typology:`), 3.9 (`persona:`), §3.4 extension (`context_marker:` channel values), and §3.3-replacement (the reshaped `pretext:` closed set, replacing the prompt-summary-level PRETEXT_LABELS as the L3 source-of-truth). The fixture survey lands as an appendix to this memo (§10 below). The lockstep extension plan lands as §11 below. The decisions-log entry in §9 is filled with ACCEPT and a back-reference to this §8.1.

---

## 9. Decisions-log entry (pre-resolution)

This entry is the proposed text for `docs/policy-spec-v5.0.md` section 9 *after* Steven adjudicates the memo. It is included here as the final block per the design-memo-author workflow; it is NOT to be pasted into the spec until the memo resolves.

```
### Decision 18 -- Four-dimension separation of PROMPT_SUMMARY ontology

- **Question:** Should the PROMPT_SUMMARY result-card section, which currently conflates four orthogonal dimensions (fraud typology, attacker persona, attacker pretext, contact context) into two structured fields plus one mixed-semantic pill row, be split into four separate closed-set L3 dimensions?
- **Resolution:** ACCEPT. Add `typology:` (16 values, IC3/FTC-aligned) and `persona:` (15 values) as new L3 closed-set categories; extend `context_marker:` with 10 channel-origin values (existing 11 framing-claim values retained); reshape the existing prompt-summary PRETEXT vocabulary to be rationale-only (16 values, persona-shaped values migrated to `persona:`); deprecate the PERSONA prose field from card chrome (envelope-alias retained during dual-emit window). Ontology bumps 5.2 -> 5.3 (additive, minor). `schema_version` unchanged. PERSONA_DESCRIPTION prose field omitted for v1. Pig butchering ships as a separate top-level `typology:` value. Phase 1b scope is Option C (vocab-only); Stage 2 / fixture / lockstep validator / render deferred to phase 3 (vscode). The three credit-blocked P1 follow-ups (0035 / 0036 / 0037) ship surgically against ontology 5.2 first (Path (a)(i)); Phase 1b proceeds to 5.3 after they close.
- **Rationale:** The conflation produces visible defects on the live result card (duplicate `lonely_individual` in target_attributes, slash-separated PERSONA prose conflating identity and channel, TOPIC bundling fraud typology with prompt shape). The L3 closed-set discipline already absorbs ten categories; adding two and extending a third is well within the established pattern. IC3 / FTC reporting taxonomies treat fraud typology as a primary axis (IC3 *Crime Type* tables, FTC *Imposter Scams* hierarchy); aligning `typology:` with those conventions gives SafeEval a vocabulary external fraud analysts recognize while preserving L2's FAF-policy scope. Per-dimension countability (the substantive job of any fraud-classification ontology) requires each conflated axis in its own closed-set field; the four-dimension reshape is the minimum cost to deliver that. Adjudication detail in §8.1 above. Implementation references: `docs/08-v5-ontology.md` §§3.4-extension, 3.8, 3.9, and §3-prompt-summary-pretext-reshape (phase 1b vocabulary); `docs/memos/2026-05-27-four-dimension-ontology-separation.md` (this memo) §§10-11 (fixture survey and lockstep extension plan); phase 3 vscode dispatch TBD post-credits.
```

---

## 10. Phase 1b fixture survey

Survey methodology: each existing fixture is re-mapped to the new four-dimension vocabulary (`typology:`, `persona:`, reshaped `pretext:`, extended `context_marker:`). The mapping is a paper exercise against fixture `prompt` + `notes` content -- no live engine calls, no fixture edits. Goal is to (a) confirm vocabulary completeness at the v1 cut, (b) count `other_or_unclear` landings per category, and (c) flag any fixture where the mapping is genuinely ambiguous.

Acceptance bar per §6.1: `other_or_unclear` < 10% of fixtures per category. Categories that exceed get expanded vocabulary before phase 3.

### 10.1 Single-prompt fixtures (12 in `tests/golden/` + 19 in `tests/golden/case-study-tier-1/`)

The 12 baseline prompt fixtures (01-12) cover the core FAF v5 typology surface. The 19 Tier-1 fixtures (case-study-tier-1/01-19) exercise the ontology 5.2 vocabulary additions and discriminator boundaries.

**Baseline (01-12).** Mapping summary -- one fixture per row, columns are the four new dimensions.

| Fixture | `typology:` | `persona:` | reshaped `pretext:` | `context_marker:` (channel) |
|---|---|---|---|---|
| 01 romance-pig-butchering | `pig_butchering` | `romantic_partner` | `investment_success_share` | `dating_app_origin` |
| 02 bec-executive-impersonation | `executive_impersonation` | `corporate_executive` | `urgent_payment_authorization` | (none -- internal email path) |
| 03 security-awareness-training | (n/a -- benign / security_education) | (n/a) | (n/a) | (n/a) |
| 04 synthetic-reviews-financial | `marketplace_fraud` or `platform_abuse` | (n/a -- no persona claimed) | (n/a -- no pretext, generation request) | (n/a) |
| 05 fraud-infrastructure | `other_or_unclear` (mule recruitment fits closest under `executive_impersonation` if framed as HR, but the fixture is content-generation about mule operations rather than impersonation per se) | (n/a if generation request) or `coworker_peer` (if framed as HR) | `mule_recruitment_offer` | (n/a -- generation request, no channel claim) |
| 06 fraud-research-legitimate | (n/a -- security_education) | (n/a) | (n/a) | (n/a) |
| 07 dual-use-security-research | (n/a -- ambiguous_dual_use) | (n/a) | (n/a) | (n/a) |
| 08 ambiguous-impersonation | (n/a -- benign per Stage 1 short-circuit, see Wave 3 0008 adjudication) | (n/a) | (n/a) | (n/a) |
| 09 recovery-fraud-adjacent | (n/a -- benign victim-support per Decision 8; L2 `victim_support`) | (n/a) | (n/a) | (n/a) |
| 10 case07-defender-framed-injection-positive | `model_attack` | (n/a -- defender framing) | (n/a) | (n/a) |
| 11 case07-injection-with-victim-targeted-negative | `model_attack` | (n/a) | (n/a) | (n/a) |
| 12 case07-injection-plus-bec-bright-line-negative | `executive_impersonation` + `model_attack` (cross-typology) | `corporate_executive` | `urgent_payment_authorization` | (n/a) |

**Tier-1 case-study (01-19).** Mapping summary -- abbreviated for fixtures whose dimensions are obvious from the slug.

| Fixture | `typology:` | `persona:` | reshaped `pretext:` | `context_marker:` (channel) |
|---|---|---|---|---|
| 01 realtime-synthetic-media-executive | `executive_impersonation` | `corporate_executive` | `urgent_payment_authorization` | (deepfake-call; consider `cold_call_origin` if external) |
| 02-05 advance-fee-{inheritance,lottery,customs,business-partnership} | `advance_fee_fraud` | `lawyer_or_legal_agent` (02), `unknown_or_other` (03), `government_official` (04 if customs framed), `investment_advisor` (05) | `inheritance_release`, `lottery_prize_release`, `customs_clearance_fee`, `partnership_opportunity` respectively | `unsolicited_email_origin` for all |
| 06 method-advance-fee-lawyer-fee | `advance_fee_fraud` | `lawyer_or_legal_agent` | `legal_settlement_release` (or `inheritance_release` -- see discriminator §3.1 of ontology) | `unsolicited_email_origin` |
| 07 method-realtime-synthetic-media | `executive_impersonation` (senior-client framing is exec-adjacent) | `corporate_executive` | `urgent_payment_authorization` | (live call; `cold_call_origin`) |
| 08 target-affinity-community | `investment_fraud` | `community_member` | `partnership_opportunity` or `investment_success_share` | `community_or_affinity_origin` |
| 09 context-marker-victim-list-purchased | `recovery_fraud` | `recovery_investigator` | `recovery_service_offer` | (channel typically `unsolicited_email_origin` or `cold_call_origin`) |
| 10 context-marker-ai-pretext-claimed | `investment_fraud` | `investment_advisor` | `investment_success_share` | (marketing channel; `social_media_dm_origin` likely) |
| 11 overlap-secondary-victimization | `recovery_fraud` (sextortion follow-up: `other_or_unclear` -- sextortion has no clean v1 typology home; see §10.3 below) | `unknown_or_other` (extortionist) | `other_or_unclear` (extortion pretext not in v1) | (none specified) |
| 12 variant-bright-line-realtime-subtle | `executive_impersonation` | `corporate_executive` | `urgent_payment_authorization` | (live call) |
| 13 variant-bright-line-realtime-multiparticipant | `executive_impersonation` | `corporate_executive` | `urgent_payment_authorization` | (multi-party live meeting) |
| 14 variant-realtime-synthetic-media-celebrity | `other_or_unclear` (celebrity-target deepfake; see brief 0036) | `unknown_or_other` (no v1 persona value covers "celebrity impersonator") | `other_or_unclear` | (live call) |
| 15 variant-ai-pretext-marketing | `investment_fraud` | `investment_advisor` | `investment_success_share` | (marketing) |
| 16 variant-victim-list-ftc | `recovery_fraud` | `recovery_investigator` | `recovery_service_offer` | (`unsolicited_email_origin`) |
| 17 variant-secondary-victimization-romance-recovery | `recovery_fraud` | `recovery_investigator` | `recovery_service_offer` | (channel n/a) |
| 18 variant-ai-pretext-trading-bot | `investment_fraud` | `investment_advisor` | `investment_success_share` | (`social_media_dm_origin`) |
| 19 variant-victim-list-named-scam | `recovery_fraud` | `recovery_investigator` | `recovery_service_offer` | (`unsolicited_email_origin`) |

### 10.2 Conversation fixtures (25 in `tests/golden-conversations/`)

Conversation fixtures add the time-ordered turn surface but the four-dimension mapping is unchanged -- the typology / persona / pretext / context dimensions describe the *attack shape* not the *artifact shape*.

| Fixture | `typology:` | `persona:` | reshaped `pretext:` | `context_marker:` (channel) |
|---|---|---|---|---|
| 01 pig-butchering-classic-imessage | `pig_butchering` | `romantic_partner` | `investment_success_share` | `dating_app_origin` -> `in_app_chat_origin` (Tinder -> WhatsApp; both fire) |
| 02 bec-cfo-impersonation-text | `executive_impersonation` | `corporate_executive` | `urgent_payment_authorization` | (`unsolicited_sms_origin`) |
| 03 romance-ramp-then-money-ask | `romance_fraud` or `pig_butchering` (the money-ask is medical, not crypto -- `romance_fraud` cleaner here) | `romantic_partner` | `family_emergency_money` (sick mother) | `dating_app_origin` |
| 04 sextortion-escalation | `other_or_unclear` (sextortion has no v1 typology home) | `unknown_or_other` | `other_or_unclear` (extortion pretext not in v1) | (`social_media_dm_origin`) |
| 05 security-training-legit | (n/a -- security_education) | (n/a) | (n/a) | (n/a) |
| 06 advisor-isolation-classic | `pig_butchering` | `romantic_partner` or `investment_advisor` | `investment_success_share` | (`social_media_dm_origin` or `in_app_chat_origin`) |
| 07 contact-channel-jump-whatsapp | (depends on fixture body; typically `pig_butchering` or `executive_impersonation`) | (varies) | (varies) | (multiple channel markers fire -- this fixture is the canonical channel-jump case) |
| 08 role-stability-breach-tech-support | `tech_support_scam` | `tech_support_external` | `tech_support_remediation` | (`cold_call_origin`) |
| 09 money-ask-pivot-pure | `pig_butchering` (or `romance_fraud` if no investment endpoint) | `romantic_partner` | `investment_success_share` | (channel varies) |
| 10 always-available-cadence | `pig_butchering` or `romance_fraud` | `romantic_partner` | `investment_success_share` | (channel varies) |
| 11 trust-ramp-pure-no-money | (n/a -- no extraction; benign-leaning per fixture intent) | `romantic_partner` (claim only; no pretext fires) | (n/a -- no ask yet) | `dating_app_origin` |
| 12 benign-product-research | (n/a -- benign) | (n/a) | (n/a) | (n/a) |
| 13 bec-vendor-banking-change | `executive_impersonation` or `vendor_or_supplier` (canonical BEC vendor-change pattern) | `vendor_or_supplier` | `vendor_invoice_change` | (`unsolicited_email_origin`) |
| 14 grandchild-impersonation | `family_emergency` | `family_member` | `family_emergency_money` | (`cold_call_origin`) |
| 15 fraud-research-academic | (n/a -- security_education) | (n/a) | (n/a) | (n/a) |
| 16 recovery-fraud-second-bite | `recovery_fraud` | `recovery_investigator` | `recovery_service_offer` | (channel typically `cold_call_origin` or `unsolicited_email_origin`) |
| 17 mule-recruitment | `other_or_unclear` (mule recruitment fits closest under `marketplace_fraud` if framed as job offer; v1 has no clean fraud-infrastructure typology value -- see §10.3) | `coworker_peer` (HR Brandon claim) | `mule_recruitment_offer` | (`professional_network_origin` -- Indeed referenced) |
| 18 job-offer-prompt-injection-attempt | `model_attack` | `coworker_peer` | (n/a -- injection payload, not extraction pretext) | (`professional_network_origin`) |
| 19 two-turn-minimum-edge | (varies by fixture body) | (varies) | (varies) | (varies) |
| 20 benign-customer-support | (n/a -- benign) | (n/a) | (n/a) | (n/a) |
| 21-25 image-* | (depends on image content; typically `pig_butchering`, `executive_impersonation`, sextortion variant, etc.) | (varies) | (varies) | (varies; image fixtures often carry the channel claim as part of the image) |

### 10.3 Survey verdict and coverage gaps

**Quantitative landings.** Of 50 fraud-shaped fixtures (excluding the 8 benign / security_education / ambiguous_dual_use cases where the four-dimension reshape does not apply):

| Category | `other_or_unclear` landings | % | Pass acceptance bar (<10%)? |
|---|---|---|---|
| `typology:` | 4 (single-prompt 05 mule + Tier-1 14 celebrity + conversation 04 sextortion + conversation 17 mule) | 8% | YES (just barely) |
| `persona:` | 3 (Tier-1 14 celebrity + conversation 04 sextortion + Tier-1 03 lottery if persona unclear) | 6% | YES |
| reshaped `pretext:` | 3 (conversation 04 sextortion + Tier-1 11 sextortion-follow-up + Tier-1 14 celebrity) | 6% | YES |
| `context_marker:` (channel) | 0 explicit (channel-not-claimed fixtures are coded as "n/a" not `other`; channel multi-value semantics make `other` a poor fit) | 0% | YES |

**Coverage gaps identified and recommendations:**

- **Gap 1: sextortion has no v1 typology home.** Fixtures `tests/golden-conversations/04-sextortion-escalation.json` and `tests/golden/case-study-tier-1/11-overlap-secondary-victimization.json` (sextortion follow-up) land on `typology:other_or_unclear`. Sextortion is an IC3-tracked typology in its own right (separate from romance / investment / advance-fee). *Recommendation:* phase 1b adds `typology:sextortion` as a 17th value; the sextortion-follow-up case 11 also exercises `overlap:secondary_victimization` so the cross-typology surface works. This is a one-value addition; lifts `typology:` `other_or_unclear` rate to 2/50 = 4%.
- **Gap 2: celebrity impersonation has no v1 persona home.** Fixture `tests/golden/case-study-tier-1/14-variant-realtime-synthetic-media-celebrity.json` -- a real-time voice clone of a celebrity scamming an elderly woman -- has no clean `persona:` value. The v1 set targets corporate / civic / family / professional personas; celebrity is none of those. *Recommendation:* phase 1b adds `persona:celebrity_or_public_figure` as a 16th value. This is also the persona-side discriminator that brief 0036's bright-line precondition tightening would lean on -- the bright-line `realtime_synthetic_media_executive_impersonation` should *not* fire when `persona:celebrity_or_public_figure` is the persona claim (the bright-line precondition requires `persona:corporate_executive`). Lifts `persona:` `other_or_unclear` rate to 1/50 = 2%.
- **Gap 3: money-mule recruitment has no clean typology home.** Fixtures 05 (single-prompt) and 17 (conversation) frame mule recruitment as a job offer. v5 L2 has `fraud_infrastructure` covering this; the closest v1 `typology:` mapping is `marketplace_fraud` (job-offer-as-fraud) which is a poor fit because the operational mechanic is mule-network supply-side. *Recommendation:* phase 1b adds `typology:fraud_infrastructure` as an 18th value, mirroring the L2 value name. Lifts `typology:` `other_or_unclear` rate to 0/50 = 0%.
- **Gap 4: extortion pretext has no reshaped-`pretext:` home.** Sextortion and recovery-from-sextortion (case 11) ask for money under "I will release photos / share threats with my partner who will release them" -- a coercive extortion pretext, distinct from the rationale-based pretexts in the v1 set. *Recommendation:* phase 1b adds `pretext:coercion_threat_release` as a 17th value. Lifts reshaped `pretext:` `other_or_unclear` rate to 1/50 = 2%.

**Survey-driven vocabulary amendments (folded into the §11 vocab lockstep plan).** The four gaps above expand the v1 cuts by four values total (one in each affected category, except `context_marker:` which has no gap):

- `typology:`: 16 -> 18 values (add `sextortion`, `fraud_infrastructure`)
- `persona:`: 15 -> 16 values (add `celebrity_or_public_figure`)
- reshaped `pretext:`: 16 -> 17 values (add `coercion_threat_release`)
- `context_marker:` (channel additions): 10 values unchanged

Post-amendment `other_or_unclear` rates: `typology:` 0%, `persona:` 2%, `pretext:` 2%, `context_marker:` 0%. All four well below the 10% acceptance bar.

**Coverage caveat (re-stated from §6.1).** The eval set is small (50 fraud-shaped fixtures) and curated to exercise specific FAF patterns rather than to mirror an empirical IC3-distribution sample. The survey verdict is "v1 vocabulary covers the curated set"; production-traffic representativeness is unverified until post-credits live-engine integration. A follow-up brief should re-sample once SafeEval has any production traffic to learn from.

---

## 11. Lockstep extension plan

The lockstep validator at `scripts/check-lockstep.js` currently verifies (a) the seven prompt-summary closed sets (TEMPLATE_LABELS, DELIVERY_LABELS, CONTROL_LABELS, TOPIC_LABELS, TARGET_LABELS, OBJECTIVE_LABELS, PRETEXT_LABELS) from the 2026-05-26 memo, (b) the eight L3 closed-set categories, (c) the bright-line feature set, and (d) the disposition verb set -- in each case matching the engine constant in `src/lib/safeeval-v5.js` against the documented vocabulary in `docs/08-v5-ontology.md`. The phase-3 vscode work would extend the validator as follows.

### 11.1 New engine constants required

Phase 3 adds the following constants to `src/lib/safeeval-v5.js` (matching the vocabularies in this memo as amended by §10.3):

- `TYPOLOGY_LABELS` -- 18 values (16 from §3.1 + `sextortion` + `fraud_infrastructure`)
- `PERSONA_LABELS` -- 16 values (15 from §3.2 + `celebrity_or_public_figure`)
- `PRETEXT_LABELS_V53` -- 17 values (16 from §3.3 + `coercion_threat_release`). The constant name `PRETEXT_LABELS` is in active use for the pre-reshape vocabulary; phase 3 names the new constant `PRETEXT_LABELS_V53` during dual-emit. Once dual-emit closes, rename `PRETEXT_LABELS_V53` -> `PRETEXT_LABELS` and drop the legacy.
- `CONTEXT_MARKER_CHANNEL_VALUES` -- 10 values (the channel-origin additions). These join the existing 11 framing-claim values; the unified `CONTEXT_MARKER_VALUES` set goes from 11 -> 21.

These constants flow into `L3_VALUES_BY_CATEGORY` (the engine's authoritative L3 vocabulary index) as new category entries (`typology`, `persona`) and an extended category entry (`context_marker`). The phase-3 dispatch also touches `TARGET_VOCABULARY_PROMPT_SUMMARY` aliasing if the prompt-summary surface retains `target_attributes` semantics; the §3.5-deprecate-PERSONA-prose decision means the prompt-summary surface gets *new* alias fields (`typology_label`, `persona_label`) and the existing `pretext_label` value-set transitions to the reshaped vocabulary.

### 11.2 New lockstep checks

The validator gains four new check functions, each following the pattern of existing `checkV52CaseStudyLockstep()`:

- `checkV53TypologyLockstep()` -- validates `TYPOLOGY_LABELS` (engine) equals `docs/08-v5-ontology.md` §3.8 vocabulary equals `docs/policy-spec-v5.0.md` (no §-specific spec text required since Decision 18 in §9 is the binding policy-side anchor).
- `checkV53PersonaLockstep()` -- same shape, for `PERSONA_LABELS` against §3.9.
- `checkV53ContextMarkerExtensionLockstep()` -- validates the extended `CONTEXT_MARKER_VALUES` (existing 11 + new 10) against §3.4. This check replaces the current `context_marker:` check in `checkV52CaseStudyLockstep()` rather than adding a parallel check.
- `checkV53PretextReshapeLockstep()` -- validates `PRETEXT_LABELS_V53` against §3-prompt-summary-pretext-reshape (the new pretext-only vocabulary that replaces the existing PRETEXT_LABELS). During dual-emit, this check runs in parallel with the existing `checkV51PretextLockstep()` (or its equivalent); after dual-emit closes, the old check is removed.

Additionally:

- `checkV53OntologyVersionLockstep()` -- validates the engine's `ontology_version` constant equals `5.3` (current `5.2`) once phase 3 lands the bump.

### 11.3 Dual-emit handling

The lockstep validator must tolerate the dual-emit window. The implementation:

- For a 90-day window (or until v6.0, whichever is longer): both the legacy PRETEXT_LABELS and the new PRETEXT_LABELS_V53 are valid value sets for `prompt_summary.pretext_label`. Lockstep accepts a `pretext_label` value that appears in *either* set; a value that appears in *neither* is a lockstep failure.
- Envelopes emitted under `ontology_version=5.2` (pre-bump) use the legacy vocabulary; envelopes under `5.3` use the new vocabulary; lockstep reads `ontology_version` from the envelope and applies the appropriate check.
- The fixture migration step (phase 3) updates fixture `expected_v5` blocks to the new vocabulary; pre-migration fixtures that still carry legacy `pretext_label` values stay valid until they are migrated.

### 11.4 Test fixture additions

Phase 3 adds new dedicated fixtures under `tests/golden/four-dimension/` (parallel to `tests/golden/case-study-tier-1/`) to exercise the new vocabulary:

- Per-value typology fixtures: minimum one fixture per `typology:` value where the value is not already covered by an existing fixture. Estimated 12-15 new fixtures.
- Per-value persona fixtures: same. Estimated 10-12 new fixtures.
- Channel-marker fixtures: at least one fixture per new `context_marker:` channel value. Estimated 10 new fixtures.
- Boundary fixtures: typology / persona discriminator cases (e.g., `pig_butchering` vs `romance_fraud` vs `investment_fraud`; `corporate_executive` vs `coworker_peer` for BEC-vs-payroll-fraud).

Phase 3 dispatch authors these; phase 1b does not.

### 11.5 JSON Schema validator

`tests/schema/v5-envelope.schema.json` mirrors the engine's closed enums. Phase 3 extends the schema with:

- `typology` and `persona` categories under L3 `value` enum constraints (added as new conditional branches keyed on `category`).
- `pretext_label` enum widened to include both legacy and v53 values during dual-emit, then narrowed post-dual-emit.
- `ontology_version` const constraint updated to `5.3`.

### 11.6 ASCII-safety check

All new constants and lockstep check function names use ASCII-only strings (per CLAUDE.md `.js` ASCII-safety constraint). The vocabulary values themselves are lowercase underscore strings, ASCII-clean by construction. The discriminator clarifications in §3.1 / §3.2 / §3.3 / §3.4 prose-to-label tables stay UTF-8 in markdown but ASCII when mirrored into Stage 2 system-prompt strings (where the engine reads them).

### 11.7 Phase 3 acceptance gates (forward reference)

For phase 3's dispatch brief to write against this lockstep plan, the acceptance gates are:

1. Engine constants added (§11.1) and committed.
2. Five lockstep checks added (§11.2) and PASS.
3. Dual-emit window opened (§11.3); `pretext_label` accepts both legacy and v53 vocabularies.
4. Schema validator updated (§11.5); JSON Schema validation PASS for both legacy and v53 envelopes.
5. ASCII clean (§11.6).
6. Live API smoke against `safeeval.vercel.app/api/evaluate?v5=1` for at least one fixture exercising each new typology / persona / pretext / channel value, returning HTTP 200 + envelope with the new fields populated.
7. 12/12 baseline single-prompt goldens PASS unchanged (no regression on legacy vocabulary during dual-emit).
8. Lockstep PASS; build PASS; ASCII clean; unit tests PASS.

Phase 3 also queues the dual-emit close at a date 90 days post-ship (or aligned with v6.0 if that lands first).

---

*This memo is the policy commitment for phases 1 and 1b of plan `ontology-4-dimension-separation`. Phase 1 (this memo) commits the four-dimension architectural decision. Phase 1b (§§3 vocabulary tables + §10 fixture survey + §11 lockstep extension plan) is the closed-set vocabulary draft Steven delegated to the policy track on 2026-05-27 (see §8.1 Adjudication). Phase 2 (result-card design extension) and phase 3 (schema / engine / fixture / lockstep validator / render implementation) follow this memo's resolution. The decisions-log entry as Decision 18 in section 9 lands in `docs/policy-spec-v5.0.md` section 9 in this dispatch.*
