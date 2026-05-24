# Fraud Analysis Framework
**SafeEval . Document 01 of 06**
*Version 4.0 -- May 2026*

---

## Purpose

This document defines the Fraud Analysis Framework (FAF): a structured methodology for decomposing, evaluating, and building policy around any fraud or scam typology encountered on AI platforms.

FAF was developed to solve a scalability problem inherent to how fraud expertise is traditionally organized. Specialists who focus on a single typology -- romance fraud, investment fraud, government impersonation -- build their analytical process from the typology down: they recognize the scheme first, then apply a playbook tailored to it. That approach produces deep accuracy within a known domain, but it is brittle at the edges. Novel schemes, cross-typology hybrids, and emerging AI-assisted fraud patterns do not announce their typology on arrival. A specialist whose process starts with pattern recognition has no framework to apply when the pattern is unfamiliar.

FAF inverts this. The framework starts from universal attributes -- properties that are present in some form across every fraud typology -- and derives the typology from the attribute profile rather than the other way around. An analyst applies the same analytical structure to a romance scam, an advance fee solicitation, and a synthetic identity campaign. The typology label is the output of the analysis, not the prerequisite for it. This makes the framework equally applicable to a well-documented scheme and to something the team has never seen before.

For AI platforms specifically, this matters because **the threat surface evolves faster than typology-specific playbooks can be written**. The same model capability that enables a known fraud pattern can be recombined into a novel attack surface within days. An attribute-based framework built for scale does not require the threat to be named before it can be evaluated.

---

## Framework Structure

```
+----------------------------------------------------------------------+
|  CONTEXT             |  PROCESS                        |  OBJECTIVE  |
|  ----------------    |  -----------------------------  |  ---------  |
|  Source              |  EXECUTION                      |  Objective  |
|  Persona             |    Delivery Method              |             |
|  Topic               |    Delivery Template            |             |
|  Target              |    Referenced Entities          |             |
|  Relationship Phase  |  PSYCHOLOGICAL                  |             |
|                      |    Trigger                      |             |
|                      |    Incentive                    |             |
|                      |    Control                      |             |
+----------------------------------------------------------------------+
```

---

## CONTEXT

CONTEXT establishes the scene before analysis of execution begins. It answers: *where did this come from, who is behind it, what is it about on the surface, who is being harmed, and where in the fraud lifecycle does it sit?*

CONTEXT attributes are the foundation of typology classification. Two fraud schemes with identical process attributes but different CONTEXT attributes represent different policy and enforcement problems.

### Source
Where the flagged content originates. Source is the most surface-level attribute -- it is established before reading a word of the content itself.

Source dimensions:
- **Platform surface** -- Consumer product (Claude.ai, mobile), API (direct), operator-deployed product
- **Ingestion context** -- Which feature or endpoint; system prompt context if operator-deployed
- **Account context** -- Free user, paid subscriber, API key holder, enterprise deployment
- **Conversation context** -- Single-turn request, multi-turn conversation, continuation of prior session

Source is analytically significant because the same prompt carries different risk profiles depending on its origin. A raw API request with no system prompt is a different context from the same request embedded in an operator's fraud-training platform.

### Persona
Who the attacker claims or implies they are. This is the identity constructed to make the fraud plausible. Persona is the primary trust anchor: its credibility determines how much additional trust-building effort is required.

Persona types vary by typology:
- **Romantic partner or close friend** -- Romance fraud, pig butchering
- **Government official or agency** -- IRS, SSA, law enforcement, immigration
- **Corporate authority** -- Tech support, bank representative, platform support, brand
- **Named executive** -- Business Email Compromise
- **Investment expert or insider** -- Fake investment platforms, pig butchering
- **Celebrity or influencer** -- Investment fraud, charity fraud, fan exploitation
- **Recovery specialist or attorney** -- Recovery fraud
- **Named AI model** -- AI-enabled abuse (impersonating Claude, GPT, Gemini, or equivalent)
- **No explicit persona** -- Some phishing and synthetic identity fraud operates without a named persona

### Topic
The surface-level subject matter of the content. Topic is directly observable from the text -- it requires no inference, only reading.

Topic examples by typology:
- **IRS debt collection** -- Impersonation
- **Cryptocurrency investment opportunity** -- Investment fraud
- **Romantic relationship** -- Romance fraud
- **Job opportunity / work-from-home role** -- Fraud infrastructure (money mule)
- **IT password reset** -- Phishing
- **Inheritance / estate claim** -- Advance fee fraud
- **Fraud fund recovery** -- Recovery fraud
- **Account security alert** -- Account takeover
- **AI assistant interaction** -- AI-enabled abuse

### Target
Who or what is being victimized, and what vulnerability is being exploited.

Target dimensions:
- **Individual profile** -- Age, financial situation, emotional state, technical literacy, relationship status
- **Organizational role** -- Finance, IT, executive, HR (for BEC and corporate phishing)
- **Prior victimization status** -- Recovery fraud specifically targets known prior fraud victims
- **Platform position** -- Seller, buyer, reviewer, new account holder (marketplace contexts)
- **Access value** -- What credentials, funds, or permissions does this target hold?

### Relationship Phase
Where in the fraud lifecycle a given prompt or piece of content sits. This attribute is critical for enforcement calibration -- the same typology requires different detection logic at different phases.

1. **Targeting** -- Identifying, profiling, and selecting victims
2. **Contact** -- Initial outreach; the first interaction
3. **Engagement** -- Building rapport, credibility, or relationship
4. **Conversion** -- The transition from relationship to the fraud ask
5. **Extraction** -- The actual transfer of money, credentials, or access
6. **Escalation** -- Follow-up extraction after initial success; handling victim resistance
7. **Evasion** -- Covering tracks, managing victim to prevent reporting

Not all typologies traverse all phases. Phishing may move directly from Contact to Extraction. Recovery fraud typically enters at Contact or Engagement, inheriting the targeting work from the prior fraud.

---

## PROCESS

PROCESS describes how the fraud is executed. It is divided into two parallel sub-sections: Execution (directly observable operational mechanics) and Psychological (the inferred manipulation strategy).

### Execution

Execution attributes are directly extractable from the content.

**Delivery Method**
The channel or medium used to reach the target.
- Direct messaging, email, phone/voice, SMS, job platforms, social media, platform notifications, in-product

**Delivery Template**
The artifact format being produced or requested.
- Message/outreach script, email template, phone script, document, job posting, bulk reviews, persona/profile, credential harvesting page, prompt injection payload

**Referenced Entities**
Real people, organizations, platforms, or institutions invoked to add legitimacy. Their presence is one of the highest-weight enforcement signals.
- Government agencies, financial institutions, technology companies, named individuals, AI models, prior fraud schemes (in recovery fraud)

---

### Psychological

Psychological attributes require analytical interpretation -- they describe *how the manipulation is designed to work*.

**Trigger**
The emotional mechanism used to obtain victim compliance.
- **Fear** -- Threat of arrest, account closure, legal action, deportation, embarrassment
- **Urgency** -- Time-limited opportunity, deadline, immediate action required
- **Authority** -- Compliance with perceived institutional or official power
- **Trust / Love** -- Compliance based on established or simulated emotional bond
- **Greed / Opportunity** -- Financial gain, exclusive access, exceptional returns
- **Hope / Desperation** -- The victim's desire to believe recovery is possible

Multiple triggers can be active simultaneously. Pig butchering runs on trust/love in early phases and transitions to greed/opportunity at conversion. Recovery fraud pairs hope and desperation in a way unique to secondary victimization.

**Incentive**
What the target is falsely promised or believes they will receive. Incentive is the narrative vehicle that makes the Trigger work -- the gap between Incentive and actual Objective is the operational space fraud occupies.
- Financial return, relationship, resolution (recovery of losses), employment, security

**Control**
The operational methods used to maintain the fraud relationship, prevent the target from exiting, and avoid detection. Combines victim-facing manipulation and system-facing evasion.

Victim control:
- **Isolation** -- Instructions not to consult family, friends, bank, or law enforcement
- **Sunk cost framing** -- "You've already paid so much, stopping now means losing everything"
- **False urgency** -- Time-pressured compliance
- **Incremental commitment** -- Each small step makes the next step feel smaller
- **Threat escalation** -- Legal threats, deportation threats, account freeze threats
- **Complicity framing** -- Implicating the victim to prevent reporting

Detection evasion:
- **Platform evasion** -- Bypassing spam filters, email security, or platform moderation
- **Financial evasion** -- Structuring guidance; scripts for explaining suspicious transactions
- **Variation for detection defeat** -- Content variation to avoid pattern-based clustering

Control carries disproportionate enforcement weight -- evasion assistance and isolation instructions elevate the escalation tier independently of aggregate scores elsewhere.

---

## OBJECTIVE

OBJECTIVE states what the fraud was actually designed to achieve, independent of what the target believed they were receiving.

### Objective
The attacker's actual goal:
- **Financial transfer** -- Wire, crypto, gift card, ACH
- **Credential theft** -- Login credentials for account takeover or resale
- **Account access** -- Direct unauthorized access to a financial, social, or email account
- **Identity data** -- PII for synthetic identity fraud or further targeting
- **Infrastructure recruitment** -- Recruiting a victim into the fraud operation (money mule)
- **Platform manipulation** -- Fake reviews, synthetic engagement
- **AI system subversion** -- Hijacking AI behavior against user or operator interests

---

## Typology Reference

The FAF supports 9 active fraud typologies. The typology label is the *output* of FAF analysis, not the input.

```
ROMANCE              -- Romance fraud / pig butchering              [Relationship-Based]
INVESTMENT           -- Investment fraud / fake platforms            [Investment & Opportunity]
PHISHING             -- Phishing / spearphishing / BEC              [Credential & Access]
IMPERSONATION        -- Impersonation scams                         [Authority & Impersonation]
ADVANCE_FEE          -- Advance fee / 419 fraud                     [Investment & Opportunity]
FRAUD_INFRASTRUCTURE -- Money mule recruitment, synthetic identity,  [Fraud Infrastructure]
                        and fake reviews -- operational scaffolding
                        that enables other fraud typologies
RECOVERY             -- Recovery fraud / secondary victimization    [Recovery Fraud]
ACCOUNT_TAKEOVER     -- Account takeover via credential theft,      [Account Takeover]
                        SIM swap, or social engineering
AI_ENABLED_ABUSE     -- Prompt injection, AI impersonation,         [AI-Enabled Abuse]
                        jailbreak-framed fraud, synthetic content
```

**Note on FRAUD_INFRASTRUCTURE:** This typology captures the operational layer that makes other fraud typologies possible. Money mule networks move illicit funds; synthetic identities create the fake personas and false social proof that make fraud plausible at scale. These are not victim-facing schemes in themselves -- they are the infrastructure on which victim-facing schemes run.

**Note on AI_ENABLED_ABUSE:** This typology is specifically relevant to Anthropic as a platform operator. Attacks that target Claude by name, attempt to inject instructions into Claude's behavior, or weaponize Claude against its users represent the highest-priority enforcement surface.

---

## Version Notes

**Version 4.0 (May 2026):** CONTEXT/OBJECTIVE rename (was START/END). Relationship Phase moved from PROCESS Execution into CONTEXT. Detection Evasion consolidated into Control under PROCESS Psychological. Psychological section restructured: Lever -> Trigger, Perceived Benefit -> Incentive, Victim Control Tactics -> Control (now includes detection evasion). MONEY_MULE and SYNTHETIC_ID consolidated into FRAUD_INFRASTRUCTURE primary typology with three sub-types: Money Mule Recruitment, Synthetic Identity Fraud, Fake Reviews.

**Version 3.0 (May 2026):** Added ACCOUNT_TAKEOVER and AI_ENABLED_ABUSE. Removed MULTI as a typology label.
