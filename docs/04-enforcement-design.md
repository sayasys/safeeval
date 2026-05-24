# Enforcement Design
**SafeEval · Document 04 of 06**
*Version 1.0 — May 2026*

---

## 1. Overview

This document defines the enforcement architecture for the Fraud & Scams policy: how automated systems and human reviewers work together, how escalation decisions are made, how precision and recall are managed, and how the enforcement system stays current as the threat landscape evolves.

The enforcement system is designed around three principles:

1. **Policy fidelity:** Enforcement decisions accurately reflect policy intent, not just surface pattern matching
2. **Proportionality:** The response matches the severity and confidence of the violation
3. **Adaptability:** The system degrades gracefully as tactics evolve, and provides the feedback loops needed to update quickly

---

## 2. Escalation Tiers

Every prompt evaluation produces one of three enforcement outcomes:

### Tier 1: AUTO-RESOLVE (Allow)
**Criteria:** No fraud-relevant signals detected, or signals present are below the disambiguation threshold for all components. Legitimate use carve-outs apply with high confidence.

**Action:** Content is generated without restriction. Signal data is logged for pattern monitoring.

**Examples:**
- Financial literacy content with no operational extraction signals
- Fiction involving fraud themes with no real-person/platform targeting
- Single educational phishing example with clear training framing
- Romantic creative writing with no financial extraction signals

---

### Tier 2: HUMAN REVIEW
**Criteria:** One or more fraud components activated at ambiguous level (score 1–2), or a high-weight signal is present without sufficient context to determine legitimate vs. prohibited use. The content *could* be legitimate but the risk profile is elevated enough to warrant a human judgment.

**Action:** Content generation is paused. Case is queued for human review with pre-populated component analysis and the specific signals that triggered review. Human reviewer applies the disambiguation criteria from the policy document and makes an allow/block decision. Decision and rationale are logged.

**SLA:** 24-hour review target for standard queue; 4-hour target for high-severity queue.

**Examples:**
- Investment content with unusual return claims but no specific fake platform reference
- Phishing-style email template referencing a real company without explicit credential-harvest instruction
- Romantic persona maintenance without financial extraction signals but with escalating intimacy
- Bulk review generation under the 3-variant threshold but with financial platform context

---

### Tier 3: AUTO-BLOCK
**Criteria:** One or more bright-line rules triggered (per policy doc section 3), OR multiple components activated at clear level (score 3), OR explicit evasion assistance requested.

**Action:** Content generation is blocked. Block reason is logged with supporting signal evidence. User receives policy violation notice. Repeat violations trigger account-level review.

**Examples:**
- Romantic persona + real cryptocurrency payment instructions
- Named government agency impersonation + payment demand + threat
- Fake SEC/FCA/FINRA registration document generation
- BEC script: named executive impersonation + wire transfer instruction
- "Rewrite this to pass spam filters" combined with phishing content

---

## 3. Component Scoring & Aggregate Risk

Each evaluated prompt receives a score for all five UFAF components (0–3 per component, max 15):

| Aggregate Score | Default Tier | Override Conditions |
|---|---|---|
| 0–3 | AUTO-RESOLVE | — |
| 4–7 | HUMAN REVIEW | Bright-line trigger → AUTO-BLOCK regardless of score |
| 8–12 | HUMAN REVIEW (high severity) | Any score-3 component → AUTO-BLOCK |
| 13–15 | AUTO-BLOCK | — |

**Override logic:** Bright-line rules (section 3 of policy doc) always produce AUTO-BLOCK regardless of aggregate score. A single clearly activated component in a bright-line category overrides a low aggregate score.

---

## 4. Precision/Recall Framework

### 4.1 Design Philosophy

Fraud & Scams enforcement operates in a domain where **false negatives** (missed fraud) and **false positives** (blocked legitimate use) both carry real costs:

- **False negatives** enable real harm to victims — financial loss, psychological damage, infrastructure for criminal operations
- **False positives** harm legitimate users (security researchers, educators, writers) and erode platform trust

The default calibration for this domain is **precision-forward at AUTO-BLOCK** (minimize false positives for the most restrictive action) and **recall-forward at HUMAN REVIEW** (catch ambiguous cases rather than miss them). This means:

- The bar for AUTO-BLOCK is bright-line rules or very high aggregate score (deliberate over-precision)
- The bar for routing to HUMAN REVIEW is deliberately lower (deliberate over-recall at this tier)

### 4.2 Precision/Recall Targets by Tier

| Tier | Precision Target | Recall Target | Rationale |
|---|---|---|---|
| AUTO-BLOCK | ≥95% | ≥70% | False blocks here are most damaging to users; miss rate accepted |
| HUMAN REVIEW | ≥60% | ≥92% | Human review is the catch-all; recall is primary; precision improves with queue management |
| AUTO-RESOLVE | ≥99% | N/A | Must not false-allow bright-line violations |

### 4.3 Measuring Performance

**False positive measurement:**
- Sample 10% of AUTO-BLOCK decisions weekly; expert reviewer assesses whether block was justified
- Track false positive rate by typology and by signal type
- Signals with FP rate >15% are flagged for recalibration

**False negative measurement:**
- Track escalated enforcement actions and policy violations that were initially allowed or reviewed-and-allowed
- Monitor external fraud reports (law enforcement referrals, researcher submissions, user reports) for content types the classifier missed
- Quarterly adversarial testing: red team attempts to generate policy-violating content; measure what evades detection

**Human review quality:**
- Track reviewer agreement rate on borderline cases (cases reviewed by 2 reviewers independently)
- Flag cases where reviewers disagree for calibration discussion and SOP update

### 4.4 Signal Recalibration Process

When a signal's performance degrades (high FP rate, low discrimination power, or saturation):

1. **Identify:** Performance monitoring surfaces the degraded signal
2. **Diagnose:** Is the signal over-broad? Is it being gamed? Has the threat landscape shifted?
3. **Recalibrate:** Adjust signal weight, add disambiguation conditions, or retire the signal
4. **Validate:** Run recalibrated signal against historical cases before deploying
5. **Document:** Update classifier guidance (doc 05) and notify ML team

---

## 5. Human Review Workflow

### 5.1 Queue Structure

Cases in the HUMAN REVIEW tier are organized into two queues:

**Standard Queue:** Aggregate score 4–7, no high-severity signals. Target: 24-hour review.
**High-Severity Queue:** Aggregate score 8+, or high-weight signal triggered, or involves a bright-line category at ambiguous level. Target: 4-hour review.

### 5.2 Case Presentation

Each human review case is presented with:

- The original prompt (full text)
- Component activation summary (which components activated, at what score, which signals triggered them)
- Preliminary typology classification (most likely fraud category)
- Relevant policy sections (links to applicable rules in doc 03)
- Disambiguation questions (the specific questions the reviewer should answer to make the allow/block decision)
- Historical context (if the account has prior violations or review history)

### 5.3 Decision Criteria

Reviewers apply the following decision logic:

1. **Does this content trigger a bright-line rule?** → Block, log rule citation
2. **Is there a clear legitimate use context?** → If yes and no operational fraud value, Allow with note
3. **Could this be used operationally to commit fraud with minimal modification?** → If yes, Block
4. **Is the context ambiguous?** → Allow with monitoring flag, or request additional context from user if feasible

### 5.4 Escalation from Human Review

Reviewers escalate to the policy team when:
- A case represents a novel tactic not covered by existing policy rules
- A case involves a high-profile entity (major brand, government agency, public figure)
- Reviewer is uncertain and wants policy guidance
- A case may represent coordinated activity (same pattern appearing in multiple cases)

### 5.5 Feedback Loop: Review → Policy

Human review decisions are the primary source of **policy gap identification**. Reviewers log:
- Cases where existing policy language was unclear or insufficient
- Cases where a legitimate use was almost blocked due to over-broad rules
- Patterns suggesting a new fraud TTP variant is emerging

Policy team reviews this log in the monthly sync. Patterns that repeat across 3+ cases trigger a policy update process.

---

## 6. Feedback Loop Architecture

The feedback loop connects threat intelligence, enforcement operations, policy, and ML/classifier teams:

```
[Threat Intelligence Feed]
  ↓ New TTP variants, emerging fraud campaigns
[Policy Team]
  ↓ Translates into policy rules and enforcement signals
[Classifier / Automated Detection]
  ↓ Flags cases for auto-block or human review
[Human Review Queue]
  ↓ Decisions + rationale logged; pattern flags raised
[Policy Gap Log]
  ↓ Reviewed monthly by policy team
[Signal Performance Monitoring]
  ↓ FP/FN rates by signal; degraded signals flagged
[Recalibration Process]
  ↓ Updated signals + rules
[Classifier / Policy Update]
```

### 6.1 Threat Intelligence Sources

- External researcher submissions (academic fraud research, NGO reports)
- Law enforcement referrals and public advisories (FTC, FBI IC3, FinCEN)
- Industry consortium sharing (GASO, Trust & Safety Professional Association)
- Internal enforcement data (patterns in flagged content)
- Red team / adversarial testing program

### 6.2 Loop Cadence

| Loop | Cadence | Owner |
|---|---|---|
| Signal performance review | Weekly | Enforcement Operations |
| Human review → policy gap log | Monthly | Policy + Enforcement |
| Threat intelligence review | Monthly | Policy team |
| Full policy review cycle | Quarterly | Policy team + cross-functional |
| Adversarial testing | Quarterly | Red team + ML |

---

## 7. SOP & Runbook Templates

### 7.1 New Fraud Typology Response SOP

When a novel fraud typology is identified:

1. **Document the typology** using the UFAF five-component structure (doc 01)
2. **Assess coverage:** Which existing policy rules apply? What gaps exist?
3. **Draft policy language** for gaps; route through change management process (doc 03, section 6.4)
4. **Define enforcement signals** for each component; add to classifier guidance (doc 05)
5. **Seed the dataset:** Add labeled examples to the prompt dataset (data/seed-prompts.json)
6. **Deploy:** Update classifier and human review queue presentation
7. **Monitor:** Track FP/FN rates for new signals for 30 days post-deployment

### 7.2 Enforcement Error Response Runbook

When a significant enforcement error is identified (high-profile false positive or missed harmful content):

1. **Triage:** Classify the error type (signal gap, policy gap, classifier failure, human review error)
2. **Immediate mitigation:** If ongoing harm, apply manual block or expedited review to similar content
3. **Root cause analysis:** Which component of the system failed? Why?
4. **Fix:** Update signal, policy rule, or reviewer guidance as appropriate
5. **Post-mortem:** Document root cause, fix applied, and monitoring plan
6. **Preventive action:** Apply lessons to adjacent rule areas where the same failure mode could occur

### 7.3 Coordinated Fraud Campaign Response Runbook

When a coordinated fraud campaign is detected (multiple related cases from different accounts):

1. **Confirm coordination:** Assess whether cases share tactics, content patterns, or infrastructure
2. **Scope the campaign:** Estimate volume and affected accounts
3. **Targeted signal deployment:** Add campaign-specific signals for accelerated detection
4. **Account-level action:** Escalate flagged accounts for account-level review, not just content-level
5. **Law enforcement notification:** If campaign meets reporting thresholds, escalate to legal/policy team for LE referral consideration
6. **Document TTPs:** Add campaign tactics to the threat model library for future reference

---

*Previous: [03 — Master Policy](./03-master-policy.md) | Next: [05 — Classifier Guidance](./05-classifier-guidance.md)*
