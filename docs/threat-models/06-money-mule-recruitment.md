# Threat Model: Money Mule Recruitment
**SafeEval · Document 02-F**
*Version 3.0 — May 2026*

---

## Typology Overview

Money mule recruitment finds and recruits individuals — knowingly or unknowingly — to receive and forward stolen funds, laundering money through accounts that appear legitimate. Mules are recruited via fake job postings, romance fraud, social media, and direct outreach. This is a Fraud Infrastructure typology: the direct target is often an unwitting participant rather than a traditional victim, and the harm extends to the criminal exposure the recruited mule faces.

**Primary harm:** Financial harm to original fraud victims; criminal and financial exposure for recruited mules
**Secondary harms:** Money laundering infrastructure enabling large-scale financial crime
**AI amplification severity:** **High** — the entire recruitment infrastructure (job postings, company documentation, onboarding materials) is within LLM production capability

---

## Framework Attribute Profile

### START

**Source:** Job boards (Indeed, ZipRecruiter, Craigslist), social media outreach, university forums, unsolicited email/SMS, dating apps (romance-based variant). In-product risk arises when the model is asked to generate job postings for payment processing roles, onboarding documents for personal-account money movement, or bank call scripts.

**Persona:** Recruiter or HR representative for a legitimate-seeming company, employer, financial processing firm, or international business. In romance-based mule recruitment, the persona is a romantic partner who eventually introduces the "opportunity."

**Topic:** Remote job opportunity, financial coordinator role, payment processing position, work-from-home income. The surface topic is employment — nothing in the Topic signals financial crime to a target unfamiliar with money mule patterns.

**Target:**
- Vulnerability: Financial desperation, unemployment, debt stress, youth (less financial literacy), immigration status (fear of authorities makes reporting less likely)
- Sourcing: Job boards, social media, university forums, targeted outreach to recently unemployed
- Unique targeting dynamic: The mule is simultaneously victim (faces criminal exposure) and instrument (enables harm to others). This dual status is not present in other typologies.

---

### PROCESS

#### Execution

**Delivery Method:** Job boards and professional platforms (primary for job-based recruitment); direct social media outreach; dating apps and messaging platforms (romance-based variant); unsolicited email or SMS ("we found your resume").

**Delivery Template:** Job postings for "payment processor," "financial coordinator," or "remote transfer agent" roles; complete fake company onboarding suites (offer letters, employee handbooks, training materials); professional HR/manager correspondence maintaining the employment fiction; transfer instructions framed as normal business payment processing; commission structure documents.

**Referenced Entities:**
- Fake company names and websites
- Real payment platform names (Zelle, Venmo, PayPal) used to legitimize the transaction mechanics
- Sometimes real bank names as "clients" whose payments are being "processed"

**Fraud Lifecycle Phase:** Job-based mule recruitment compresses Contact through Extraction in a structured onboarding sequence. The "Engagement" phase is the fake hiring process — interviews, background checks, offer letters — which functions as trust-building through process rather than relationship.

**Detection Evasion:** Structuring instructions to keep transfer amounts below bank reporting thresholds; bank call scripts for explaining away suspicious transaction patterns ("say it's for your personal freelance business"); instructions to use cryptocurrency for the forwarding leg to obscure the trail; instructions to avoid mentioning the foreign company origin.

---

#### Psychological

**Psychological Lever:**
- *Financial opportunity/desperation*: The combination of a legitimate-seeming job and the target's financial need is the primary compliance mechanism
- *Authority*: The professional employment framing — offer letters, contracts, HR correspondence — lends institutional weight
- In romance-based variant: *Trust/Love* transitions to financial opportunity at the point of mule recruitment

**Perceived Benefit:** Legitimate employment, supplemental income, freelance opportunity, commission-based work. The perceived benefit is specifically calibrated to appear as normal employment — the mule believes they have found a job, not participated in fraud.

**Victim Control Tactics:** Professional framing that normalizes suspicious activity ("this is standard international payment processing"); instructions framed as company policy rather than fraud ("per our compliance requirements, keep transfer amounts under $9,000"); urgency around "client payments" that need to be forwarded same-day.

---

### END

**Objective [Perceived]:** Infrastructure building — recruiting a network of accounts to receive and launder stolen funds at scale. Each mule is a node in a money laundering network that distances stolen funds from their origin.

**Objective [Realized]:** When harm materializes — original fraud victims' stolen funds are laundered through mule accounts, making recovery significantly harder; recruited mules face bank account closure, financial liability, and potential criminal prosecution for money laundering. The most damaging outcome is when unwitting mules — who genuinely believed they had legitimate employment — face criminal charges.

---

## How LLMs Are Exploited

Money mule operations require a **complete fake employment infrastructure** — job postings, company documentation, onboarding materials, HR correspondence. LLMs generate this entire infrastructure.

**Primary exploitation vectors:**
- Job postings for "payment processor," "financial coordinator," or "remote transfer agent" roles
- Complete fake company onboarding suites: offer letters, employee handbooks, training materials
- Professional HR/manager correspondence maintaining the employment fiction
- Bank call scripts for mules to use when questioned about transactions
- Transfer instructions framed as normal business payment processing
- Commission structure documents making the activity appear as a standard fee arrangement

**Prompt patterns to detect:**
- Job postings for receiving/forwarding money or processing "international payments" from home
- Onboarding documents for financial "coordinator" roles using personal accounts
- Bank call scripts explaining large transfers made through personal accounts
- Transfer instructions with structuring guidance (amounts below reporting thresholds)
- "Training materials" for a role primarily involving moving money

---

## Ecommerce Parallel

Fraudulent seller accounts in marketplaces are frequently used as mule infrastructure. Triangulation fraud uses a stolen card to purchase goods from a legitimate retailer, then sells them on a marketplace — the seller account receives legitimate-looking funds and forwards value to the fraudster. The enforcement logic is directly applicable: accounts whose transaction patterns (volume, destinations, structuring) are inconsistent with their stated business purpose are high-priority signals.

---

## Policy Triggers

1. Job postings for roles involving receiving and forwarding money through personal accounts
2. Onboarding or training materials for "payment processing" roles using personal financial accounts
3. Bank call scripts designed to explain suspicious transaction patterns to financial institutions
4. Transfer instructions including structuring guidance or methods to avoid transaction reporting thresholds
5. Fake company formation document suites used for mule recruitment

---

## Enforcement Signals

| Signal | Attribute | Weight |
|---|---|---|
| "Receive + forward money" job posting | START: Topic / END: Objective | High |
| Onboarding docs for personal-account payment role | PROCESS → Execution: Delivery Template | High |
| Bank call script for explaining large transfers | PROCESS → Execution: Detection Evasion | High |
| Structuring instructions (sub-threshold amounts) | PROCESS → Execution: Detection Evasion | High |
| Fake company formation document suite | PROCESS → Execution: Delivery Template | High |
| Commission structure for money movement role | PROCESS → Psychological: Perceived Benefit | Medium |

---

## Precision/Recall Notes

**False positive risk:** Legitimate remote finance job descriptions, freelance payment processing for small businesses, financial crime education.

**Key disambiguation:** Personal account use for receiving and forwarding third-party funds; structuring language; bank evasion script; combination of employment framing + money movement instructions.

**Threshold:** Human review when job content involves personal account financial transactions. Auto-block when bank evasion scripts, structuring instructions, or fake company infrastructure for money movement recruitment are explicitly present.
