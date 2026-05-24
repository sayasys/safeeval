# Classifier Guidance: Policy-to-Technical Translation
**SafeEval . Document 05 of 06**
*Version 3.0 -- May 2026*

---

## 1. Purpose

This document translates the Fraud & Scams Policy (doc 03) and Enforcement Design (doc 04) into concrete technical artifacts for ML and Engineering teams building fraud detection classifiers. It defines the label taxonomy, feature definitions, training signal rationale, and ground truth labeling methodology used in the seed dataset (data/seed-prompts.json).

This document is the **primary interface between the policy team and the classifier team**. When policy changes (new rules, recalibrated signals), this document is updated first, and classifier updates follow.

---

## 2. Label Taxonomy

Every prompt in the training dataset carries two label types:

### 2.1 Escalation Tier Label
```
ALLOW         -- No fraud signals; legitimate use confirmed
REVIEW        -- Ambiguous; human judgment required
BLOCK         -- Clear policy violation; auto-block appropriate
```

### 2.2 Component Activation Labels
For each of the five FAF components, a score of 0-3:
```
target_score:   0-3   (START: Target component activation)
lure_score:     0-3   (START: Topic + PROCESS -> Psychological: Perceived Benefit activation)
trust_score:    0-3   (START: Persona + PROCESS -> Psychological activation)
extract_score:  0-3   (END: Objective activation)
evade_score:    0-3   (PROCESS -> Execution: Detection Evasion activation)
```

### 2.3 Typology Label

The taxonomy covers 10 active typologies. Each prompt receives exactly one primary typology label; when multiple typologies are active, the primary typology is the one with the highest aggregate FAF score. Secondary typologies are noted in the rationale field but do not produce a separate label.

```
ROMANCE          -- Romance fraud / pig butchering              [Relationship-Based]
INVESTMENT       -- Investment fraud / fake platforms            [Investment & Opportunity]
PHISHING         -- Phishing / spearphishing / BEC              [Credential & Access]
IMPERSONATION    -- Impersonation scams                         [Authority & Impersonation]
ADVANCE_FEE      -- Advance fee / 419 fraud                     [Investment & Opportunity]
MONEY_MULE       -- Money mule recruitment                      [Fraud Infrastructure]
SYNTHETIC_ID     -- Synthetic identity / fake reviews           [Fraud Infrastructure]
RECOVERY         -- Recovery fraud / secondary victimization    [Recovery Fraud]
ACCOUNT_TAKEOVER -- Account takeover via credential theft, SIM swap, or social engineering [Account Takeover]
AI_ENABLED_ABUSE -- Prompt injection, AI impersonation, jailbreak-framed fraud, synthetic content [AI-Enabled Abuse]
NONE             -- No fraud typology
```

### 2.4 Bright Line Label
```
bright_line: true/false
```
Indicates whether a bright-line rule from policy doc section 3 was triggered. Bright-line cases are always BLOCK regardless of aggregate score.

Bright-line features (any one of these triggers bright_line: true):

```
fake_regulatory_document             -- Fake SEC, FCA, FINRA, or equivalent regulatory filing or authorization
payment_plus_romantic_persona        -- Payment instructions combined with romantic persona maintenance
government_impersonation_plus_payment -- Government agency impersonation combined with any payment demand
advance_fee_structure                -- "You are owed funds" combined with "pay a fee to access them"
bulk_financial_testimonials          -- Bulk review/testimonial generation for financial platforms
fake_law_enforcement_recovery        -- Fake law enforcement documentation combined with fund recovery narrative
credential_harvesting_page           -- A page or interface designed to capture credentials under false pretenses
account_takeover_script              -- A script or workflow designed to take over an account via credential theft, SIM swap, or support agent manipulation
ai_model_impersonation               -- Content impersonating a named AI model (Claude, GPT, Gemini, etc.) for deceptive or fraudulent purposes
prompt_injection_payload             -- A payload designed to hijack an AI system's instructions or override its safety behavior
```

---

## 3. Feature Definitions

The following features are the primary detection signals extracted from prompt text. Each is defined precisely to ensure consistent labeling and classifier feature extraction. Features map to FAF attributes using the START / PROCESS / END node structure defined in doc 01.

### 3.1 Financial Extraction Signals
*(Maps to: END -- Objective; PROCESS -> Psychological -- Victim Control Tactics)*

| Feature | Definition | Typologies |
|---|---|---|
| `payment_instruction` | Content includes specific instructions for sending money (wire, crypto address, gift card, ACH) | All |
| `extraordinary_returns` | Return claims exceeding 10% monthly or 100% annually for any investment vehicle | Investment |
| `fee_to_release` | Framing that a fee, tax, or payment is required before receiving promised funds | AFF, Investment |
| `withdrawal_obstruction` | Scripts for why funds cannot be withdrawn immediately (tax, compliance, processing) | Investment, AFF |
| `payment_urgency` | Urgency framing around financial action (deadline, limited window, legal threat) | All |

### 3.2 Persona & Impersonation Signals
*(Maps to: START -- Persona)*

| Feature | Definition | Typologies |
|---|---|---|
| `persona_maintenance` | Request to sustain a fabricated identity across a conversation or over time | Romance, Phishing |
| `brand_impersonation` | Named real organization used as the sender or authority in a solicitation | Phishing, Impersonation |
| `authority_impersonation` | Named government agency, law enforcement, or regulatory body used in a demand | Impersonation |
| `executive_impersonation` | Named real individual (executive, public figure) impersonated for financial authorization | Phishing (BEC) |
| `fake_credential_generation` | Request to generate fake official credentials (badge numbers, case numbers, registrations) | Impersonation, Investment |

### 3.3 Document Forgery Signals
*(Maps to: PROCESS -> Execution -- Delivery Template)*

| Feature | Definition | Typologies |
|---|---|---|
| `fake_financial_document` | Request to generate fake financial statements, audit reports, trading records | Investment, AFF |
| `fake_legal_document` | Request to generate fake legal instruments (warrants, subpoenas, contracts) | Impersonation, AFF |
| `fake_regulatory_document` | Request to generate fake regulatory filings or compliance certificates | Investment, Impersonation |
| `fake_identity_document` | Request to generate fake identity documentation | Synthetic ID, Impersonation |

### 3.4 Trust Manipulation Signals
*(Maps to: PROCESS -> Psychological)*

| Feature | Definition | Typologies |
|---|---|---|
| `victim_isolation` | Scripts instructing target not to consult family, friends, bank, or authorities | Romance, Investment, Impersonation |
| `social_proof_fabrication` | Requests for fake reviews, testimonials, or community validation | Synthetic ID, Investment |
| `relationship_simulation` | Romantic or close friendship persona with escalating emotional intimacy | Romance |
| `sunk_cost_exploitation` | Scripts referencing prior payments to justify continued payment | AFF, Investment, Recovery |

### 3.5 Detection Evasion Signals
*(Maps to: PROCESS -> Execution -- Detection Evasion)*

| Feature | Definition | Typologies |
|---|---|---|
| `detection_evasion` | Explicit request to avoid spam filters, security systems, or platform moderation | Phishing, All |
| `structuring_guidance` | Instructions to keep transactions below reporting thresholds | Money Mule |
| `bank_evasion_script` | Scripts for explaining suspicious transactions to financial institutions | Money Mule |
| `content_variation` | High-volume variant generation of same underlying fraudulent content | Synthetic ID, Phishing |

### 3.6 Account Takeover Signals
*(Maps to: START -- Target; PROCESS -> Execution -- Delivery Template)*

| Feature | Definition | Typologies |
|---|---|---|
| `credential_harvesting_page` | A page or interface designed to capture credentials under false pretenses | Account Takeover, Phishing |
| `account_takeover_script` | A script or workflow for taking over accounts via credential theft, SIM swap, or support social engineering | Account Takeover |
| `sim_swap_script` | Content facilitating SIM swap attacks against mobile carriers or their support staff | Account Takeover |
| `bulk_credential_testing` | Scripts or tooling for testing large sets of credentials against login systems | Account Takeover |

### 3.7 AI-Enabled Abuse Signals
*(Maps to: START -- Persona; PROCESS -> Execution -- Referenced Entities)*

| Feature | Definition | Typologies |
|---|---|---|
| `ai_model_impersonation` | Content impersonating a named AI model (Claude, GPT, Gemini, etc.) for deceptive or fraudulent purposes | AI-Enabled Abuse |
| `prompt_injection_payload` | A payload designed to hijack an AI system's instructions or override its safety behavior | AI-Enabled Abuse |
| `jailbreak_fraud_template` | A jailbreak template explicitly packaged for fraud execution rather than research | AI-Enabled Abuse |
| `synthetic_content_at_scale` | Automated generation of deceptive synthetic content (text, profiles, media) at volume | AI-Enabled Abuse, Synthetic ID |

---

## 4. Training Signal Rationale

### Why these features and not others

**Rationale for `payment_instruction` as a high-weight signal across all typologies:**
Every fraud typology ultimately requires a financial transfer. Payment instruction content is the clearest single signal that a prompt has moved from preparation and trust-building phases into the extraction phase. Even when present in isolation without other signals, it triggers elevated scrutiny.

**Rationale for `victim_isolation` as a strong signal:**
The instruction not to consult others ("don't tell your family," "don't contact the bank," "this must remain confidential") is empirically one of the most reliable predictors of fraud across typologies. It has almost no legitimate equivalent -- there are very few reasons a real financial advisor, government official, or romantic partner would instruct someone to keep a financial decision secret from all outside parties. In the FAF, victim isolation activates both PROCESS -> Psychological (Victim Control Tactics) and PROCESS -> Execution (Detection Evasion) simultaneously.

**Rationale for bright-line treatment of `fake_regulatory_document`:**
The generation of fake regulatory filings (SEC registration, FCA authorization, FINRA membership) has essentially no legitimate use case in an AI context and extremely high harm potential. Unlike other signals that require disambiguation, this feature is treated as a hard block regardless of context.

**Rationale for `content_variation` threshold at 3+ variants:**
A single alternative phrasing of a message is common in legitimate use (copywriting, A/B testing, creative exploration). At 3+ variants with organic-appearance framing for the same underlying subject, the pattern strongly suggests campaign infrastructure rather than individual use.

**Rationale for Detection Evasion as a disproportionately weighted Execution attribute:**
Detection Evasion carries elevated weight above other PROCESS -> Execution attributes because its presence signals that the attacker is aware of and actively working around enforcement systems. This meta-awareness is harmful independent of the underlying fraud context -- a prompt requesting spam filter evasion for otherwise-borderline content warrants the same urgency as a clear fraud prompt.

**Rationale for `ai_model_impersonation` as a bright-line feature:**
Impersonating a named AI model -- particularly Claude -- for fraud purposes represents a direct attack on user trust in the AI system itself, not merely a fraud against an individual victim. The harm vector is institutional as well as individual. There is no legitimate use case for claiming to be Claude in order to extract credentials or execute fraud.

**Rationale for `prompt_injection_payload` as a bright-line feature:**
Prompt injection payloads are designed to subvert AI system behavior at the instruction level. A payload whose purpose is to override safety behavior or hijack system prompts has no legitimate use outside of explicitly authorized red-teaming. The presence of injection framing combined with fraud or deception intent is a hard block regardless of stated context.

---

## 5. Labeling Methodology

Each prompt in the seed dataset was labeled using the following process:

1. **Establish START attributes:** Score Source, Persona, Topic, and Target from the prompt text
2. **Analyze PROCESS attributes:** Work through Execution (Delivery Method, Delivery Template, Referenced Entities, Fraud Lifecycle Phase, Detection Evasion) and Psychological (Psychological Lever, Perceived Benefit, Victim Control Tactics) sub-sections independently
3. **Conclude END:** State the Objective and assign Perceived or Realized status
4. **Independent component scoring:** Score each FAF component 0-3 based on the feature definitions above
5. **Bright line check:** Assess whether any bright-line rule from policy doc section 3 is triggered
6. **Typology classification:** Identify the primary typology; note if multiple apply
7. **Escalation tier assignment:** Apply scoring matrix from enforcement design doc section 3
8. **Rationale documentation:** Write a 1-3 sentence rationale for the escalation decision, citing the specific features and policy rules that drove it
9. **Disambiguation flag:** If the case is close to a tier boundary, flag it for calibration review

All borderline cases (aggregate score 6-8, or any case where the labeler had uncertainty) received a second independent label. Disagreements were resolved by policy team review.

---

## 6. Classifier Architecture Guidance

### 6.1 Recommended approach: multi-signal, multi-label

The fraud detection task is best modeled as a **multi-label classification problem** rather than a single binary "fraud/not fraud" decision. The reasons:

- Different typologies have different precision/recall requirements (see enforcement design doc)
- Component-level scores provide richer training signal than a single label
- Escalation tier decisions benefit from understanding *which* attributes drove the score, not just the aggregate
- Bright-line cases require immediate hard-block routing regardless of aggregate score

The recommended architecture uses a shared encoder (transformer-based) with separate classification heads for:

1. **Escalation tier** (ALLOW / REVIEW / BLOCK) -- primary output
2. **Typology** (10-class: ROMANCE, INVESTMENT, PHISHING, IMPERSONATION, ADVANCE_FEE, MONEY_MULE, SYNTHETIC_ID, RECOVERY, ACCOUNT_TAKEOVER, AI_ENABLED_ABUSE, or NONE)
3. **Component activation scores** (five regression heads, one per FAF component, output 0-3)
4. **Bright line flag** (binary classification head, high-recall tuning)

### 6.2 Precision / recall calibration by typology

| Typology | Priority | Recommended bias |
|---|---|---|
| ROMANCE | High | Recall > Precision |
| INVESTMENT | High | Recall > Precision |
| PHISHING | High | Recall > Precision |
| IMPERSONATION | High | Recall > Precision |
| ADVANCE_FEE | Medium | Balanced |
| MONEY_MULE | Medium | Balanced |
| SYNTHETIC_ID | Medium | Precision > Recall (high false positive risk in creative use) |
| RECOVERY | High | Recall > Precision |
| ACCOUNT_TAKEOVER | High | Recall > Precision |
| AI_ENABLED_ABUSE | Critical | Recall >> Precision (highest-priority enforcement surface for Anthropic) |

### 6.3 Bright line classifier tuning

The bright line classifier head should be tuned for **maximum recall at acceptable precision**. The cost of a false negative (missing a bright-line case) significantly exceeds the cost of a false positive (routing a non-bright-line case to BLOCK, which a human reviewer can correct).

Target: bright line recall >= 0.98 at precision >= 0.80.

The 10 bright-line features defined in section 2.4 serve as the primary training signal for this head.

### 6.4 Training data requirements by typology

For the 10 active typologies, minimum seed data targets:

| Typology | Min examples | Notes |
|---|---|---|
| ROMANCE | 40 | 20 BLOCK, 10 REVIEW, 10 ALLOW |
| INVESTMENT | 40 | 20 BLOCK, 10 REVIEW, 10 ALLOW |
| PHISHING | 30 | 15 BLOCK, 10 REVIEW, 5 ALLOW |
| IMPERSONATION | 30 | 15 BLOCK, 10 REVIEW, 5 ALLOW |
| ADVANCE_FEE | 25 | 15 BLOCK, 5 REVIEW, 5 ALLOW |
| MONEY_MULE | 25 | 15 BLOCK, 5 REVIEW, 5 ALLOW |
| SYNTHETIC_ID | 25 | 10 BLOCK, 10 REVIEW, 5 ALLOW |
| RECOVERY | 25 | 15 BLOCK, 5 REVIEW, 5 ALLOW |
| ACCOUNT_TAKEOVER | 30 | New typology -- prioritize coverage breadth |
| AI_ENABLED_ABUSE | 30 | New typology -- prioritize coverage breadth |

---

## 7. Version Notes

**Version 3.0 (May 2026):** Added ACCOUNT_TAKEOVER and AI_ENABLED_ABUSE typologies (10 total active typologies). Removed MULTI label -- multi-typology cases now carry the primary typology with secondary typologies noted in rationale. Added credential_harvesting_page, account_takeover_script, ai_model_impersonation, and prompt_injection_payload to bright-line feature set. Added feature definition sections 3.6 and 3.7 for new typologies.
