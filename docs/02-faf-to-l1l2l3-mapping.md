# FAF Evidence -> L1 / L2 / L3 Classification Mapping
**SafeEval - Document 02 of 06**
*Version 5.0.1 - May 2026*

---

## 1. What this document is

This document is the contract between the FAF evidence layer (CONTEXT / PROCESS / OBJECTIVE nodes plus component scores and bright lines, produced at Stage 2) and the classification layer (L1 domain, L2 risk pattern, L3 multi-valued tags, produced at Stage 3).

The audience is a fraud-policy reviewer who has read the FAF specification (`docs/01-framework.md`) and the policy spec (`docs/policy-spec-v5.0.md`) and wants to know: *given a Stage 2 evidence object, what Stage 3 classification follows from it, and why?*

In v5.0, this mapping was implicit in the engine code and in the per-prompt judgment of the classifier model. v5.0.1 documents it explicitly. The reason is auditability: a reviewer challenged on "why did this classification come out the way it did?" needs a written rule to point to, not a model output to defend.

This document does not redefine the FAF or the L1/L2/L3 vocabularies. It states the bridge: which FAF facts produce which classification under which policy rule.

---

## 2. L1 definitions, with the policy that distinguishes them

L1 answers *what space is this prompt in?* Exactly one L1 per prompt. The seven values are mutually exclusive and exhaustive.

| L1 value | Definition | What FAF evidence selects this |
|---|---|---|
| `benign` | No meaningful abuse risk. Customer support, general information, education, creative writing, factual research. | Low aggregate score, no bright lines, OBJECTIVE describes a non-harm pursuit. |
| `security_education` | Defensively-framed content: awareness training, fraud-pattern explainers, blue-team education, victim support. Stated purpose is to help defenders or potential victims. | CONTEXT carries a defender persona (security trainer, victim, journalist with framing), OBJECTIVE describes understanding rather than execution, PROCESS may include attack-pattern descriptions but no operational asks. |
| `ambiguous_dual_use` | Could be defensive or offensive depending on actor and authorization. Reserved for borderline-authorized cases. | CONTEXT carries an authorization claim that cannot be verified from the prompt alone (`authorization_unverifiable` risk marker often fires here), and the OBJECTIVE could plausibly be served by either a defender or an attacker. |
| `deceptive_fraud` | Purpose is to deceive a victim into transferring money, goods, services, or trust. Harm vector is the victim's voluntary action under false pretenses. | OBJECTIVE names money / goods / services / trust extraction from a target who is the victim of the deception. PROCESS typically carries deception-building mechanics: persona claims, pretext templates, trust manufacture. |
| `privacy_abuse` | Targets credentials, accounts, personal data, or surveillance of individuals. Harm vector is breach of an identity or account boundary. | OBJECTIVE names credentials, account access, MFA codes, personal data lookups, or surveillance. The deception is incidental; the boundary breach is the goal. |
| `platform_abuse` | Manipulation of platform mechanics for unfair gain or evasion (multi-accounting, promo abuse, reputation laundering, automation, ban evasion). | OBJECTIVE names platform-level manipulation; CONTEXT often carries no claimed-victim identity because the platform IS the victim. |
| `cyber_intrusion` | Content enabling technical attacks on systems, AI models, or infrastructure (prompt injection, jailbreak framing, malware, model impersonation). | OBJECTIVE names a system, infrastructure, or model attack surface. Distinct from `privacy_abuse` because the target is the system, not an individual account. |

When two L1s plausibly fit, the disambiguation rules in Section 3 apply.

---

## 3. L1 split rules: where the same FAF evidence could land in two domains

The hardest classification calls are the ones where the FAF evidence is consistent with more than one L1. The two cases that recur are credential phishing (deceptive_fraud or privacy_abuse?) and authorized-vs-unauthorized framing (security_education or ambiguous_dual_use?).

### 3.1 Credential phishing disambiguation

A credential-stealing phishing email could plausibly fit either `deceptive_fraud` (it deceives the employee into action) or `privacy_abuse` (it steals credentials). Both are true. The L1 must commit to one.

**Decision rule (per `policy-spec-v5.0.md` Decision 1):** classify by **ultimate harm intent**, inferred from the OBJECTIVE node.

- If the prompt's ultimate goal is **money transfer** (BEC, executive impersonation for wire fraud, payment redirect), classify as `deceptive_fraud` / `phishing_attack`. The credential is incidental machinery; the money is the harm.
- If the prompt's ultimate goal is **credential or account access** (employee credential theft, MFA bypass, password harvesting page), classify as `privacy_abuse` / `credential_theft`. The deception is incidental machinery; the boundary breach is the harm.
- If the OBJECTIVE is genuinely ambiguous (the prompt asks for "a convincing employee phishing template" with no stated purpose), classify as `ambiguous_dual_use` / `borderline_security_research` and let Stage 4's rules (specifically `ambiguous_l1_requires_review`) route to human review.

The L2 classification reflects the attacker's primary objective, inferred from framing and explicit asks. The L3 method tag `method:phishing` carries the technique on both sides of the split, so a downstream consumer can find "all phishing-method prompts" with one L3 query without re-classifying.

### 3.2 Authorized-framing disambiguation (security_education vs. ambiguous_dual_use)

A prompt that claims a defensive framing ("for my security training program," "as an authorized red-team test") presents an authorization claim the system cannot verify from the prompt alone.

**Decision rule:** the L3 `context_marker:` tags carry the claim; the L1 reflects how strong the claim is.

- A clear, internally consistent defender framing -- explicit defensive purpose, no operational ask for a weaponizable artifact, no `risk_marker:deceptive_effectiveness_requested` or similar escalations -- classifies as `security_education`.
- A framing that *claims* authorization but cannot be verified -- `risk_marker:authorization_unverifiable` fires, or the operational asks contradict the defender framing (e.g., "write a real working credential-harvesting page so we can train against it") -- classifies as `ambiguous_dual_use`.
- A clear attacker framing with a defender-framing wrapper that the system can see through (the FAF would surface this through `context_marker:internal_simulation_claimed` plus a high `extract` component score) classifies according to the harm vector, not the wrapper. The L3 context_marker is preserved as evidence the wrapper was attempted.

The principle: the L1 is the system's judgment about the actual space the prompt sits in; L3 context_marker tags are what the prompt claimed about itself.

---

## 4. L2 enumeration by L1 (closed set per L1)

The L2 vocabulary is closed and scoped by L1. No L2 value is valid under more than one L1. Selecting an L2 outside the allowed set under the assigned L1 is an engine-enforced validation failure (`validation_fallback` rule), which downgrades the action to `human_review`.

| L1 | Valid L2 values | Notes |
|---|---|---|
| `benign` | `no_risk_pattern`, `customer_support_inquiry`, `general_information`, `creative_writing`, `educational_inquiry` | Default benign L2 is `no_risk_pattern`. |
| `security_education` | `phishing_awareness`, `malware_education`, `fraud_pattern_research`, `defensive_simulation_authorized`, `victim_support` | `victim_support` covers active-scam victims as well as post-fraud recovery. (Decision 8.) |
| `ambiguous_dual_use` | `borderline_security_research`, `borderline_red_team`, `borderline_journalism`, `borderline_education_request` | When in doubt about which borderline applies, default to `borderline_security_research`. The L3 context_marker carries the specific framing claim. |
| `deceptive_fraud` | `romance_fraud`, `investment_fraud`, `advance_fee_fraud`, `phishing_attack`, `impersonation_scam`, `recovery_fraud`, `fraud_infrastructure`, `marketplace_fraud`, `refund_payment_fraud`, `identity_fraud` | `phishing_attack` here is money-extraction phishing (BEC, executive impersonation for wire). For credential phishing see `privacy_abuse / credential_theft`. (Decision 1.) |
| `privacy_abuse` | `credential_theft`, `account_takeover`, `private_data_misuse`, `doxxing_or_stalking` | `credential_theft` is upstream (extracting credentials); `account_takeover` is downstream (using or resetting them). |
| `platform_abuse` | `promotion_abuse`, `multi_accounting`, `reputation_manipulation`, `automation_botting`, `ban_evasion` | |
| `cyber_intrusion` | `credential_harvesting_infra`, `malware_distribution`, `prompt_injection_attack`, `model_jailbreak`, `ai_model_impersonation` | `credential_harvesting_infra` is infrastructure-grade (phishing kits, OTP relays); contrast with `privacy_abuse / credential_theft` which is per-victim credential extraction. |

---

## 5. Worked example: credential-phishing BEC email

A worked example of the mapping in action. Hypothetical Stage 2 evidence object:

```json
{
  "faf_nodes": {
    "context": {
      "source": "user",
      "persona": "CEO",
      "topic": "urgent wire transfer authorization",
      "target": "company finance team",
      "relationship_phase": "extraction"
    },
    "process": {
      "execution": {
        "delivery_method": "email",
        "delivery_template": "executive impersonation, authority + urgency framing",
        "referenced_entities": ["company finance", "vendor", "wire transfer"]
      },
      "psychological": {
        "trigger": "authority",
        "incentive": "avoid escalation to legal",
        "control": "after-hours timing + suppression of out-of-band verification"
      }
    },
    "objective": { "objective": "wire transfer of $100,000 to an attacker-controlled account" }
  },
  "component_scores": { "target": 3, "lure": 2, "trust": 3, "extract": 3, "evade": 2 },
  "aggregate_score": 13,
  "bright_lines": ["executive_impersonation_payment"],
  "process_flags": [
    { "category": "Trigger", "description": "authority + urgency" },
    { "category": "Template", "description": "executive impersonation for wire fraud" }
  ],
  "l2_probabilities": { "phishing_attack": 0.91, "impersonation_scam": 0.74 }
}
```

The Stage 3 classification that follows from this evidence:

```json
{
  "l1": { "value": "deceptive_fraud", "confidence": 0.93 },
  "l2": { "value": "phishing_attack", "confidence": 0.91 },
  "l3": [
    { "value": "method:phishing",                "confidence": 0.93 },
    { "value": "method:pretexting_email",        "confidence": 0.88 },
    { "value": "tactic:authority",               "confidence": 0.90 },
    { "value": "tactic:urgency",                 "confidence": 0.82 },
    { "value": "target:enterprise_finance",      "confidence": 0.92 },
    { "value": "overlap:payment_fraud_enablement", "confidence": 0.84 },
    { "value": "risk_marker:payment_instruction_embedded", "confidence": 0.89 }
  ]
}
```

Why `deceptive_fraud` and not `privacy_abuse`? The OBJECTIVE is money ("wire transfer of $100,000"). The prompt does not ask for credentials; it asks for the wire. Credential theft would be incidental machinery here, but the prompt does not even use it -- the attacker is impersonating, not phishing for passwords. Classify by ultimate harm intent (Section 3.1): the harm is the money transfer, so L1 = `deceptive_fraud`.

Why L2 = `phishing_attack` rather than `impersonation_scam`? Both fit. The bright line that fired (`executive_impersonation_payment`) constrains the L2 to `{impersonation_scam, phishing_attack}` per the `BRIGHT_LINE_FORCED_L2` map in the policy spec. `phishing_attack` wins on `l2_probabilities` (0.91 vs. 0.74); the L3 tag `method:pretexting_email` carries the impersonation mechanism.

Stage 4's `bright_line_forces_block` rule will fire on `executive_impersonation_payment`, locking the disposition to `block` with `policy_note` flagging non-negotiability. The classification above is what gets recorded in the audit trail.

---

## 6. FAF content preserved in evidence but not surfaced in classification

The classification layer (L1 / L2 / L3) does not enumerate every FAF fact. Several fields are intentionally preserved in `evidence` only, where Stage 4 disposition rules can read them without changing the classification.

- `evidence.faf_nodes.context.relationship_phase` -- one of `targeting`, `contact`, `engagement`, `conversion`, `extraction`, `escalation`, `evasion`. Phase changes how Stage 4 should treat the same L2: a romance-fraud prompt at `engagement` is different from one at `extraction`. The classification stays `deceptive_fraud / romance_fraud` either way; the disposition can be phase-aware.
- `evidence.faf_nodes.context.target` (free-text specificity) -- the L3 `target:` tags capture target type (e.g., `target:enterprise_finance`), but demographic specificity (age range, vulnerability indicators, named individuals) is preserved as text in the evidence node only. A reviewer can read it; the classification layer does not enumerate it.
- `evidence.faf_nodes.process.psychological.incentive` -- what the victim is promised. Preserved as text; not discretized into an L3 tag. The L3 `tactic:` tag captures the psychological lever (urgency, greed, etc.), not the specific promise.

Why this split? The classification layer is the *risk-pattern decision* -- it answers "which policy rules apply?" with a closed vocabulary. The evidence layer is the *fact record* -- it preserves what the prompt said and what Stage 2 inferred, in detail rich enough that a Stage 4 rule can read a specific field without re-running Stage 2. Generous evidence, surgical classification.

This is the same separation the FAF v4.0 spec used between component scores (discretized 0-3 ints, classification-grade) and process flags (free-text descriptions, evidence-grade). v5.0.1 carries it forward and names the rule.

---

## 7. Mapping rules engine-enforced

The following mapping behaviors are enforced by `src/lib/safeeval-v5.js` and validated by `tests/schema/v5-envelope.schema.json`. They are listed here so a reviewer can find them in one place; the canonical declarations live in `policy-spec-v5.0.md`.

1. `classification.l1.value` must be in the L1 closed set (Section 2 above; policy-spec Section 2).
2. `classification.l2.value` must be in `L2_BY_L1[classification.l1.value]` (Section 4 above; policy-spec Section 7).
3. When a bright line in `BRIGHT_LINE_FORCED_L2` fires, the L2 is forced to one of the values in the constrained set for that bright line. The engine reassigns L1 to match if necessary.
4. When `evidence.bright_lines` contains `ai_model_impersonation`, the L1 must be `cyber_intrusion` and the L2 must be `ai_model_impersonation` -- the one intentional same-string co-occurrence in v5 (policy-spec Decision 9, schema rule 11).
5. L3 entries must match `^(method|tactic|target|context_marker|overlap|risk_marker):[a-z_]+$` and have confidence >= 0.50.
6. Validation failure on any of the above downgrades `disposition.action` to `human_review` with rule `validation_fallback`.

---

*Companion docs: `docs/01-framework.md` (FAF specification), `docs/policy-spec-v5.0.md` (authoritative spec + decisions log), `docs/04-enforcement-design.md` (pipeline architecture), `docs/07-v5-schema.md` (envelope shape), `docs/08-v5-ontology.md` (vocabulary reference).*
