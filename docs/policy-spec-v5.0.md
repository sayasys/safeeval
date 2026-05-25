# SafeEval Policy Spec v5.0

**Status:** Authoritative spec. v5.0.1 patch applied 2026-05-24 (decisions 11-14 added; Section 6 expanded; Stage 5 removed).
**Schema version:** 5.0.1
**Ontology version:** 5.0
**Predecessor:** FAF v4.0 (see `src/lib/safeeval.js` and v4 docs).
**Companion docs:** `docs/07-v5-schema.md` (envelope description), `docs/08-v5-ontology.md` (vocabulary reference).

This spec is ASCII-only by policy. The engine mirrors the CONST block in section 1 into a JS config; the JSON Schema validator mirrors the closed enums into `tests/schema/v5-envelope.schema.json`. Both consume the same source: this file.

---

## 0. How to use this spec

- Section 1 (CONST block) is the canonical list of thresholds. Mirror to JS as a config object.
- Section 2 is the L1 closed enum. Mirror to JS as `L1_VALUES`.
- Section 3 is the L2-by-L1 map. Mirror to JS as `L2_BY_L1` (object literal in section 7 is copy-paste ready).
- Section 4 is the L3 categorized vocabulary. Mirror to JS as `L3_CATEGORIES`, `L3_VALUES_BY_CATEGORY`.
- Section 5 is the bright-line enum. Mirror to JS as `BRIGHT_LINE_FEATURES`.
- Section 6 is the disposition verb enum. Mirror to JS as `DISPOSITION_ACTIONS`.
- Section 7 is the L1-to-L2 constraint table, copy-paste ready.
- Section 8 is the v4-to-v5 mapping table. Mirror to JS as `V4_TO_V5_MAP`.
- Section 9 is the decisions log -- one short entry per resolved policy decision.
- Section 10 is deferred work.

---

## 1. CONST block (mirror into a JS config)

All thresholds are externalized. Policy changes here do not require engine code changes; engine reads from a single config block. (Decision 4 resolution: thresholds in a config block, not embedded in policy logic.)

```
# Disposition rule thresholds
AGGREGATE_BLOCK_THRESHOLD         = 10    # aggregate_score >= 10 forces block
AGGREGATE_ALLOW_THRESHOLD         = 3     # aggregate_score <= 3 AND l1=benign forces allow
COMPONENT_MAX_VALUE               = 3     # component score max (0..3)
COMPONENT_COUNT                   = 5     # target, lure, trust, extract, evade
AGGREGATE_MAX                     = 15    # 5 components * 3

# Triage short-circuit (Stage 1)
TRIAGE_BENIGN_CONFIDENCE_MIN      = 0.92  # short-circuit allow at this threshold
TRIAGE_RISK_MARKERS_MAX           = 0     # short-circuit only when zero risk markers in coarse context

# Classifier confidences (Stage 3)
L1_CONFIDENCE_MIN                 = 0.50  # below this, l1 is reported but flagged uncertain
L2_CONFIDENCE_MIN                 = 0.50
L3_EMIT_CONFIDENCE_MIN            = 0.50  # L3 tags below this are filtered before emission
L2_HUMAN_REVIEW_THRESHOLD         = 0.60  # l2 below this routes to human_review

# Triage precision gate (Stage 1)
TRIAGE_BENIGN_PRECISION_MIN       = 0.98  # required Haiku precision on benign classification
                                          # before Stage 1 short-circuit is permitted. Measured by
                                          # scripts/measure-haiku-precision.js. See Decision 12.

# Triage observability
TRIAGE_OBSERVABILITY_SAMPLE_RATE  = 0.10  # fraction of Stage 1 short-circuited ALLOW outputs that
                                          # are flagged in the trace for offline re-evaluation.
                                          # Sampling is deterministic on a stable prompt hash so
                                          # the same prompt always samples the same way.

# Sub-typology / L2-prob display
SUB_TYPOLOGY_API_THRESHOLD        = 0.60  # API emits sub-typology analysis above this
SUB_TYPOLOGY_DISPLAY_THRESHOLD    = 0.65  # UI shows sub-typologies above this (carry-forward from v4)

# Risk-marker escalation
RISK_MARKER_REVIEW_COUNT          = 2     # >= 2 risk markers forces at least human_review

# Validation
REASONING_SUMMARY_MAX_CHARS       = 280
PROMPT_LENGTH_MIN                 = 10
PROMPT_LENGTH_MAX                 = 5000

# Pipeline trace exposure
PIPELINE_TRACE_DEFAULT            = "off"  # default off; ?debug=1 returns trace (Decision 5)
```

Implementation note: these are exported as a single `POLICY_CONFIG` object from `src/lib/safeeval-v5.js`. The disposition engine and the UI both read from this object. Changing a number here must NOT require touching engine logic.

---

## 2. L1 vocabulary (closed, 7 values, mutually exclusive)

L1 answers: *what space is this prompt in?* Exactly one L1 per prompt.

| Value | Definition |
|---|---|
| `benign` | No meaningful abuse risk. Customer support, general info, education, creative writing, factual research. |
| `security_education` | Defensively-framed content: awareness training, fraud-pattern explainers, blue-team education. Stated purpose is to help defenders or potential victims. |
| `ambiguous_dual_use` | Could be defensive or offensive depending on actor and authorization. Reserved for borderline-authorized cases; for clear multi-vector attacks pick the primary harm vector. |
| `deceptive_fraud` | Content whose purpose is to deceive a victim into transferring money, goods, services, or trust. Harm vector is the victim's voluntary action under false pretenses. |
| `privacy_abuse` | Content targeting credentials, accounts, personal data, or surveillance of individuals. Harm vector is breach of an identity or account boundary. |
| `platform_abuse` | Manipulation of platform mechanics for unfair gain or evasion (multi-accounting, promo abuse, reputation laundering, automation, ban evasion). |
| `cyber_intrusion` | Content enabling technical attacks on systems, AI models, or infrastructure (prompt injection, jailbreak framing, malware, model impersonation). |

Engine mirror: `L1_VALUES = ["benign","security_education","ambiguous_dual_use","deceptive_fraud","privacy_abuse","platform_abuse","cyber_intrusion"]`.

---

## 3. L2-by-L1 vocabulary (closed, scoped by L1)

L2 answers: *within this domain, what is the primary risk pattern?* Each L1 has its own allowed L2 set; no L2 value is valid under more than one L1.

### 3.1 L1 = `benign`

| L2 value | Definition |
|---|---|
| `no_risk_pattern` | Default benign L2. No identifiable risk pattern. |
| `customer_support_inquiry` | Help-desk style questions about a product or service. |
| `general_information` | General-knowledge questions, factual lookups. |
| `creative_writing` | Fiction, creative prose, poetry, narrative content. |
| `educational_inquiry` | Tutorial / how-to / explainer requests on non-sensitive topics. |

### 3.2 L1 = `security_education`

| L2 value | Definition |
|---|---|
| `phishing_awareness` | Content that helps users recognize phishing attempts. |
| `malware_education` | Defensive explainers about malware behavior and indicators. |
| `fraud_pattern_research` | Analytical or research-oriented examination of fraud techniques for defense. |
| `defensive_simulation_authorized` | Explicit authorized red-team / blue-team simulation requests with clear authorization framing. |
| `victim_support` | Content addressed to a victim of fraud or abuse, including recovery guidance, scammer-identification help, dispute paths, and emotional support for victims actively being scammed. Broader than recovery_guidance alone -- also covers active-scam victims and dispute help. (Decision 8.) |

### 3.3 L1 = `ambiguous_dual_use`

| L2 value | Definition |
|---|---|
| `borderline_security_research` | Could be defensive research or offensive recon depending on actor. |
| `borderline_red_team` | Plausibly authorized adversarial testing but lacks clear authorization framing. |
| `borderline_journalism` | Investigative / journalistic framing on fraud or abuse topics. |
| `borderline_education_request` | Educational framing on dual-use content where intent cannot be confirmed. |

### 3.4 L1 = `deceptive_fraud`

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

### 3.5 L1 = `privacy_abuse`

| L2 value | Definition |
|---|---|
| `credential_theft` | Phishing or social-engineering to extract usernames, passwords, MFA codes, session tokens. (Decision 1: credential-targeting phishing lives here, not under `deceptive_fraud`.) |
| `account_takeover` | Direct ATO methods: credential stuffing, SIM swapping, social-engineering account recovery resets. |
| `private_data_misuse` | Illicit personal-data lookups, illegal background checks, data-broker abuse. |
| `doxxing_or_stalking` | Aggregation and exposure of personal information for harassment or surveillance. |

### 3.6 L1 = `platform_abuse`

| L2 value | Definition |
|---|---|
| `promotion_abuse` | Coupon abuse, referral abuse, trial abuse. |
| `multi_accounting` | Operating multiple accounts to evade per-account limits or amplify benefits. |
| `reputation_manipulation` | Fake reviews / testimonials / engagement on platforms where reputation drives outcomes. |
| `automation_botting` | Automated / scripted abuse: scraping, scalping, automated form submission, bot networks. |
| `ban_evasion` | Returning to a platform after being banned via new identifiers, devices, or accounts. |

### 3.7 L1 = `cyber_intrusion`

| L2 value | Definition |
|---|---|
| `credential_harvesting_infra` | Infrastructure for capturing credentials at scale: phishing kits, harvesting backends, OTP relay infrastructure. |
| `malware_distribution` | Distribution mechanisms for malicious software. |
| `prompt_injection_attack` | Prompt-injection payloads targeting LLM-based systems. (Decision 2: split out from v4 umbrella.) |
| `model_jailbreak` | Jailbreak framings designed to bypass model safety guardrails. (Decision 2.) |
| `ai_model_impersonation` | Impersonation of named AI models or AI-product brands for downstream fraud or trust manipulation. (Decision 2.) |

---

## 4. L3 vocabulary (open, multi-valued, categorized via `prefix:value`)

L3 answers: *what specific facts apply to this prompt?* Every L3 tag has the form `<category>:<value>`. The six categories are stable; values within each category are extensible (see Section 11 extension policy).

L3 categories: `method`, `tactic`, `target`, `context_marker`, `overlap`, `risk_marker`.

### 4.1 `method` -- how the attack works mechanically

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
| `money_mule_recruitment` | Recruitment language for money-mule operations. |
| `synthetic_identity_construction` | Construction of synthetic / blended identities for downstream fraud. |
| `fake_review_generation` | Generation of fabricated reviews / testimonials at scale. |

### 4.2 `tactic` -- psychological lever (maps to FAF `Trigger`)

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

### 4.3 `target` -- who or what is being targeted

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

### 4.4 `context_marker` -- request framing (independent of method)

Context markers are *claims about framing*, not verified facts. They feed disposition but do not override bright-line signals.

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

### 4.5 `overlap` -- cross-typology enablement

| Value | Definition |
|---|---|
| `account_takeover_enablement` | Enables downstream ATO. |
| `payment_fraud_enablement` | Enables downstream payment fraud. |
| `identity_fraud_enablement` | Enables downstream identity fraud. |
| `money_laundering_overlap` | Touches money-laundering mechanics. |
| `content_moderation_overlap` | Overlaps with content-policy concerns beyond fraud. |
| `extortion_overlap` | Overlaps with extortion / threats. |
| `csam_adjacency` | Adjacent to CSAM concerns (always triggers escalated review). |

### 4.6 `risk_marker` -- escalating signals

Risk markers bias toward `human_review` or `block`. Per Section 1 CONST, two or more risk markers force at least `human_review`.

| Value | Definition |
|---|---|
| `deceptive_effectiveness_requested` | Prompt explicitly asks for the output to deceive its target effectively. |
| `anti_detection_requested` | Prompt asks for evasion of detection / filters. |
| `scale_enablement_requested` | Prompt asks for output suitable for high-volume / templated use. |
| `specific_victim_targeted` | Prompt names or describes a specific identifiable victim. |
| `authorization_unverifiable` | Authorization claim is present but cannot be verified from the prompt alone. |
| `payment_instruction_embedded` | Prompt embeds specific payment / wire / crypto instructions. |

### 4.7 L3 format and emission rules

- Every L3 entry MUST match the regex `^(method|tactic|target|context_marker|overlap|risk_marker):[a-z_]+$`.
- L3 entries SHOULD NOT duplicate (same `value`). Engine deduplicates and keeps highest-confidence instance.
- L3 entries with confidence < `L3_EMIT_CONFIDENCE_MIN` (0.50) are filtered before emission.
- Reviewer-instruction tags (e.g., `human_review_recommended`) are forbidden. That belongs on `disposition.action`.

---

## 5. Bright-line feature codes (closed enum)

Bright lines are enumerated, high-confidence indicators that automatically force `disposition.action = "block"` regardless of aggregate score. They live in `evidence.bright_lines` and are referenced from `disposition.triggered_by.bright_lines`.

The 13 v4 features are carried forward intact. v5 adds one: `mfa_or_otp_harvesting` (split out from the implicit coverage in v4's `credential_harvesting_page`). Total: 14.

| Feature | Definition |
|---|---|
| `fake_regulatory_document` | Fabricated official / regulatory document (e.g., fake SEC letter, fake court order). |
| `executive_impersonation_payment` | Impersonation of a corporate executive paired with a payment request. |
| `government_impersonation_payment` | Impersonation of a government official / agency paired with a payment request. |
| `family_impersonation_payment` | Impersonation of a family member paired with a payment request. |
| `bank_evasion_script` | Script to coach a victim past their bank's fraud-prevention questions. |
| `bulk_fake_reviews_financial` | Bulk fake reviews for a financial product or service. |
| `detection_evasion_explicit` | Explicit request to evade fraud-detection systems. |
| `structuring_guidance` | Guidance on structuring transactions to evade reporting thresholds. |
| `money_mule_job_posting` | Job posting designed to recruit money mules. |
| `credential_harvesting_page` | Functional credential-harvesting web page. |
| `account_takeover_script` | Script to execute account takeover via social engineering. |
| `ai_model_impersonation` | Material impersonating a specific named AI model or brand. |
| `prompt_injection_payload` | Working prompt-injection payload designed to override an LLM's safety behavior. |
| `mfa_or_otp_harvesting` | (New in v5) Page or workflow for harvesting MFA / OTP codes. Was implicit in v4's `credential_harvesting_page`; v5 splits it out. |

Implementation note: `ai_model_impersonation` appears as BOTH an L2 value (under `cyber_intrusion`) AND a bright-line feature code. This is intentional and the only such overlap. The L2 names the risk pattern; the bright-line names the evidence signal. The JSON Schema validator does not error on this duplication.

**Co-occurrence rule:** the bright-line code `ai_model_impersonation` and the L2 value `ai_model_impersonation` are intentionally the same string. When the bright line fires, the L2 MUST be `ai_model_impersonation` (under L1 `cyber_intrusion`). This is the only case in the v5 ontology where a bright-line code and an L2 value share a string. The JSON Schema validator enforces this as a conditional (`if/then`) invariant. (Decision 9.)

---

## 6. Disposition verb vocabulary (closed, 4 values)

These four verbs are the only legal values for `disposition.action`. They never appear in L1, L2, or L3.

| Value | When to emit | `safe_completion_guidance` |
|---|---|---|
| `allow` | Clearly benign, no abuse risk, no dual-use ambiguity. | `null` |
| `safe_completion` | Benign or educational request that touches dual-use content. Respond, but frame defensively. | Short string describing framing constraints. |
| `human_review` | Ambiguous, high-impact, or possibly-authorized requests needing human adjudication. | `null` (reviewer reads `reasoning_summary` + `triggered_by`). |
| `block` | Direct enablement of fraud, credential theft, ATO, payment abuse, identity fraud, or other deceptive harm. | `null` |

Engine mirror: `DISPOSITION_ACTIONS = ["allow","safe_completion","human_review","block"]`.

### 6.1 Deterministic disposition rule order

The engine applies these rules in order. The first rule that fires wins. Rule names are recorded in `disposition.triggered_by.rules`. The engine implementation lives in `applyDeterministicRules()` in `src/lib/safeeval-v5.js`; this list is the lockstep contract -- when the code adds, removes, or reorders a rule, this section updates in the same change.

1. Any value in `evidence.bright_lines` -> `block`. Rule: `bright_line_forces_block`. **Non-negotiable: no downstream stage may downgrade a bright-line block.** `disposition.triggered_by.bright_lines` enumerates the matched features and `disposition.triggered_by.policy_note` records the non-negotiability for the audit trail. (Decision 11.)
2. `evidence.aggregate_score >= AGGREGATE_BLOCK_THRESHOLD` -> `block`. Rule: `high_aggregate_score`.
3. `classification.l1.value == "ambiguous_dual_use"` -> `human_review`. Rule: `ambiguous_l1_requires_review`.
4. `classification.l1.value == "security_education"` AND no bright lines -> `safe_completion`. Rule: `security_education_safe_completion`.
5. Count of `classification.l3[]` entries with `category == "risk_marker"` >= `RISK_MARKER_REVIEW_COUNT` AND no bright lines -> `human_review`. Rule: `multi_risk_marker_review`.
6. `classification.l2.confidence < L2_HUMAN_REVIEW_THRESHOLD` -> `human_review`. Rule: `low_l2_confidence_review`.
7. `evidence.aggregate_score <= AGGREGATE_ALLOW_THRESHOLD` AND `l1.value == "benign"` -> `allow`. Rule: `low_score_benign_allow`.
8. Otherwise the disposition model adjudicates, filling `reasoning_summary`. Rule: `model_adjudicated`.

Implicit fallback (not numbered because it is not a policy rule, it is a failure-mode behavior): when the Stage 4 model call itself fails after a rule has already decided, the engine returns the rule-derived action with `reasoning_summary = "Model unavailable; rule-derived disposition."` and adds `validation_fallback` to `disposition.triggered_by.rules` only when no rule had decided. Bright-line-decided cases never fall through to the fallback because rule 1 fires before the model is invoked for content reasoning.

### 6.2 Disposition action semantics (Decision 14)

`disposition.action` is a verb, not a tier. Each verb has named operational semantics that downstream consumers (UI, reviewer queue, dual-emit translator) read from:

```
allow            -- Grant request. No constraints. Used for clearly-benign traffic.
safe_completion  -- Grant request with framing constraints. Respond defensively;
                    do not produce a directly weaponizable artifact. The
                    `safe_completion_guidance` field carries the specific framing
                    constraint, branched by L1:
                      * L1 = security_education  -> assume authorized defensive
                        use; respond pedagogically with explicit defender framing.
                      * Else (dual-use)          -> respond defensively; do not
                        produce a working artifact (template, page, script).
human_review     -- Route to abuse review queue. Human decides. Reviewer reads
                    `reasoning_summary`, `narrative_summary`, and `triggered_by`.
block            -- Deny request. Return policy explanation. When `triggered_by`
                    names bright_lines, the block is non-negotiable.
```

The engine mirrors these semantics into `DISPOSITION_SEMANTICS` in `safeeval-v5.js`. The branched `safe_completion_guidance` string is generated at Stage 4 based on `classification.l1.value`.

### 6.3 No adversarial review stage (Decision 11)

v5.0 reserved a Stage 5 adversarial-review slot. v5.0.1 removes it. The calibration role Stage 5 was filling is covered by rule 6 (`low_l2_confidence_review`), which deterministically routes Stage 3 outputs below `L2_HUMAN_REVIEW_THRESHOLD` to human_review without a second model call. If post-traffic analysis surfaces a wrong-action rate on `model_adjudicated` cases worth re-arguing, the next iteration adds offline sampling-based review, not an inline pipeline stage. See decisions log entry 11.

---

## 7. L1 -> L2 constraint table (copy-paste ready)

This block is the source of truth for `L2_BY_L1` in the engine. Order is stable.

```
L2_BY_L1 = {
  "benign": [
    "no_risk_pattern",
    "customer_support_inquiry",
    "general_information",
    "creative_writing",
    "educational_inquiry"
  ],
  "security_education": [
    "phishing_awareness",
    "malware_education",
    "fraud_pattern_research",
    "defensive_simulation_authorized",
    "victim_support"
  ],
  "ambiguous_dual_use": [
    "borderline_security_research",
    "borderline_red_team",
    "borderline_journalism",
    "borderline_education_request"
  ],
  "deceptive_fraud": [
    "romance_fraud",
    "investment_fraud",
    "advance_fee_fraud",
    "phishing_attack",
    "impersonation_scam",
    "recovery_fraud",
    "fraud_infrastructure",
    "marketplace_fraud",
    "refund_payment_fraud",
    "identity_fraud"
  ],
  "privacy_abuse": [
    "credential_theft",
    "account_takeover",
    "private_data_misuse",
    "doxxing_or_stalking"
  ],
  "platform_abuse": [
    "promotion_abuse",
    "multi_accounting",
    "reputation_manipulation",
    "automation_botting",
    "ban_evasion"
  ],
  "cyber_intrusion": [
    "credential_harvesting_infra",
    "malware_distribution",
    "prompt_injection_attack",
    "model_jailbreak",
    "ai_model_impersonation"
  ]
}
```

Validation rule: `classification.l2.value` MUST be in `L2_BY_L1[classification.l1.value]`. Engine enforces this after model emission; violations downgrade `disposition.action` to `human_review` with rule `validation_fallback`.

---

## 8. v4 -> v5 mapping table (authoritative)

The engine consumes this as `V5_TO_V4_TYPOLOGY` (inverse map) for the dual-emit window.

| v4.0 typology code | v5 L1 | v5 L2 | Notes |
|---|---|---|---|
| `ROMANCE` | `deceptive_fraud` | `romance_fraud` | Sub-types (Romance Fraud, Pig Butchering) move to L3 `method:` or `target:lonely_individual`. |
| `INVESTMENT` | `deceptive_fraud` | `investment_fraud` | Sub-types (Crypto Platform Fraud, Ponzi, Pump & Dump) move to L3 method tags. |
| `PHISHING` (BEC / payment-redirect) | `deceptive_fraud` | `phishing_attack` | Decision 1 split. Carry `L3 method:phishing`. |
| `PHISHING` (credential-targeting) | `privacy_abuse` | `credential_theft` | Decision 1 split. Carry `L3 method:phishing`. |
| `IMPERSONATION` | `deceptive_fraud` | `impersonation_scam` | Sub-types collapse to L3 `target:` and `tactic:authority`. |
| `ADVANCE_FEE` | `deceptive_fraud` | `advance_fee_fraud` | Direct map. |
| `FRAUD_INFRASTRUCTURE` | `deceptive_fraud` | `fraud_infrastructure` | Sub-types collapse to L3: `method:money_mule_recruitment`, `method:synthetic_identity_construction`, `method:fake_review_generation`. |
| `RECOVERY` | `deceptive_fraud` | `recovery_fraud` | Direct map; carry `L3 target:recent_fraud_victim`. |
| `ACCOUNT_TAKEOVER` | `privacy_abuse` | `account_takeover` | Domain shift from `deceptive_fraud` to `privacy_abuse`. ATO is about violating an account boundary, not deceiving a buyer. |
| `AI_ENABLED_ABUSE` (prompt injection) | `cyber_intrusion` | `prompt_injection_attack` | Decision 2 split. |
| `AI_ENABLED_ABUSE` (jailbreak) | `cyber_intrusion` | `model_jailbreak` | Decision 2 split. |
| `AI_ENABLED_ABUSE` (model impersonation) | `cyber_intrusion` | `ai_model_impersonation` | Decision 2 split. |
| `NONE` | `benign` | `no_risk_pattern` | Decision 3: NONE retires. `benign / no_risk_pattern` plays the role. |

### 8.1 v4 escalation_tier -> v5 disposition.action

| v4 tier | v5 action | Notes |
|---|---|---|
| `ALLOW` (no `disambiguation_note`) | `allow` | Direct map. |
| `ALLOW` (with `disambiguation_note` describing defensive framing) | `safe_completion` | The pattern v4 expressed via free-text note becomes a named action. |
| `REVIEW` | `human_review` | Verb-form rename. |
| `BLOCK` | `block` | Direct map (case change). |

---

## 9. Decisions log

Each entry resolves one open policy decision. Format: decision, resolution, one-sentence rationale.

### Decision 1 -- PHISHING split

- **Question:** Is the PHISHING split (across `deceptive_fraud` and `privacy_abuse`) worth the migration cost?
- **Resolution:** SPLIT. Phishing-for-money lives at `deceptive_fraud / phishing_attack`; credential phishing lives at `privacy_abuse / credential_theft`. Both carry `L3 method:phishing`.
- **Rationale:** Industry standard (Stripe Radar, Meta, Anthropic / OpenAI / Microsoft internal T&S taxonomies all split phishing by intent), and the L1 = "what space is this in" rule fails if BEC-for-wire and password-harvest sit in the same bucket -- they have different victims, different harm vectors, and different defensive playbooks.

### Decision 2 -- AI_ENABLED_ABUSE split

- **Question:** Does `AI_ENABLED_ABUSE` split into three L2 values or stay as one umbrella?
- **Resolution:** SPLIT into three L2s under `cyber_intrusion`: `prompt_injection_attack`, `model_jailbreak`, `ai_model_impersonation`.
- **Rationale:** Mature AI-abuse taxonomies distinguish by attack surface (system prompt boundary vs. model alignment vs. brand impersonation), and forcing them into one bucket loses the routing signal a downstream defender needs to pick the right mitigation.

### Decision 3 -- NONE retirement

- **Question:** Does `NONE` retire entirely, or remain as a degenerate L2 under `benign`?
- **Resolution:** RETIRE. `benign / no_risk_pattern` plays the role.
- **Rationale:** Keeping `NONE` as both a v4 typology code AND a v5 degenerate L2 would create two ways to express "this is fine," which is the kind of collision the v5 envelope exists to eliminate; the v4-to-v5 mapping table handles the legacy alias cleanly.

### Decision 4 -- Config-file thresholds

- **Question:** Move deterministic disposition thresholds into a config file so policy can change without engineering?
- **Resolution:** YES. All thresholds are declared in Section 1 CONST block of this spec and mirror into a single `POLICY_CONFIG` export in `safeeval-v5.js`.
- **Rationale:** Standard fraud-team hygiene -- policy reviewers should be able to tune block thresholds without touching engine code, and the bright-line vs aggregate-score vs L2-confidence machinery is exactly the kind of policy surface that drifts when buried in code.

### Decision 5 -- pipeline_trace default

- **Question:** Default-on or default-off for the full pipeline trace?
- **Resolution:** DEFAULT-OFF. `?debug=1` returns the trace; production responses omit `pipeline_trace` entirely (not nulled -- omitted).
- **Rationale:** Production T&S API convention is least-info-by-default (small response surface, lower payload, no accidental leakage of stage-internal reasoning into untrusted consumers); debug mode covers documentation and developer walkthrough use cases.

### Decision 6 -- Streaming UX

- **Question:** Streaming the pipeline to the UI -- in scope for v5, or v5.1?
- **Resolution:** DEFER to v5.1. The architecture supports it (each stage emits a discrete artifact, see schema doc section 5); ship as a separable concern after v5.0 lands.
- **Rationale:** Streaming is a UX layer over a stage-discrete pipeline -- it does not change the envelope or the ontology, so deferring it does not block the v5.0 cutover, and shipping the static pipeline first lets us calibrate before adding the UI complexity.

### Decision 7 -- Doc-first vs code-first

- **Question:** Does v5 need to be reflected back into stakeholder-facing docs before code changes?
- **Resolution:** DOC-FIRST. Round 1 (this round) ships `policy-spec-v5.0.md`, `07-v5-schema.md`, `08-v5-ontology.md`. Round 2 ships `safeeval-v5.js` plus JSON Schema validators. Existing v4 docs (`01-framework.md`, `03-master-policy.md`, `05-classifier-guidance.md`, threat models) stay at v4 until v5 ships in code, then migrate in a later round.
- **Rationale:** The intended audience for this work is fraud-policy reviewers, not engineers reading JS first -- the spec is the artifact they evaluate, so it has to be the first deliverable.

### Decision 8 (post-Round-1) -- victim_support L2 under security_education

- **Question:** Where does a prompt from a fraud victim asking for help (scammer identification, recovery, dispute paths, emotional support during an active scam) land in the L1/L2 vocabulary?
- **Resolution:** Add `victim_support` as a fifth L2 under `security_education`. Definition broader than recovery alone -- covers active-scam victims and dispute help in addition to post-fraud recovery guidance.
- **Rationale:** Industry standard in mature T&S taxonomies routes victim-facing content to a distinct response path (support / recovery vs. fraud detection); eval-harness golden prompt 09 had no clean L2 home in the original four security_education values. Non-breaking under the extension policy (adding an L2 under an existing L1 is minor; tracked for the next minor version when other changes accumulate -- 5.0 ships with the value already enumerated since it predates engine code in Round 2).

### Decision 9 (post-Round-1) -- ai_model_impersonation L2/bright-line co-occurrence

- **Question:** `ai_model_impersonation` appears as both an L2 value under `cyber_intrusion` AND a bright-line feature code. Rename one side, or document the rule?
- **Resolution:** Documented the intentional co-occurrence rather than renaming either side. When the bright line fires, the L2 MUST be `ai_model_impersonation` (under L1 `cyber_intrusion`). Enforced as a JSON Schema conditional (`if/then`) invariant.
- **Rationale:** Lower churn vs. renaming (which would force a v4-to-v5 map change and a bright-line vocabulary churn); the rule is enforceable as a JSON Schema invariant; the semantic "bright line forces this L2" is the clearest expression of the relationship.

### Decision 11 (v5.0.1) -- Stage 5 adversarial review removed

- **Question:** Stage 5 (adversarial review) can downgrade a bright-line block based on a counterargument; keep with guardrail, or remove?
- **Resolution:** REMOVE. Stage 5 is excised from `safeeval-v5.js`. Confidence-calibrated routing through the existing `low_l2_confidence_review` rule (Section 6.1 rule 6) plus the structured `triggered_by` artifact at Stage 4 cover the calibration role Stage 5 was filling.
- **Rationale:** A bright-line block being walked back by a re-argument breaks the policy contract that bright lines are non-negotiable; a guardrail patches the symptom while the stage's primary value (re-arguing borderlines) is already redundant with `low_l2_confidence_review`. Removing the stage is cheaper, more legible, and eliminates the audit artifact that reads as system inconsistency to reviewers. If post-traffic data shows model_adjudicated cases have a wrong-action rate, the next iteration adds offline sampling review, not an inline pipeline stage.

### Decision 12 (v5.0.1) -- Haiku Stage 1 precision gate is runnable

- **Question:** Stage 1's benign short-circuit depends on Haiku precision being above the gate threshold; document the requirement only, or ship a runnable check?
- **Resolution:** RUNNABLE. `scripts/measure-haiku-precision.js` computes Haiku's false-negative rate on a labeled JSONL dataset and prints pass/fail against `POLICY_CONFIG.TRIAGE_BENIGN_PRECISION_MIN` (default 0.98). A seed dataset ships at `data/haiku-precision-seed.jsonl`.
- **Rationale:** A precision claim without a way to test it is a load-bearing assertion with no support, and this repo already establishes the pattern (`scripts/check-lockstep.js`) of claim-in-docs + script-that-checks-claim. The seed dataset is a worked example; downstream users can swap in larger label sets without changing the harness.

### Decision 13 (v5.0.1) -- Disposition output gains narrative layer; structured layer preserved

- **Question:** Add a stakeholder-readable narrative to `disposition` output; collapse the existing structured fields into prose, or keep both?
- **Resolution:** PARTIAL ADOPT. Add `disposition.narrative_summary` (up to 600 chars) and `disposition.confidence_path` (a string showing the per-stage confidence climb: e.g. `"triage:0.87 -> faf:0.92 -> classify:0.91 -> disposition:0.99"`). Do NOT collapse `triggered_by`, `bright_lines`, `l2_probabilities` -- those remain as separate structured fields.
- **Rationale:** Two audiences read this output -- a reader skimming for system legibility and a reviewer auditing a specific call. Prose helps the first and hurts the second; structured fields do the opposite. Shipping both layers serves both audiences without breaking the v5 envelope shape. `confidence_path` specifically demonstrates how the system's confidence evolves across stages, which maps to the precision/recall tradeoff signal a fraud-policy reviewer expects.

### Decision 14 (v5.0.1) -- `safe_completion` semantics named and branched by L1

- **Question:** `safe_completion` is a disposition verb but its operational semantics ("respond defensively" vs. "respond pedagogically with defender framing") are undefined in v5.0. Define implicitly via free-text guidance, or name explicitly?
- **Resolution:** NAME EXPLICITLY. Section 6.2 declares the operational semantics of all four disposition verbs. The `safe_completion_guidance` string is branched by `classification.l1.value`: `security_education` -> "assume authorized defensive use; respond pedagogically"; otherwise -> "respond defensively; do not produce a working artifact." Engine mirrors this as `DISPOSITION_SEMANTICS` in `safeeval-v5.js`.
- **Rationale:** Verbs that downstream consumers depend on must have named semantics or they drift. The L1 branch is the smallest, clearest split that captures the actual policy difference (security_education is authorized defender framing; ambiguous_dual_use is conservative defender framing). Free-text guidance was the v5.0 placeholder; v5.0.1 promotes it to a structured policy with audit-trail visibility.

### Decision 15 (post-v5.0.1) -- Fake reviews route to `platform_abuse / reputation_manipulation`, not `deceptive_fraud / fraud_infrastructure`

- **Question:** Fake-review generation (including the `bulk_fake_reviews_financial` bright line) is described in v4 docs as a Fraud Infrastructure typology (docs 03 Section 3.6, 05 Section 2.3). Under the v5 L1 vocabulary (mapping doc Section 2), `platform_abuse` explicitly covers "reputation laundering," which is what bulk fake-review generation is. Does fake-review content route to `deceptive_fraud / fraud_infrastructure` or `platform_abuse / reputation_manipulation`?
- **Resolution:** `platform_abuse / reputation_manipulation`. The L1 selection rule from mapping doc Section 2 is decisive: `platform_abuse` is "manipulation of platform mechanics for unfair gain or evasion (multi-accounting, promo abuse, **reputation laundering**, automation, ban evasion)." Bulk fake reviews on a marketplace or financial product manipulate platform mechanics for unfair gain; the platform is the victim, not an individual deceived into transferring money. `fraud_infrastructure` under `deceptive_fraud` is reserved for supply-side enablement of victim-facing fraud (money mule recruitment, synthetic identity construction). The `bulk_fake_reviews_financial` bright line still fires under the new routing -- `BRIGHT_LINE_FORCED_L2['bulk_fake_reviews_financial']` already includes both `fraud_infrastructure` and `reputation_manipulation` (line 272 of `safeeval-v5.js`), so engine code requires no change for this decision alone.
- **Rationale:** Two reasons. First, lockstep: doc 02 Section 2's L1 definitions are the v5 authority; allowing v4 docs (which use FRAUD_INFRASTRUCTURE as a typology bucket that includes fake reviews) to silently override is exactly the cross-surface drift v5's lockstep regime is designed to prevent. Second, harm vector: `deceptive_fraud` is defined by "victim's voluntary action under false pretenses" -- a single victim transferring money. Bulk fake reviews do not have a single victim; they degrade marketplace trust for many parties simultaneously. The harm shape matches `platform_abuse`, not `deceptive_fraud`. Migration cost is low: v4 docs are unchanged per Decision 7 (they migrate in a coordinated pass when v5 ships in production); the v5 mapping doc, the v5 classifier guidance Section 7 (Version Notes), and the v5 golden suite are the surfaces that align with this decision now.

### Decision 10 (post-Round-1) -- Borderline-L2 split deferred

- **Question:** Should the `ambiguous_dual_use` L2 vocabulary grow a fifth value (`borderline_pretext_request`) to cover pretext-style requests that the four current borderlines do not fit cleanly?
- **Resolution:** DEFER. Borderline L2 vocabulary stays at 4 values for v5.0. If eval-harness or production traffic shows pretext-request misclassification, `borderline_pretext_request` can be added in v5.x per the non-breaking extension policy (Section 11).
- **Rationale:** eval-harness golden prompts 07 and 08 currently use `borderline_security_research` as the closest fit. That is acceptable for v5.0 ship; adding a fifth value pre-emptively risks a vocabulary that does not match what real traffic actually surfaces. Revisit after Round 2 eval data.

---

## 10. Deferred / out of scope

### 10.1 Schema validators

- JSON Schema validators for the v5 envelope. The shape is fixed (see `docs/07-v5-schema.md` and section 7 of this spec).
- Engine-enforced validation behaviors (`validation_fallback` rule, `mfa_or_otp_harvesting` -> L2 mandatory subset, etc.) -- this spec names the rules; the validator at `tests/schema/v5-envelope.schema.json` translates the expressible ones into JSON Schema constraints.

### 10.2 v4 doc migration

- `docs/01-framework.md`, `docs/03-master-policy.md`, `docs/05-classifier-guidance.md`, and `docs/threat-models/*.md` still reference v4 typology codes. They migrate to v5 vocabulary in a coordinated pass once v5 has served production traffic.

### 10.3 To later rounds

- Streaming UX (Decision 6) -- v5.1.
- Offline calibration sampling of `model_adjudicated` Stage 4 outputs. Replaces the role v5.0 reserved for an inline Stage 5; landing approach (sampling cadence, storage, replay harness) is unscoped pending v5.0.1 traffic. See Decision 11.
- `risk_marker -> escalation_signal` L3 rename. Approved in principle; deferred to v5.1 pending alignment on whether to break the L3 vocabulary pre- or post-engine-traffic. See Section 11 extension policy.
- Whether the `ai_model_impersonation` overlap between L2 and bright-line should be renamed on either side (currently kept as-is for v4 carry-forward compatibility -- see Section 5 note).

---

## 11. Ontology extension policy

- Adding a value within an existing L3 category is non-breaking. Patch bump (5.0 -> 5.0.1).
- Adding a new L3 category is minor breaking. Minor bump (5.0 -> 5.1) and `ontology_version` update.
- Adding a new L1 value is major breaking. Major bump (5.0 -> 6.0).
- Adding a new L2 under an existing L1 is minor breaking (5.0 -> 5.1).
- Removing or renaming any value is major breaking.
- Adding or removing a bright-line feature is minor breaking (5.0 -> 5.1).
- Adding a disposition verb is major breaking.

`ontology_version` ships on every response so consumers can detect drift.

---

*End of spec. The engine and the JSON Schema validator both consume this file as a contract; this spec MUST be updated in lockstep with any L1, L2, L3, bright-line, disposition, or threshold change.*
