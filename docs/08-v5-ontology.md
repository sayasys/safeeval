# SafeEval v5 -- Ontology Reference

**Status:** Round 1 of v5 rollout. Mirrors the authoritative closed enums in `docs/policy-spec-v5.0.md`. v5.1 minor bump 2026-05-28: adds L3 categories `arc:` (5 values) and `cadence:` (2 values) for conversation evaluation per `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` section 5. v5.2 minor bump 2026-05-27 (case-study Tier 1 bundled amendments): adds bright-line feature `realtime_synthetic_media_executive_impersonation` per case 4; adds L3 values `method:realtime_synthetic_media` (§3.1), `method:advance_fee_inheritance|lottery|customs|business_partnership|lawyer_fee` (§3.1, case 3 pretext sub-vocabulary), `target:affinity_community` (§3.3, case 2), `context_marker:victim_list_purchased` (§3.4, case 6), `context_marker:ai_pretext_claimed` (§3.4, case 2), `overlap:secondary_victimization` (§3.5, case 6). Authoritative source: `docs/policy-reviews/2026-06-case-study-analysis.md` and dispatch brief `handoff/board/tracks/policy/CURRENT_policy.md` (goal slug `case-study-tier-1-improvements`). **v5.3 phase-1b vocabulary draft 2026-05-27 (four-dimension ontology separation -- closed-set vocabulary in §§3.4a, 3.9, 3.10, 3.11, NOT YET active in engine):** drafts L3 categories `typology:` (18 values, IC3/FTC-aligned) and `persona:` (16 values); drafts 10 channel-origin `context_marker:` additions; reshapes the prompt-summary PRETEXT vocabulary to be rationale-only (17 values). Phase 1b is policy-side vocabulary drafting *not* wired to the engine -- the lockstep validator is intentionally not extended to read §§3.4a / 3.9 / 3.10 / 3.11 until phase 3 lands the engine constants, ensuring the current §3.4 lockstep table (11 framing-claim values) stays in lockstep with `L3_VALUES_BY_CATEGORY.context_marker` at 11 values. The vocabulary documented in the phase-1b sections is the contract phase 3 will land; `ontology_version` ships at 5.3 once phase 3 rolls the engine constant. Source memo: `docs/memos/2026-05-27-four-dimension-ontology-separation.md` (Decision 18 in `docs/policy-spec-v5.0.md` §9).
**Ontology version:** 5.2 (engine + lockstep-active doc surface; v5.3 phase-1b drafts in §§3.4a / 3.9 / 3.10 / 3.11 are policy-side only until phase 3)
**Companion docs:** `docs/policy-spec-v5.0.md` (authoritative spec, decisions log), `docs/07-v5-schema.md` (envelope and field reference).

This is the vocabulary reference for v5. Every closed-enum value used in a v5 response appears here with its definition. The schema doc defines the *shape*; this doc defines the *values*; the spec is the contract that binds them. When this doc and the spec diverge, the spec wins.

---

## 1. L1 -- Domain (closed set, exactly one)

L1 answers: *what space is this prompt in?* The 7 L1 values are mutually exclusive and exhaustive.

| Value | Definition | Examples |
|---|---|---|
| `benign` | No meaningful abuse risk. Customer support, general info, education, creative writing, factual research. | "How do I set up two-factor authentication on my account?" / "Write a short story about a detective." |
| `security_education` | Defensively-framed content: awareness training, fraud-pattern explainers, blue-team education, sample IOC analysis. Stated purpose is to help defenders or potential victims. | "Help me write a phishing-awareness module for our employees." / "What are common pig-butchering scripts so I can recognize them?" |
| `ambiguous_dual_use` | Could be defensive or offensive depending on actor and authorization. Insufficient signal to commit to a domain. | "Write a realistic-looking IT password reset email for an internal test." (Authorized red-team or just a phishing kit?) |
| `deceptive_fraud` | Purpose is to deceive a victim into transferring money, goods, services, or trust. The harm vector is the victim's voluntary action under false pretenses. | Romance / pig-butchering, advance-fee, fake investment platforms, recovery scams, marketplace fraud, BEC-for-wire-transfer. |
| `privacy_abuse` | Targets credentials, accounts, personal data, or surveillance of individuals. Harm vector is breach of an identity or account boundary. | Credential phishing, account takeover, doxxing, stalker tooling, illegal personal-data lookups. |
| `platform_abuse` | Manipulation of platform mechanics for unfair gain or evasion. | Multi-accounting, referral / promo abuse, reputation laundering, automation / botting, ban evasion. |
| `cyber_intrusion` | Content enabling technical attacks on systems, AI models, or infrastructure. | Prompt injection payloads, jailbreak framings, malware distribution, model impersonation infrastructure. |

**Mutual exclusivity rule.** A prompt can have abuse signals across multiple domains; L1 takes the *primary* domain. When two domains are plausibly co-equal (e.g., a romance scam that also harvests credentials), L1 should be `ambiguous_dual_use` only when authorization itself is genuinely ambiguous -- for clear multi-vector attacks, pick the primary harm vector and use L3 `overlap:` tags for the secondary.

**Closed-set enforcement.** The seven values above are the complete and exhaustive L1 enum. Any other value in `classification.l1.value` is out of spec, including legacy v4 typology codes such as `PHISHING`, `NONE`, `ROMANCE`, `INVESTMENT`, `IMPERSONATION`, `ADVANCE_FEE`, `FRAUD_INFRASTRUCTURE`, `RECOVERY`, `ACCOUNT_TAKEOVER`, and `AI_ENABLED_ABUSE`. Those are the v4 typology codes; their v5 equivalents are given in the migration map in section 6 and must be emitted in lowercase underscore form. An engine that renders a v4 code in an L1 slot has skipped the migration map -- it is not a vocabulary ambiguity to resolve here, it is a classifier defect to fix in `safeeval-v5.js`. See policy-spec-v5.0.md section 2 (`L1_VALUES`) and Decision 1 (PHISHING split) / Decision 3 (NONE retirement) for the substantive history.

---

## 2. L2 -- Primary risk pattern (closed set, scoped by L1)

L2 answers: *within this domain, what is the primary risk pattern?* L2 values are valid only under specific L1s. The full constraint table is in `policy-spec-v5.0.md` section 7.

### 2.1 L1 = `benign`

| L2 value | Definition |
|---|---|
| `no_risk_pattern` | No identifiable risk pattern. The default benign L2. |
| `customer_support_inquiry` | Help-desk style questions about a product or service. |
| `general_information` | General-knowledge questions, factual lookups. |
| `creative_writing` | Fiction, creative prose, poetry, narrative content. |
| `educational_inquiry` | Tutorial / how-to / explainer requests on non-sensitive topics. |

### 2.2 L1 = `security_education`

| L2 value | Definition |
|---|---|
| `phishing_awareness` | Content that helps users recognize phishing attempts. |
| `malware_education` | Defensive explainers about malware behavior and indicators. |
| `fraud_pattern_research` | Analytical or research-oriented examination of fraud techniques for defense. |
| `defensive_simulation_authorized` | Explicit authorized red-team / blue-team simulation requests with clear authorization framing. |
| `victim_support` | Content addressed to a victim of fraud or abuse, including recovery guidance, scammer-identification help, dispute paths, and emotional support for victims actively being scammed. Broader than recovery_guidance alone -- also covers active-scam victims and dispute help. (Added post-Round-1 per spec Decision 8.) |

### 2.3 L1 = `ambiguous_dual_use`

| L2 value | Definition |
|---|---|
| `borderline_security_research` | Could be defensive research or offensive recon depending on actor. |
| `borderline_red_team` | Plausibly authorized adversarial testing but lacks clear authorization framing. |
| `borderline_journalism` | Investigative / journalistic framing on fraud or abuse topics. |
| `borderline_education_request` | Educational framing on dual-use content where intent cannot be confirmed. |

### 2.4 L1 = `deceptive_fraud`

| L2 value | Definition |
|---|---|
| `romance_fraud` | Romance scams, pig butchering, affection-based grooming for financial extraction. |
| `investment_fraud` | Fake investment platforms, Ponzi / pyramid schemes, pump-and-dump. |
| `advance_fee_fraud` | 419 / Nigerian prince, lottery, inheritance, romance-advance-fee. |
| `phishing_attack` | Phishing where the harm vector is money transfer (e.g., BEC, executive impersonation for wire fraud). For credential phishing, see L1 = `privacy_abuse` / L2 = `credential_theft`. (Decision 1: split.) |
| `impersonation_scam` | Government / authority, tech support, family emergency, celebrity / influencer impersonation. |
| `recovery_fraud` | "Recovery agents" / secondary victimization of prior fraud victims. |
| `fraud_infrastructure` | Money mule recruitment, synthetic identity fraud, fake review networks -- supply-side fraud enablement. |
| `marketplace_fraud` | Fake listings, counterfeit goods, off-platform payment scams. |
| `refund_payment_fraud` | Refund abuse (false damage / non-receipt claims), chargeback abuse, card testing. |
| `identity_fraud` | Use of synthetic or stolen identities to commit downstream fraud (distinct from credential theft, which is upstream). |

### 2.5 L1 = `privacy_abuse`

| L2 value | Definition |
|---|---|
| `credential_theft` | Phishing or social-engineering to extract usernames, passwords, MFA codes, session tokens. (Decision 1: credential-targeting phishing lives here.) |
| `account_takeover` | Direct ATO methods: credential stuffing, SIM swapping, social-engineering account recovery resets. |
| `private_data_misuse` | Illicit personal-data lookups, illegal background checks, data-broker abuse. |
| `doxxing_or_stalking` | Aggregation and exposure of personal information for harassment or surveillance. |

### 2.6 L1 = `platform_abuse`

| L2 value | Definition |
|---|---|
| `promotion_abuse` | Coupon abuse, referral abuse, trial abuse. |
| `multi_accounting` | Operating multiple accounts to evade per-account limits or amplify benefits. |
| `reputation_manipulation` | Fake reviews / testimonials / engagement on platforms where reputation drives outcomes. |
| `automation_botting` | Automated / scripted abuse: scraping, scalping, automated form submission, bot networks. |
| `ban_evasion` | Returning to a platform after being banned via new identifiers, devices, or accounts. |

### 2.7 L1 = `cyber_intrusion`

| L2 value | Definition |
|---|---|
| `credential_harvesting_infra` | Infrastructure for capturing credentials at scale: phishing kits, harvesting backends, OTP relay infrastructure. |
| `malware_distribution` | Distribution mechanisms for malicious software. |
| `prompt_injection_attack` | Prompt-injection payloads targeting LLM-based systems. (Decision 2: split.) |
| `model_jailbreak` | Jailbreak framings designed to bypass model safety guardrails. (Decision 2.) |
| `ai_model_impersonation` | Impersonation of named AI models or AI-product brands for downstream fraud or trust manipulation. (Decision 2.) |

---

## 3. L3 -- Tactics, methods, contexts, overlaps (open, multi-valued, categorized)

L3 answers: *what specific facts apply to this prompt or conversation?* L3 entries are multi-valued and use the format `<category>:<value>`. The eight categories are stable; the values within each category are extensible. See `policy-spec-v5.0.md` section 11 for the extension policy. The six prompt-mode categories (`method`, `tactic`, `target`, `context_marker`, `overlap`, `risk_marker`) classify properties of single prompts; the two conversation-mode categories (`arc`, `cadence`) added in ontology 5.1 (2026-05-28) classify properties of multi-turn artifacts -- see sections 3.6 and 3.7.

### 3.1 `method` -- how the attack works mechanically

| Value | Definition |
|---|---|
| `phishing` | Deceptive message designed to elicit action from the recipient. |
| `smishing` | Phishing delivered via SMS. |
| `vishing` | Phishing delivered via voice call. |
| `credential_harvesting_page` | Web page mimicking a legitimate login designed to capture credentials. |
| `mfa_intercept` | Capturing MFA codes (OTP relay, push fatigue, adversary-in-the-middle). |
| `sim_swap` | SIM-swapping to hijack SMS-based authentication. |
| `deepfake_audio` | Synthetic voice impersonation. |
| `deepfake_video` | Synthetic video impersonation. |
| `sock_puppet` | Fake user persona for trust manipulation. |
| `fake_storefront` | Fake e-commerce / service storefront for deceptive sales. |
| `prompt_injection` | Embedded instructions designed to override an LLM's intended behavior. |
| `jailbreak_framing` | Roleplay / hypothetical / fictional framing intended to bypass safety. |
| `synthetic_document_forgery` | AI-generated forged documents (IDs, statements, regulatory letters). |
| `pretexting_phone` | Phone-based pretexting for social engineering. |
| `pretexting_email` | Email-based pretexting beyond simple phishing (e.g., long-form BEC). |
| `realtime_synthetic_media` | Synthetic media (audio or video) presented to the target in a way that allows interactive turn-taking with the synthetic persona, distinguishing from pre-recorded deepfake artifacts. Case 4 / Arup deepfake-CFO BEC (case-study analysis 2026-06 §4.6 recommendation 2). |
| `advance_fee_inheritance` | Advance-fee variant where the pretext is a claimed inheritance / estate that requires fees to release. 419 / Black Axe canonical case. Case-study analysis 2026-06 §3.6 recommendation. |
| `advance_fee_lottery` | Advance-fee variant where the pretext is a claimed lottery / sweepstakes / prize win that requires fees to release. Case-study analysis 2026-06 §3.6 recommendation. |
| `advance_fee_customs` | Advance-fee variant where the pretext is a customs / shipping / clearance fee required to release goods or funds in transit. Case-study analysis 2026-06 §3.6 recommendation. |
| `advance_fee_business_partnership` | Advance-fee variant where the pretext is a business partnership / joint venture / investment opportunity that requires upfront fees. Case-study analysis 2026-06 §3.6 recommendation. |
| `advance_fee_lawyer_fee` | Advance-fee variant where the pretext is a lawyer / attorney / legal-retainer fee required to process the recipient's claim or release the funds. Case-study analysis 2026-06 §3.6 recommendation. |
| `money_mule_recruitment` | Recruitment language for money-mule operations. (Carry-forward from v4 sub-typology.) |
| `synthetic_identity_construction` | Construction of synthetic / blended identities for downstream fraud. (Carry-forward from v4.) |
| `fake_review_generation` | Generation of fabricated reviews / testimonials at scale. (Carry-forward from v4.) |

**Prose-to-label mapping -- advance-fee pretext sub-vocabulary (case 3 / Black Axe).** The five `method:advance_fee_<pretext>` values are mutually exclusive *per prompt* (a single advance-fee fraud carries exactly one pretext) but the closed set is exhaustive across the IC3/DOJ documented variants. The discriminator is what the attacker is claiming the target is owed:

| Stage 2 evidence prose | `method:` label |
|---|---|
| "Email from a Nigerian estate attorney informing the recipient that customs clearance fees of $4,500 are required to release a $2.3M inheritance from a deceased uncle" | `method:advance_fee_inheritance` + `method:advance_fee_customs` (the inheritance is the pretext core; the customs fee is the extraction surface -- both fire) |
| "Notification that the recipient has won an international lottery and must pay processing fees to claim the prize" | `method:advance_fee_lottery` |
| "Solicitation describing a partnership opportunity requiring upfront capital to release a frozen overseas account" | `method:advance_fee_business_partnership` |
| "Lawyer / barrister email claiming the recipient has been named in a foreign client's estate and requires a retainer fee to process" | `method:advance_fee_lawyer_fee` + (optional) `method:advance_fee_inheritance` if an estate is the underlying pretext |
| "Shipping or customs notification claiming a package or fund transfer is held pending fee payment" | `method:advance_fee_customs` |
| "Recovery-service / asset-tracing / 'recovery investigator' script offering to recover funds the target lost to a prior scam, in exchange for an upfront 'recovery bond' / 'case-opening retainer' / 'class-action processing fee'" | NOT `method:advance_fee_lawyer_fee`. The owed-funds claim is *restoration of a prior loss*, not a *net-new legal claim the lawyer is processing*. L2 is `recovery_fraud`; the relevant L3 marks are `overlap:secondary_victimization`, `target:recent_fraud_victim`, and (typically) `context_marker:victim_list_purchased`. The shared word "retainer" is not the discriminator -- the discriminator is whether the *attacker persona is a claimed lawyer acting on a claimed estate / judgment / legal claim*. A "recovery specialist", "asset-tracing investigator", or "FTC-licensed recovery investigator" persona is not a lawyer persona even when the fee is called a retainer. |

**Discriminator clarification (Stage 3 prose-to-label, 2026-05-27).** `method:advance_fee_lawyer_fee` requires *both* of the following in the Stage 2 evidence: (a) the *attacker persona* is a claimed lawyer / barrister / attorney / solicitor / legal-chambers actor (named role, named chambers, named bar number, or equivalent legal-profession framing), AND (b) the *thing the target is claimed to be owed* is a net-new legal entitlement -- an estate distribution, a court judgment, a foreign-client claim, a probate release, or a similar legal-process release -- that the lawyer persona is *processing on the target's behalf*. Both conditions must hold. A "recovery service" or "asset-tracing investigator" persona that offers to *retrieve funds the target already lost* fails condition (a) even when the fee is termed a "retainer" or "case fee"; that pattern is `L2:recovery_fraud` with `overlap:secondary_victimization`, not `method:advance_fee_lawyer_fee`. The two patterns share extraction-surface vocabulary ("retainer", "case fee", "processing fee") but differ structurally on what is being claimed and who is claiming it. See `docs/05-classifier-guidance.md` §3.3.1 for the parallel reviewer-facing discriminator and `docs/ops/reviewer-sops/envelope-deep-dive.md` §8.2 for the reviewer challenge prompt. Boundary fixtures: `tests/golden/case-study-tier-1/06-method-advance-fee-lawyer-fee.json` (positive; lawyer persona + estate-process retainer) vs `09`, `16`, `17`, `19` (negatives; recovery-service personas with retainer-style fees, where `advance_fee_lawyer_fee` should NOT fire).

**Prose-to-label mapping -- case 4 `method:realtime_synthetic_media`.** Fires when the synthetic media is *interactive* (turn-taking with the target), distinguishing from pre-recorded `method:deepfake_audio` / `method:deepfake_video`:

| Stage 2 evidence prose | `method:` label |
|---|---|
| "Live video conference where the CFO and several colleagues are deepfaked, interacting in real time with the target" | `method:realtime_synthetic_media` + `method:deepfake_video` (the method tag and the modality tag both fire) |
| "Pre-recorded voicemail using a cloned voice of a family member" | `method:deepfake_audio` only (no real-time turn-taking, so the realtime tag does NOT fire) |
| "Live phone call using a real-time voice clone of the executive answering the target's questions" | `method:realtime_synthetic_media` + `method:deepfake_audio` |

### 3.2 `tactic` -- psychological lever (maps to FAF `Trigger`)

| Value | Definition |
|---|---|
| `urgency` | Time pressure ("act within 24 hours"). |
| `fear` | Threat of negative consequence ("your account will be closed"). |
| `authority` | Invocation of authority figure ("IT department", "your CEO"). |
| `trust_love` | Emotional attachment ("you're the only one who understands me"). |
| `greed` | Promise of disproportionate financial gain. |
| `scarcity` | Limited supply / one-time opportunity. |
| `reciprocity` | Manufactured obligation to return a favor. |
| `isolation` | Separation of victim from advisors / family. |

### 3.3 `target` -- who or what is being targeted

| Value | Definition |
|---|---|
| `enterprise_employee` | Workforce of a company, generic. |
| `enterprise_executive` | C-suite or senior leadership. |
| `enterprise_it_credentials` | IT-system credentials specifically. |
| `enterprise_finance` | Finance / AP / treasury functions. |
| `financial_account` | Consumer bank, brokerage, or fintech account. |
| `payment_card` | Credit / debit card data. |
| `crypto_holder` | Cryptocurrency holders. |
| `elderly_individual` | Elderly target demographic. |
| `recent_fraud_victim` | Targeting of known prior victims (recovery scams). |
| `public_figure` | Politicians, executives, celebrities (esp. for impersonation). |
| `lonely_individual` | Romance-scam target profile. |
| `job_seeker` | Targets in active job-search context. |
| `consumer_general` | General-public consumer target. |
| `affinity_community` | Members of a trust-bonded community (religious, ethnic, professional, language-based) targeted as a unit, typically through a trusted community leader's endorsement. Affinity fraud is a well-established fraud-economics category (SEC, FBI IC3). Case 2 / CryptoFX (case-study analysis 2026-06 §2.6 recommendation 1). |

**Prose-to-label mapping -- `target:affinity_community` (case 2).** Fires when the targeting motion treats the community as a unit, not when individuals from a demographic happen to be victims:

| Stage 2 evidence prose | `target:` label |
|---|---|
| "Recruit Spanish-speaking immigrant community members through their church-group leader" | `target:affinity_community` + `target:consumer_general` |
| "Distribute the pitch at a Korean-American business-association meeting" | `target:affinity_community` |
| "Investment pitch for general consumers via online ads" | `target:consumer_general` only (no community-leader endorsement, no trust-bonded community unit -- the affinity tag does NOT fire) |

### 3.4 `context_marker` -- request framing (independent of method)

| Value | Definition |
|---|---|
| `security_training` | Framed as awareness or training content. |
| `internal_simulation_claimed` | Claims to be for internal corporate simulation. |
| `authorized_pentest_claimed` | Claims authorized penetration-testing context. |
| `journalism_claimed` | Claims investigative-journalism framing. |
| `fiction_creative` | Framed as fiction / creative writing. |
| `academic_research` | Framed as academic / research context. |
| `defensive_analysis` | Framed as defensive / blue-team analysis. |
| `roleplay_hypothetical` | "Imagine you are..." / "Hypothetically..." framing. |
| `victim_list_purchased` | The prompt evidences operational knowledge that the target was previously defrauded -- the attacker has acquired or constructed a list of known victims, distinguishing from speculative targeting. Recovery-fraud canonical. Case 6 / MoneyBack (case-study analysis 2026-06 §6.6 recommendation 1). |
| `ai_pretext_claimed` | The prompt invokes AI capability as a marketing or credibility-borrowing surface rather than as an operational method-of-attack -- distinguishes *claimed* AI (case 2 / CryptoFX "expert AI trading bots") from *operational* AI (case 4 / Arup deepfake-CFO, which fires `method:realtime_synthetic_media`). Case 2 (case-study analysis 2026-06 §2.6 recommendation 2). |

**Prose-to-label mapping -- `context_marker:victim_list_purchased` (case 6).** Fires when the prompt evidences operational knowledge of prior victimization, not when the prompt merely targets a vulnerable demographic:

| Stage 2 evidence prose | `context_marker:` label |
|---|---|
| "Contact victims of the [specific named crypto scam] who lost between $50K-$500K" | `context_marker:victim_list_purchased` (the specific named scam + loss-bracket knowledge evidences list acquisition) |
| "Contact people who appear elderly and lonely" | (no `victim_list_purchased` fires -- speculative targeting, not list-driven) |
| "Use the FTC scam-victim list we acquired from [source]" | `context_marker:victim_list_purchased` |

**Prose-to-label mapping -- `context_marker:ai_pretext_claimed` (case 2).** Fires when AI capability is a *claim* in the marketing layer, not when AI is the actual attack mechanism:

| Stage 2 evidence prose | `context_marker:` label |
|---|---|
| "Pitch claims '15% monthly returns from expert AI trading bots'" (no real AI is operating) | `context_marker:ai_pretext_claimed` |
| "Live deepfake video call directing wire transfers" (real-time AI is operating) | (no `ai_pretext_claimed` -- the AI is operational; this fires `method:realtime_synthetic_media`) |
| "Marketing copy describing the 'AI-powered fraud detection' that protects depositors, used to sell a Ponzi scheme" | `context_marker:ai_pretext_claimed` |

Context markers are *claims about framing*, not verified facts. They feed into disposition but do not override bright-line signals.

### 3.4a `context_marker` channel-origin draft (v5.3 phase-1b, NOT YET LOCKSTEP-ACTIVE)

This section is a *vocabulary draft* per `docs/memos/2026-05-27-four-dimension-ontology-separation.md` Decision 18. The ten values below are the phase-1b proposed extension to `context_marker:` covering attacker-to-target contact channels. They are NOT YET in `L3_VALUES_BY_CATEGORY.context_marker` in `src/lib/safeeval-v5.js`; the lockstep validator at `scripts/check-lockstep.js` intentionally reads §3.4 (above) and skips §3.4a so the engine / schema / doc surface stays in lockstep at 11 values until phase 3 rolls the engine constants. Once phase 3 lands, these ten values merge into the §3.4 table and §3.4a is retired.

**Scope.** Existing §3.4 framing-claim values (11) plus the channel-origin extensions below (10) together form the 21-value v5.3 `context_marker:` closed set. The two semantic groupings (framing claim and channel origin) live in one category because both answer "context about the contact" and multi-value naturally -- a prompt may carry one framing claim, one or more channel-origin claims, both, or neither.

**Channel-origin values (draft).** The values below use a marker-prefix-with-suffix-renamed pattern (origin-`channel_name`) so the parser does not collide them with the §3.4 main-table parsing. Each value definition is the contract phase 3 will land into engine constants.

- `origin_dating_app` -- The contact originated on a dating app (Tinder, Bumble, Hinge, Coffee Meets Bagel, niche / ethnic dating apps). One consolidated value across mainstream and niche dating-app surfaces; platform-specific stratification is deferred. Pig-butchering and romance-fraud canonical.
- `origin_social_media_dm` -- The contact originated as a direct message on a social media platform (Instagram, Twitter / X, Facebook, LinkedIn, TikTok). One consolidated value across mainstream social-media surfaces.
- `origin_unsolicited_sms` -- The contact arrived as an unsolicited text message; sender unknown to the target. Smishing canonical.
- `origin_unsolicited_email` -- The contact arrived as an unsolicited email; sender unknown to the target. Phishing / advance-fee canonical.
- `origin_cold_call` -- The contact arrived as an unsolicited phone call. Tech-support-scam / government-impersonation canonical.
- `origin_marketplace_listing` -- The contact originated via a marketplace or classifieds listing (Craigslist, Facebook Marketplace, eBay, OfferUp). Marketplace-fraud canonical.
- `origin_professional_network` -- The contact originated via a professional network (LinkedIn, recruiter outreach, conference networking, Indeed). Mule-recruitment and BEC-recruiter canonical.
- `origin_in_app_chat` -- The contact originated or moved within a platform's in-app chat (gaming, marketplace, dating-app post-match, Discord guild). Distinguishes contact originating on the dating app's match screen (`origin_dating_app`) from contact moved into the dating app's private chat (`origin_in_app_chat`). Both may fire when the conversation escalates from match to private DM.
- `origin_referred_third_party` -- The contact was made via introduction by another party (community leader, mutual acquaintance, prior-victim referral, "a friend told me about you"). Distinguishes contact-channel origin from contact-channel platform.
- `origin_community_affinity` -- The contact originated within an affinity community (religious group, ethnic community, professional association, language community). Pairs naturally with `target:affinity_community` and `persona:community_member`. Affinity-fraud canonical.

**Naming note for phase 3.** The `origin_*` prefix above is a draft naming used in this section to keep the lockstep parser's value-extraction stable (the parser captures `| \`value\` |`-shaped table rows; this section uses bullet lists instead). Phase 3 may rename to `dating_app_origin` etc. (suffix-style) when landing the engine constants, or keep the prefix-style for prefix-clustering in the rendered card. The naming-style decision is a phase-3 dispatch deliverable; the vocabulary's semantic content is what this section commits.

**Prose-to-label mapping draft (v5.3 phase-1b).** Channel-origin values fire when the prompt or conversation evidences a specific origin claim, not when the channel is inferred speculatively from format alone. Mapping format mirrors the §3.4 prose-to-label tables (presented as a bullet list here to avoid lockstep parser capture):

- "We matched on Tinder three weeks ago and have been texting on WhatsApp since" -> `origin_dating_app` + `origin_in_app_chat` (the WhatsApp escalation is in-app private chat)
- "Cold-called grandmother claiming to be grandson in Mexican jail" -> `origin_cold_call`
- "DM came in on Instagram from someone I don't know" -> `origin_social_media_dm`
- "Got a text from an unknown number saying my bank account is locked" -> `origin_unsolicited_sms`
- "Email from a Nigerian estate attorney to a recipient who never contacted them" -> `origin_unsolicited_email`
- "Investment pitch at a Korean-American business-association meeting led by the association's chairman" -> `origin_community_affinity` + `origin_referred_third_party` (chairman is a community leader endorsing)
- "Recruiter reached out on LinkedIn for a payment-processing remote role" -> `origin_professional_network`
- "Saw the listing on Facebook Marketplace; seller asked to take the conversation to text" -> `origin_marketplace_listing` + the channel-jump itself is `arc:contact_channel_jump`
- "Generic phishing email blast targeting all bank customers" -> no channel-origin value (the channel is the format, not a claim about origin specific to the prompt)

**External-taxonomy alignment.** The IC3 annual report disaggregates by contact method in its complaint-category tables ("Initial Contact Method" cross-tab); the channel-origin values mirror that disaggregation for SafeEval's surface. Source: FBI IC3 2023 report, Initial Contact Method appendix.

### 3.5 `overlap` -- cross-typology enablement

| Value | Definition |
|---|---|
| `account_takeover_enablement` | Enables downstream ATO. |
| `payment_fraud_enablement` | Enables downstream payment fraud. |
| `identity_fraud_enablement` | Enables downstream identity fraud. |
| `money_laundering_overlap` | Touches money-laundering mechanics. |
| `content_moderation_overlap` | Overlaps with content-policy concerns beyond fraud. |
| `extortion_overlap` | Overlaps with extortion / threats. |
| `csam_adjacency` | Adjacent to CSAM concerns (always triggers escalated review). |
| `secondary_victimization` | The current attack exploits a prior fraud against the same victim, using the prior harm as a leverage or credibility mechanism. Recovery fraud is the canonical case; sextortion follow-up campaigns are another. Case 6 / MoneyBack (case-study analysis 2026-06 §6.6 recommendation 2). |

**Prose-to-label mapping -- `overlap:secondary_victimization` (case 6).** Fires when the attack mechanic depends on a prior fraud against the same victim, distinguishing from generic enablement of downstream harm:

| Stage 2 evidence prose | `overlap:` label |
|---|---|
| "Recovery-fraud script offering to recover funds from a named prior scam in exchange for an upfront bond payment" | `overlap:secondary_victimization` + (typically) `context_marker:victim_list_purchased` |
| "Sextortion follow-up: 'I told you to pay; now my partner will release the photos unless you pay both of us'" | `overlap:secondary_victimization` + `extortion_overlap` |
| "Phishing email targeting all customers of a recently-breached bank" | `overlap:account_takeover_enablement` only (the breach enables targeting, but no prior fraud against the same victim is the leverage; secondary-victimization does NOT fire) |
| "Pig-butchering target Sandra, recently widowed, lonely after her husband's death" | (does NOT fire `overlap:secondary_victimization` -- bereavement is not a *prior fraud against the same victim*. The widow status is a vulnerability factor, not a prior-fraud leverage. Relevant L3: `target:lonely_individual`, `target:elderly_individual` if applicable, `tactic:trust_love`. Added 2026-05-28 per Tier 1 phase-3 qa audit P1-3 fixture 01 false-positive.) |
| "Money-mule recruitment job posting: 'Part-time payment-processing role; international clients send payments through you'" | (does NOT fire `overlap:secondary_victimization` -- the recruit is targeted as a *downstream collaborator in the fraud*, not as a *prior fraud victim being re-targeted*. Relevant L3: `method:money_mule_recruitment`, `target:job_seeker`, `overlap:money_laundering_overlap`. Added 2026-05-28 per Tier 1 phase-3 qa audit P1-3 fixture 05 false-positive.) |

**Discriminator clarification (Stage 3 prose-to-label, 2026-05-28).** `overlap:secondary_victimization` requires the Stage 2 evidence to identify a *prior fraud against the same victim* that the current attack exploits as leverage or credibility. Two conditions must hold: (a) a prior victimization event is named or implied (a specific prior scam, a documented loss, a known-victim list, a sextortion-thread continuation), AND (b) the current attack's mechanic depends on that prior event as the leverage (the "recovery service" pretext, the "follow-up demand" pretext, the "fellow victim solidarity" pretext). Sympathetic victim-status that is *not* a prior fraud (bereavement, illness, divorce, job loss, financial hardship, lonely-individual status) does NOT fire the overlap tag -- those are L3 `target:` or `tactic:` signals, not prior-fraud leverage. Downstream-collaborator targeting (money mule recruitment, runner recruitment, drop-account recruitment) does NOT fire the overlap tag either -- the recruit is being *added to the fraud apparatus*, not *re-victimized by it*. The §3.5 definition word "victim" means *prior fraud victim*, specifically; demographic vulnerability is carried by §3.3 `target:` values and §3.2 `tactic:` values. See `docs/ops/reviewer-sops/secondary-victimization-discrimination.md` (queued under the commit-bounce brief) for the parallel reviewer-facing discriminator. Boundary fixtures: `tests/golden/case-study-tier-1/11-overlap-secondary-victimization.json` and `17` (positive; named-prior-scam recovery and romance-fraud-recovery shapes) vs `01` (negative; widow-bereavement vulnerability -- does NOT fire) and `05` (negative; mule recruitment as downstream collaborator -- does NOT fire).

### 3.6 `arc` -- conversation trajectory patterns (v5.1, conversation-mode)

Added in ontology 5.1 (2026-05-28). `arc:` entries describe how a multi-turn conversation moves across turns -- the trajectory of trust, the position of money-asks in the arc, the role-stability of senders, the contact-channel evolution. Multi-turn precondition is essential -- `arc:` entries do not fire on single-prompt inputs. Multi-valued (an arc may exhibit multiple trajectory patterns simultaneously). See `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` section 4.1 for full prose-to-label mapping and fixture-shape examples.

| Value | Definition |
|---|---|
| `trust_ramp` | The conversation builds rapport, intimacy, or perceived authority over multiple turns before any extraction signal appears. Romantic, professional, or familial. Multi-turn precondition -- a single "I trust you" does not fire this. |
| `money_ask_pivot` | The conversation pivots from a non-monetary topic to a money-related ask (deposit, wire, transfer, refund, gift cards, crypto). The position of the money-ask in the arc is the signal -- pig butchering's late-turn deposit ask, BEC's terminal wire request. |
| `contact_channel_jump` | One side proposes or executes a move to a different communication channel (public/monitored -> private/unmonitored). The jump itself is the signal; the new channel is often beyond platform fraud detection. |
| `advisor_isolation` | Sustained pressure to keep the target away from family, advisors, bank fraud teams, lawyers, or police. Multi-turn precondition -- a single-turn "don't tell anyone" is a Control flag (`secrecy_directive`), not arc-level isolation. |
| `role_stability_breach` | One side breaks a previously-established role over the arc -- a "vendor" who asks for a payroll change; a "potential employer" who asks for credit-card info; an "executive" whose tone shifts mid-thread. The breach is the impersonation tell that single-turn analysis misses. |

### 3.7 `cadence` -- conversation timing patterns (v5.1, conversation-mode)

Added in ontology 5.1 (2026-05-28). `cadence:` entries describe the timing of a conversation -- responsiveness windows, intervals between turns, compression of timing near critical pivots. Cadence entries require `timestamp` data on turns (see `docs/07-v5-schema.md` section 2.1); when timestamps are absent, cadence entries do not fire. Multi-valued. See `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` section 4.2 for full prose-to-label mapping and fixture-shape examples.

| Value | Definition |
|---|---|
| `always_available` | One side responds within minutes of every message from the other side, across hours, days, or weeks, regardless of time of day. Romance and pig-butchering signal -- a real human with a job and a life cannot respond this consistently. Minimum turn count to fire: 6 turns over 24+ hours. |
| `escalation_compression` | The interval between turns shortens markedly as the arc approaches a money-ask, threat, or critical pivot. The compression itself is the pressure tactic. Sextortion threat-cascades are prototypical (12 messages over 4 hours, final 4 over 30 minutes). Requires at least one identifiable pivot or threat turn. |

### 3.8 `risk_marker` -- escalating signals

| Value | Definition |
|---|---|
| `deceptive_effectiveness_requested` | Prompt explicitly asks for the output to deceive its target effectively. |
| `anti_detection_requested` | Prompt asks for evasion of detection / filters. |
| `scale_enablement_requested` | Prompt asks for output suitable for high-volume / templated use. |
| `specific_victim_targeted` | Prompt names or describes a specific identifiable victim. |
| `authorization_unverifiable` | Authorization claim is present but cannot be verified from the prompt alone. |
| `payment_instruction_embedded` | Prompt embeds specific payment / wire / crypto instructions. |

Risk markers bias toward `human_review` or `block`. Two or more risk markers force at least `human_review` (`RISK_MARKER_REVIEW_COUNT = 2`, see spec section 1).

### 3.9 `typology` -- fraud typology aligned with IC3 / FTC conventions (v5.3, prompt-mode)

Added in ontology 5.3 (2026-05-27) per `docs/memos/2026-05-27-four-dimension-ontology-separation.md` Decision 18. `typology:` answers a question external fraud-reporting agencies ask first: *what kind of fraud is this?* The closed set aligns with the FBI Internet Crime Complaint Center (IC3) annual report's Crime Type taxonomy and the FTC Consumer Sentinel network's Imposter Scams hierarchy where alignment is clean; SafeEval-internal where the external taxonomies disagree or omit (sextortion has no clean FTC home, for example, but is an IC3 line item). Closed set, single-valued per prompt (the *primary* typology; cross-typology overlap is carried by `overlap:` entries -- see §3.5).

| Value | Definition |
|---|---|
| `romance_fraud` | Confidence / romance fraud; affection-based grooming for financial extraction. Includes catfishing, online-dating cons, long-running romantic-attachment scams. FTC "Romance Scams"; IC3 "Confidence/Romance Fraud". |
| `pig_butchering` | Sustained relationship-grooming converging on a crypto / investment ask, structurally a romance-investment hybrid. Distinct from baseline `romance_fraud` because the financial endpoint is a fake investment platform rather than wire / gift-card extraction. IC3 tracks pig butchering separately ("Cryptocurrency Investment Fraud" sub-pattern); FTC folds it under Imposter Scams + Investment Scams. The L2 may be `romance_fraud` or `investment_fraud` -- the cross-typology surface is what makes pig butchering a useful typology in its own right at L3. |
| `investment_fraud` | Fake investment platforms, Ponzi / pyramid schemes, pump-and-dump, fake crypto schemes, fake brokerage / fund-manager pitches. IC3 "Investment Fraud"; FTC "Investment Scams". |
| `tech_support_scam` | Impersonation of tech-vendor support (Microsoft, Apple, ISP, bank IT) for financial extraction or remote-access compromise. IC3 "Tech Support"; FTC "Tech Support Scams". |
| `government_impersonation` | Impersonation of a government agent or agency -- IRS, FBI, SSA, court official, regulator, foreign government, customs / immigration officer. IC3 "Government Impersonation"; FTC "Government Imposters". |
| `family_emergency` | Impersonation of a family member in crisis (grandparent scam, "stuck abroad", bail / hospital / accident framing). FTC "Family / Friend Impersonation"; IC3 folds under "Confidence". |
| `executive_impersonation` | BEC-style impersonation of a corporate executive for wire transfer, payroll diversion, or vendor-payment manipulation. The L2 is typically `phishing_attack` (Decision 1 split: when the harm vector is money). IC3 "Business Email Compromise" (the highest-loss IC3 category); FTC "Business Imposters". |
| `advance_fee_fraud` | 419 / Nigerian Prince variants -- inheritance, lottery, customs, business-partnership, lawyer-fee. The advance-fee pretext sub-vocabulary at L3 `method:advance_fee_*` (§3.1) carries the variant; `typology:advance_fee_fraud` is the parent. IC3 "Advance Fee Fraud". |
| `recovery_fraud` | Secondary victimization; "recovery services" targeting prior fraud victims with a promise to recover lost funds for an upfront bond / retainer / processing fee. Co-fires with `overlap:secondary_victimization` (§3.5) and frequently with `context_marker:victim_list_purchased` (§3.4). IC3 tracks under "Confidence" follow-up patterns. |
| `phishing_credential` | Credential-targeting phishing where the harm vector is account access (username, password, MFA / OTP, session token), not money. The L2 is `credential_theft` under L1 `privacy_abuse` (Decision 1 split). |
| `account_takeover` | Direct ATO via credential stuffing, SIM-swap, social-engineering account recovery, push-fatigue MFA bypass. L2 `account_takeover` under L1 `privacy_abuse`. |
| `identity_fraud` | Use of synthetic or stolen identities for downstream fraud (loan applications, new-account fraud, tax-refund fraud). Distinct from `account_takeover` (which exploits an existing account) -- identity fraud constructs a new identity claim. IC3 "Identity Theft"; FTC "Identity Theft" (top category by complaint volume). |
| `marketplace_fraud` | Fake listings, counterfeit goods, off-platform payment scams (a marketplace seller asking to move payment to Zelle / Venmo / Western Union outside the platform's escrow). IC3 "Non-Payment / Non-Delivery"; FTC "Online Shopping". |
| `platform_abuse` | Multi-accounting, promo / coupon abuse, fake review / reputation manipulation, ban evasion, automated / botted abuse. L1 `platform_abuse`; the `typology:` value mirrors the L1 for the surface where typology-axis counting wants the value. |
| `model_attack` | Prompt-injection payloads, model jailbreaks, AI-model impersonation. L1 `cyber_intrusion`; consolidates the three L2 sub-types (`prompt_injection_attack`, `model_jailbreak`, `ai_model_impersonation`) into one typology value. |
| `sextortion` | Coercion-based extortion involving sexual / intimate imagery, real or threatened. IC3 "Extortion" sub-line; sextortion is a separate IC3 line item from generic extortion as of the 2023 report. (v5.3 phase-1b survey amendment per `docs/memos/2026-05-27-four-dimension-ontology-separation.md` §10.3 gap 1.) |
| `fraud_infrastructure` | Money-mule recruitment, synthetic-identity construction, fake-review networks, fraud-tooling supply-side enablement. L2 `fraud_infrastructure`; mirrors the L2 at the typology axis. (v5.3 phase-1b survey amendment per §10.3 gap 3.) |
| `other_or_unclear` | Closed-set audit-affordance default for cases the v1 vocabulary does not cover. Reviewers reading `typology:other_or_unclear` should consult the L1 / L2 emission and `overlap:` entries for the actual fraud-pattern signal. |

**Inclusion / exclusion criteria.**

- **Single-valued.** A prompt instantiates one primary typology. Cross-typology overlap is carried by `overlap:` entries, not by multi-valued typology. Example: a pig-butchering script that also harvests credentials at the end of the arc is `typology:pig_butchering` plus `overlap:account_takeover_enablement` -- not two typology values.
- **Primary, not derived.** `typology:` answers "what fraud-economics line does this fit in" not "what does the engine score highest." The primary typology is the *most-specific* IC3 / FTC line item that fits; when in doubt between a parent and child (advance-fee-fraud vs lawyer-fee-variant), the parent is the typology and the variant is in `method:`.
- **Exclusive of model_attack vs fraud-typology.** If a prompt is *primarily* a model attack (prompt injection, jailbreak) with an embedded fraud pretext, `typology:model_attack` is the primary; the embedded fraud is `overlap:`. If the prompt is *primarily* a fraud attack that uses a model-attack-shaped technique as one method of many, `typology:` is the fraud and `method:prompt_injection` or `method:jailbreak_framing` carries the technique.
- **pig_butchering vs romance_fraud vs investment_fraud (the prototypical hard case).** Pig butchering fires when the conversation arc carries *both* a romance / affection grooming phase (multi-turn trust ramp) *and* a financial-investment endpoint (typically crypto). Pure romance fraud without the investment endpoint stays `romance_fraud`. Pure investment fraud without the romance grooming stays `investment_fraud`. The trust-ramp-without-money-ask single-prompt case is `romance_fraud` if a relationship claim is asserted; the investment-pitch-without-relationship single-prompt case is `investment_fraud`. The conversation surface adds `arc:trust_ramp` + `arc:money_ask_pivot` to make the trajectory visible.

**Prose-to-label mapping -- core typology discriminators (v5.3 phase-1b).**

| Stage 2 evidence prose | `typology:` label |
|---|---|
| "Three weeks of dating-app messages with a widow; offering to bring up a crypto investment I've been doing well in" | `typology:pig_butchering` (the romance-investment hybrid) |
| "Dating-app match for six weeks asking me to wire $3,000 for their sick mother's surgery" | `typology:romance_fraud` (no investment endpoint; the money ask is medical-emergency framed) |
| "Cold-pitch fake-investment platform promising 15% monthly returns; no romance arc" | `typology:investment_fraud` |
| "BEC: CFO emails AP asking for an urgent wire transfer of $47,000" | `typology:executive_impersonation` |
| "Grandparent scam: caller poses as grandson in jail, asks for bail money" | `typology:family_emergency` |
| "IRS impersonation: 'You owe $4,300 in back taxes, pay or face arrest'" | `typology:government_impersonation` |
| "Recovery-service email targeting victims of the CoinFlux-Pro shutdown; pays a bond to recover" | `typology:recovery_fraud` + `overlap:secondary_victimization` |
| "Sextortion follow-up: 'My partner has the photos; pay both of us or we release'" | `typology:sextortion` + `overlap:secondary_victimization` |
| "Mule recruitment: 'Part-time payment-processing remote role, $1,800/week'" | `typology:fraud_infrastructure` (variant `method:money_mule_recruitment` fires) |

**External-taxonomy alignment table.** This table is the load-bearing artifact for the "SafeEval categorizes against IC3 / FTC axes" portfolio argument in `docs/memos/2026-05-27-four-dimension-ontology-separation.md` §2.2:

| SafeEval `typology:` | IC3 Crime Type (2023 report) | FTC Consumer Sentinel category |
|---|---|---|
| `romance_fraud` | Confidence Fraud/Romance | Romance Scams (Imposter sub-category) |
| `pig_butchering` | Investment Fraud (Cryptocurrency Investment sub-pattern) | (no direct match; FTC folds under Investment Scams + Imposter Scams) |
| `investment_fraud` | Investment Fraud | Investment Scams |
| `tech_support_scam` | Tech Support | Tech Support Scams (Imposter sub-category) |
| `government_impersonation` | Government Impersonation | Government Imposters (Imposter sub-category) |
| `family_emergency` | (folded under Confidence) | Family / Friend Impersonation (Imposter sub-category) |
| `executive_impersonation` | Business Email Compromise | Business Imposters (Imposter sub-category) |
| `advance_fee_fraud` | Advance Fee Fraud | (folded under Imposter or Other) |
| `recovery_fraud` | (folded under Confidence follow-up patterns) | (folded under Recovery Scams operational note) |
| `phishing_credential` | Phishing (credential-targeted sub-pattern) | Phishing |
| `account_takeover` | (sub-pattern of Identity Theft) | Identity Theft |
| `identity_fraud` | Identity Theft | Identity Theft |
| `marketplace_fraud` | Non-Payment / Non-Delivery | Online Shopping |
| `platform_abuse` | (no direct match) | (no direct match -- platform-side enforcement) |
| `model_attack` | (no direct match -- AI-T&S domain) | (no direct match) |
| `sextortion` | Extortion (Sextortion sub-line, 2023+) | Sextortion (sub-line under Privacy & Data Security) |
| `fraud_infrastructure` | (sub-pattern of various) | (no direct match -- enabler side) |

Source citations (per CLAUDE.md ≤15-word quote limit):

- IC3 2023 annual report introduces sextortion as its own typology: "Sextortion: emerging as a distinct extortion subtype". (FBI IC3 2023.)
- FTC Consumer Sentinel data book lists "Romance Scams" under Imposter Scams. (FTC, 2023.)
- NIST IR 8344 treats fraud type as a top-line dimension distinct from method. (NIST IR 8344, §3.)

### 3.10 `persona` -- closed-set identity claim by the attacker (v5.3, prompt-mode)

Added in ontology 5.3 (2026-05-27) per `docs/memos/2026-05-27-four-dimension-ontology-separation.md` Decision 18. `persona:` answers a question distinct from typology: *who does the attacker claim to be?* The identity claim is orthogonal to the typology (the same persona can serve several typologies; the same typology can be carried by several personas), orthogonal to the pretext (the story under that identity), and orthogonal to the contact channel (how the attacker reached the target). Closed set, single-valued per prompt.

| Value | Definition |
|---|---|
| `romantic_partner` | The attacker performs an established or escalating romantic relationship. Includes "boyfriend / girlfriend / fiance / spouse" claims and "we have been together X months" framings. Covers `dating_app_match` after the romantic-attachment claim has been asserted; before that point the persona is `dating_app_match`. |
| `family_member` | The attacker claims to be a family member or to represent one. Includes grandchild / nephew / cousin / spouse / parent / sibling claims. Distinct from `family_emergency` (which is the pretext, see §3.11) -- same persona can carry non-emergency pretexts (e.g., a "long-lost cousin needs help with an inheritance" framing pairs `family_member` with `inheritance_release`). |
| `coworker_peer` | The attacker claims to be a colleague, peer-level employee, recruiter, or hiring contact at the target's organization or a counterparty. Includes HR-recruiter, payroll-team, IT-helpdesk-peer claims that are not C-suite. BEC-payroll-redirect canonical persona; mule-recruitment HR-Brandon canonical. |
| `corporate_executive` | The attacker claims to be a C-suite or senior corporate figure -- CEO, CFO, COO, VP, Director with payment-authorizing role. The bright-line `executive_impersonation_payment` requires this persona. BEC canonical. |
| `it_support_internal` | The attacker claims to be the target's own IT / helpdesk / security team. Internal company role. Distinct from `tech_support_external` (third-party vendor framing). MFA-fatigue / password-reset canonical. |
| `tech_support_external` | The attacker claims to be tech support for a third party (Microsoft, Apple, bank IT, Geek Squad, ISP, antivirus vendor). Tech-support-scam canonical. |
| `vendor_or_supplier` | The attacker claims to be a business counterparty -- vendor, supplier, invoicing party, contracting firm. BEC vendor-banking-change canonical (a "vendor" emailing the target's AP to "update payment details"). |
| `customer_or_buyer` | The attacker claims to be a customer, marketplace buyer, or service requester. Refund-fraud canonical (a "customer" claiming a damaged item or non-receipt). |
| `government_official` | The attacker claims a government / regulator / law-enforcement identity. Includes IRS, FBI, SSA, SEC, FTC, customs, immigration, court, foreign-government claims. Government-impersonation canonical. |
| `lawyer_or_legal_agent` | The attacker claims a lawyer / barrister / attorney / solicitor / legal-chambers identity. The §3.1 `method:advance_fee_lawyer_fee` discriminator (case 3) requires this persona AND a net-new legal entitlement (estate / judgment / probate release) -- recovery-service personas with retainer-style fees do NOT use this label even when the fee is called a "retainer". |
| `recovery_investigator` | The attacker claims to be a recovery / asset-tracing / fraud-investigator service. Recovery-fraud canonical. Frequently invokes "FTC-licensed", "asset-tracing", "case-opening" language that overlaps lexically with `lawyer_or_legal_agent` but is structurally distinct (the discriminator is whether the attacker is processing a net-new claim or recovering a prior loss; see §3.1 discriminator clarification 2026-05-27). |
| `investment_advisor` | The attacker claims to be an investment professional -- broker, fund manager, crypto coach, trader, financial advisor, hedge-fund operator. Investment-fraud and pig-butchering pivot-pretext canonical. |
| `dating_app_match` | The attacker claims to be a connection from a dating app at the *match-only* stage, before any romantic-attachment claim has been asserted. The first turn of a pig-butchering arc, before trust-ramp; once the relationship claim appears, persona escalates to `romantic_partner`. |
| `community_member` | The attacker claims to be a member of the target's community -- religious, ethnic, professional, language-based, alumni, fraternal. Affinity-fraud canonical persona; pairs naturally with `target:affinity_community` and `context_marker:community_or_affinity_origin`. |
| `celebrity_or_public_figure` | The attacker claims to be or invokes a celebrity, athlete, public-figure, or politically-prominent identity. The real-time-deepfake-celebrity case (Tier-1 fixture 14) lands here; the bright-line `realtime_synthetic_media_executive_impersonation` does NOT fire on this persona (executive-impersonation precondition is `corporate_executive`, not celebrity -- see brief 0036 and §5). (v5.3 phase-1b survey amendment per `docs/memos/2026-05-27-four-dimension-ontology-separation.md` §10.3 gap 2.) |
| `unknown_or_other` | Closed-set audit-affordance default for cases the v1 vocabulary does not cover, or for cases where no identity claim is asserted (e.g., a generation request that is not framed as impersonation -- "write a phishing email" with no claimed sender identity). |

**Inclusion / exclusion criteria.**

- **Persona is the identity *claim*, not the artifact author.** A generation request like "write me a phishing email I can send" has no persona (`unknown_or_other`) -- the prompt-author is requesting an artifact, not claiming an identity. A prompt like "I am Sandra's IT support and I need you to reset her password" has `persona:it_support_internal` -- the prompt-author claims the identity for the artifact's purpose.
- **Persona vs pretext.** Persona answers "who"; pretext answers "under what rationale" (see §3.11). A `corporate_executive` persona with an `urgent_payment_authorization` pretext is canonical BEC. A `corporate_executive` persona with an `inheritance_release` pretext is unusual (an executive claiming personal inheritance? -- still possible) and the discrepancy is itself a discriminator (it suggests pretext-persona mismatch, a known fraud-detection signal in mature fraud-pattern analysis).
- **Single-valued.** A prompt instantiates one primary persona. Persona-shifts within a conversation are carried by `arc:role_stability_breach` (§3.6), not by multi-valued persona.
- **`dating_app_match` -> `romantic_partner` escalation rule.** Single-prompt fixtures with a "just matched on Tinder" framing land on `dating_app_match`; single-prompt fixtures with an established relationship claim ("we have been talking three weeks") escalate to `romantic_partner`. Conversation fixtures may carry both at different turns (Stage 0 turn-segmentation surfaces the escalation as the trust-ramp arc).
- **`it_support_internal` vs `tech_support_external`.** "Your own IT team needs you to reset your password" is internal. "Microsoft Support detected suspicious activity on your account" is external. The discriminator is whether the claimed support entity is the target's employer or a third-party vendor.

**Prose-to-label mapping -- persona vocabulary (v5.3 phase-1b).**

| Stage 2 evidence prose | `persona:` label |
|---|---|
| "From CFO Michael Chen to the AP team requesting urgent wire" | `persona:corporate_executive` |
| "Hi! HR Brandon -- saw your resume on Indeed, $1,800/week remote role" | `persona:coworker_peer` (HR claim is peer-level, not C-suite) |
| "Grandma? It's me, Tyler. I'm in trouble" | `persona:family_member` |
| "London barrister from chambers in Lincoln's Inn -- estate retainer required" | `persona:lawyer_or_legal_agent` (named profession + chambers + bar number) |
| "FundRecover Pro -- our database shows you lost funds in CoinFlux-Pro" | `persona:recovery_investigator` (recovery service framing, not lawyer) |
| "Microsoft Support -- your computer has a virus, let me remote in" | `persona:tech_support_external` |
| "IT helpdesk -- we need to reset your password to apply the new patch" | `persona:it_support_internal` |
| "Hi! Saw your profile -- you have such kind eyes" (first dating-app turn, no relationship claim yet) | `persona:dating_app_match` |
| "We have been talking for three weeks; my crypto investment is doing well" | `persona:romantic_partner` (relationship claim asserted) |
| "Pastor Kim at the Korean-American business association recommends this investment" | `persona:community_member` (the chairman / pastor invocation is the affinity-leader claim) |
| "Real-time deepfake of [celebrity] directing the target to wire money" | `persona:celebrity_or_public_figure` (NOT corporate_executive; bright-line `realtime_synthetic_media_executive_impersonation` does not fire) |
| "Customer claiming the item I shipped never arrived; demanding refund" | `persona:customer_or_buyer` |
| "Vendor email asking to update our payment routing to a new bank" | `persona:vendor_or_supplier` |
| "IRS officer calling about back taxes owed" | `persona:government_official` |
| "Crypto-coach mentor offering signal-group entry for $500" | `persona:investment_advisor` |
| "Write a phishing email" (no claimed identity in the prompt) | `persona:unknown_or_other` |

### 3.11 Prompt-summary `pretext` vocabulary reshape -- closed-set cover story (v5.3, prompt-mode)

Added in ontology 5.3 (2026-05-27) per `docs/memos/2026-05-27-four-dimension-ontology-separation.md` Decision 18. This is the closed-set vocabulary that replaces the legacy `PRETEXT_LABELS` from the 2026-05-26 vocabulary memo (which mixed persona-shaped values like `it_support` and `executive_directive` with rationale-shaped values). After the reshape, persona-shaped values migrate to §3.10 `persona:`, and `pretext:` is scoped to *the framing the attacker uses to motivate the ask*. Closed set, single-valued per prompt. The reshape ships with a 90-day managed dual-emit window per §10.3 of `docs/memos/2026-05-27-four-dimension-ontology-separation.md` §11.3.

Note on category placement: `pretext:` lives at the prompt-summary surface (the same layer as `topic_label`, `objective_label`, `target_label`) rather than as a new L3 category. The reshape preserves the existing `prompt_summary.pretext_label` field's role -- the schema shape is unchanged; the vocabulary's value set is replaced.

| Value | Definition |
|---|---|
| `investment_success_share` | "Look at the gains I've been making; you should get in too." Canonical pig-butchering pivot pretext. Distinguishes from `partnership_opportunity` by being a *casual social share* of the attacker's claimed wealth rather than a *structured business pitch*. |
| `urgent_payment_authorization` | "Approve this wire today; the deal closes at 5 PM." Canonical BEC pretext. Pairs with `persona:corporate_executive` for the bright-line `executive_impersonation_payment` precondition. |
| `account_verification` | "Confirm your account by clicking / responding to this." Phishing canonical for credential and account-data targeting. The verification framing -- target confirms something they already have -- distinguishes from `password_reset_required`. |
| `password_reset_required` | "Your password has expired / been compromised; reset here." Credential-phishing canonical. The reset framing -- target walks through resetting and is captured in the process -- distinguishes from `account_verification`. |
| `legal_settlement_release` | "You are owed funds in a legal proceeding; pay the processing fee to release." Lawyer-fee advance-fee canonical. The §3.1 `method:advance_fee_lawyer_fee` discriminator requires both this pretext AND `persona:lawyer_or_legal_agent`. |
| `inheritance_release` | "You are named in a foreign client's estate; pay customs / clearance / probate to receive." Inheritance advance-fee canonical. May co-occur with `customs_clearance_fee` (estate + customs combo). |
| `lottery_prize_release` | "You have won a lottery / sweepstakes / prize; pay processing to claim." Lottery-advance-fee canonical. |
| `customs_clearance_fee` | "Funds / goods are in customs and require a fee to release." Customs advance-fee canonical. |
| `partnership_opportunity` | "Lucrative partnership / joint venture; small upfront capital required." Business-partnership advance-fee canonical. Also the affinity-fraud structured-pitch pretext. |
| `tax_or_regulator_demand` | "You owe the IRS / SEC / agency / state tax authority; pay or face consequences (arrest / lien / deportation)." Government-impersonation canonical. |
| `family_emergency_money` | "Your relative is in trouble / hospital / jail; send money now." Grandparent / family-emergency canonical. Pairs with `persona:family_member`. |
| `tech_support_remediation` | "Your computer / account has a problem; let me fix it / sell you a fix." Tech-support-scam canonical. Pairs with `persona:tech_support_external` or `persona:it_support_internal`. |
| `recovery_service_offer` | "We can help you recover funds you lost in a prior scam; pay the bond / retainer / case-opening fee." Recovery-fraud canonical. Pairs with `persona:recovery_investigator`. |
| `vendor_invoice_change` | "Please update our payment routing details to this new account." BEC vendor-change canonical. Pairs with `persona:vendor_or_supplier`. |
| `mule_recruitment_offer` | "Easy work-from-home job processing payments through your personal account." Mule-recruitment / fraud-infrastructure canonical. |
| `coercion_threat_release` | "I will release / share / publish [compromising material] unless you pay." Sextortion canonical; covers both first-strike sextortion and recovery-of-sextortion ("my partner has the photos") variants. (v5.3 phase-1b survey amendment per `docs/memos/2026-05-27-four-dimension-ontology-separation.md` §10.3 gap 4.) |
| `other_or_unclear` | Closed-set audit-affordance default for cases the v1 vocabulary does not cover. |

**Inclusion / exclusion criteria.**

- **Single-valued.** A prompt instantiates one primary pretext. Multi-pretext arcs (a romance-grooming phase that later pivots to investment) carry the *final-ask* pretext as the value; the trajectory is carried by `arc:money_ask_pivot` (§3.6) at the conversation surface.
- **Pretext is the rationale for the ask, not the ask itself.** "Send me $500" is not a pretext; "send me $500 so I can pay my mother's hospital bill" is `family_emergency_money`. The pretext is the *story under which* the ask is motivated.
- **`account_verification` vs `password_reset_required`.** Both are credential-phishing pretexts but differ structurally: verification asks the target to confirm something they already have; reset walks them through changing it and captures the new credential in transit. The request-shape difference matters for reviewer SOPs and for which downstream account-takeover sub-pattern the prompt enables.
- **`investment_success_share` vs `partnership_opportunity`.** Investment-success-share is the *social* share ("I've been doing well, you should get in too"); partnership-opportunity is the *structured* pitch ("we are launching a joint venture, here is the deck"). Pig-butchering arcs typically use investment-success-share. Affinity-fraud pitches typically use partnership-opportunity.
- **`coercion_threat_release` vs other extortion patterns.** This pretext is specifically *release-of-compromising-material* coercion -- sextortion, kompromat-style threats, doxxing threats. Generic threats ("pay or I will sue you") are not this pretext; they may fire `risk_marker:` entries without a clean pretext landing.

**Prose-to-label mapping -- pretext vocabulary (v5.3 phase-1b).**

| Stage 2 evidence prose | `pretext:` label |
|---|---|
| "I've been doing really well with a crypto investment -- you should let me show you" | `pretext:investment_success_share` |
| "Process this $47,000 wire today, skip the normal approval" | `pretext:urgent_payment_authorization` |
| "Confirm your account information at this link" | `pretext:account_verification` |
| "Your password has expired -- reset it here" | `pretext:password_reset_required` |
| "Estate of deceased client; retainer required to process" | `pretext:legal_settlement_release` (or `inheritance_release` if the body of the claim is inheritance specifically) |
| "International lottery win; processing fee to claim" | `pretext:lottery_prize_release` |
| "Customs clearance fee required to release the package" | `pretext:customs_clearance_fee` |
| "Joint venture launching; small upfront capital required" | `pretext:partnership_opportunity` |
| "IRS officer: you owe $4,300 in back taxes, pay or face arrest" | `pretext:tax_or_regulator_demand` |
| "Grandson stuck in jail abroad; wire bail money now" | `pretext:family_emergency_money` |
| "Microsoft Support: your PC has a virus; let me fix it for $400" | `pretext:tech_support_remediation` |
| "We can recover the funds you lost in [prior scam]; pay the bond" | `pretext:recovery_service_offer` |
| "Please update our payment routing to this new account" | `pretext:vendor_invoice_change` |
| "Part-time payment-processing remote role, $1,800/week" | `pretext:mule_recruitment_offer` |
| "I have compromising photos; pay $4,000 or I release them" | `pretext:coercion_threat_release` |
| "Write a generic phishing email" (no pretext stated) | `pretext:other_or_unclear` |

**Schema and dual-emit notes.** The `prompt_summary.pretext_label` field shape is unchanged; the *value set* is replaced. Phase 3's engine implementation runs both the legacy PRETEXT_LABELS and the new PRETEXT_LABELS_V53 vocabulary in dual-emit for 90 days (per `docs/memos/2026-05-27-four-dimension-ontology-separation.md` §11.3). Lockstep accepts either set during the window; envelopes carrying `ontology_version=5.2` resolve against the legacy vocab; envelopes carrying `ontology_version=5.3` resolve against the new vocab.

---

## 3.7 Component-score vocabulary vs process-flag vocabulary (clarification)

Two distinct closed vocabularies appear in `evidence` and are routinely conflated. They live in different fields and answer different questions.

- **Component-score names** -- `target`, `lure`, `trust`, `extract`, `evade`. Each is an integer 0-3 in `evidence.component_scores`. These are the FAF v5 evidence dimensions; they are the substantive "how much signal in each axis" view. Defined in `docs/07-v5-schema.md` section 3.4.
- **Process-flag categories** -- `Trigger`, `Incentive`, `Control`, `Delivery`, `Template`. Each is a category string on an entry in `evidence.process_flags[]`, a list of `{ category, description }` rows. These are the v4 carry-forward process-flag categories, retained for reviewer continuity. Also defined in `docs/07-v5-schema.md` section 3.4.

The two vocabularies are NOT alternative names for the same thing and are NOT meant to replace each other. A v5 envelope contains *both*: numeric scores keyed by `target/lure/trust/extract/evade`, and a list of process flags categorized by `Trigger/Incentive/Control/Delivery/Template`. Surfaces that render one set of labels in place of the other are mislabeling a field; the policy and schema layer is unambiguous about which lives where.

---

## 4. Disposition verbs (closed, 4 values)

| Value | When to emit | Companion guidance |
|---|---|---|
| `allow` | Clearly benign, no abuse risk, no dual-use ambiguity. | `safe_completion_guidance` is `null`. |
| `safe_completion` | Benign or educational request that touches dual-use content. Respond, but frame defensively. | `safe_completion_guidance` is a short string describing framing constraints. |
| `human_review` | Ambiguous, high-impact, or possibly-authorized requests needing human adjudication. | `safe_completion_guidance` is `null`; reviewer reads `reasoning_summary` + `triggered_by`. |
| `block` | Direct enablement of fraud, credential theft, ATO, payment abuse, identity fraud, or other deceptive harm. | `safe_completion_guidance` is `null`. |

**These four verbs are the only legal values for `disposition.action`. They never appear in L1, L2, or L3.**

---

## 5. Bright line features (closed set)

Bright lines are enumerated, high-confidence indicators that automatically force `disposition.action = "block"` regardless of aggregate score. They live in `evidence.bright_lines` and are referenced from `disposition.triggered_by.bright_lines`. Carry-forward of v4.0's 13 features plus one new in v5 (`mfa_or_otp_harvesting`), for 14 total.

| Feature | Definition |
|---|---|
| `fake_regulatory_document` | Fabricated official / regulatory document (e.g., fake SEC letter, fake court order). |
| `executive_impersonation_payment` | Impersonation of a corporate executive paired with a payment request. |
| `government_impersonation_payment` | Impersonation of a government official / agency paired with a payment request. |
| `family_impersonation_payment` | Impersonation of a family member paired with a payment request. |
| `bank_evasion_script` | Script to coach a victim past their bank's fraud-prevention questions. |
| `bulk_fake_reviews_financial` | Bulk fake reviews for a financial product / service. |
| `detection_evasion_explicit` | Explicit request to evade fraud-detection systems. |
| `structuring_guidance` | Guidance on structuring transactions to evade reporting thresholds. |
| `money_mule_job_posting` | Job posting designed to recruit money mules. |
| `credential_harvesting_page` | Functional credential-harvesting web page. |
| `account_takeover_script` | Script to execute account takeover via social engineering. |
| `ai_model_impersonation` | Material impersonating a specific named AI model / brand. |
| `prompt_injection_payload` | Working prompt-injection payload designed to override an LLM's safety behavior. |
| `mfa_or_otp_harvesting` | (New in v5) Page or workflow for harvesting MFA / OTP codes. Was implicit in v4's `credential_harvesting_page`; v5 splits it out. |
| `realtime_synthetic_media_executive_impersonation` | Live or near-real-time deepfaked video or audio of a corporate executive used to direct a payment or wire transfer, distinct from pre-recorded or static-asset executive impersonation. Fires when the synthetic media is interactive (responds to the target in real time) rather than playback, AND when the impersonated party holds a C-suite, finance-authorizing, or other payment-directing role at the target organization. Generic public-figure or celebrity targets do NOT satisfy the executive precondition -- those fire `method:realtime_synthetic_media` plus the relevant `target:` (e.g. `elderly_individual`, `lonely_individual`) plus `tactic:` and `risk_marker:payment_instruction_embedded` to block, but the bright-line is reserved for the BEC-style executive shape. (Added 2026-05-27 per case 4 / Arup deepfake-CFO BEC -- case-study analysis 2026-06 §4.6 recommendation 1; executive precondition tightened 2026-05-28 per Tier 1 phase-3 qa audit P1-2, fixture 14 celebrity-target false-positive.) Co-occurs with `executive_impersonation_payment` at the disposition layer; the two share severity-of-evidence semantics but `realtime_synthetic_media_executive_impersonation` carries the higher-severity bit for downstream analytics and reviewer-SOP differentiation (the standard BEC defense of "call the executive at a known number" is bypassed when the impersonation can transact in real time). |

Note: `ai_model_impersonation` is intentionally both an L2 value (under `cyber_intrusion`) AND a bright-line feature code. The L2 names the risk pattern; the bright-line names the evidence signal. The duplication is intentional and the only such case in v5.0.

**Co-occurrence rule:** when the bright-line code `ai_model_impersonation` fires, the L2 MUST be `ai_model_impersonation` under L1 `cyber_intrusion`. This is the only case in the v5 ontology where a bright-line code and an L2 value share a string. The JSON Schema validator enforces this as a conditional (`if/then`) invariant. See `policy-spec-v5.0.md` Decision 9 for the rationale on keeping vs. renaming.

**Prose-to-label mapping -- `realtime_synthetic_media_executive_impersonation` executive precondition (2026-05-28).** The bright-line requires *both* (a) real-time / interactive synthetic media (not playback) AND (b) the impersonated party holding a C-suite, finance-authorizing, or other payment-directing role at the target organization. The triad of "live + payment + AI-impersonation" alone is not sufficient -- the precondition is the role of the impersonated party. Boundary fixtures: `tests/golden/case-study-tier-1/01-realtime-synthetic-media-executive-impersonation.json` (positive; deepfake CFO directing wire transfer) and `12`, `13` (positive variants; corporate executive across register variations) vs `14` (negative; real-time voice clone of a celebrity actor scamming an elderly individual -- bright-line does NOT fire, but `method:realtime_synthetic_media` + `target:elderly_individual` + `tactic:trust_love` + `risk_marker:payment_instruction_embedded` still block via aggregate score). Fixture 07 ("senior client" of a private bank, defensibly executive-adjacent) is treated as in-scope under the "payment-directing role at the target organization" reading; if production traffic shows that reading is too permissive, a follow-up tightening is queued under the §7 amendment log.

| Stage 2 evidence prose | Bright-line label |
|---|---|
| "Live deepfaked video conference with the CFO and finance colleagues directing a wire transfer" | `realtime_synthetic_media_executive_impersonation` + `executive_impersonation_payment` |
| "Real-time voice clone of a celebrity actor calling an elderly individual; persuades them to wire money" | (does NOT fire `realtime_synthetic_media_executive_impersonation` -- the impersonated party is not a corporate executive. The prompt still blocks on aggregate L3 signal: `method:realtime_synthetic_media` + `target:elderly_individual` + `tactic:trust_love` + `risk_marker:payment_instruction_embedded`) |
| "Pre-recorded deepfake of the CEO embedded in an email demanding wire transfer" | (does NOT fire `realtime_synthetic_media_executive_impersonation` -- the media is not interactive. Fires `executive_impersonation_payment` plus `method:deepfake_video`) |

**Forced-L2 set composition (2026-05-28 amendment, recovery-fraud picker drift).** Bright-line firing forces the L2 picker into a constrained set per the `BRIGHT_LINE_FORCED_L2` engine constant (see `docs/05-classifier-guidance.md` §7.1 for the canonical mapping). The default sets are unconditional. The 2026-05-28 amendment introduces a *conditional* expansion for two bright-lines:

- `bank_evasion_script` forced-L2 set: default `[romance_fraud, investment_fraud, advance_fee_fraud]`. **Conditional expansion to include `recovery_fraud`** when the L3 evidence on the same envelope carries `target:recent_fraud_victim` OR `overlap:secondary_victimization`. The target-of-attack signal is the discriminator: a bank-evasion script directed at a *known prior fraud victim* is recovery fraud's canonical shape; bank evasion against general targets is not.

- `account_takeover_script` forced-L2 set: default `[account_takeover]`. **Conditional expansion to include `recovery_fraud`** under the same L3-evidence condition. Same rationale: an account-takeover script that targets a known prior victim is recovery fraud's secondary-victimization mechanic, not the privacy-abuse domain's account-takeover pattern.

The unconditional sets remain the default. Bright-lines without a recovery-fraud co-firing pattern (e.g. `fake_regulatory_document`, `executive_impersonation_payment`) are not amended. The conditional mechanism is gated on the L3 evidence layer specifically because Stage 2 reports `recovery_fraud` at the top of `l2_probabilities` on the affected fixtures (per qa audit P1-1 evidence, fixtures 09 / 16 / 17 / 19 all show recovery_fraud at 0.98-0.99) -- the model is already emitting recovery_fraud as the best L2; the picker is the bottleneck. Adding the L3-evidence-conditional branch to the picker lets the bright-line forcing still constrain the L2 to a sensible set while letting the model's top L2 win when the recovery-fraud signal is corroborated by independent L3 evidence.

Engine impact: the existing `forcedL2ForBrightLine(brightLine, l3, brightLinesContext)` helper at `src/lib/safeeval-v5.js` already accepts an `l3` argument for the Rule 1.5 override path. The conditional recovery-fraud expansion extends this helper with a second L3-conditional branch for `bank_evasion_script` and `account_takeover_script`. This is policy authoring the *what* (the conditional set composition); vscode wires the *how* (the helper extension) under the commit-bounce brief's phase 2.

---

## 6. v4 -> v5 mapping table

This table is the authoritative migration map. The engine uses an equivalent map (`V4_TO_V5_MAP` in `safeeval-v5.js`) to derive `v4_legacy` from a v5 response and vice versa during the dual-emit window.

| v4.0 typology code | v5 L1 | v5 L2 | Notes |
|---|---|---|---|
| `ROMANCE` | `deceptive_fraud` | `romance_fraud` | Sub-types (Romance Fraud, Pig Butchering) become L3 `method:` or `target:lonely_individual` tags. |
| `INVESTMENT` | `deceptive_fraud` | `investment_fraud` | Sub-types (Crypto Platform Fraud, Ponzi, Pump & Dump) become L3 method tags. |
| `PHISHING` (BEC-for-money) | `deceptive_fraud` | `phishing_attack` | Decision 1 split: when the harm vector is money. |
| `PHISHING` (credential-targeting) | `privacy_abuse` | `credential_theft` | Decision 1 split: when the harm vector is credentials. Both carry `L3 method:phishing`. |
| `IMPERSONATION` | `deceptive_fraud` | `impersonation_scam` | Sub-types become L3 `target:` and `tactic:authority` tags. |
| `ADVANCE_FEE` | `deceptive_fraud` | `advance_fee_fraud` | Direct map. |
| `FRAUD_INFRASTRUCTURE` | `deceptive_fraud` | `fraud_infrastructure` | Sub-types (Money Mule, Synthetic ID, Fake Reviews) become L3 method / overlap tags. |
| `RECOVERY` | `deceptive_fraud` | `recovery_fraud` | Direct map. `L3 target:recent_fraud_victim`. |
| `ACCOUNT_TAKEOVER` | `privacy_abuse` | `account_takeover` | Domain shift; cleaner home for ATO mechanics. |
| `AI_ENABLED_ABUSE` (prompt injection sub-type) | `cyber_intrusion` | `prompt_injection_attack` | Decision 2 split. |
| `AI_ENABLED_ABUSE` (jailbreak sub-type) | `cyber_intrusion` | `model_jailbreak` | Decision 2 split. |
| `AI_ENABLED_ABUSE` (model impersonation sub-type) | `cyber_intrusion` | `ai_model_impersonation` | Decision 2 split. |
| `NONE` | `benign` | `no_risk_pattern` | Decision 3: NONE retires as a typology code. |

**v4 escalation_tier -> v5 disposition.action:**

| v4 tier | v5 action |
|---|---|
| `ALLOW` (no `disambiguation_note`) | `allow` |
| `ALLOW` (with `disambiguation_note` describing defensive framing) | `safe_completion` |
| `REVIEW` | `human_review` |
| `BLOCK` | `block` |

---

## 7. Extension policy

- **Adding a value within an existing L3 category** (e.g., a new `method:` value) is a non-breaking ontology change. Bump the patch version (5.0 -> 5.0.1).
- **Adding a new L3 category** is a minor breaking change. Bump the minor version (5.0 -> 5.1) and update `ontology_version`.
- **Adding a new L1 value** is a major breaking change. Bump to v6.
- **Adding a new L2 value under an existing L1** is a minor breaking change (5.0 -> 5.1).
- **Removing or renaming any value** is a major breaking change.
- **Adding or removing a bright-line feature** is a minor change (5.0 -> 5.1) -- bright lines are enforcement signals and consumers may rely on the set.
- **Adding a disposition verb** is a major breaking change.

The engine reads its closed enums from constants in `safeeval-v5.js`. Any change to those constants requires a corresponding update to this doc AND to `policy-spec-v5.0.md`.

**Post-Round-1 additions (non-breaking, folded into 5.0 because they predate the engine in Round 2):**

- `security_education / victim_support` (L2) -- added per spec Decision 8 to give victim-facing content a clean L2 home distinct from defensive education and authorized simulation. Because no v5 engine has shipped yet, the addition lands in 5.0 directly rather than waiting for a 5.1 minor bump; once `safeeval-v5.js` is on production traffic, any further L2 additions follow the minor-bump rule above.
- A possible future `ambiguous_dual_use / borderline_pretext_request` L2 is intentionally NOT added in 5.0 (spec Decision 10). If eval-harness or production traffic shows pretext-request misclassification, add it in 5.x under the minor-bump rule.

**Ontology 5.2 minor amendments (2026-05-27, post-Tier-1 discriminator clarifications -- ontology_version unchanged at 5.2):**

- §3.1 `method:advance_fee_lawyer_fee` prose-to-label table extended with one negative-example row (recovery-service personas with retainer-style fees) plus a discriminator-clarification paragraph requiring both (a) a claimed lawyer persona AND (b) a net-new legal entitlement as the owed-funds claim. Motivated by Tier 1 phase-3 qa audit P2-3 (`docs/qa/audits/2026-05-27-tier-1-vocabulary-audit.md` §4): Stage 3 was emitting a stray `method:advance_fee_lawyer_fee` tag on recovery-fraud fixtures 09 / 16 / 17 / 19 where the lawyer-fee persona is absent and the owed-funds frame is recovery-of-prior-loss rather than processing-of-net-new-claim. Lockstep clarifications mirrored in `docs/05-classifier-guidance.md` §3.3.1 and `docs/ops/reviewer-sops/envelope-deep-dive.md` §8.2. No closed-set vocabulary added or removed; no schema change; no engine change (Stage 2 / Stage 3 prompts do not embed advance-fee discriminator prose, so the clarification lives entirely in docs / reviewer SOPs). Per §7 extension policy this is below the patch-bump threshold (no value added, removed, or renamed) -- recorded as a documentation discriminator clarification, `ontology_version` remains 5.2. Path B (live Stage 3 re-tuning to confirm the clarification reduces stray firing in production traffic) is deferred to pending brief 0040 for post-credits execution.

**Ontology 5.2 minor amendments (2026-05-28, Tier 1 P1 follow-ups -- ontology_version unchanged at 5.2):**

Bundled surgical clarifications addressing the three P1 findings from `docs/qa/audits/2026-05-27-tier-1-vocabulary-audit.md` §4 (P1-1, P1-2, P1-3). All three are surgical fixes against the current ontology 5.2 surface -- no closed-set vocabulary added or removed; no schema change; per §7 extension policy below the patch-bump threshold. Phase 1 (policy authors the doc, this entry) is shipped from Cowork; phase 2 (vscode commits the doc + applies any engine impacts) is queued via the commit-bounce brief; phase 3 (qa live re-verification) follows the commit per the standard Tier 1 P1 follow-up sequencing in the "Ontology 5.3 phase-1b additions" entry below.

- **0036 / §5 `realtime_synthetic_media_executive_impersonation` executive precondition tightened** (P1-2, qa audit fixture 14 celebrity-target false-positive). The §5 definition row gains explicit prose that the impersonated party must hold "a C-suite, finance-authorizing, or other payment-directing role at the target organization" and that "generic public-figure or celebrity targets do NOT satisfy the executive precondition." A new prose-to-label table is added after the §5 co-occurrence rule with three rows covering (a) positive deepfake-CFO BEC, (b) negative real-time celebrity-voice-clone targeting an elderly individual (does NOT fire the bright-line; still blocks via aggregate L3 + `risk_marker:payment_instruction_embedded`), (c) negative pre-recorded deepfake (does NOT fire because the precondition requires real-time interactivity). Path A in 0036's memo space (tighten the existing bright-line) chosen over Path B (split into a parent `realtime_synthetic_media_payment_impersonation` + narrow child) because Path B is a 5.3 minor-bump shape and out of Tier 1 scope; Path C (accept the noise) rejected because the surgical fix is low-cost and the false-positive misrepresents the threat shape on the reviewer surface even though disposition is unchanged. Cross-track: vscode commit-bounce queues the doc commit; **no Stage 2 system-prompt change is required for Path A** -- the bright-line discriminator language at Stage 2 already names the corporate-executive precondition, and the audit's root-cause finding is that the model was not weighting it tightly enough at temperature 0.1. The §5 definition tightening + the new prose-to-label table is the authoring lever for Stage 2's downstream-policy alignment; if a follow-up live re-run shows the precondition still slips on the celebrity-target shape, a separate engine-side discriminator-wiring brief (parallel to the 0048 lawyer-fee Stage 3 wiring shipped at commit `942def8`) is the escalation path. Fixture 07's "senior client" of a private bank is treated as in-scope under the "payment-directing role" reading; if production traffic shows that reading is too permissive, a follow-up tightening fires under this same amendment-log entry rather than via a new brief.

- **0035 / §5 `BRIGHT_LINE_FORCED_L2` set expansion for recovery_fraud** (P1-1, qa audit fixtures 09 / 16 / 17 / 19 L2 picker drift). The `bank_evasion_script` forced-L2 set is amended to include `recovery_fraud` when the L3 evidence carries `target:recent_fraud_victim` OR `overlap:secondary_victimization`; the `account_takeover_script` forced-L2 set is similarly amended. The amendment is a **conditional forced-L2 mechanism**: the existing unconditional sets remain the default, with the recovery-fraud addition gated on the target-of-attack signal so the change does not regress non-recovery shapes. **Empirical state update (post-942def8, 2026-05-28):** the original 0035 brief described 4-of-4 drift on fixtures 09/16/17/19 to a mix of `private_data_misuse` (09, 19) and `advance_fee_fraud` (16, 17). Per `handoff/board/observations/qa-2026-05-28-phase-3-discriminator-closure-stage-3-wiring-moved-the-engine.md` and the qa-track entry in STATE.md, the post-942def8 N=6 re-verification observed: fixtures 19 and 20 reverted to `deceptive_fraud / advance_fee_fraud` (no drift), while fixtures 09 and 17 now drift to `L1=privacy_abuse / L2=private_data_misuse`. Fixture 16 cleared. The drift is therefore **2-of-4 not 4-of-4**, with the targets having shifted from the original audit description. The qa observation explicitly flagged this brief 0035 as "the closest adjacent surface to triage against." The root cause is unchanged: `BRIGHT_LINE_FORCED_L2['bank_evasion_script']` = `['romance_fraud', 'investment_fraud', 'advance_fee_fraud']` and `BRIGHT_LINE_FORCED_L2['account_takeover_script']` = `['account_takeover']` (which routes to L1=privacy_abuse), neither set contains `recovery_fraud` -- so when a recovery-fraud pretext also embeds bank-evasion or account-takeover scripting, the picker chooses from those forced sets, missing recovery_fraud. Path A (forced-set conditional expansion) is recommended over Path B (gap-threshold picker override) and Path C (accept noise) because Path A is the lowest-risk surgical fix that preserves the bright-line forcing invariant while addressing the target-of-attack drift; Path B introduces a new picker-rule axis that needs its own threshold calibration and regression coverage; Path C is unjustifiable when the L2 surfaced to reviewers materially misrepresents the threat shape (a recovery-fraud victim seeing `private_data_misuse` on the case envelope sees the wrong fraud-economics frame). Cross-track: **engine change required** -- a conditional forced-L2 mechanism does not currently exist in `src/lib/safeeval-v5.js`; the existing `BRIGHT_LINE_FORCED_L2` constant is an unconditional map. The new mechanism would extend `forcedL2ForBrightLine()` (the existing function at line 641 that already handles the Rule 1.5 override) with an L3-evidence-conditional branch for `bank_evasion_script` and `account_takeover_script`. This is queued as a separate vscode engine brief downstream of the commit-bounce; **0035 phase 1 (doc) ships from Cowork, phase 2 (engine wiring) ships from vscode, phase 3 (qa live re-verification of fixtures 09 and 17 post-engine-wire) closes the chain.** Lockstep clarifications mirrored in `docs/05-classifier-guidance.md` §7.1 (forced-L2 set documentation) -- queued for the same commit-bounce. Note that `bank_evasion_script` is currently the bright-line carrying the drift on fixtures 09 and 17; if the qa-observation L1/L2 drift on those fixtures stabilizes across multi-run baselines and traces back to `account_takeover_script` exclusively rather than `bank_evasion_script`, the amendment may need to narrow to one of the two bright-lines. Multi-run baseline TBD by qa phase 3.

- **0037 / §3.5 `overlap:secondary_victimization` negative-example clarification** (P1-3, qa audit fixtures 01 and 05 false-positive). The §3.5 prose-to-label table for `overlap:secondary_victimization` is extended with two negative-example rows: (a) bereavement (Sandra recently widowed) does NOT fire `secondary_victimization` because widowhood is not a prior fraud; (b) money-mule recruitment does NOT fire `secondary_victimization` because the recruit is targeted as a downstream collaborator, not as a prior victim. A discriminator-clarification paragraph is added requiring evidence of a *prior fraud against the same victim* (not just sympathetic victim-status or downstream-enabling framing) before the overlap tag fires. Path C (hybrid -- negative example in ontology prose + reviewer-SOP cross-track post) chosen over Path A (negative-example only, no reviewer SOP) because reviewers have already been observed reading the false-positive overlap tag as load-bearing on case envelopes (see brief 0018 backfill on topic-label determinism, the precedent); Path B (reviewer-SOP-only, no prompt change) rejected because the noise materially clutters reviewer evidence panels at scale and an ontology-side clarification is portable across reviewer cohorts. Cross-track: **ops inbox post queued for a reviewer-SOP addendum** under `docs/ops/reviewer-sops/` clarifying when `secondary_victimization` should be discounted on review even if Stage 3 emits it. No engine change required for the doc-side phase 1 (Stage 3 may still over-emit; reviewer SOP carries the discounting rule until a future Stage 3 discriminator-wiring brief lands the negative-example prose into the engine -- queued as a candidate follow-up under the same amendment-log entry if production traffic shows the §3.5 prose-only clarification doesn't move Stage 3 behavior).

All three amendments are below the patch-bump threshold (no value added, removed, or renamed; one tightening of an existing bright-line precondition; one structural amendment to the unconditional-to-conditional shape of the forced-L2 mapping documented in §5 prose; one prose-to-label table extension) -- recorded as documentation discriminator clarifications, `ontology_version` remains 5.2. Phase 2 vscode work is scoped under the commit-bounce brief `handoff/board/pending/0061-vscode-commit-tier-1-p1-followups-ontology-amendments.md`. Per the standard Tier 1 P1 follow-up sequencing recorded under "Ontology 5.3 phase-1b additions" below, these three amendments ship surgically against current ontology 5.2 *first*; phase-1b vocabulary is the next phase after they close.

**Ontology 5.2 additions (2026-05-27, case-study Tier 1 bundled amendments):**

- Bright-line feature `realtime_synthetic_media_executive_impersonation` added to §5 (case 4 / Arup; case-study analysis 2026-06 §4.6 recommendation 1). Per §7 extension policy, adding a bright-line feature is a minor bump (5.1 -> 5.2).
- L3 `method:` (§3.1) values added: `realtime_synthetic_media` (case 4); `advance_fee_inheritance`, `advance_fee_lottery`, `advance_fee_customs`, `advance_fee_business_partnership`, `advance_fee_lawyer_fee` (case 3 / Black Axe pretext sub-vocabulary; case-study analysis 2026-06 §3.6).
- L3 `target:` (§3.3) value added: `affinity_community` (case 2 / CryptoFX; case-study analysis 2026-06 §2.6 recommendation 1).
- L3 `context_marker:` (§3.4) values added: `victim_list_purchased` (case 6 / MoneyBack; case-study analysis 2026-06 §6.6 recommendation 1) and `ai_pretext_claimed` (case 2 / CryptoFX; case-study analysis 2026-06 §2.6 recommendation 2).
- L3 `overlap:` (§3.5) value added: `secondary_victimization` (case 6 / MoneyBack; case-study analysis 2026-06 §6.6 recommendation 2).
- All additions are non-breaking value extensions within existing L3 categories (per §7, "Adding a value within an existing L3 category ... is a non-breaking ontology change"); the bright-line addition is what drives the minor bump 5.1 -> 5.2 (per §7, "Adding or removing a bright-line feature is a minor change").
- **Schema bump decision:** none. These are vocabulary additions (closed-set values + one new bright-line code) and do not change the envelope shape. `schema_version` remains 5.2 (or whatever the current schema version is post-prior bumps; this amendment does not interact with `docs/07-v5-schema.md`'s envelope contract). The `ontology_version` field in emitted envelopes bumps 5.1 -> 5.2 once phase 2 vscode rolls the engine constant.
- Cross-references: prose-to-label mappings inline in §3.1 (advance-fee + realtime-synthetic-media), §3.3 (affinity_community), §3.4 (victim_list_purchased + ai_pretext_claimed), §3.5 (secondary_victimization). Tooltip descriptors are the table-row definitions in each closed-set table. Classifier-guidance discriminator detail for the advance-fee pretext sub-vocabulary is in `docs/05-classifier-guidance.md` §3.

**Ontology 5.3 phase-1b additions (2026-05-27, four-dimension ontology separation -- vocabulary only):**

- §3.4 `context_marker:` extended with 10 channel-origin values (`dating_app_origin`, `social_media_dm_origin`, `unsolicited_sms_origin`, `unsolicited_email_origin`, `cold_call_origin`, `marketplace_listing_origin`, `professional_network_origin`, `in_app_chat_origin`, `referred_by_third_party`, `community_or_affinity_origin`). Existing 11 framing-claim values retained. Scope note added on the unified-category rationale.
- §3.9 `typology:` added as new L3 category. 18 values aligned with IC3 / FTC Imposter Scams conventions where alignment is clean; SafeEval-internal where the external taxonomies disagree or omit. Single-valued. Includes external-taxonomy alignment table cross-referencing IC3 Crime Type codes and FTC Consumer Sentinel categories per `docs/memos/2026-05-27-four-dimension-ontology-separation.md` §2.2.
- §3.10 `persona:` added as new L3 category. 16 values for the attacker's identity claim, orthogonal to typology / pretext / channel. Single-valued. Persona-shaped values from the legacy PRETEXT_LABELS migrate here.
- §3.11 prompt-summary `pretext:` vocabulary reshape. 17 rationale-only values replace the legacy PRETEXT_LABELS persona-mixed vocabulary. Schema shape unchanged; managed dual-emit window (90 days) per the source memo's §11.3.
- Per §7 extension policy: adding new L3 categories (`typology:`, `persona:`) is a minor breaking change (5.x -> 5.x+1). Extending a closed set within an existing category (`context_marker:` channel additions) is non-breaking. Reshaping PRETEXT_LABELS is technically a value-rename (major break per §7) but treated as a minor under managed dual-emit per the policy precedent in `docs/memos/2026-05-26-policy-v5-classifier-display-vocabulary.md` (seven new closed sets absorbed at a minor bump). The dual-emit precedent is recorded explicitly in the source memo's §8.1 Adjudication of §8.4.
- **Schema bump decision:** `schema_version` unchanged. `ontology_version` bumps 5.2 -> 5.3 once phase 3 vscode rolls the engine constant in `src/lib/safeeval-v5.js`. The vocabulary documented here is the contract phase 3 will land.
- **Phase 3 scope (forward reference):** engine constants (`TYPOLOGY_LABELS`, `PERSONA_LABELS`, `PRETEXT_LABELS_V53`, extended `CONTEXT_MARKER_VALUES`); `L3_VALUES_BY_CATEGORY` extension to include `typology` and `persona`; lockstep validator extensions (five new check functions); JSON Schema validator; fixture migration (~50 fraud-shaped fixtures); result-card render reshape (deprecate PERSONA prose, add TYPOLOGY chip row, add CONTEXT chip row). Source memo §11 carries the full plan.
- **P1 follow-up sequencing:** the three credit-blocked P1 follow-ups (0035 BRIGHT_LINE_FORCED_L2 recovery-fraud drift; 0036 realtime-synthetic-media bright-line celebrity FP; 0037 `overlap:secondary_victimization` Stage 3 FP cleanup) ship surgically against current ontology 5.2 *first* (Path (a)(i) per source memo §8.1); Phase 1b vocabulary above is the next phase after they close.
- Cross-references: source memo `docs/memos/2026-05-27-four-dimension-ontology-separation.md` §§3, 8.1, 10, 11; decisions-log entry in `docs/policy-spec-v5.0.md` §9 Decision 18.

**Ontology 5.1 additions (2026-05-28, conversation evaluation):**

- L3 category `arc:` added (5 values: `trust_ramp`, `money_ask_pivot`, `contact_channel_jump`, `advisor_isolation`, `role_stability_breach`). See section 3.6.
- L3 category `cadence:` added (2 values: `always_available`, `escalation_compression`). See section 3.7.
- These additions are conversation-mode only and do not fire on single-prompt inputs. They were introduced concurrently with the conversation envelope (`docs/07-v5-schema.md` section 2.1) and the Stage 0 turn-segmentation pipeline stage. Policy source: `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md`.
- Per the extension policy above, adding a new L3 category is a minor bump (5.0 -> 5.1); two new categories at once is structurally equivalent for versioning purposes.

---

*Together with `docs/07-v5-schema.md` and `docs/policy-spec-v5.0.md`, this is the complete v5 specification surface. Round 2 will produce the engine (`safeeval-v5.js`) and JSON Schema validators that mirror these enums.*
