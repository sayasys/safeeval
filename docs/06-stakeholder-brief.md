# Fraud & Scams Stakeholder Brief
**SafeEval · Document 06 of 06**
*Version 1.0 — May 2026*

---

## Executive Summary

This brief provides a consolidated overview of Anthropic's Fraud & Scams enforcement framework for non-technical stakeholders across Legal, Public Policy, Go-to-Market, and Leadership. It describes what the framework does, what risks it addresses, what it permits, and how cross-functional partners should engage with the policy team.

---

## What Problem This Solves

Large language models are uniquely powerful tools for fraud. They remove the two constraints that historically limited fraud scale: **language quality** and **personalization capacity**.

A fraudster running a romance scam used to be limited by how many relationships they could sustain simultaneously and how convincing their writing was. LLMs remove both limits. The same is true for investment fraud, phishing, impersonation scams, and every other typology in this framework.

This isn't theoretical. Law enforcement agencies including the FBI, FTC, and Europol have documented LLM-assisted fraud campaigns causing billions in victim losses annually. The fraud landscape for AI platforms is not a future risk — it is a current and active harm vector.

The Fraud & Scams framework is Anthropic's operational response: a policy architecture, detection system, and enforcement workflow designed to prevent Claude from being used as fraud infrastructure.

---

## What the Framework Covers

The framework addresses seven fraud typologies with documented AI-exploitation vectors:

| Typology | Primary Harm | Why AI Amplifies It |
|---|---|---|
| Romance / Pig Butchering | Victim financial loss, psychological harm | Scales trust-building; removes human bottleneck |
| Investment Fraud | Financial loss; retirement savings | Generates convincing pitch copy and fake documentation |
| Phishing / Spearphishing | Credential theft, account compromise | Removes quality-degradation detection signal |
| Impersonation Scams | Financial loss; institutional trust erosion | Authentic government/corporate voice generation |
| Advance Fee Fraud | Serial financial loss | Formal documentation and fee cycle scripting |
| Money Mule Recruitment | Victim criminal exposure; money laundering | Professional recruitment infrastructure at scale |
| Synthetic Identity Fraud | Platform integrity; secondary fraud enablement | Mass fake persona and review generation |

---

## What the Framework Permits

**Permitted uses that might superficially resemble prohibited ones:**

- **Security awareness training:** Writing example phishing emails for employee education is explicitly permitted under the legitimate use carve-out, with appropriate framing
- **Fraud research and journalism:** Explaining how fraud schemes work for academic, journalistic, or consumer protection purposes is permitted
- **Fiction:** Creative writing involving fraud themes is permitted where content lacks operational application
- **Legitimate financial services:** Investment pitch writing, business development, and financial content creation for real products is permitted

**The disambiguation principle:** The core question is not "does this look like fraud?" but "could this be used operationally to commit fraud against real people, with minimal modification?" Content that explains fraud is categorically different from content that equips it.

---

## How Enforcement Works

Every prompt that reaches the fraud detection layer receives an automated evaluation:

- **Allow (Tier 1):** No fraud signals — content is generated normally
- **Human Review (Tier 2):** Ambiguous signals — a trained reviewer makes the call within 24 hours
- **Auto-Block (Tier 3):** Clear policy violation or bright-line rule trigger — content is blocked

Auto-block is calibrated to minimize false positives (blocking legitimate users). The human review tier is calibrated to minimize false negatives (missing fraud). This reflects a deliberate design choice: the most consequential enforcement action (blocking) requires the highest confidence.

---

## Guidance for Cross-Functional Partners

### Legal

**What the policy team needs from you:**
- Regulatory developments affecting the fraud typologies covered (FTC rules, FinCEN guidance, international AML developments)
- Guidance on when enforcement data should be escalated to law enforcement
- Input on policy language that intersects with liability exposure (particularly around "material assistance" definitions)

**What we can provide to you:**
- Enforcement signal documentation for regulatory inquiries
- Policy version history and change rationale for compliance purposes
- Case data on specific enforcement actions when legally relevant

---

### Public Policy

**What the policy team needs from you:**
- Legislative or regulatory trends that may require proactive policy adjustment
- External stakeholder feedback on policy gaps or over-restriction
- Coordination on public statements about fraud prevention capabilities and limitations

**What we can provide to you:**
- The public-facing policy summary (below) for external communications
- Enforcement efficacy data (at the level appropriate for external disclosure)
- Subject matter expertise for policy conversations with regulators or law enforcement

---

### Go-to-Market / Developer Relations

**What the policy team needs from you:**
- Operator feedback on enforcement friction — cases where the fraud policy is impeding legitimate product use cases
- New use case categories that may require carve-out review (e.g., new enterprise verticals with fraud-adjacent workflows)
- Awareness when enterprise customers are deploying Claude in fraud-adjacent domains (financial services, insurance, collections) so policy engagement can happen proactively

**What we can provide to you:**
- Guidance on operator system prompt configuration to reduce false positives in legitimate fraud-adjacent deployments
- Pre-launch policy review for enterprise products with elevated fraud risk surface
- Documentation of the legitimate use carve-outs for customer-facing materials

---

## Public-Facing Policy Summary

*For use in external communications, help center documentation, and developer-facing policy materials:*

> Anthropic's usage policies prohibit using Claude to facilitate fraud or scams against individuals or organizations. This includes, but is not limited to: generating content that impersonates government agencies or financial institutions for fraudulent purposes, creating fake investment documentation or extraordinary return claims, writing scripts designed to manipulate individuals into transferring money or credentials, generating bulk fake reviews or synthetic personas to manipulate trust systems, and producing content designed to evade fraud detection systems.
>
> Claude is designed to support legitimate uses in security research, consumer fraud education, fiction, and genuine financial services. When in doubt, the primary question is whether content could be used to cause real financial harm to a real person.
>
> If you encounter content that may violate these policies, please report it through [trust@anthropic.com].

---

## Escalation Contacts

| Issue Type | Primary Contact |
|---|---|
| Policy interpretation questions | Fraud & Scams Policy team |
| High-severity enforcement error | Policy team + Enforcement Operations |
| Law enforcement inquiry | Legal + Policy team |
| Regulatory development | Public Policy + Legal |
| Enterprise product concern | Go-to-Market + Policy team |
| Novel fraud typology | Policy team (file via threat intelligence intake) |

---

*This brief is updated quarterly in alignment with the policy review cycle. For the most current version, see the policy repository.*

*Previous: [05 — Classifier Guidance](./05-classifier-guidance.md) | [Return to README](../README.md)*
