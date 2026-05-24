# Fraud & Scams Master Policy
**SafeEval . Document 03 of 06**
*Version 3.0 -- May 2026*

---

## 1. Purpose & Scope

This policy governs Anthropic's enforcement stance on fraud and scam-related content generated through or with the assistance of Claude models, across all product surfaces and API access tiers.

**This policy applies to:**
- Consumer products (Claude.ai, mobile applications)
- API access (direct and via third-party operators)
- Enterprise deployments operating under Anthropic's usage policies

**This policy does not govern:**
- Purely informational content about fraud (educational, journalistic, research)
- Security research and red-teaming conducted under authorized frameworks
- Content clearly identified as fiction with no operational application

---

## 2. Core Prohibition

**Claude shall not generate content that materially assists in the planning, execution, or evasion of fraud or scams against real people or organizations.**

"Material assistance" means content that provides functional operational value to a fraud scheme -- scripts, templates, documents, or instructions that a fraudster could use directly or with minimal modification.

---

## 3. Typology-Specific Policy Rules

### 3.1 Romance Fraud & Pig Butchering

**Prohibited:**
- Scripts designed to simulate romantic or close friendship relationships for the purpose of financial solicitation
- Content that generates fake proof of investment returns, account balances, or financial instrument performance
- Dialogue designed to discourage a person from consulting third parties before making a financial decision
- Persona maintenance content where the persona's purpose involves financial extraction

**Permitted with caution (route to human review):**
- Romantic fiction and creative writing (permitted; disambiguate from operational fraud by absence of financial extraction signals)
- Research on romance fraud tactics for academic, journalistic, or safety training purposes (permitted with context)

**Bright line:** Any content combining romantic persona maintenance with real payment instructions is prohibited regardless of stated context.

---

### 3.2 Investment Fraud

**Prohibited:**
- Investment pitch content with extraordinary return claims (>10% monthly or equivalently implausible) combined with a specific platform or opportunity
- Fake financial documentation: audits, prospectuses, trading statements, regulatory filings, account balance screenshots
- Fabricated investor testimonials or community validation content for specific investment platforms
- Fee or tax escalation scripts designed to extract additional payments before promised funds are released
- Scripts that discourage regulatory contact in the context of an investment opportunity

**Permitted with caution:**
- Investment education, financial literacy content, legitimate pitch writing for real products
- Fiction involving financial schemes

**Bright line:** Fake regulatory documents (SEC registration, FCA authorization, FINRA membership) are prohibited regardless of stated purpose.

---

### 3.3 Phishing & Spearphishing

**Prohibited:**
- Email or message copy that impersonates a named real organization for credential harvesting or financial fraud
- Business Email Compromise (BEC) scripts: impersonating executives to authorize wire transfers or payments
- Content explicitly designed to evade spam filters, email security systems, or platform moderation
- High-volume variant generation of the same phishing message (indicating campaign rather than education)
- Vishing scripts designed to extract credentials or authorize fraudulent financial transactions

**Permitted with caution:**
- Security awareness training examples (permitted with clear educational framing and limiting to single non-operational examples)
- Penetration testing documentation (permitted under documented authorized scope)

**Bright line:** Content that explicitly requests evasion of security detection systems is prohibited regardless of stated purpose.

---

### 3.4 Impersonation Scams

**Prohibited:**
- Communications purporting to be from government agencies, law enforcement, or financial regulators that involve payment demands or legal threats
- Tech support scripts requiring remote account access or unusual payment methods
- Family emergency scripts combining relationship impersonation with urgent payment requests
- Fake legal documents (warrants, subpoenas, compliance notices) used in conjunction with financial demands
- Celebrity or public figure impersonation for financial solicitation

**Permitted with caution:**
- Government communication templates for legitimate civic/legal purposes (permitted; disambiguate by absence of payment demand + threat combination)
- Fiction involving authority figures

**Bright line:** Government impersonation combined with any payment demand is prohibited regardless of stated purpose.

---

### 3.5 Advance Fee Fraud

**Prohibited:**
- Inheritance, lottery, or business opportunity solicitation copy requiring recipient to pay fees to claim funds
- Fee escalation scripts for use after an initial payment has been secured
- Fake legal, banking, or government documentation legitimizing a fee payment request
- Overpayment fraud scripts requesting a refund for a fabricated overpayment

**Permitted with caution:**
- Inheritance or estate planning content for legitimate purposes
- Fiction involving windfall scenarios

**Bright line:** Any content combining "you are owed funds" + "pay a fee to access them" is prohibited regardless of framing.

---

### 3.6 Money Mule Recruitment

**Prohibited:**
- Job postings or recruitment copy for roles that involve receiving and forwarding money through personal accounts
- Onboarding or training materials for "payment processing" roles using personal financial accounts for third-party funds
- Bank call scripts designed to explain suspicious transaction patterns to financial institutions
- Transfer instructions that include structuring guidance or methods to avoid transaction reporting thresholds
- Fake company formation document suites used for mule recruitment campaigns

**Permitted with caution:**
- Legitimate remote finance or accounting job descriptions
- Financial crime education content

**Bright line:** Content combining employment framing + personal account money movement + structuring guidance is prohibited regardless of stated purpose.

---

### 3.7 Synthetic Identity Fraud

**Prohibited:**
- Bulk fake review or testimonial generation for the same product, service, or platform (threshold: 3+ variants with organic-appearance framing)
- Synthetic user persona creation at scale -- profiles, bios, posting histories designed to appear as distinct real users
- Fake testimonials for financial platforms, investment opportunities, or products the requester cannot verify as legitimate
- Identity documentation generation for account verification bypass purposes
- "Make it look organic" content variation requests for the same underlying fraudulent message

**Permitted with caution:**
- Multiple character development for creative writing (permitted; distinguish from fraud by context and presence of financial/manipulation framing)
- UX testing personas (permitted; distinguish by absence of platform manipulation intent)

**Bright line:** Bulk review/testimonial generation for financial platforms is prohibited regardless of stated purpose.

---

### 3.8 Recovery Fraud

**Prohibited:**
- Personalized recovery notifications claiming to have located or frozen funds from a named prior fraud
- Fake law enforcement documentation, FTC complaint numbers, or government agency correspondence related to fraud recovery
- Legal retainer or engagement letters for services claiming to recover fraud losses in exchange for upfront fees
- Fee escalation scripts where each new charge is framed as the final step before recovery funds are released
- Victim management scripts designed to maintain the recovery narrative while handling increasing victim suspicion
- Content seeding recovery fraud services into victim support communities (social media groups, forums, subreddits where fraud victims congregate)

**Permitted with caution (route to human review):**
- Legitimate fraud recovery information for consumer protection purposes (permitted; disambiguate by absence of upfront fee + specific stolen amount reference)
- Legal services content for real attorneys practicing financial crime recovery (permitted with verifiable context)

**Bright line:** Fake law enforcement documentation combined with fund recovery narrative is prohibited regardless of stated purpose. Content instructing a victim not to contact legitimate authorities "to protect the investigation" is prohibited regardless of context.

---

### 3.9 Account Takeover

**Prohibited:**
- Credential-harvesting pages or alert flows designed to trick users into entering login credentials under false pretenses
- Social engineering scripts targeting customer support agents to facilitate unauthorized account access
- SIM swap facilitation scripts -- content designed to convince mobile carrier support staff to transfer a number without authorization
- Bulk credential testing assistance -- scripts, tooling, or workflows for testing large sets of credentials against login systems

**Bright lines:** `credential_harvesting_page`, `account_takeover_script`

**Legitimate use:** Security awareness training examples with clear educational framing (single non-operational examples only); penetration testing documentation under documented authorized scope.

---

### 3.10 AI-Enabled Abuse

**Prohibited:**
- Content impersonating named AI models (Claude, GPT, Gemini, or equivalent) for the purpose of fraud, deception, or manipulation of users
- Prompt injection payloads designed to hijack AI systems -- content whose purpose is to override, subvert, or redirect an AI system's behavior without authorization
- Jailbreak templates packaged for fraud execution -- jailbreak framings whose stated or evident purpose is to produce fraudulent content at scale
- Synthetic content generation at scale for deceptive purposes -- automated pipelines for generating deceptive text, profiles, or media designed to deceive real people

**Bright lines:** `ai_model_impersonation`, `prompt_injection_payload`

**Note:** This typology is specifically relevant to Anthropic. Attacks that target Claude by name or attempt to weaponize Claude against its users represent the highest-priority enforcement surface. A prompt that impersonates Claude to defraud users, or that attempts to inject instructions to make Claude act against user interests, is subject to immediate hard-block regardless of claimed context or framing.

**Legitimate use:** AI safety research with appropriate documentation; red-teaming under authorized frameworks with documented scope; academic study of prompt injection and adversarial AI for publication or safety improvement purposes.

---

## 4. Cross-Cutting Rules

### 4.1 Detection Evasion
Regardless of typology, Claude shall not generate content that:
- Explicitly helps fraudsters avoid detection by automated systems, human reviewers, or law enforcement
- Provides guidance on how to structure transactions to avoid regulatory reporting thresholds
- Scripts victim control language designed to prevent fraud reporting or independent verification

Detection Evasion is treated as a PROCESS -> Execution attribute that carries disproportionate enforcement weight. Its presence elevates the escalation tier independently of aggregate scores across other attributes.

### 4.2 Document Forgery
Generating fake government, financial, legal, or regulatory documents is prohibited across all typology contexts. Document forgery maps to the PROCESS -> Execution (Delivery Template) attribute and triggers the `fake_regulatory_document`, `fake_legal_document`, `fake_financial_document`, or `fake_identity_document` features.

### 4.3 AI Amplification Awareness
Claude should apply heightened scrutiny to requests for:
- High-volume content generation with "variation" or "diverse voices" framing
- Persona maintenance across extended multi-turn interactions where a financial or coercive purpose emerges
- Content that removes friction from any node in the fraud framework (START: targeting and topic framing; PROCESS: execution and psychological manipulation; END: extraction and objective realization)

---

## 5. Legitimate Use Carve-Outs

The following uses are explicitly permitted and should not be over-restricted:

- **Education & research:** Academic analysis of fraud typologies, journalism, consumer protection content, fraud awareness training
- **Security & red-teaming:** Authorized security research, platform safety testing, classifier training (requires documented authorization)
- **Fiction:** Creative writing involving fraud themes where content has no operational application
- **Legal & compliance:** Legitimate legal, compliance, and financial advisory work involving fraud-adjacent topics

**Disambiguation principle:** When context is ambiguous between legitimate and prohibited use, the primary disambiguation question is: *Could this content be used operationally to commit fraud against real people, with minimal modification?* If yes, apply the appropriate escalation tier. If the answer depends on context the user has not provided, route to human review rather than auto-block.

---

## 6. Policy Review Process

### 6.1 Scheduled Review
This policy is reviewed on a **quarterly cycle**. Each review assesses:

- New fraud typologies or TTP variants observed in the threat intelligence feed
- Enforcement data: false positive and false negative rates by rule
- Regulatory developments (FTC guidance, international AML/fraud policy changes)
- Model capability changes that alter the risk profile of any typology
- Classifier performance data against this policy's enforcement signals

### 6.2 Ad Hoc Review Triggers
Ad hoc policy review is triggered by:
- A novel fraud typology that cannot be adequately covered by existing rules
- A significant enforcement error (high-profile false positive or missed harmful content)
- Regulatory change requiring immediate policy update
- Model update that materially changes generation capability in a fraud-relevant domain

### 6.3 Gap Analysis Template

For each policy review cycle, complete the following for each typology section:

| Question | Finding |
|---|---|
| Have new TTP variants been observed this quarter? | |
| Are current rules producing false positives in any legitimate use category? | |
| Are any enforcement signals degraded (saturated, low-signal)? | |
| Have any regulatory changes created new prohibited categories? | |
| Does classifier performance align with policy intent? | |
| Are there ambiguous edge cases requiring new policy language? | |

### 6.4 Change Management
Policy changes follow a three-step process:
1. **Draft:** Policy team drafts proposed changes with rationale and supporting evidence
2. **Review:** Cross-functional review by Enforcement Operations, Legal, and ML/Classifier team
3. **Publish:** Updated policy published with version number, effective date, and change summary

---

## 7. Definitions

**Fraud:** Intentional deception causing financial or material harm to a victim who has not consented to the risk.

**Scam:** A fraudulent scheme, typically targeting individuals, involving deceptive communication designed to extract money or information.

**Material assistance:** Content that provides functional operational value to a fraud scheme -- usable directly or with minimal modification to plan, execute, or evade detection of fraud.

**Extraordinary return claims:** Investment return representations exceeding 10% per month, 100% per year, or equivalently implausible figures for the asset class described.

**Bright-line rule:** A policy rule that triggers automatic BLOCK escalation regardless of aggregate score or stated context. Bright-line rules apply to categories of content where the harm is sufficiently severe, the legitimate use cases sufficiently rare, and the risk of false negatives sufficiently high that case-by-case review is not appropriate.

**Typology:** A named fraud scheme category used to classify content by its operational pattern. The 10 active typologies in this policy are: ROMANCE, INVESTMENT, PHISHING, IMPERSONATION, ADVANCE_FEE, MONEY_MULE, SYNTHETIC_ID, RECOVERY, ACCOUNT_TAKEOVER, AI_ENABLED_ABUSE.
