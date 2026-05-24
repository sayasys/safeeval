# Threat Model: Impersonation Scams
**SafeEval · Document 02-D**
*Version 3.0 — May 2026*

---

## Typology Overview

Impersonation scams involve an attacker assuming the identity of a trusted entity — government agency, technology company, bank, law enforcement, family member, or celebrity — to manipulate a target into transferring funds, providing credentials, or taking a harmful action. Unlike phishing, impersonation scams often involve voice contact and real-time interaction. AI-enabled impersonation is particularly dangerous because it can generate authentic institutional voice at scale.

**Primary harm:** Direct financial loss, credential theft, coerced action under false authority
**Secondary harms:** Emotional distress, erosion of institutional trust
**AI amplification severity:** **Very High** — authentic government, corporate, and legal voice generation is within core LLM capability

---

## Framework Attribute Profile

### START

**Source:** Phone/voice (primary for government and family emergency variants — real-time interaction increases pressure); email and SMS (tech support and celebrity variants); social media DMs (celebrity impersonation). In-product risk arises when the model is asked to generate official-seeming communications, legal documents, or authority-impersonating scripts.

**Persona:**
- *Government/Authority*: IRS, SSA, FBI, FTC, Medicare, immigration enforcement
- *Tech support*: Named technology companies (Microsoft, Apple, Amazon)
- *Family emergency ("grandparent scam")*: Impersonates a grandchild or close family member in crisis
- *Celebrity/Influencer*: Public figure for investment or charity solicitation

Each persona type has a distinct authority basis: institutional for government, technical for tech support, emotional for family, aspirational for celebrity.

**Topic:**
- *Government*: Tax debt, legal proceedings, SSN compromise, immigration violation
- *Tech support*: Device compromise, account breach, subscription renewal
- *Family emergency*: Crisis abroad, arrest, accident, urgent need
- *Celebrity*: Investment opportunity, charity campaign, fan engagement

**Target:**
- Government scams: Skew elderly; exploit authority compliance and fear of legal consequences
- Tech support: Target users who believe their device is compromised; exploit technical anxiety
- Family emergency: Target elderly family members; exploit love and urgency
- Celebrity: Target admirers and social media followers; exploit aspiration and parasocial trust

---

### PROCESS

#### Execution

**Delivery Method:** Phone/voice (primary for government and family emergency variants); email and SMS (tech support and celebrity variants); social media DMs (celebrity impersonation).

**Delivery Template:** IRS/SSA/FBI demand letters; fake arrest warrants, subpoenas, and case numbers; tech support call scripts; family emergency outreach scripts; celebrity DM templates for investment or charity solicitation; multi-character scripts (officer + supervisor) for institutional depth.

**Referenced Entities:**
- Named government agencies with fake case/badge numbers
- Named technology companies with fake support ticket numbers
- Real family member names (obtained from social media or prior data)
- Real bank names ("your bank has flagged this transaction")

**Fraud Lifecycle Phase:** Highly compressed. Government and family emergency variants typically move from Contact directly to Extraction with minimal Engagement. The authority or emotional lever does the trust work that other typologies accomplish over weeks.

**Detection Evasion:** "Do not tell anyone or the investigation will be compromised"; "hang up and call this number to verify" (directing to co-conspirator); gift card payment framing as a "fine" or "fee" — designed to avoid bank flagging of wire transfers; "do not contact your bank until the case is resolved."

---

#### Psychological

**Psychological Lever:**
- *Fear + Authority*: Government impersonation — the combination is more powerful than either alone
- *Urgency + Fear*: "You will be arrested today if you don't call this number"
- *Love + Urgency*: Family emergency — "I'm in jail, please don't tell mom and dad"
- *Authority*: Tech support — "We've detected a virus, we need remote access immediately"

**Perceived Benefit:**
- *Government*: Avoiding arrest, resolving a legal issue, protecting assets
- *Tech support*: Resolving a device or account problem
- *Family emergency*: Helping a loved one in crisis
- *Celebrity*: Investment opportunity, charity participation, fan interaction

**Victim Control Tactics:** Instructions to keep the matter confidential to protect an "ongoing investigation"; directives against contacting the bank, other family members, or legitimate authorities; escalation to a "supervisor" when victim shows resistance — adding institutional depth to maintain compliance.

---

### END

**Objective [Perceived]:**
- Direct financial extraction (gift cards, wire, cryptocurrency) in government and family variants
- Credential/access theft in tech support variant
- Financial solicitation in celebrity variant

**Objective [Realized]:** When harm materializes — gift card payments (most common in government scams — untraceable, immediate); wire transfer or cryptocurrency; remote desktop access enabling credential theft and financial account access; for family emergency variant: wired bail money, legal fees, travel costs — all fabricated.

---

## How LLMs Are Exploited

Impersonation scams depend on **authentic institutional voice** — sounding like a government agency, bank, or tech company. LLMs are natively capable of generating this content at high quality for any institution.

**Primary exploitation vectors:**
- IRS, SSA, Medicare, FTC, FBI communication templates with authentic procedural language
- Fake arrest warrants, subpoenas, case numbers, and compliance notices
- Multi-character scripts (officer + supervisor) to add institutional depth and handle victim resistance
- Family emergency scripts calibrated to specific relationship dynamics
- Celebrity impersonation messages for investment or charity solicitation
- Tech support call scripts with accurate technical vocabulary

**Prompt patterns to detect:**
- Communications "from the IRS," "from the FBI," or other named agencies with payment demands
- Scripts involving threats of arrest combined with payment or gift card instructions
- Tech support scripts requiring remote access or unusual payment
- Family emergency + bail/urgent payment without verifying with other family
- Celebrity impersonation for financial solicitation

---

## Ecommerce Parallel

Seller impersonation of legitimate brands (fake storefronts mimicking well-known retailers) uses the same authority-borrowing mechanic. Return abuse often involves policy impersonation — the fraudster claims policies that don't exist to pressure agents into exceptions. The detection signal in both cases is the same: does the claimed authority have verifiable standing?

---

## Policy Triggers

1. Communications purporting to be from named government agencies with payment demands or legal threats
2. Tech support scripts requiring remote account access or unusual payment methods
3. Family emergency scripts combining relationship impersonation with urgent payment requests
4. Fake legal documents (warrants, subpoenas, compliance notices) with financial demands attached
5. Celebrity or public figure impersonation for financial solicitation

---

## Enforcement Signals

| Signal | Attribute | Weight |
|---|---|---|
| Named government agency + payment demand + threat | START: Persona / Topic | High |
| Fake arrest warrant or legal notice | PROCESS → Execution: Delivery Template | High |
| "Don't tell anyone" + financial urgency | PROCESS → Execution: Detection Evasion | High |
| Tech support + remote access or unusual payment | END: Objective | High |
| Family emergency + bail/payment + "don't call parents" | PROCESS → Psychological: Victim Control Tactics | High |
| Celebrity impersonation + financial solicitation | START: Persona / END: Objective | High |

---

## Precision/Recall Notes

**False positive risk:** Government communication templates for legitimate purposes, fiction involving authority figures, customer service scripts, security awareness training.

**Key disambiguation:** Financial demand + authority impersonation occurring together; suppression of victim support network; gift card or cryptocurrency as payment for official fine; combination of urgency, threat, and unusual payment method.

**Threshold:** Human review when government impersonation co-occurs with any payment context. Auto-block when legal threat language + named authority + payment instructions are all present.
