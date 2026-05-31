# SafeEval v5 -- Output Schema

**Status:** v5.1 patch (extended 2026-05-28 for conversation evaluation). Schema additions (additive, dual-emit): (a) classifier-display closed-set labels on `evidence.process_flags[]` (`label` / `labels`) and `prompt_summary` (`topic_label`, `target_label`, `objective_label`, `pretext_label`, `topic_explanation`, `pretext_explanation`, `target_attributes`); (b) conversation-input discriminator on a new top-level `input` field (`input.kind: "prompt" | "conversation"`), conversation envelope at `input.conversation`, per-turn evidence container `evidence.per_turn`, and Stage 0 trace slot -- additive per `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md`. Existing prose fields retained as backward-compat aliases per `docs/memos/2026-05-26-policy-v5-classifier-display-vocabulary.md` section 4.3. Prior v5.0.1 additions: `disposition.narrative_summary`, `disposition.confidence_path`, `disposition.triggered_by.policy_note`; Stage 5 trace slot removed.
**Schema version:** 5.1
**Ontology version:** 5.2 (current; the case-study Tier 1 amendments bump 2026-05-27 per `docs/08-v5-ontology.md`. The `arc:` and `cadence:` L3 categories were added in the earlier 5.1 bump 2026-05-28 per `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` section 5; sequence numbers are content-keyed, not strictly chronological)
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
    "narrative_summary":  "This prompt requests a working credential-harvesting page impersonating enterprise IT, paired with MFA-code capture. The combined target/extract/evade pattern triggers two bright-line features (credential_harvesting_page, mfa_or_otp_harvesting) and routes to a non-negotiable block. The classifier's confidence climbed from 0.87 at triage to 0.97 at disposition as each stage added signal -- the system is narrowing in, not wavering.",
    "confidence_path":    "triage:0.87 -> faf:0.94 -> classify:0.93 -> disposition:0.97",
    "triggered_by": {
      "bright_lines": ["credential_harvesting_page", "mfa_or_otp_harvesting"],
      "thresholds":   [],
      "rules":        ["bright_line_forces_block"],
      "policy_note":  "Bright-line match: non-negotiable. No downstream stage may downgrade this disposition. See policy-spec-v5.0.md Section 6.1 rule 1."
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

### 2.1 Conversation inputs -- `input` discriminator (v5.1 additive, 2026-05-28)

The envelope grows a new top-level `input` field that discriminates between prompt-mode and conversation-mode inputs. Producers SHOULD emit this field for all v5.1 envelopes; legacy v5.1 envelopes without `input` are treated as `{ input: { kind: "prompt", text: <legacy_prompt> } }` by consumers. See `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` section 2 for the full envelope-shape commit.

Prompt-mode input shape:

```jsonc
"input": {
  "kind": "prompt",
  "text": "Write a phishing email impersonating IT for an internal security test."
}
```

Conversation-mode input shape:

```jsonc
"input": {
  "kind": "conversation",
  "conversation": {
    "modality":         "text" | "image",
    "turns": [
      { "sender": "Alice",    "text": "Hi! How was your day?", "timestamp": "2026-04-12T10:14:00Z" },
      { "sender": "__user__", "text": "Pretty good, you?",     "timestamp": null }
    ],
    "parse_confidence": 0.95,
    "parse_warnings":   []
  }
}
```

Closed sets:
- `input.kind` -- one of `"prompt"`, `"conversation"`.
- `input.conversation.modality` -- one of `"text"`, `"image"`.
- `input.conversation.turns[i].sender` -- arbitrary string; the reserved value `"__user__"` is canonical for unnamed self-bubbles per the canonicalization rule in `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` section 3.2.
- `input.conversation.turns[i].text` -- arbitrary string, verbatim turn content.
- `input.conversation.turns[i].timestamp` -- ISO-8601 string or null.
- `input.conversation.parse_confidence` -- float [0, 1].
- `input.conversation.parse_warnings` -- array of strings.

The `prompt_length` field at the top level remains. For conversation inputs, it carries the sum of `turns[i].text.length` -- the same per-input length budget that prompts pay against the `[10, 5000]` cap of validation rule 10.

Conversation inputs also populate two extension surfaces inside `evidence`: `evidence.per_turn` (per-turn FAF evidence, see section 3.4) and (within `pipeline_trace`) `pipeline_trace.stage_0` (the Stage 0 parser trace, see section 5).

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
| `action` | string | One of: `allow`, `safe_completion`, `human_review`, `block`. Operational semantics in `policy-spec-v5.0.md` Section 6.2. |
| `confidence` | float [0,1] | Confidence in the action. Set to 1.0 when a bright-line rule fires; rule-decided non-bright-line actions use the per-rule confidence in `applyDeterministicRules()`. |
| `reasoning_summary` | string | 1-3 sentences, max 280 chars (`REASONING_SUMMARY_MAX_CHARS`). Audit-grade short justification, intended for reviewer queues and structured logs. The producer is responsible for ending at a clean sentence boundary at or below the cap. Mid-word or mid-clause hard slicing at the cap is out of spec; if the model overruns, the producer trims back to the last sentence-final punctuation (`.`, `!`, `?`) -- it does not just truncate. (See rule 9 in section 6.) |
| `narrative_summary` | string | 1-2 paragraphs, max 600 chars (`NARRATIVE_SUMMARY_MAX_CHARS`). Stakeholder-readable prose explaining the call. Tells the story (triage -> evidence -> classification -> decision) in English; sits alongside the structured `triggered_by` artifact rather than replacing it. (Decision 13.) Same clean-boundary rule as `reasoning_summary`: ends at sentence-final punctuation, no mid-word slicing. (See rule 9a in section 6.) |
| `confidence_path` | string | The per-stage confidence trajectory formatted as `"triage:<c1> -> faf:<c2> -> classify:<c3> -> disposition:<c4>"`. Shows how the system's confidence evolved through the pipeline. Stages that did not run (e.g., short-circuit at Stage 1) are omitted from the path. (Decision 13.) |
| `triggered_by` | object | Explainability artifact. |
| `triggered_by.bright_lines` | array of strings | Which bright-line features (from `evidence.bright_lines`) drove the action. Empty if none. |
| `triggered_by.thresholds` | array of strings | Which score thresholds fired. E.g., `"aggregate_score>=10"`. |
| `triggered_by.rules` | array of strings | Which deterministic rules fired. See `policy-spec-v5.0.md` section 6.1. |
| `triggered_by.policy_note` | string or null | When a non-negotiable rule fired (currently: `bright_line_forces_block`), a short string flagging the non-negotiability to reviewers and to any downstream stage that might otherwise consider downgrading. Null otherwise. (Decision 11.) |
| `safe_completion_guidance` | string or null | When `action = "safe_completion"`, the framing constraint string. Branched by `classification.l1.value` per `policy-spec-v5.0.md` Section 6.2: `security_education` -> pedagogical defender framing; otherwise -> defensive non-artifact framing. Null when action is not `safe_completion`. (Decision 14.) |
| `degraded` | boolean | Non-nullable; default `false`. Set to `true` when the disposition was produced via a deterministic rule-cascade fallback because an upstream model stage failed: (1) Stage 2 failed and disposition was forced to `human_review` per `docs/04-enforcement-design.md` section 9 "Stage 2 fails"; (2) Stage 3 failed and classification was derived from `evidence.l2_probabilities` per section 9 "Stage 3 fails"; (3) Stage 4 failed and disposition was emitted from rules only (`reasoning_summary = "Model unavailable; rule-derived disposition."`, section 9 "Stage 4 fails"); (4) Stage 4's model-adjudicated path fell back to `human_review` with `validation_fallback` in `triggered_by.rules` (section 9 "Stage 4 fails" final sentence). MUST remain `false` for Stage 1 short-circuit-to-allow envelopes -- the intended fast path is not a fallback. Sibling boolean on `disposition`, not a fifth verb in the closed disposition vocabulary. Producer-side invariant: `degraded === true` iff `pipeline_trace.errors[]` is non-empty AND the disposition was emitted via a section-9 fallback path. Field shape authored by ops in `docs/memos/2026-05-25-ops-cross-track-answers.md` section 3.3; schema text landed in `docs/memos/2026-05-25-policy-classifier-translator-spec.md`. (v5.0.1 additive, 2026-05-25.) |

**Action selection order:** See `policy-spec-v5.0.md` section 6.1 -- engine applies the deterministic rules in the order listed there. First rule that fires wins. v5.0.1 removed the optional Stage 5 adversarial review; disposition output is final once Stage 4 returns. (Decision 11.)

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
| `process_flags` | array of objects | Each `{ category, description, label?, labels? }`. Categories: `Trigger`, `Incentive`, `Control`, `Delivery`, `Template`. Categories `Template` and `Delivery` carry a single-valued `label` (closed-set from `TEMPLATE_LABELS` / `DELIVERY_LABELS` -- see section 3.7); category `Control` carries a multi-valued `labels` array (closed-set from `CONTROL_LABELS`). Categories `Trigger` / `Incentive` stay prose-only. (v5.1 additive; legacy v4 envelopes without `label` / `labels` keep rendering against the description per display spec section 9.3.) |
| `l2_probabilities` | object | Map from any L2 value to probability [0,1]. Sparse -- only L2s with prob > 0 are included. Replaces v4's `typology_probabilities`. |
| `per_turn` | array of objects or absent | Conversation-mode only (`input.kind === "conversation"`). Each entry: `{ turn_index, sender, component_scores, bright_lines, process_flags }`. Per-turn FAF evidence, populated by Stage 2 for conversation inputs. Bright lines firing on any turn fire arc-level (also surfacing in `evidence.bright_lines`). For prompt-mode envelopes the field is absent. (v5.1 additive, 2026-05-28; see `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` section 2.3.) |

**Relationship-Phase values:** `targeting`, `contact`, `engagement`, `conversion`, `extraction`, `escalation`, `evasion`. Unchanged from v4.0.

**Trigger values:** `fear`, `urgency`, `authority`, `trust_love`, `greed_opportunity`, `hope_desperation`. Unchanged from v4.0 (note underscore-vs-slash normalization: v4's "trust/love" becomes `trust_love` for ASCII safety).

### 3.5 `prompt_summary`

Convenience summary for UI display. The original v4-carry-forward prose fields stay populated as backward-compat aliases during the v5.1 dual-emit window; the additive `*_label` / `*_explanation` / `target_attributes` fields land alongside them per the v5.1 classifier-display work (`docs/memos/2026-05-26-policy-v5-classifier-display-vocabulary.md`).

```jsonc
{
  // -- v4-carry-forward prose (dual-emit, retained for back-compat) --
  "persona":   "string | null",
  "topic":     "string",
  "target":    "string | null",
  "objective": "string | null",
  "pretext":   "string | null",

  // -- v5.1 classifier-display closed-set labels (additive) --
  "topic_label":         "string",        // closed-set from TOPIC_LABELS
  "target_label":        "string",        // closed-set from TARGET_LABELS
  "objective_label":     "string",        // closed-set from OBJECTIVE_LABELS
  "pretext_label":       "string",        // closed-set from PRETEXT_LABELS
  "topic_explanation":   "string | null", // free-text prose (e.g., "California driver licence")
  "pretext_explanation": "string | null", // free-text prose
  "target_attributes":   ["string"]       // L3-aliased values, prefix target:|tactic:
}
```

`target_attributes` is engine-populated post-Stage-3 from `classification.l3[]` (the subset of `target:` and `tactic:` prefixed values). It is not emitted by Stage 2.

### 3.7 v5.1 classifier-display closed sets

Seven closed-set vocabularies introduced in v5.1 for the result-card classifier-display surface. Each set is defined in the vocabulary memo (`docs/memos/2026-05-26-policy-v5-classifier-display-vocabulary.md`) and mirrored verbatim in `src/lib/safeeval-v5.js` exports plus `tests/schema/v5-envelope.schema.json` `$defs`. Lockstep-verified by `scripts/check-lockstep.js`.

| Engine constant | JSON Schema `$defs` | Memo section | Cardinality | Surface |
|---|---|---|---|---|
| `TEMPLATE_LABELS`  | `template_labels`  | memo 2.1 | 11 values | `evidence.process_flags[].label` (category Template) |
| `DELIVERY_LABELS`  | `delivery_labels`  | memo 2.2 | 9 values  | `evidence.process_flags[].label` (category Delivery) |
| `CONTROL_LABELS`   | `control_labels`   | memo 2.3 | 11 values | `evidence.process_flags[].labels` (category Control; multi-valued) |
| `TOPIC_LABELS`     | `topic_labels`     | memo 3.1 | 12 values | `prompt_summary.topic_label` |
| `TARGET_LABELS`    | `target_labels`    | memo 3.2 | 15 values | `prompt_summary.target_label` |
| `OBJECTIVE_LABELS` | `objective_labels` | memo 3.3 | 11 values | `prompt_summary.objective_label` |
| `PRETEXT_LABELS`   | `pretext_labels`   | memo 3.4 | 12 values | `prompt_summary.pretext_label` |

Every vocabulary includes `none_observed` (no-signal default) and `other` (audit-affordance catchall). The display spec at `docs/ux/design-system/v5-result-card.md` sections 9-13 documents the chip chrome and empty-state policy. Out-of-spec values emitted by Stage 2 are coerced engine-side to `other` rather than throwing -- see `coerceProcessFlag` / `coercePromptSummary` in `src/lib/safeeval-v5.js`.

### 3.6 `pipeline_trace` (debug only)

Resolved per Decision 5 (`policy-spec-v5.0.md` section 9): default-OFF. The trace ships only when the caller passes `?debug=1`. In production responses the field is OMITTED from the JSON entirely (not present as `null`, not present as `{}` -- absent).

```jsonc
// shape when present:
{
  "stage_1": { "model": "...", "duration_ms": 312, "input_tokens": 248, "output_tokens": 64,  "output": { /* triage output */ }, "sampled_for_offline_review": false },
  "stage_2": { "model": "...", "duration_ms": 2412, "input_tokens": 1234, "output_tokens": 1187, "output": { /* faf analysis */ } },
  "stage_3": { "model": "...", "duration_ms": 891, "input_tokens": 1456, "output_tokens": 312,  "output": { /* classification */ } },
  "stage_4": { "model": "...", "duration_ms": 612, "input_tokens": 1389, "output_tokens": 187,  "output": { /* disposition */ } },
  "short_circuited_at": null,
  "errors": []
}
```

**Note on `stage_1.sampled_for_offline_review`:** When Stage 1 short-circuits to ALLOW, a deterministic hash of the prompt selects approximately `TRIAGE_OBSERVABILITY_SAMPLE_RATE` (default 10%) of cases for offline re-evaluation. The flag is recorded in the trace so an out-of-band batch job can find the sampled prompts and re-run them through the full pipeline. This is the audit mechanism backing the >98% Haiku precision claim (Decision 12). Sampling is deterministic on a stable prompt hash so the same prompt always samples the same way (no traffic-replay drift).

**Note on Stage 5:** v5.0.1 removed the optional Stage 5 adversarial-review slot. The trace shape no longer carries `stage_5`. Clients written against v5.0 that defensively read `stage_5` will see undefined and should fall back to treating disposition as final at Stage 4. (Decision 11.)

Default-off rationale: least-info-by-default is standard for production T&S APIs (smaller response surface, lower payload, no accidental leakage of stage-internal reasoning into untrusted consumers). Debug mode covers documentation and developer walkthrough use cases.

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
  "v4_legacy": { /* the v4 response shape (preserved during dual-emit) */ },
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

(Full pipeline rationale is in `docs/04-enforcement-design.md`. This is the implementation reference.)

| Stage | Model | Purpose | Output |
|---|---|---|---|
| 0. Turn Segmentation | `claude-haiku-4-5` (image-mode default), `claude-sonnet-4-6` (escalation tier when `parse_confidence < 0.85`), or `null` (text-mode -- deterministic parse) | Conversation inputs only. Image -> turn array via vision parse; text -> turn array via sender-line heuristics. Emits `parse_confidence`, `parse_warnings`, optional `modality_hint`. Adversarial-input mitigation via SECURITY block in parser prompt (see `docs/threat-models/09-ai-enabled-abuse.md`). On failure, halts the pipeline and routes disposition to `human_review` with rule `stage_0_parse_failure`. | `{ turns, parse_confidence, parse_warnings, modality_hint? }`. Stage trace at `pipeline_trace.stage_0`. (v5.1 additive, 2026-05-28; see `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` section 6.) |
| 1. Triage | `claude-haiku-4-5` | Coarse L1 routing + context grab. Short-circuits obvious benigns. Gated by `TRIAGE_BENIGN_PRECISION_MIN`. For conversation inputs, sees the turn array directly (not a flattened string) and computes arc-level coarse context. | `{ l1_candidate, l1_confidence, coarse_context }` |
| 2. FAF Analysis | `claude-sonnet-4-6` | Full FAF evidence: nodes, scores, bright lines, process flags, L2 probs. For conversation inputs, additionally emits `evidence.per_turn[]` per the per-turn evidence shape in section 3.4. | full `evidence` object |
| 3. Classification | `claude-sonnet-4-6` | Assigns L1, L2, L3 with confidences. Constrained by closed enums via tool-use. L3 categories include `arc:` and `cadence:` for conversation inputs (see ontology section 3.6 / 3.7). | full `classification` object |
| 4. Disposition | `claude-sonnet-4-6` | Deterministic rules first; when a rule decides, reasoning_summary is generated from the rule + evidence without re-asking the model to "decide." When no rule fires, the model adjudicates. Always returns final disposition. Disposition is arc-level for conversation inputs. | full `disposition` object |

v5.0 reserved a Stage 5 adversarial review slot. v5.0.1 removed it -- see policy-spec-v5.0.md Decision 11. The calibration role is now covered by the deterministic `low_l2_confidence_review` rule (Section 6.1 rule 6).

**Short-circuit:** Stage 1 emits final `disposition.action = "allow"` and stops if `l1_candidate == "benign"` AND `l1_confidence >= TRIAGE_BENIGN_CONFIDENCE_MIN` (0.92) AND no risk markers in `coarse_context`. In that case, `evidence` is populated with a minimal stub and `model_pipeline = ["claude-haiku-4-5"]`.

**Streaming UX (Decision 6):** Deferred to v5.1. The architecture supports streaming each stage to the UI as it completes; the v5.0 cutover ships the static (non-streaming) pipeline first. This does not change the envelope or the ontology.

**Failure handling:** Each stage can fail independently. Per-stage fallbacks documented in memo section 4.3 and implemented in `safeeval-v5.js`.

---

## 6. Validation rules (engine-enforced)

These are the validation behaviors the engine must implement. The corresponding JSON Schema validator lives at `tests/schema/v5-envelope.schema.json` (draft 2020-12, Round 2). The schema encodes rules 1-8, 9b, and 9c below as `enum`, `pattern`, and `if/then` constraints; the remaining engine-enforced behaviors -- rule 9 / 9a clean-boundary truncation, rule 10 (aggregate equals sum), rule 11's full transitive enforcement, rule 12's L2 / `l2_probabilities` co-occurrence MUST half plus SHOULD tolerance, and rule 12b's within-tolerance tiebreak -- cannot be expressed as pure JSON Schema invariants and are noted in the schema's `$defs.rule_*` descriptions for discoverability. Rule 12a is a cardinality clarification with no validator counterpart -- it documents that the map may carry multiple keys (the schema already permits this via the `additionalProperties` shape of `l2_probabilities`), but the schema does not need a new constraint to enforce it.

1. `classification.l1.value` MUST be in the L1 closed set (spec section 2).
2. `classification.l2.value` MUST be in the L2 set for the assigned L1 (spec section 7 `L2_BY_L1`).
3. Every `classification.l3[].value` MUST match `^(method|tactic|target|context_marker|overlap|risk_marker):[a-z_]+$`.
4. Every L3 `value` after the `:` MUST be in the closed set for that category (with `risk_marker` and `overlap` being the most extensible).
5. `disposition.action` MUST be in `{allow, safe_completion, human_review, block}`.
6. `evidence.bright_lines` entries MUST be in `BRIGHT_LINE_FEATURES` (spec section 5).
7. `evidence.aggregate_score` MUST equal the sum of `component_scores`.
8. `evidence.component_scores[*]` MUST be integers 0-3.
9. `disposition.reasoning_summary` MUST be at most `REASONING_SUMMARY_MAX_CHARS` (280) AND MUST end at a clean sentence boundary (the last character before any trailing whitespace MUST be one of `.`, `!`, `?`). The producer is responsible for trimming back to the prior sentence boundary when the model overruns; hard slicing at the cap is out of spec. This is engine-enforced rather than schema-enforced because "ends at a sentence boundary" is straightforward to check in code but ugly as a JSON Schema regex. (v5.0.1 clarification, 2026-05-25.)
9a. `disposition.narrative_summary` MUST be at most `NARRATIVE_SUMMARY_MAX_CHARS` (600) AND MUST end at a clean sentence boundary as defined in rule 9. (v5.0.1, Decision 13; clean-boundary clause added 2026-05-25.)
9b. `disposition.confidence_path` MUST match the regex `^(triage:[0-9.]+ -> )?(faf:[0-9.]+ -> )?(classify:[0-9.]+ -> )?disposition:[0-9.]+$`. Stages that did not run are omitted from the path. (v5.0.1, Decision 13.)
9c. `disposition.triggered_by.policy_note` MUST be a non-empty string when `disposition.triggered_by.rules` contains `bright_line_forces_block`; otherwise it MUST be null or absent. (v5.0.1, Decision 11.)
10. Prompt length on input MUST be in `[PROMPT_LENGTH_MIN, PROMPT_LENGTH_MAX]` = `[10, 5000]`.
11. **Co-occurrence rule (`ai_model_impersonation`):** when `evidence.bright_lines` contains `ai_model_impersonation`, then `classification.l1.value` MUST equal `cyber_intrusion` AND `classification.l2.value` MUST equal `ai_model_impersonation`. This is the only case in v5.0 where a bright-line code and an L2 value intentionally share a string. Schema-keeper implements this as a JSON Schema conditional (`if/then`) invariant in Round 2. See `policy-spec-v5.0.md` section 5 and Decision 9.
12. **L2 / `l2_probabilities` co-occurrence invariant:** `classification.l2.value` MUST appear as a key in `evidence.l2_probabilities`. Its probability there SHOULD be within `L2_PICK_PROBABILITY_TOLERANCE` (0.05) of `max(values(evidence.l2_probabilities))`. The MUST half is engine-enforced (a picked L2 absent from the probability map is a coercion target -- downgrade to `human_review` with rule `validation_fallback` per the validation behavior described below). The SHOULD half is a quality bar -- engines may pick a slightly lower-probability L2 when downstream evidence justifies it, but the gap must be inside the tolerance. This rule is what makes "the engine picked L2=X but the evidence says L2=Y" a provably out-of-spec disposition rather than a stylistic disagreement. (v5.0.1 invariant added 2026-05-25.)
12a. **Cardinality of `evidence.l2_probabilities`:** the map MAY contain one key, or multiple keys. Multi-key maps are in-spec and reflect prompts where more than one L2 has substantive signal -- the canonical case is business email compromise (BEC) for money, which is centrally both `phishing_attack` (delivery template) and `impersonation_scam` (persona). The example map in section 2 above is multi-key for this reason. Rule 12's MUST half applies to the picked L2 only; the rule says nothing about how many other L2s may be keys, nor that any non-picked L2 must be absent. Stage 2's job is to produce evidence; Stage 3's job is to select; the cardinality of the map is an evidence-layer characteristic and not constrained beyond rule 12's MUST. (v5.0.1 clarification, adjudicated in `docs/memos/2026-05-25-policy-bec-map-rule12.md`, 2026-05-25.)
12b. **Within-tolerance tiebreak for the Stage 3 L2 pick:** when two or more keys in `evidence.l2_probabilities` are within `L2_PICK_PROBABILITY_TOLERANCE` (0.05) of `max(values(evidence.l2_probabilities))`, the producer's pick is deterministic and follows this order: (i) if exactly one of the tied L2s is referenced by a fired bright-line feature -- meaning the bright-line code in `evidence.bright_lines` semantically corresponds to that L2 under the FAF (e.g., `executive_impersonation_payment` corresponds to `impersonation_scam`; `credential_harvesting_page` corresponds to `credential_theft`) -- pick that L2; (ii) if zero of the tied L2s is referenced by a fired bright line, or if multiple tied L2s are each referenced by different fired bright lines, pick the alphabetically-earliest L2 name (lexical ASCII order). Comparison is float-robust: producers MUST treat probabilities whose difference is within a small numeric epsilon of the tolerance threshold as tied (e.g., by quantizing to 4 decimal places before comparing, or by adding a `1e-9` epsilon slack to the threshold). The bright-line-to-L2 reference set is the closed mapping in `docs/08-v5-ontology.md` section 2 (each L2's definition) plus the bright-line definitions in `docs/policy-spec-v5.0.md` section 5; producers SHOULD derive the reference set programmatically from those sources rather than hard-coding a parallel table. This rule is engine-enforced and runs after the argmax-and-SHOULD-bound selection from `docs/memos/2026-05-25-policy-classifier-translator-spec.md` section 2.3; when the argmax is uncontested the tiebreak is a no-op. (v5.0.1 invariant added 2026-05-25; float-robustness clause added 2026-05-27 per `docs/memos/2026-05-27-policy-fixture-01-l2-drift.md`.)

13. **Conversation-input shape (v5.1 additive, 2026-05-28).** When `input.kind === "conversation"`, `input.conversation` MUST be present with: `modality` in `{"text", "image"}`; `turns` as an array of length >= 2; each turn entry having `sender: string` (REQUIRED) and `text: string` (REQUIRED), `timestamp: ISO-8601 string or null` (OPTIONAL); `parse_confidence: float [0,1]`; `parse_warnings: array of strings`. Stage 0 (`pipeline_trace.stage_0`) MUST be present when conversation-mode inputs reach the pipeline. See `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` sections 2.3, 3.1, 6.2.
14. **Sender canonicalization (v5.1 additive, 2026-05-28).** Unnamed self-bubble senders (turns sent by the device owner / account holder where the source UI does not display a real name) MUST be canonicalized at Stage 0 to the reserved value `"__user__"`. Other sender values are arbitrary strings (verbatim parser emission with whitespace trimming). UI-layer mapping from `__user__` to a per-modality friendly label (`Me` / `You`) is a render-layer concern, not a schema invariant. See `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` section 3.2.

Validation runs after the model returns. Invalid responses are coerced to safe defaults and an entry is added to `pipeline_trace.errors`. A validation failure on a critical field (action, L1) downgrades the action to `human_review` with a `validation_fallback` rule. A Stage 0 parse failure (`stage_0.ok === false`) halts the pipeline before Stage 1 and routes disposition to `human_review` with rule `stage_0_parse_failure`.

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
