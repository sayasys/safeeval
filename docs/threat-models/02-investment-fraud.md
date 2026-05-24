# Threat Model: Investment Fraud
**SafeEval · Document 02-B**
*Version 3.0 — May 2026*

---

## Typology Overview

Investment fraud encompasses schemes where victims transfer money under the belief they are making a legitimate investment. Variants include fake cryptocurrency platforms, Ponzi and pyramid schemes, pump-and-dump, and fraudulent business opportunities. LLMs dramatically amplify the persuasiveness and production speed of investment fraud content.

**Primary harm:** Financial loss ranging from hundreds to millions per victim
**Secondary harms:** Retirement savings depletion, family financial destabilization, secondary victimization when victims recruit others
**AI amplification severity:** **Very High** — investment narratives, documentation, and platform copy are all within LLM core capability

---

## Framework Attribute Profile

### START

**Source:** Social media financial communities, direct messaging, dating apps (pig butchering variant), email, Telegram investment groups. In-product risk arises when the model is asked to generate investment documentation, pitch copy, or fake regulatory materials.

**Persona:** Successful investor, fund manager, crypto insider, financial influencer, or a friend who "made significant returns." In platform-based variants, the persona may be an automated trading system or AI advisor rather than an individual.

**Topic:** Investment opportunity, cryptocurrency platform, trading strategy, or financial returns. Surface-level subject matter is consistently financial — this is one of the more directly observable Topics across typologies.

**Target:**
- Vulnerability: Financial anxiety, retirement insecurity, recent windfall, greed, low investment sophistication, social proof susceptibility
- Sourcing: Social media financial communities (Reddit, Facebook groups, Telegram channels), LinkedIn, dating apps (convergent with pig butchering), email lists
- LLM amplification: Generating personalized pitch variations for different financial profiles; analyzing public posts for financial circumstance signals

---

### PROCESS

#### Execution

**Delivery Method:** Social media, direct message, dating apps (pig butchering variant), email, Telegram investment communities, fake financial news sites.

**Delivery Template:** Investment thesis documents, fund prospectuses, fake audit reports and trading statements, fake regulatory registration certificates, platform marketing copy, investor testimonials, fee justification scripts.

**Referenced Entities:** Fake brokerage names (often mimicking real firms), fabricated SEC/FCA/FINRA registrations, fake financial news outlets, celebrity endorsement references, real financial regulatory body names used to imply authorization.

**Fraud Lifecycle Phase:** All phases active. The "seeding" tactic — allowing small early withdrawals to prove legitimacy — is a deliberate trust-building mechanism that bridges Engagement and Conversion before the larger extraction.

**Detection Evasion:** Scripts directing victims not to contact financial regulators ("your account is under a compliance hold"); instructions to explain a wire transfer to the bank as "personal investment" to avoid scrutiny; scripts explaining why an independent financial advisor "wouldn't understand this opportunity."

---

#### Psychological

**Psychological Lever:**
- *Greed/Opportunity*: Primary lever — extraordinary returns, exclusive access, limited availability
- *Fear of Missing Out*: "This position closes Friday," "only 12 spots remaining"
- *Social proof*: Fabricated community of investors validating the opportunity
- *Authority*: Fake regulatory registrations, fabricated analyst endorsements

**Perceived Benefit:** Investment returns, financial security, exclusive access to an opportunity, passive income. The seeding tactic — allowing small early withdrawals — is a deliberate mechanism to make the Perceived Benefit feel real before the larger extraction.

**Victim Control Tactics:** Discouraging contact with regulators or independent financial advisors; urgency framing around investment windows; once extraction begins, withdrawal obstruction scripts explaining why funds cannot be accessed ("tax clearance required," "compliance hold," "processing delay").

---

### END

**Objective [Perceived]:** Financial extraction — transfer of victim funds to attacker-controlled platforms or accounts. In advanced variants, sustained extraction through fee escalation cycles after the initial investment is made.

**Objective [Realized]:** When harm materializes — direct financial loss through wire transfer, cryptocurrency, or ACH. Victims frequently escalate investment after early "returns" (the seeding tactic), meaning total losses are often multiples of initial investment. Withdrawal fee escalation compounds loss: once extraction is complete, additional fees are demanded to release "profits."

---

## How LLMs Are Exploited

Investment fraud's core dependency is **persuasive financial content generation at scale**. LLMs produce:
- Investment thesis documents and fund overviews with sophisticated-sounding analysis
- Fake prospectuses, audited return statements, and risk disclosure documents
- Analyst-style research reports with plausible financial modeling language
- Fabricated regulatory registration certificates and compliance documentation
- Personalized pitch copy tailored to a target's stated financial goals
- Platform marketing copy and fake investor testimonials

**The critical AI-specific risk:** Mass personalization of investment pitches. Traditional boiler room fraud required human callers; AI-assisted fraud runs thousands of individualized, sophisticated conversations simultaneously.

**Prompt patterns to detect:**
- Investment thesis or fund overview copy with extraordinary return claims
- Prompts to generate "investor testimonials" or "reviews" for a specific platform
- Requests to create fake regulatory certificates or compliance documents
- Generating trading statements, account balance copy, or return history
- "Explaining fees before withdrawal" scripts

---

## Ecommerce Parallel

Investment fraud is structurally identical to marketplace seller fraud:

| Seller Fraud | Investment Fraud |
|---|---|
| Fake storefront with seeded positive reviews | Fake platform with seeded "returns" |
| Small successful transactions to build history | Small early withdrawals to prove legitimacy |
| Large fraudulent transaction after trust established | Large investment after trust established |
| Disappear or manufacture dispute barrier | Disappear or manufacture fee barrier |

The enforcement pattern is identical: watch for trust-building followed by a disproportionate extraction ask.

---

## Policy Triggers

1. Investment pitch content with extraordinary return claims for a specific platform
2. Fake financial documentation — audits, prospectuses, trading statements, regulatory filings
3. Fabricated investor testimonials or community validation for investment platforms
4. Fee or tax escalation scripts requiring payment before funds can be released
5. Scripts discouraging regulatory contact in the context of an investment opportunity

---

## Enforcement Signals

| Signal | Attribute | Weight |
|---|---|---|
| Extraordinary returns + document generation | END: Objective / PROCESS → Execution: Delivery Template | High |
| Fake SEC/FCA/FINRA registration copy | PROCESS → Execution: Referenced Entities | High |
| "Fee required before withdrawal" script | PROCESS → Psychological: Victim Control Tactics | High |
| Fake audit report or trading statement | PROCESS → Execution: Delivery Template | High |
| Fabricated testimonials for investment platform | PROCESS → Execution: Delivery Template | Medium |
| Scripts discouraging regulatory contact | PROCESS → Execution: Detection Evasion | High |

---

## Precision/Recall Notes

**False positive risk:** Legitimate financial writing, investment education, fiction involving financial schemes, real pitch deck copy.

**Key disambiguation:** Extraordinary return claims (>10% monthly) + specific platform + document generation for unverified entity.

**Threshold:** Human review for investment content with unusual return claims. Auto-block when fake regulatory documents, fake trading statements, or withdrawal fee scripts are explicitly requested.
