# SafeEval v5 -- Output Schema

**Status:** Round 2 of v5 rollout. JSON Schema validator landed at `tests/schema/v5-envelope.schema.json` (draft 2020-12).
**Schema version:** 5.0
**Ontology version:** 5.0
**Predecessor:** FAF v4.0 (`src/lib/safeeval.js`)
**Companion docs:** `docs/policy-spec-v5.0.md` (authoritative spec), `docs/08-v5-ontology.md` (vocabulary reference).

This doc describes the shape of the v5 evaluation response. The closed enums, thresholds, and validation rules referenced here are defined in `policy-spec-v5.0.md`. When the two diverge, the spec wins.

---

## 1. Why this schema exists

v4.0 fuses three different decisions into one response object:

1. **What is this prompt about?** (typology)
2. **What evidence supports that?** (component scores, FAF nodes, process flags, bright lines)
3. **What action does the system take?** (escalation_tier)

When those are fused, you cannot change enforcement policy without re-running classification, you cannot audit which evidence drove which decision, and the vocabulary tends to drift because there is no clean place to add new tactics or context markers.

v5 separates the three. Each lives in its own object: `classification`, `evidence`, `disposition`. The FAF analysis (the substantive v4 work) is preserved verbatim inside `evidence` -- nothing is lost, the layers are just made orthogonal.

---

## 2. Top-level envelope

```jsonc
{
  // -- metadata --
  "schema_version":   "5.0",
  "ontology_version": "5.0",
  "evaluated_at":     "2026-05-24T18:42:10.512Z",
  "model_pipeline":   ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-sonnet-4-6", "claude-sonnet-4-6"],
  "prompt_length":    347,
  // "pipeline_trace" is OMITTED by default. See section 3.6 (Decision 5).

  // -- what is this prompt? --
  "classification": {
    "l1": { "value": "privacy_abuse",    "confidence": 0.93 },
    "l2": { "value": "credential_theft", "confidence": 0.89 },
    "l3": [
      { "value": "method:phishing",                     "confidence": 0.95 },
      { "value": "method:credential_harvesting_page",   "confidence": 0.91 },
      { "value": "method:mfa_intercept",                "confidence": 0.88 },
      { "value": "tactic:urgency",                      "confidence": 0.82 },
      { "value": "target:enterprise_it_credentials",    "confidence": 0.85 },
      { "value": "overlap:account_takeover_enablement", "confidence": 0.86 }
    ]
  },

  // -- what does the system do? --
  "disposition": {
    "action":             "block",
    "confidence":         0.97,
    "reasoning_summary":  "Prompt requests a credential-and-MFA harvest page impersonating enterprise IT. Direct account takeover enablement.",
    "triggered_by": {
      "bright_lines": ["credential_harvesting_page", "mfa_or_otp_harvesting"],
      "thresholds":   [],
      "rules":        ["bright_line_forces_block"]
    },
    "safe_completion_guidance": null
  },

  // -- why? (FAF v4 evidence, preserved) --
  "evidence": {
    "faf_nodes": {
      "context": {
        "source":              "user",
        "persona":             "IT support agent",
        "topic":               "password reset",
        "target":              "company employees",
        "relationship_phase":  "extraction"
      },
      "process": {
        "execution": {
          "delivery_method":     "email",
          "delivery_template":   "urgent password reset notice",
          "referenced_entities": ["company IT", "Okta"]
        },
        "psychological": {
          "trigger":   "urgency",
          "incentive": "avoiding account lockout",
          "control":   "24-hour deadline + reply-to suppression"
        }
      },
      "objective": {
        "objective": "credential and MFA collection"
      }
    },
    "component_scores": { "target": 3, "lure": 3, "trust": 2, "extract": 3, "evade": 2 },
    "aggregate_score":  13,
    "bright_lines":     ["credential_harvesting_page", "mfa_or_otp_harvesting"],
    "process_flags":    [
      { "category": "Trigger", "description": "urgency: account lock in 24h" },
      { "category": "Delivery", "description": "templated mass-email format" }
    ],
    "l2_probabilities": {
      "credential_theft":    0.89,
      "phishing_attack":     0.62,
      "account_takeover":    0.41,
      "no_risk_pattern":     0.00
    }
  },

  // -- short-form summary (preserved from v4) --
  "prompt_summary": {
    "persona":   "IT support agent",
    "topic":     "password reset",
    "target":    "company employees",
    "objective": "harvest credentials + MFA codes",
    "pretext":   "mandatory security update"
  }
}
```

---

## 3. Field reference

### 3.1 Metadata

| Field | Type | Notes |
|---|---|---|
| `schema_version` | string | Envelope shape version. v5 = `"5.0"`. Bump on shape change. |
| `ontology_version` | string | L1/L2/L3 vocabulary version. v5 = `"5.0"`. Adding values within an existing L3 category is non-breaking; adding an L3 category or removing any value is breaking. See `policy-spec-v5.0.md` section 11. |
| `evaluated_at` | ISO-8601 string | UTC timestamp. |
| `model_pipeline` | array of strings | Models used per stage, in order. Stages that did not run (short-circuit) are omitted. |
| `prompt_length` | int | Character count of the input prompt. |
| `pipeline_trace` | object or omitted | Full per-stage outputs. Returned only when the API is called with `?debug=1`. Otherwise the field is OMITTED entirely (not nulled). See section 3.6. |

### 3.2 `classification`

| Field | Type | Notes |
|---|---|---|
| `l1.value` | string | One of the 7 L1 values (see ontology doc section 1, spec section 2). |
| `l1.confidence` | float [0,1] | Classifier confidence in the L1 assignment. |
| `l2.value` | string | One of the L2 values allowed under the assigned L1 (see ontology doc section 2, spec section 3). |
| `l2.confidence` | float [0,1] | Classifier confidence in the L2 assignment. |
| `l3` | array | Multi-valued. Each entry is `{ value: "category:value", confidence }`. May be empty. |
| `l3[].value` | string | `"<category>:<value>"`. Category is one of: `method`, `tactic`, `target`, `context_marker`, `overlap`, `risk_marker` (see ontology doc section 3, spec section 4). |
| `l3[].confidence` | float [0,1] | Per-tag confidence. Tags below `L3_EMIT_CONFIDENCE_MIN` (0.50) are filtered out before emission. |

**Constraints:**

- `l2.value` MUST be a valid L2 for the given `l1.value`. The engine enforces this via the `L2_BY_L1` map in `safeeval-v5.js` (mirrored from `policy-spec-v5.0.md` section 7).
- L3 entries SHOULD NOT duplicate (same `value`). The engine deduplicates and keeps the highest-confidence instance.
- The closed enums (L1, L2, L3 categories, L3 values within `method` / `tactic` / `target` / `context_marker` / `overlap` / `risk_marker`) are defined in the ontology doc and the spec, and mirrored in `safeeval-v5.js` exports.

### 3.3 `disposition`

| Field | Type | Notes |
|---|---|---|
| `action` | string | One of: `allow`, `safe_completion`, `human_review`, `block`. |
| `confidence` | float [0,1] | Confidence in the action. Set to 1.0 when a deterministic rule fired (e.g., bright line). |
| `reasoning_summary` | string | 1-3 sentences, max 280 chars (`REASONING_SUMMARY_MAX_CHARS`). Audit-grade natural-language justification. |
| `triggered_by` | object | Explainability artifact. |
| `triggered_by.bright_lines` | array of strings | Which bright-line features (from `evidence.bright_lines`) drove the action. Empty if none. |
| `triggered_by.thresholds` | array of strings | Which score thresholds fired. E.g., `"aggregate_score>=10"`. |
| `triggered_by.rules` | array of strings | Which deterministic rules fired. See spec section 6.1. |
| `safe_completion_guidance` | string or null | When `action = "safe_completion"`, a short note describing how the response should be framed (e.g., "Frame defensively; do not produce a working artifact"). Null otherwise. |

**Action selection order:** See `policy-spec-v5.0.md` section 6.1 -- engine applies the deterministic rules in the order listed there. First rule that fires wins.

### 3.4 `evidence`

The FAF v4.0 evidence layer, moved from the response root to under `evidence`.

| Field | Type | Notes |
|---|---|---|
| `faf_nodes.context` | object | Source, Persona, Topic, Target, Relationship Phase. |
| `faf_nodes.process.execution` | object | Delivery Method, Delivery Template, Referenced Entities. |
| `faf_nodes.process.psychological` | object | Trigger, Incentive, Control. |
| `faf_nodes.objective` | object | Objective string. |
| `component_scores` | object | `target`, `lure`, `trust`, `extract`, `evade`, each int 0-3. |
| `aggregate_score` | int | Sum of component scores, 0-15. |
| `bright_lines` | array of strings | Subset of `BRIGHT_LINE_FEATURES` (see ontology doc section 5, spec section 5). |
| `process_flags` | array of objects | Each `{ category, description }`. Categories: `Trigger`, `Incentive`, `Control`, `Delivery`, `Template`. (Carry-forward from v4.0.) |
| `l2_probabilities` | object | Map from any L2 value to probability [0,1]. Sparse -- only L2s with prob > 0 are included. Replaces v4's `typology_probabilities`. |

**Relationship-Phase values:** `targeting`, `contact`, `engagement`, `conversion`, `extraction`, `escalation`, `evasion`. Unchanged from v4.0.

**Trigger values:** `fear`, `urgency`, `authority`, `trust_love`, `greed_opportunity`, `hope_desperation`. Unchanged from v4.0 (note underscore-vs-slash normalization: v4's "trust/love" becomes `trust_love` for ASCII safety).

### 3.5 `prompt_summary`

Carry-forward from v4.0 with no changes. Five-field convenience summary for UI display.

```json
{
  "persona":   "string | null",
  "topic":     "string",
  "target":    "string | null",
  "objective": "string | null",
  "pretext":   "string | null"
}
```

### 3.6 `pipeline_trace` (debug only)

Resolved per Decision 5 (`policy-spec-v5.0.md` section 9): default-OFF. The trace ships only when the caller passes `?debug=1`. In production responses the field is OMITTED from the JSON entirely (not present as `null`, not present as `{}` -- absent).

```jsonc
// shape when present:
{
  "stage_1": { "model": "...", "duration_ms": 312, "input_tokens": 248, "output_tokens": 64,  "output": { /* triage output */ } },
  "stage_2": { "model": "...", "duration_ms": 2412, "input_tokens": 1234, "output_tokens": 1187, "output": { /* faf analysis */ } },
  "stage_3": { "model": "...", "duration_ms": 891, "input_tokens": 1456, "output_tokens": 312,  "output": { /* classification */ } },
  "stage_4": { "model": "...", "duration_ms": 612, "input_tokens": 1389, "output_tokens": 187,  "output": { /* disposition */ } },
  "stage_5": null,
  "short_circuited_at": null,
  "errors": []
}
```

Default-off rationale: least-info-by-default is standard for production T&S APIs (smaller response surface, lower payload, no accidental leakage of stage-internal reasoning into untrusted consumers). Debug mode covers the portfolio walkthrough use case.

---

## 4. API contract during the dual-emit phase

For one release window, the `/api/evaluate` route returns both shapes when the client opts in.

### 4.1 Request

```
POST /api/evaluate?v5=1
Content-Type: application/json

{ "prompt": "..." }
```

Query parameters:

- `v5=1` (optional) -- include the v5 envelope alongside `v4_legacy`. If omitted, response is v4 only (current behavior).
- `debug=1` (optional, requires `v5=1`) -- include `pipeline_trace` in the v5 envelope.

### 4.2 Response (v5 opted in)

```jsonc
{
  "id": "uuid",
  "v4_legacy": { /* unchanged v4 response, see HANDOFF.md section 4.4 */ },
  "v5":        { /* v5 envelope per section 2 above */ }
}
```

### 4.3 Response (v5 not opted in)

```jsonc
{
  "id": "uuid",
  /* ... full v4 response fields at the response root, unchanged from current behavior ... */
}
```

This matches the current production contract. Existing consumers (and the current UI) keep working with zero changes.

### 4.4 Cost during dual-emit

When `?v5=1` is set, the API runs v4 and v5 in parallel. The user pays for both. The v5 pipeline triages on Haiku first -- when the prompt is clearly benign, v5 short-circuits after stage 1 and is cheaper than v4. For suspicious prompts, v5 is roughly 2x the cost of v4.

This is acceptable for the dual-emit window because it lets you A/B the pipelines without breaking anything. After cutover (memo section 6 step 4), v4 is dropped and the engine runs v5 only.

---

## 5. Stage-by-stage pipeline summary

(Full pipeline architecture is in the v5 design memo section 4. This is the implementation reference.)

| Stage | Model | Purpose | Output |
|---|---|---|---|
| 1. Triage | `claude-haiku-4-5` | Coarse L1 routing + context grab. Short-circuits obvious benigns. | `{ l1_candidate, l1_confidence, coarse_context }` |
| 2. FAF Analysis | `claude-sonnet-4-6` | Full FAF evidence: nodes, scores, bright lines, process flags, L2 probs. | full `evidence` object |
| 3. Classification | `claude-sonnet-4-6` | Assigns L1, L2, L3 with confidences. Constrained by closed enums via tool-use. | full `classification` object |
| 4. Disposition | `claude-sonnet-4-6` | Deterministic rules first, then model fills `reasoning_summary` for unhandled cases. | full `disposition` object |
| 5. Adversarial review (optional) | `claude-sonnet-4-6` | Argues the strongest case the disposition is wrong. Adjusts action if it materially shifts confidence. | revised `disposition` |

**Short-circuit:** Stage 1 emits final `disposition.action = "allow"` and stops if `l1_candidate == "benign"` AND `l1_confidence >= TRIAGE_BENIGN_CONFIDENCE_MIN` (0.92) AND no risk markers in `coarse_context`. In that case, `evidence` is populated with a minimal stub and `model_pipeline = ["claude-haiku-4-5"]`.

**Streaming UX (Decision 6):** Deferred to v5.1. The architecture supports streaming each stage to the UI as it completes; the v5.0 cutover ships the static (non-streaming) pipeline first. This does not change the envelope or the ontology.

**Failure handling:** Each stage can fail independently. Per-stage fallbacks documented in memo section 4.3 and implemented in `safeeval-v5.js`.

---

## 6. Validation rules (engine-enforced)

These are the validation behaviors the engine must implement. The corresponding JSON Schema validator lives at `tests/schema/v5-envelope.schema.json` (draft 2020-12, Round 2). The schema encodes rules 1-9 below as `enum`, `pattern`, and `if/then` constraints; rule 10 (aggregate equals sum) and rule 11's full transitive enforcement that cannot be expressed as a pure JSON Schema invariant are engine-enforced and noted in the schema's `$defs.rule_*` descriptions for discoverability.

1. `classification.l1.value` MUST be in the L1 closed set (spec section 2).
2. `classification.l2.value` MUST be in the L2 set for the assigned L1 (spec section 7 `L2_BY_L1`).
3. Every `classification.l3[].value` MUST match `^(method|tactic|target|context_marker|overlap|risk_marker):[a-z_]+$`.
4. Every L3 `value` after the `:` MUST be in the closed set for that category (with `risk_marker` and `overlap` being the most extensible).
5. `disposition.action` MUST be in `{allow, safe_completion, human_review, block}`.
6. `evidence.bright_lines` entries MUST be in `BRIGHT_LINE_FEATURES` (spec section 5).
7. `evidence.aggregate_score` MUST equal the sum of `component_scores`.
8. `evidence.component_scores[*]` MUST be integers 0-3.
9. `disposition.reasoning_summary` MUST be at most `REASONING_SUMMARY_MAX_CHARS` (280).
10. Prompt length on input MUST be in `[PROMPT_LENGTH_MIN, PROMPT_LENGTH_MAX]` = `[10, 5000]`.
11. **Co-occurrence rule (`ai_model_impersonation`):** when `evidence.bright_lines` contains `ai_model_impersonation`, then `classification.l1.value` MUST equal `cyber_intrusion` AND `classification.l2.value` MUST equal `ai_model_impersonation`. This is the only case in v5.0 where a bright-line code and an L2 value intentionally share a string. Schema-keeper implements this as a JSON Schema conditional (`if/then`) invariant in Round 2. See `policy-spec-v5.0.md` section 5 and Decision 9.

Validation runs after the model returns. Invalid responses are coerced to safe defaults and an entry is added to `pipeline_trace.errors`. A validation failure on a critical field (action, L1) downgrades the action to `human_review` with a `validation_fallback` rule.

---

## 7. What v5 does NOT change

- The `/api/evaluate` route signature (POST, JSON body with `prompt` field, validation rules: 10-5000 chars).
- The in-memory evaluation history store (still ephemeral, still resets on cold start).
- The model identifiers used for substantive work (`claude-sonnet-4-6`). Stage 1 adds `claude-haiku-4-5`.
- The bright-line feature *values* of v4 (13 features). Their location moves from response root to `evidence.bright_lines`, but the feature codes are identical. v5 adds one new bright-line: `mfa_or_otp_harvesting` (14 total -- see spec section 5).
- The `prompt_summary` shape and field names.
- The component-score names and 0-3 scale.

If a downstream consumer only needs bright-line features and component scores, those names are stable across v4 and v5 (the path changes; the values do not).

---

## 8. Migration checklist for full cutover (memo section 6 step 4)

When v4 retires, this checklist documents what needs to move:

1. `src/lib/safeeval.js` -> archive or delete.
2. `src/app/api/evaluate/route.js` -> drop the `?v5=1` opt-in; v5 becomes the default and only shape. Remove `v4_legacy` from response.
3. `src/app/page.js` -> already on v5 at this point (step 3 of memo section 6).
4. `docs/01-framework.md` -> update FAF section header to "FAF v5 evidence model" (the underlying CONTEXT/PROCESS/OBJECTIVE structure is unchanged).
5. `docs/03-master-policy.md` -> update typology references to v5 vocabulary.
6. `docs/05-classifier-guidance.md` -> update to point at the v5 pipeline stages.
7. `docs/04-enforcement-design.md` and `docs/06-stakeholder-brief.md` -> bring forward from v2.x to v5.x.
8. `docs/threat-models/*.md` -> update typology code references where they appear.
9. HANDOFF.md -> bump section 4 and section 8, mark v5 as canonical.

---

*This document is the canonical reference for the v5 envelope. The vocabulary detail lives in `docs/08-v5-ontology.md`. The contract for engine-builder and schema-keeper lives in `docs/policy-spec-v5.0.md`. The implementation will live in `src/lib/safeeval-v5.js` (Round 2).*
