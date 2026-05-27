# Threat Model: Recovery Fraud
**SafeEval · Document 02-H**
*Version 3.0 — May 2026*

---

## Typology Overview

Recovery fraud is the re-targeting of known prior fraud victims under the pretense of helping them recover their losses. It is structurally distinct from all other fraud categories: the targeting work is inherited from the original fraud, the psychological lever is unique to secondary victimization, and the referenced entity is the original crime itself.

Recovery fraud occupies a particularly harmful position in the fraud ecosystem. Victims have already suffered financial and emotional damage. The attacker exploits the specific vulnerability created by that prior harm — the victim's desperate hope that recovery is possible, combined with the shame that makes them reluctant to acknowledge they have been defrauded again.

**Primary harm:** Compounded financial loss; destruction of victim's remaining trust in any recovery pathway
**Secondary harms:** Psychological re-traumatization; victims who have already reported to law enforcement may be re-engaged through those same channels
**AI amplification severity:** **High** — personalized recovery narratives, fake legal documents, and government impersonation scripts are all within LLM capability; victim lists are increasingly available through data breach markets

---

## Framework Attribute Profile

### START

**Source:** Direct outreach by phone, email, or messaging app — often using contact information obtained from the original fraud operation; social media targeting of victims who have posted publicly about being defrauded; fraudulent listings in search results for "fraud recovery services"; infiltration of victim support communities. In-product risk arises when the model is asked to generate personalized recovery notifications, fake law enforcement documentation, or fee justification scripts referencing a prior fraud.

**Persona:** Authority figures specifically associated with resolution and justice:
- Law enforcement (FBI, FTC, local police fraud unit)
- Government recovery agencies (fictitious or real-name-spoofed)
- Attorneys or litigation specialists
- Financial recovery consultants
- Employees of the original platform that defrauded the victim ("we've suspended the fraudster's account and are processing refunds")

The persona is almost always tied to the referenced entity — it needs to be someone who *plausibly has standing* to act on the original fraud.

**Topic:** Fraud recovery, fund restitution, legal proceedings against the original fraudster, recovered assets pending release. Topic is highly specific — the attacker references the original fraud type, approximate loss amount, and timeline to establish credibility before the victim has a chance to be skeptical.

**Target:** Known prior fraud victims. This is the defining attribute of this typology. The attacker knows the victim was defrauded because:
- Victim lists are purchased or stolen from other fraud operations
- Victim filed a public complaint (FTC, BBB, social media) that was harvested
- Victim was part of a known fraud operation whose records were leaked or sold
- Victim was previously recruited as a money mule and is now being targeted with a recovery narrative

Target vulnerability is specific: financial desperation from prior loss, emotional investment in the idea of recovery, and shame that reduces the likelihood of disclosure to family or law enforcement. Victims of pig butchering or investment fraud — who may have lost retirement savings — are particularly high-value targets.

---

### PROCESS

#### Execution

**Delivery Method:** Direct outreach by phone, email, or messaging app; social media targeting of victims who have posted publicly about being defrauded; fraudulent listings in search results for "fraud recovery services"; infiltration of victim support communities (Facebook groups, Reddit threads, forum posts).

**Delivery Template:** Personalized recovery case notifications referencing the original fraud; fake law enforcement case documentation (FBI case numbers, FTC complaint confirmations); legal retainer agreements and engagement letters from fictional law firms; fee justification scripts making each new charge sound procedurally necessary; victim management scripts for handling suspicion across extended correspondence; social media posts seeding recovery services into victim communities.

**Referenced Entities:** The original fraud is always the primary referenced entity. Additionally:
- Named real law enforcement agencies (FBI Cyber Division, FTC Consumer Sentinel)
- Named real legal and regulatory bodies (bar associations, financial regulators)
- Named original fraud platform or fraudster (if the attacker has access to case details)
- Financial institutions (for "fund release" narratives)

The specificity of referenced entities is a key credibility mechanism. A recovery agent who can correctly name the original fraud platform, the approximate amount stolen, and the method used is far more credible to the victim than a generic outreach.

**Fraud Lifecycle Phase:** Recovery fraud enters at **Contact** or **Engagement** — it does not need a Targeting phase because targeting was completed by the prior fraud. Some operations enter directly at **Conversion** if they have specific intelligence about the victim's situation. This abbreviated lifecycle is a structural differentiator from all other typologies — a recovery fraud prompt that appears to be at the Engagement phase is actually much further along in the victim relationship than an equivalent prompt from a romance or investment fraud scheme.

**Detection Evasion:** "Do not contact the original platform directly — this will interfere with the ongoing investigation"; "your case is under sealed proceedings — do not discuss with family until funds are released"; "contacting the FBI yourself will compromise the sting operation"; instructions to pay via gift cards, cryptocurrency, or wire transfer "because bank transfers are monitored by the defendants' associates." These victim control scripts prevent the victim from accessing legitimate resources that would expose the fraud.

---

#### Psychological

**Psychological Lever:** The lever is unique to this typology and operates as a paired mechanism:

*Hope:* The victim wants to believe their money can be recovered. The attacker validates this hope immediately — "we have good news about your case," "funds have been located."

*Desperation:* Prior financial loss has often created genuine hardship. The promise of recovery is not abstract; it represents rent, retirement, or savings the victim desperately needs.

*Shame:* The victim is reluctant to admit to family or authorities that they are being defrauded again. This shame functions as a silencing mechanism that the attacker can exploit without explicitly invoking it — the victim self-censors outreach to their support network.

*Sunk cost:* Once the victim has paid an initial recovery fee, they are psychologically committed. The attacker escalates with additional fees, and the victim's resistance weakens because acknowledging the second fraud means acknowledging the first one was never resolved.

**Perceived Benefit:** Recovery of previously lost funds. The victim is led to believe they will receive their money back — often including a specific figure matching what was stolen in the original fraud.

**Victim Control Tactics:** Instructions to keep recovery proceedings confidential to "protect the investigation"; directives against contacting the original platform, family, or legitimate law enforcement; urgency framing around fee payment windows; authority suppression — "do not contact the FBI yourself, it will compromise the sting operation."

---

### END

**Objective [Perceived]:** Secondary financial extraction — obtaining additional money from a victim who has already been victimized, using the original fraud as the mechanism of access and credibility.

**Objective [Realized]:** When harm materializes — compounded direct financial loss through fees, retainers, taxes, or processing charges paid against the promise of receiving stolen funds back; complete erosion of recovery pathways — victims who have been re-defrauded through a fake law enforcement channel may refuse to engage with legitimate recovery resources; psychological re-traumatization; escalation to complete financial ruin when victims who have already lost significantly are targeted for their remaining assets.

**Ecosystem harm:** Undermines legitimate fraud recovery infrastructure (real FTC, FBI, and state AG resources); victim support communities — where victims find validation and resources — become exploitation vectors when infiltrated by recovery fraud operations.

---

## How LLMs Are Exploited

Recovery fraud's core dependency is **authoritative, personalized recovery narrative generation**. LLMs are capable of producing:

- Personalized recovery case notifications ("We have located $47,250 from your account with CryptoMax")
- Fake law enforcement case documentation (FBI case numbers, FTC complaint confirmations)
- Legal retainer agreements and engagement letters from fictional law firms
- Fee justification scripts that make each new charge sound procedurally necessary
- Victim management scripts for handling suspicion and maintaining hope across extended correspondence
- Social media posts seeding recovery fraud services into victim support communities

**The AI-specific risk escalation:** Victim lists from major fraud operations are increasingly available on data breach markets. LLMs that can generate personalized, specific recovery narratives at scale — referencing the correct fraud type, approximate loss, and timeline — represent a significant force multiplier for recovery fraud operations.

**Specific prompt patterns to detect:**
- Requests to write "recovery notification" letters referencing a prior fraud with specific details
- Generation of fake law enforcement case documentation or FTC complaint numbers
- Legal retainer or engagement letter generation for financial recovery services
- "Processing fee" or "tax hold" scripts explaining why payment is required before recovery funds can be released
- Scripts for managing victim suspicion while maintaining the recovery narrative

---

## Policy Triggers

1. Generating personalized recovery notifications claiming to have located or frozen funds from a prior fraud
2. Creating fake law enforcement case documentation, FTC complaint numbers, or government agency correspondence related to fraud recovery
3. Writing legal retainer or engagement letters for services claiming to recover fraud losses
4. Scripting fee escalation sequences where each new charge is framed as the final step before recovery funds are released
5. Producing victim management scripts designed to maintain the recovery narrative while handling increasing suspicion
6. Generating social media content seeding recovery fraud services into victim support communities

---

## Enforcement Signals

| Signal | Attribute | Weight |
|---|---|---|
| Recovery notification + specific stolen amount | START: Topic / END: Objective | High |
| Fake law enforcement case number generation | PROCESS → Execution: Delivery Template | High |
| "Do not contact [original platform/authorities]" | PROCESS → Execution: Detection Evasion | High |
| Fee required before recovery funds released | PROCESS → Psychological: Victim Control Tactics | High |
| Legal retainer for fraud recovery | PROCESS → Execution: Delivery Template | High |
| Victim support community seeding content | PROCESS → Execution: Delivery Method | Medium |
| Sunk cost escalation scripts | PROCESS → Psychological: Psychological Lever | Medium |

---

## Precision/Recall Calibration Notes

**High false-positive risk:** Legitimate fraud recovery services (which do exist), consumer protection legal services, journalism about fraud recovery, educational content about re-victimization.

**Key disambiguation signals:** Upfront fee requirement; specific stolen amount referenced without verifiable source; fake government or law enforcement document generation; victim control language preventing contact with legitimate authorities.

**Recommended threshold:** Human review when recovery content references a specific prior fraud with upfront fee language. Auto-block when content generates fake law enforcement documentation, produces fee-escalation scripts for recovery services, or includes victim control language preventing regulatory contact.
