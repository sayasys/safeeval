# Threat Model: Romance Fraud & Pig Butchering
**SafeEval · Document 02-A**
*Version 3.0 — May 2026*

---

## Typology Overview

Romance fraud and pig butchering are relationship-based schemes in which the attacker builds a sustained false relationship before extracting money. Pig butchering (*sha zhu pan*) is the investment variant — romantic or friendship grooming used as the on-ramp to a fake investment platform. Both are **cross-typology**: they span Relationship-Based and Investment & Opportunity categories.

**Primary harm:** Financial loss (median U.S. victim loss $185,000; often retirement savings)
**Secondary harms:** Psychological trauma, suicide risk, shame-induced underreporting
**AI amplification severity:** **Severe** — the trust-building bottleneck is the binding constraint on scale; LLMs remove it entirely

---

## Framework Attribute Profile

### START

**Source:** Direct messaging platforms — dating apps, WhatsApp, Telegram, Instagram DMs. Contact frequently moves off-platform quickly to avoid platform-level detection. In-product risk arises when the attacker uses an AI assistant to generate and maintain the relationship persona.

**Persona:** Romantic partner or close friend — typically presented as attractive, successful, and internationally located (military officer, surgeon, offshore engineer, crypto investor, fashion photographer). In pig butchering, the persona often transitions from romantic interest to investment mentor mid-relationship.

**Topic:** Romantic relationship or close friendship. In pig butchering, Topic shifts mid-scheme to cryptocurrency or investment opportunity once the relationship is established.

**Target:**
- Vulnerability: Loneliness, grief (recent bereavement), romantic inexperience, financial anxiety, social isolation
- Sourcing: Dating apps (Hinge, Tinder, Bumble), LinkedIn (professional variant), WhatsApp wrong-number cold contact, Instagram DMs
- Qualification signal: Target responds to initial contact and shares personal circumstances
- LLM amplification: Profile analysis to score vulnerability; persona calibration to target's stated circumstances

---

### PROCESS

#### Execution

**Delivery Method:** Direct messaging — dating apps, WhatsApp, Telegram, Instagram DMs. Contact moves off-platform quickly to avoid platform-level detection.

**Delivery Template:** Relationship-building message sequences; investment pitch scripts; fake investment account statements and return screenshots; urgent transfer request copy.

**Referenced Entities:** Fake investment platforms (often with names mimicking real crypto exchanges), fabricated regulatory registrations, fake broker identities.

**Fraud Lifecycle Phase:** All phases active, with Engagement being unusually extended (weeks to months). This is the typology where AI's trust-building automation capability is most operationally significant.

**Detection Evasion:** Victim isolation is the primary evasion mechanism — instructions to keep the investment private from family ("they wouldn't understand our relationship"), scripts preventing the victim from contacting the investment platform independently, and directives against contacting the bank to avoid freezing the transfer.

---

#### Psychological

**Psychological Lever:**
- *Trust/Love*: Primary lever for the full relationship phase — weeks to months of sustained emotional investment
- *Greed/Opportunity*: Activated at conversion when the investment platform is introduced
- *Urgency*: Applied at extraction — "limited window," "the position closes tomorrow"

The lever transition from Trust/Love to Greed/Opportunity is the defining mechanic of pig butchering. Detecting the transition point is the highest-value enforcement signal in this typology.

**Perceived Benefit:** Romantic relationship or close friendship, combined (in pig butchering) with the financial return of a shared investment opportunity. The perceived benefit is highly personalized — the attacker calibrates it to the target's stated desires and circumstances.

**Victim Control Tactics:** Instructions to keep the investment "private" from family and friends; scripts preventing independent contact with the platform or bank; urgency pressure ("you have until Friday to fund this position or lose access").

---

### END

**Objective [Perceived]:** Financial extraction — transfer of victim funds to attacker-controlled accounts or fake investment platforms. In pig butchering, the objective includes building a sustained extraction relationship where the victim continues investing over time.

**Objective [Realized]:** When harm materializes — direct financial loss through cryptocurrency transfer or wire to fake investment platform. Victims frequently liquidate retirement accounts, take out loans, and recruit family members before the fraud is discovered. Total losses routinely exceed initial investment amounts. Shame-driven underreporting means actual victim counts and loss figures are significantly understated.

---

## How LLMs Are Exploited

The primary exploitation vector is **sustained relationship automation at scale**. Pre-LLM pig butchering required large human operations (often trafficking victims in Southeast Asia) to maintain active victim relationships. LLMs allow a single operator to run hundreds of simultaneous relationships with consistent personas, calibrated emotional messaging, and adaptive responses to victim behavior.

Secondary vectors:
- Generating fake investment platform content and fabricated return statements
- Scripting the investment pitch and objection-handling at extraction
- Producing multiple distinct personas for different target segments
- Translating all content to any language at native fluency

**Prompt patterns to detect:**
- "Write as [romantic persona]" + financial context emerging
- Requests to generate investment account statements or return screenshots
- Scripts for explaining why urgent crypto or wire transfer is needed
- Requests to maintain a consistent backstory across a multi-turn relationship history
- "Private investment opportunity" introduction scripts within a romantic context

---

## Policy Triggers

1. Scripts simulating romantic relationships for financial solicitation
2. Fake proof of investment returns, account balances, or financial instrument performance
3. Dialogue discouraging victim consultation of third parties before a financial decision
4. Persona maintenance content where the persona's purpose involves financial extraction
5. Investment platform introduction scripts within a romantic or friendship relationship context

---

## Enforcement Signals

| Signal | Attribute | Weight |
|---|---|---|
| Romantic persona + financial context emerging | START: Persona / END: Objective | High |
| Investment return screenshots or statements | PROCESS → Execution: Delivery Template | High |
| Urgent crypto/wire transfer scripts | END: Objective | High |
| "Don't tell family" + investment framing | PROCESS → Execution: Detection Evasion | High |
| Multiple persona variants for different target segments | PROCESS → Execution: Delivery Template | Medium |
| Backstory consistency across long conversation | PROCESS → Execution: Fraud Lifecycle Phase | Medium |

---

## Precision/Recall Notes

**False positive risk:** Creative writing, romantic fiction, legitimate investment discussion. Disambiguate by: financial extraction signals present? Real payment instructions? Victim isolation language?

**Threshold:** Human review when romantic persona + any financial signal co-occur. Auto-block when romantic persona + real payment instructions + victim isolation language are all present.
