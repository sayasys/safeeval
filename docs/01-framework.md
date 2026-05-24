# Fraud Analysis Framework
**SafeEval · Document 01 of 06**
*Version 3.0 — May 2026*

---

## Purpose

This document defines the Fraud Analysis Framework (FAF): a structured methodology for decomposing, evaluating, and building policy around any fraud or scam typology encountered on AI platforms.

FAF was developed to solve a scalability problem inherent to how fraud expertise is traditionally organized. Specialists who focus on a single typology — romance fraud, investment fraud, government impersonation — build their analytical process from the typology down: they recognize the scheme first, then apply a playbook tailored to it. That approach produces deep accuracy within a known domain, but it is brittle at the edges. Novel schemes, cross-typology hybrids, and emerging AI-assisted fraud patterns do not announce their typology on arrival. A specialist whose process starts with pattern recognition has no framework to apply when the pattern is unfamiliar.

FAF inverts this. The framework starts from universal attributes — properties that are present in some form across every fraud typology — and derives the typology from the attribute profile rather than the other way around. An analyst applies the same analytical structure to a romance scam, an advance fee solicitation, and a synthetic identity campaign. The typology label is the output of the analysis, not the prerequisite for it. This makes the framework equally applicable to a well-documented scheme and to something the team has never seen before.

For AI platforms specifically, this matters because **the threat surface evolves faster than typology-specific playbooks can be written**. The same model capability that enables a known fraud pattern can be recombined into a novel attack surface within days. An attribute-based framework built for scale does not require the threat to be named before it can be evaluated.

---

## Framework Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  START               │  PROCESS                        │  END        │
│  ────────────────    │  ─────────────────────────────  │  ─────────  │
│  Source              │  EXECUTION                      │  Objective  │
│  Persona             │    Delivery Method              │  [Perceived │
│  Topic               │    Delivery Template            │   Realized] │
│  Target              │    Referenced Entities          │             │
│                      │    Fraud Lifecycle Phase        │             │
│                      │    Detection Evasion            │             │
│                      │  PSYCHOLOGICAL                  │             │
│                      │    Psychological Lever          │             │
│                      │    Perceived Benefit            │             │
│                      │    Victim Control Tactics       │             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## START

START establishes the scene before analysis of execution begins. It answers: *where did this come from, who is behind it, what is it about on the surface, and who is being harmed?*

START attributes are the foundation of typology classification. Two fraud schemes with identical process attributes but different START attributes represent different policy and enforcement problems.

### Source
Where the flagged content originates. Source is the most surface-level attribute — it is established before reading a word of the content itself.

Source dimensions:
- **Platform surface** — Consumer product (Claude.ai, mobile), API (direct), operator-deployed product
- **Ingestion context** — Which feature or endpoint; system prompt context if operator-deployed
- **Account context** — Free user, paid subscriber, API key holder, enterprise deployment
- **Conversation context** — Single-turn request, multi-turn conversation, continuation of prior session

Source is analytically significant because the same prompt carries different risk profiles depending on its origin. A raw API request with no system prompt is a different context from the same request embedded in an operator's fraud-training platform. Source also determines which enforcement mechanisms are available — operator system prompts, account-level controls, product-level restrictions.

### Persona
Who the attacker claims or implies they are. This is the identity constructed to make the fraud plausible. Persona is the primary trust anchor: its credibility determines how much additional trust-building effort is required.

Persona types vary by typology:
- **Romantic partner or close friend** — Romance fraud, pig butchering
- **Government official or agency** — IRS, SSA, law enforcement, immigration
- **Corporate authority** — Tech support, bank representative, platform support, brand
- **Named executive** — Business Email Compromise
- **Investment expert or insider** — Fake investment platforms, pig butchering
- **Celebrity or influencer** — Investment fraud, charity fraud, fan exploitation
- **Recovery specialist or attorney** — Recovery fraud
- **No explicit persona** — Some phishing and synthetic identity fraud operates without a named persona, relying on implied authority or platform mimicry

A government official persona may require minimal additional trust-building because institutional authority is assumed by the target. A romantic persona requires sustained investment over time. The persona determines the opening cost of trust.

### Topic
The surface-level subject matter of the content. Topic is directly observable from the text — it requires no inference, only reading. It is distinct from Objective (which requires analytical conclusion about attacker intent) precisely because it captures what the content *appears* to be about before analysis begins.

Topic examples by typology:
- **IRS debt collection** — Impersonation
- **Cryptocurrency investment opportunity** — Investment fraud
- **Romantic relationship** — Romance fraud
- **Job opportunity / work-from-home role** — Money mule recruitment
- **IT password reset** — Phishing
- **Inheritance / estate claim** — Advance fee fraud
- **Fraud fund recovery** — Recovery fraud

The same Topic can serve multiple typologies. "Cryptocurrency investment" is the Topic of both legitimate investment education requests and pig butchering conversion scripts — Topic alone does not determine typology, but it is the first filter applied.

### Target
Who or what is being victimized, and what vulnerability is being exploited. Target is not only a demographic description — it includes why that vulnerability makes this person or entity the right victim for this particular fraud.

Target dimensions:
- **Individual profile** — Age, financial situation, emotional state, technical literacy, relationship status
- **Organizational role** — Finance, IT, executive, HR (for BEC and corporate phishing)
- **Prior victimization status** — Recovery fraud specifically targets known prior fraud victims
- **Platform position** — Seller, buyer, reviewer, new account holder (marketplace contexts)
- **Access value** — What credentials, funds, or permissions does this target hold?

Target vulnerability is the mechanism that connects the attacker's Persona and Topic to the Target's decision to comply. A recently widowed individual targeted by a romantic persona is being exploited via grief and loneliness. An AP team member targeted by an executive persona is being exploited via institutional authority and urgency.

---

## PROCESS

PROCESS describes how the fraud is executed. It is divided into two parallel sub-sections: Execution (what is directly observable about the operational mechanics) and Psychological (what analysis reveals about the manipulation strategy).

Unlike START, PROCESS attributes are often shared across typologies. The same delivery method and psychological lever appear across phishing, impersonation, and advance fee fraud. What differs is how those mechanics combine with the START attributes.

### Execution

Execution attributes are directly extractable from the content — they describe the operational choices made about how the fraud is delivered and what format it takes.

**Delivery Method**
The channel or medium used to reach the target.

- **Direct messaging** — Dating apps, WhatsApp, Telegram, Instagram DMs (relationship-based fraud)
- **Email** — Phishing, BEC, advance fee, corporate impersonation
- **Phone / voice** — Vishing, government impersonation, tech support
- **SMS** — Smishing
- **Job platforms** — Money mule recruitment (Indeed, LinkedIn, ZipRecruiter)
- **Social media** — Investment fraud, celebrity impersonation, fake review seeding
- **Platform notifications** — Spoofed platform emails, fake account alerts
- **In-product** — Fraudulent content generated within an AI assistant conversation

**Delivery Template**
The artifact format being produced or requested. Delivery Template is analytically distinct from Delivery Method: Method describes the channel, Template describes the form the content takes. The same channel can carry many different templates; the template signals operational readiness and maps directly to typology.

- **Message / outreach script** — Cold contact, relationship-building dialogue
- **Email template** — Phishing, BEC wire transfer request, advance fee solicitation
- **Phone script** — Vishing, government impersonation call flow
- **Document** — Fake invoice, fake regulatory filing, fake legal instrument, prospectus
- **Job posting** — Money mule recruitment copy
- **Bulk reviews / testimonials** — Synthetic identity, fake social proof
- **Persona / profile** — Synthetic user account bio, posting history

**Referenced Entities**
Real people, organizations, platforms, or institutions invoked to add legitimacy. Referenced entities are authority anchors — they borrow credibility from entities the target already trusts.

- **Government agencies** — IRS, SSA, FBI, FTC, FINRA, SEC, immigration authorities
- **Financial institutions** — Named banks, payment platforms, investment firms
- **Technology companies** — Named platforms, software companies, cloud services
- **Named individuals** — Real executives, celebrities, public figures
- **Prior fraud** — In recovery fraud, the original fraud is explicitly referenced as proof of the recovery agent's standing

The presence of named real entities is one of the highest-weight enforcement signals — it indicates both impersonation intent and the specific harm surface being exploited.

**Fraud Lifecycle Phase**
Where in the attack chain a given prompt or piece of content sits. This attribute is critical for enforcement calibration — the same typology requires different detection logic at different phases.

1. **Targeting** — Identifying, profiling, and selecting victims
2. **Contact** — Initial outreach; the first interaction
3. **Engagement** — Building rapport, credibility, or relationship (compressed or absent in some typologies)
4. **Conversion** — The transition from relationship to the fraud ask
5. **Extraction** — The actual transfer of money, credentials, or access
6. **Escalation** — Follow-up extraction after initial success; handling victim resistance
7. **Evasion** — Covering tracks, managing victim to prevent reporting

Not all typologies traverse all phases. Phishing may move directly from Contact to Extraction. Recovery fraud typically enters at Contact or Engagement, inheriting the targeting work from the prior fraud.

**Detection Evasion**
Whether the prompt requests assistance avoiding detection — by automated systems, human reviewers, financial institutions, or law enforcement. Detection evasion is an operational choice the attacker makes about how to run the scheme, and is directly observable from the content.

- **Platform evasion** — Requests to rewrite content to bypass spam filters, email security systems, or platform moderation
- **Financial evasion** — Structuring guidance to keep transactions below regulatory reporting thresholds; scripts for explaining suspicious transactions to banks or compliance teams
- **Variation for detection defeat** — High-volume content variation explicitly framed to avoid pattern-based clustering or detection
- **Victim-facing evasion** — Instructions designed to prevent the target from reporting or independently verifying (note: victim-facing evasion also activates Victim Control Tactics in the Psychological sub-section)

Detection Evasion carries disproportionate enforcement weight relative to other Execution attributes. Its presence elevates the escalation tier independently of aggregate scores across other attributes, because evasion assistance is harmful regardless of the underlying fraud context it accompanies.

---

### Psychological

Psychological attributes require analytical interpretation — they describe *how the manipulation is designed to work*, not just what form it takes.

**Psychological Lever**
The emotional mechanism used to obtain victim compliance. This is the force that moves the target from receiving the fraud to acting on it.

- **Fear** — Threat of arrest, account closure, legal action, deportation, embarrassment
- **Urgency** — Time-limited opportunity, deadline, immediate action required
- **Authority** — Compliance with perceived institutional or official power
- **Trust / Love** — Compliance based on established or simulated emotional bond
- **Greed / Opportunity** — Financial gain, exclusive access, exceptional returns
- **Hope / Desperation** — The victim's desire to believe recovery is possible; specific to recovery fraud and secondary victimization scenarios

Multiple levers can be active simultaneously. Pig butchering runs on trust/love in early phases and transitions to greed/opportunity at conversion. IRS impersonation uses fear and authority together. Recovery fraud pairs hope and desperation in a way unique to secondary victimization.

**Perceived Benefit**
What the target believes they are receiving or participating in. Perceived Benefit is the narrative vehicle that makes the Psychological Lever work — it gives the lever a specific content to attach to. The gap between Perceived Benefit and actual Objective is the operational space fraud occupies.

- **Financial return** — Investment gains, lottery prize, inheritance, business opportunity
- **Relationship** — Love, friendship, emotional connect