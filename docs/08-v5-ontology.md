# SafeEval v5 -- Ontology Reference

**Status:** Round 1 of v5 rollout. Mirrors the authoritative closed enums in `docs/policy-spec-v5.0.md`. v5.1 minor bump 2026-05-28: adds L3 categories `arc:` (5 values) and `cadence:` (2 values) for conversation evaluation per `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` section 5.
**Ontology version:** 5.1
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
| `money_mule_recruitment` | Recruitment language for money-mule operations. (Carry-forward from v4 sub-typology.) |
| `synthetic_identity_construction` | Construction of synthetic / blended identities for downstream fraud. (Carry-forward from v4.) |
| `fake_review_generation` | Generation of fabricated reviews / testimonials at scale. (Carry-forward from v4.) |

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

Context markers are *claims about framing*, not verified facts. They feed into disposition but do not override bright-line signals.

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

Note: `ai_model_impersonation` is intentionally both an L2 value (under `cyber_intrusion`) AND a bright-line feature code. The L2 names the risk pattern; the bright-line names the evidence signal. The duplication is intentional and the only such case in v5.0.

**Co-occurrence rule:** when the bright-line code `ai_model_impersonation` fires, the L2 MUST be `ai_model_impersonation` under L1 `cyber_intrusion`. This is the only case in the v5 ontology where a bright-line code and an L2 value share a string. The JSON Schema validator enforces this as a conditional (`if/then`) invariant. See `policy-spec-v5.0.md` Decision 9 for the rationale on keeping vs. renaming.

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

**Ontology 5.1 additions (2026-05-28, conversation evaluation):**

- L3 category `arc:` added (5 values: `trust_ramp`, `money_ask_pivot`, `contact_channel_jump`, `advisor_isolation`, `role_stability_breach`). See section 3.6.
- L3 category `cadence:` added (2 values: `always_available`, `escalation_compression`). See section 3.7.
- These additions are conversation-mode only and do not fire on single-prompt inputs. They were introduced concurrently with the conversation envelope (`docs/07-v5-schema.md` section 2.1) and the Stage 0 turn-segmentation pipeline stage. Policy source: `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md`.
- Per the extension policy above, adding a new L3 category is a minor bump (5.0 -> 5.1); two new categories at once is structurally equivalent for versioning purposes.

---

*Together with `docs/07-v5-schema.md` and `docs/policy-spec-v5.0.md`, this is the complete v5 specification surface. Round 2 will produce the engine (`safeeval-v5.js`) and JSON Schema validators that mirror these enums.*
