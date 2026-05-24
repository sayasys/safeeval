# Threat Model: Synthetic Identity Fraud
**SafeEval · Document 02-G**
*Version 3.0 — May 2026*

---

## Typology Overview

Synthetic identity fraud involves creating fictitious identities — fully fabricated or blended from real and fake information — to open accounts, generate fake social proof, or operate at scale while evading identity-based detection. On AI platforms, it primarily manifests as fake review networks, coordinated manipulation campaigns, and scaled fraud operations hiding behind many distinct-seeming accounts.

**Primary harm:** Platform integrity degradation; enabling other fraud at scale
**Secondary harms:** Harm to individuals whose partial identity data is incorporated; regulatory exposure for platforms
**AI amplification severity:** **Severe** — LLMs generate coherent, contextually consistent synthetic identities at massive scale with no human bottleneck

---

## Framework Attribute Profile

### START

**Source:** Direct API access (primary — bulk generation requires programmatic access); consumer product (individual synthetic persona requests); operator-deployed products where the operator has not restricted bulk content generation. In-product risk is particularly acute because the model is being used to generate the fraud infrastructure itself, not just to draft communications.

**Persona:** Not a single persona but many — the defining feature of synthetic identity fraud is the generation of *multiple distinct-seeming identities*, each with a consistent backstory, communication style, and platform history. Each fake identity is its own persona, designed to appear as a real, independent user.

**Topic:** Product reviews, user testimonials, community forum posts, investment platform ratings, social media profiles. The surface topic is peer validation — synthetic identity fraud manufactures the appearance of organic user consensus.

**Target:**
- *Platform trust systems*: The review, rating, and community systems that legitimate users rely on to make decisions
- *Real users*: Deceived by fake social proof into trusting fraudulent sellers, investments, or products
- *Identity verification systems*: KYC and authentication systems that can be defeated by synthetic identity packages

---

### PROCESS

#### Execution

**Delivery Method:** Review and rating platforms (direct injection of fake reviews); social media (fake accounts seeding content); API access (programmatic fake account creation at scale); forum and community platforms (fake members validating fraudulent offers).

**Delivery Template:** Bulk product or service reviews with varied writing styles and reviewer demographics; synthetic user profile bios and posting histories; fake investor or customer testimonials; varied fake community posts simulating organic validation; identity documentation packages for account creation.

**Referenced Entities:** Real platforms whose review systems are being manipulated (Amazon, Google, Trustpilot, App stores); real product or service categories whose credibility is being borrowed; in identity document fraud: real identity data elements from breach records.

**Fraud Lifecycle Phase:** Synthetic identity fraud typically operates across Targeting and Engagement phases of *other* fraud typologies. The fake identities and reviews are built infrastructure that makes other fraud (investment fraud, seller fraud, romance fraud) more effective. This typology is most usefully understood as an enabler rather than a standalone scheme.

**Detection Evasion:** Explicit "make it look organic" or "make them seem like different people" framing; requests for content variation specifically to defeat clustering detection; account aging guidance — making synthetic accounts appear to have legitimate history; instructions to space review posting over time to avoid velocity signals.

---

#### Psychological

**Psychological Lever:**
- *Social proof*: The fundamental lever — humans defer to the apparent consensus of peers. Synthetic identity fraud manufactures that consensus.
- *Authority through volume*: "If 200 reviewers all say this investment platform is legitimate, it must be"

**Perceived Benefit (for the person the synthetic identity is interacting with):** Genuine peer reviews, authentic community validation, real user endorsement. The target believes they are accessing organic social proof when they are interacting with manufactured consensus.

**Victim Control Tactics:** No direct victim control is involved — synthetic identity fraud operates at the infrastructure level, manipulating the information environment rather than individual targets. Suppression of legitimate negative signals is structural: by saturating review systems with fake content, authentic dissenting voices are diluted without any direct interaction with potential victims.

---

### END

**Objective [Perceived]:** Platform manipulation — distorting trust signals through fake social proof; infrastructure building — creating account networks for volume-dependent fraud operations; authentication evasion — defeating identity-based access controls.

**Objective [Realized]:** When harm materializes — platform trust degradation where users cannot distinguish genuine from manufactured social proof; secondary harm: victims of investment fraud, seller fraud, or romance fraud were made more vulnerable by the fake social proof infrastructure; identity theft risk for individuals whose partial data was incorporated into synthetic identities; regulatory exposure for platforms unable to demonstrate adequate controls against coordinated inauthentic behavior.

---

## How LLMs Are Exploited

Synthetic identity fraud has two primary exploitation modes on AI platforms:

**Mode 1: Using the API to generate synthetic identity content** — fake reviews, profiles, community posts — at scale.

**Mode 2: Using synthetic identities to access the API** — fake accounts used to create API keys or access consumer products, circumventing per-account rate limits or detection.

**Primary exploitation vectors:**
- Bulk fake product or service reviews across multiple "distinct" reviewer voices
- Fake user profile bios, posting histories, and social content in volume
- Fake testimonials for investment platforms, fraudulent products, or scam services
- Varied fake community posts simulating organic validation
- Identity documentation packages for account creation

**Prompt patterns to detect:**
- Multiple unique reviews for the same product/service with "diverse reviewer" framing
- "Different writing styles" or "different demographics" for reviews of the same subject
- Bulk user profile bios or posting histories
- Fake testimonials for financial platforms or investment opportunities
- "Make it look organic" + varied content for the same underlying message

---

## Ecommerce Parallel

Malicious review campaigns are synthetic identity fraud applied directly to marketplace trust systems. The operational mechanics are identical: create synthetic reviewer identities with varied profiles, generate varied review content, age accounts to avoid velocity detection, coordinate timing to avoid clustering signals. Direct experience with malicious review detection in ecommerce is the most applicable background for detecting synthetic identity fraud on AI platforms — the signals are the same, applied to a new surface.

Return abuse repeat offenders running new accounts after being flagged are also running a simple synthetic identity operation — a new account is a new synthetic identity for the purpose of defeating account-level controls.

---

## Policy Triggers

1. Bulk fake reviews, testimonials, or ratings for products, services, or platforms (threshold: 3+ variants with organic-appearance framing)
2. Synthetic user personas with fabricated histories designed to appear as real users
3. Varied fake community content with explicit "organic appearance" framing for fraudulent platforms
4. Identity documentation generation for account creation or verification bypass
5. Fake investor, customer, or community member profiles to legitimize fraudulent offerings

---

## Enforcement Signals

| Signal | Attribute | Weight |
|---|---|---|
| Bulk review generation for same product/service | END: Objective | High |
| "Diverse personas" or "different voices" for same subject | PROCESS → Execution: Delivery Template | High |
| Fake testimonials for financial platform | PROCESS → Execution: Delivery Template | High |
| "Make it look organic" / variation requests | PROCESS → Execution: Detection Evasion | High |
| Synthetic profile bio + posting history in bulk | PROCESS → Execution: Delivery Template | High |
| Identity document generation for verification bypass | PROCESS → Execution: Detection Evasion | High |

---

## Precision/Recall Notes

**False positive risk:** Fiction writing with multiple distinct characters, legitimate market research, UX persona development, creative writing prompts.

**Key disambiguation:** Same subject across multiple "diverse" voices; financial platform context; explicit organic-appearance framing; bulk volume indicators.

**Threshold:** Human review when review/testimonial generation requests exceed 3 variants for the same subject. Auto-block when bulk generation + financial platform context + organic-appearance framing are combined, or identity documentation is requested for verification purposes.
