# Threat Model: Phishing & Spearphishing
**SafeEval · Document 02-C**
*Version 3.0 — May 2026*

---

## Typology Overview

Phishing uses deceptive communications to trick recipients into revealing credentials, clicking malicious links, or authorizing fraudulent transactions. Spearphishing is the targeted variant, personalized using specific information about the target. In AI-enabled contexts, the quality gap between phishing and legitimate communications has effectively collapsed.

**Primary harm:** Credential theft, financial account access, corporate network compromise, identity theft
**Secondary harms:** Data breach, ransomware deployment, secondary fraud enabled by stolen access
**AI amplification severity:** **Very High** — the primary historical detection signal (poor language quality) is eliminated entirely

---

## Framework Attribute Profile

### START

**Source:** Email (primary), SMS (smishing), voice (vishing). In-product risk arises when the model is asked to generate brand-impersonating copy, BEC scripts, or high-volume message variants. The delivery channel must match the claimed persona — channel mismatch is itself a detection signal.

**Persona:** Internal IT team, executive or executive assistant, bank or financial institution, government agency, known vendor or supplier, HR department. The persona is an entity the target already has a trust relationship with — phishing borrows existing trust rather than building it.

**Topic:** Security alert, invoice or payment request, account verification, password reset, compliance action, manager instruction. Topic is designed to appear routine — the surface subject matter is something the target would expect to receive in the normal course of business.

**Target:**
- Individual vulnerability: Role-based (finance, IT, executive assistant — people with payment or access authority), time pressure susceptibility, authority compliance tendency
- Organizational vulnerability: Accounts payable, credential management systems, wire transfer approval workflows
- Spearphishing specificity: Target selected because of a specific known context (new hire, recent acquisition, active vendor relationship, named project)

---

### PROCESS

#### Execution

**Delivery Method:** Email (primary), SMS (smishing), voice (vishing). The delivery method is inseparable from the persona — the channel must match the claimed identity.

**Delivery Template:** Brand-accurate email templates, BEC wire transfer authorization requests, fake invoice copy, fake IT security alert, vishing call scripts, spearphishing messages with injected personal detail.

**Referenced Entities:** Named real organizations are the defining mechanic of phishing. The entire credibility structure depends on borrowing trust from a recognized brand, institution, or individual. In spearphishing, referenced entities extend to named internal contacts, real project names, and actual vendor relationships.

**Fraud Lifecycle Phase:** Phishing is the most compressed typology — it typically spans only Contact through Extraction in a single message or very short sequence. There is no meaningful Engagement phase. This compression makes phishing difficult to detect at the content level: there are few preceding signals before the extraction ask.

**Detection Evasion:** Explicit requests to rewrite content to avoid spam filters or email security systems; requests for content that will "pass" as legitimate to security-aware recipients; high-volume variant generation of the same phishing message (campaign infrastructure indicator); requests to avoid specific known spam trigger phrases.

---

#### Psychological

**Psychological Lever:**
- *Authority*: Compliance with IT, HR, executive, or institutional demand
- *Urgency*: "Your account will be locked," "invoice overdue," "wire must process today"
- *Fear*: "Security breach detected," "compliance failure," "legal action pending"

Unlike relationship-based fraud, phishing rarely uses Trust/Love as a lever. It works through authority and urgency — the victim complies not because they trust the sender personally but because the claimed authority makes non-compliance feel risky.

**Perceived Benefit:** Routine administrative action — verifying credentials, processing an invoice, resolving a security alert, following a manager's instruction. The perceived benefit is deliberately mundane; it is designed to feel like a normal task rather than an opportunity.

**Victim Control Tactics:** Urgency framing that prevents deliberation ("respond within 2 hours or your account will be suspended"); confidentiality framing in BEC variants ("this acquisition must remain confidential until announcement"); direct phone number provided that routes to co-conspirators rather than legitimate support.

---

### END

**Objective [Perceived]:** Credential theft, financial authorization (wire transfer, ACH), or account access — presented to the target as a routine administrative action.

**Objective [Realized]:** When harm materializes — credential compromise enabling account takeover, data exfiltration, or further fraud; direct financial loss through fraudulent wire transfer or payment authorization (BEC variant); corporate network access enabling ransomware deployment or data theft; identity theft through credential aggregation.

---

## How LLMs Are Exploited

The historical detection signal for phishing was **quality degradation** — poor grammar, awkward phrasing, generic salutations. LLMs eliminate this signal. A fraudster with no language proficiency can generate native-quality, contextually accurate phishing communications for any organization.

**Primary exploitation vectors:**
- Brand-accurate email templates for any company, bank, or government agency
- Business Email Compromise (BEC) scripts impersonating named executives
- High-volume personalized spearphishing variants generated from scraped LinkedIn/company data
- Fake vendor invoices and payment request copy
- Vishing scripts for call center credential extraction

**Prompt patterns to detect:**
- Write emails impersonating named companies, banks, or government agencies
- Generate "login verification" or "account security" email copy
- "Invoice" or "payment request" templates with urgency framing for specific organizations
- "Pass spam filters" or "not get flagged" instructions
- BEC pattern: "write from [executive] asking [employee] to wire funds"

---

## Policy Triggers

1. Email or message copy impersonating a named real organization for credential harvesting or financial fraud
2. BEC scripts impersonating named executives to authorize wire transfers
3. Content explicitly designed to evade email security systems or spam filters
4. High-volume variant generation of phishing messages (3+ variants of same underlying message)
5. Vishing scripts for credential extraction or fraudulent financial authorization

---

## Enforcement Signals

| Signal | Attribute | Weight |
|---|---|---|
| Named brand impersonation + credential/payment request | START: Persona | High |
| "Write as [executive]" + wire/payment instruction | END: Objective | High |
| "Pass spam filters" / "avoid detection" | PROCESS → Execution: Detection Evasion | High |
| Fake invoice + urgency + specific org | PROCESS → Execution: Referenced Entities | High |
| Personal detail injection for spearphishing | START: Target | High |
| Vishing script + credential/payment extraction | PROCESS → Execution: Delivery Template | High |

---

## Precision/Recall Notes

**False positive risk:** Security awareness training examples, penetration testing, fiction involving phishing, legitimate transactional email templates.

**Key disambiguation:** Named real organizations + credential/payment extraction intent + no clear educational framing. Multiple variants indicate campaign rather than education.

**Threshold:** Human review for phishing-style templates referencing real organizations without clear educational framing. Auto-block when evasion of security systems is explicit, named executives are impersonated for financial authorization, or high-volume variant generation is requested.

---

## Real-time synthetic media BEC (added 2026-05-27, case 4 / Arup deepfake-CFO)

The dominant BEC threat-model historically assumed asynchronous text-channel impersonation -- a spoofed-CFO email or chat message. The reviewer-side defense was the canonical "call the executive at a known number to confirm." The 2024 Arup deepfake-CFO case (HK$200M / ~US$25M wire fraud against the Hong Kong office of a UK engineering firm) demonstrated a structurally distinct attack: a live video conference where the CFO and several apparent colleagues were all deepfaked, interacting in real time over 15 transactions with the target finance employee. The canonical defense was bypassed because the deepfake *was* the executive on the known number, in real-time video and voice. Hong Kong police confirmed the case and characterized it as the largest known deepfake-enabled BEC at the time.

**Threat-model addition.** Real-time synthetic media BEC is the same L1/L2 (`deceptive_fraud / phishing_attack`) as the email-channel BEC but with structurally different attack mechanics:

- *Persona:* Real-time deepfaked executive (video and/or audio), often alongside deepfaked apparent colleagues to manufacture the social pressure of a group call.
- *Delivery method:* Live video conference (Zoom, Teams, proprietary platforms) or live phone call. The interactivity is the load-bearing differentiator from pre-recorded deepfake artifacts.
- *Bypass mechanism:* The standard reviewer-SOP defense ("call the executive at a known number to confirm") fails when the impersonation can transact in real time on the known number.
- *Severity:* Higher than email-channel BEC at the bright-line layer (see `docs/08-v5-ontology.md` §5 `realtime_synthetic_media_executive_impersonation`). Both fire `executive_impersonation_payment` at the disposition layer; the realtime variant additionally fires the new dedicated bright-line.

**Policy artifacts.** Bright-line `realtime_synthetic_media_executive_impersonation` (ontology §5); L3 `method:realtime_synthetic_media` (ontology §3.1); master-policy §3.3 bright-line clause (added 2026-05-27). The L3 method tag fires whenever the synthetic media is interactive (turn-taking), distinguishing from pre-recorded `method:deepfake_audio` / `method:deepfake_video`.

**Reviewer-SOP impact.** The canonical BEC defense needs an explicit augmentation for the deepfake-video variant. Suggested SOP additions for ops-track follow-up: (a) require an out-of-band confirmation channel (e.g., a pre-arranged code phrase, a separate text-message confirmation to the executive's verified number, a callback initiated by the executive rather than the target) for any wire transfer authorized via live video; (b) treat any video-call wire authorization that the target cannot independently corroborate via a second channel as a `human_review` floor regardless of apparent identity match. Ops-track owns the full reviewer-SOP authoring in phase 4 of the case-study Tier 1 goal.

**Cross-references.** Cross-link to `docs/threat-models/09-ai-enabled-abuse.md` for the broader AI-as-attack-vector framing. Case 8 (FTC voice-clone grandparent scam) is the consumer-fraud analogue documented in case-study analysis 2026-06 §8; the existing `family_impersonation_payment` bright-line is sufficient at the disposition layer for that variant (per case-study analysis §8.6, restraint not to over-fit L3 method vocabulary). Originating case-study: `docs/policy-reviews/2026-06-case-study-analysis.md` §4.
