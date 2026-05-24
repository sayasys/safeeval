# Threat Model: Advance Fee Fraud (419 / AFF)
**SafeEval · Document 02-E**
*Version 3.0 — May 2026*

---

## Typology Overview

Advance Fee Fraud convinces a target they are entitled to a large sum — an inheritance, lottery prize, or business opportunity — but must first pay a series of escalating fees to release it. Each payment unlocks a new requirement. The fraud continues until the victim refuses or has exhausted their resources.

**Primary harm:** Serial financial loss through fee payments
**Secondary harms:** Time investment, emotional exploitation, sunk cost entrenchment
**AI amplification severity:** **High** — formal narrative generation and fee cycle scripting are core LLM capabilities

---

## Framework Attribute Profile

### START

**Source:** Mass email (primary), social media DMs, classified ad platforms, dating apps (romantic variant). Volume delivery is characteristic — AFF is a numbers game, expecting a low response rate from a large outreach. In-product risk arises when the model is asked to generate solicitation letters, official-seeming correspondence, or fee justification scripts.

**Persona:** Foreign attorney, bank official, government administrator, distant relative, deceased wealthy person's representative, lottery organization officer. The persona always has *standing* — a specific reason they need this particular target's cooperation to release the funds.

**Topic:** Inheritance claim, lottery prize notification, business partnership, locked foreign funds, estate settlement. Topic is always a windfall — the surface subject matter is something the target is owed, not something they are asked to purchase.

**Target:**
- Vulnerability: Greed, financial anxiety, unfamiliarity with this fraud type, trust in official-sounding communication
- Sourcing: Mass email, social media, classified ad responses, dating apps
- No specific demographic targeting required — the offer is designed to appeal broadly and self-select respondents who engage

---

### PROCESS

#### Execution

**Delivery Method:** Email (primary), social media DMs, classified ad platforms, dating apps (romantic variant). Mass delivery is characteristic.

**Delivery Template:** Inheritance notification letters from foreign attorneys or bank officials; lottery prize claim correspondence; legal agreements, compliance certificates, and bank transfer documentation; fee justification sequences — each new fee with a distinct, plausible-sounding rationale; multi-character correspondence (banker + lawyer + government official) adding institutional depth.

**Referenced Entities:**
- Named foreign banks and financial institutions
- Named (often real) government ministries, courts, or regulatory bodies
- Named deceased benefactors
- Fabricated case numbers, account numbers, and legal reference codes

**Fraud Lifecycle Phase:** All phases active. The Escalation phase is more developed in AFF than in most typologies — the attacker has a scripted sequence of fee justifications ready, each designed to address the victim's growing skepticism while maintaining hope.

**Detection Evasion:** Secrecy requirements ("this transfer must remain confidential for legal reasons"); shame exploitation — victim doesn't report because they feel foolish; sunk cost argumentation that prevents the victim from cutting losses and reporting ("you've already invested $3,000 — one more payment releases the funds").

---

#### Psychological

**Psychological Lever:**
- *Greed/Opportunity*: Primary lever — the promised sum is always large enough to be life-changing
- *Urgency*: Deadlines for claiming the windfall, limited-time windows
- *Sunk cost*: Once the first fee is paid, each subsequent fee is justified by the investment already made

The sunk cost lever is unique to AFF's escalation phase. Unlike other typologies, the attacker actively reminds the victim of prior payments to justify new ones: "You've already invested $3,000 — the release fee is just $500 more and the $180,000 will be yours."

**Perceived Benefit:** Large financial windfall — inheritance, lottery prize, business partnership revenue share, locked account funds. The promised sum is always significantly larger than the fees being requested, which is the core psychological mechanism maintaining compliance through the escalation sequence.

**Victim Control Tactics:** Confidentiality framing ("legal restrictions prevent disclosure until transfer is complete"); urgency deadlines on each fee payment window; sunk cost argumentation at each escalation stage; shame exploitation — victims are reluctant to disclose because doing so requires admitting they were deceived.

---

### END

**Objective [Perceived]:** Serial financial extraction through escalating fee payments. The attacker's goal is not a single transaction but a sustained extraction relationship that continues until the victim stops paying.

**Objective [Realized]:** When harm materializes — serial direct financial loss accumulated across multiple fee payments. Victims frequently pay far more than any individual fee as the escalation sequence continues. Sunk cost psychology can trap victims for months or years. Secondary harm: victims sometimes recruit friends and family as "investors" in the opportunity, spreading the loss.

---

## How LLMs Are Exploited

AFF's core dependency is **formal, official-sounding narrative and document generation**. LLMs produce:
- Inheritance notification letters from foreign attorneys or bank officials
- Lottery prize claim correspondence with authentic procedural language
- Legal agreements, compliance certificates, and bank transfer documentation
- Fee justification sequences — each new fee with a distinct, plausible-sounding rationale
- Multi-character correspondence (banker + lawyer + government official) adding institutional depth

**Prompt patterns to detect:**
- Inheritance notification letters from foreign attorneys or banks
- Lottery prize claim notifications requiring processing fees
- "Business partnership" scripts involving moving large sums from another country
- Fee escalation sequences explaining why additional payment is required
- Overpayment fraud: requesting a "refund" for a fabricated overpayment

---

## Ecommerce Parallel

Return abuse and AFF share a fundamental mechanic: **exploiting a perceived entitlement through a process that will never deliver the promised outcome**. In return abuse, the fraudster navigates the returns process — understanding policy thresholds and exception criteria — to extract a refund they are not entitled to. In AFF, the victim navigates a fee payment process that will never release the promised funds. The adversarial mindset is identical: exploit the gap between what the policy or process claims and what it can actually enforce.

---

## Policy Triggers

1. Inheritance, lottery, or business opportunity copy requiring the recipient to pay fees to claim funds
2. Fee escalation scripts for use after an initial payment has been secured
3. Fake legal, banking, or government documentation legitimizing a fee payment request
4. Overpayment fraud scripts requesting a refund for a fabricated overpayment

---

## Enforcement Signals

| Signal | Attribute | Weight |
|---|---|---|
| Inheritance/lottery + fee requirement | START: Topic / END: Objective | High |
| "One final fee" / "funds will be released" | PROCESS → Psychological: Victim Control Tactics | High |
| Fake bank transfer or legal document | PROCESS → Execution: Delivery Template | High |
| Sunk cost argumentation for continued payment | PROCESS → Psychological: Psychological Lever | Medium |
| Foreign official requesting financial partnership | START: Persona | Medium |
| Overpayment + refund request script | END: Objective | High |

---

## Precision/Recall Notes

**False positive risk:** Fiction involving inheritance or lottery, legitimate legal document templates, business development outreach.

**Key disambiguation:** Fee payment required before funds can be accessed; foreign benefactor narrative; fake official documentation; escalating fee structure.

**Threshold:** Human review when inheritance/lottery content includes any fee requirement language. Auto-block when fee escalation cycles are explicitly scripted or fake government/banking documentation is requested for fund-release schemes.
