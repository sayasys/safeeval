# v5 result-card chrome -- design-system spec

**Date:** 2026-05-25
**Author:** ux track (Cowork)
**Status:** spec, ready for VS Code implementation handoff
**Phase:** live-v5-app-audit phase 2c
**Companion files:** `docs/ux/design-system/disposition-tier-icons.md` (per-tier icon spec), `docs/ux/audits/2026-05-25-live-v5-surface.md` (the phase-1 audit this spec resolves), `docs/ux/audits/2026-05-25-live-v5-surface-followup.md` (re-tests on the now-rendering surface).
**Authoritative inputs:** `docs/07-v5-schema.md` (envelope shape), `docs/08-v5-ontology.md` (closed enums + L1/L2 vocabulary), `docs/04-enforcement-design.md` (stage names + section 9 fallback paths), `docs/memos/2026-05-25-ops-cross-track-answers.md` (stage labels, degraded flag), `docs/memos/2026-05-25-policy-cross-track-decisions.md` (closed-set L1, two-vocabulary clarification, clean-boundary, L2/probability invariant).

## 0. Scope and non-scope

This spec describes the visual + structural chrome of the v5 result card -- what sections exist, in what order, how each renders the v5 envelope, and how each handles loading / degraded / missing-field cases. It is the source-of-truth for the phase 2d VS Code render-fix dispatch.

In-scope: visual structure of the eight sections enumerated below; per-tier disposition icon usage (full design in companion `disposition-tier-icons.md`); explicit accommodation of the two-vocabulary distinction (Update B) and stage-label list (Update A) called out in the dispatch brief.

Out of scope (deferred to phase 2e per CURRENT_ux.md or to engine-side dispatches per policy/ops memos): mobile-viewport pixel-level layout; pixel-by-pixel WCAG contrast measurements on the now-rendering surface; `human_review` disposition reproducibility test; classifier-side fixes to the L1 = `NONE` / L1 = `PHISHING` leaks (engine dispatch, not ux); the `disposition.degraded` boolean field implementation (engine dispatch via policy adjudication).

No new policy wording, no new disposition behavior, no new typology, no threshold change. This spec is rendering instructions over an envelope whose shape and vocabulary are fixed elsewhere.

## 1. Section inventory and order

The result card renders eight sections in this top-to-bottom order. Sections are visible by default unless marked `(collapsible)`; collapsibles are collapsed by default unless noted. The order is chosen to put credibility-bearing fields first (disposition + reasoning) and reference / debug detail last.

| # | Section | Renders | Default state |
|---|---------|---------|---------------|
| 1 | Disposition banner | `disposition.action`, `disposition.confidence`, `schema_version`, per-tier icon | visible |
| 2 | Reasoning + narrative summary | `disposition.reasoning_summary`, `disposition.narrative_summary`, `safe_completion_guidance` (when present) | visible (narrative collapsed into "Read more" if both fields present) |
| 3 | Classification envelope | `classification.l1`, `classification.l2`, `classification.l3[]` | visible |
| 4 | Triggered-by block | `disposition.triggered_by.{bright_lines, thresholds, rules, policy_note}` | visible |
| 5 | Evidence panel | `evidence.component_scores`, `evidence.process_flags[]`, `evidence.bright_lines`, `evidence.l2_probabilities`, `evidence.faf_nodes` | (collapsible), collapsed |
| 6 | Stage trace | `disposition.confidence_path` parsed against the four static stage labels | (collapsible), collapsed |
| 7 | Degraded chip | `disposition.degraded === true` (or interim string-equality rule) | visible only when degraded |
| 8 | Loading state (replaces 1-7 while pending) | progress over the four static stage labels, count from `model_pipeline.length` | visible while `loading === true` |

The current live render (commit `db43090`) covers sections 1, 3, 4, 5 inline plus a pipeline-trace block and a metadata footer. This spec keeps the order and adds sections 2, 6, 7, 8 as net new, restructures 5 to surface component-scores and process-flags as two distinct sections per Update B, and adds the per-tier icon to section 1 per audit P1.1.

## 2. Section specs

### 2.1 Disposition banner

The credibility core. First thing a reader sees when the result lands.

**Visual structure** (single row, flex-wrap):

- **Tier icon** (NEW, resolves audit P1.1). One of four icons per `disposition.action`. Full spec at `docs/ux/design-system/disposition-tier-icons.md`. Icon sits to the left of the disposition pill, same vertical center, 16px square in the pill itself, 20px in the surrounding banner row.
- **Disposition pill.** Background + text color per `V5_ACTION_CONFIG` (already in `src/app/page.js` lines 76-101 -- keep). Pill content is `icon + space + DISPOSITION-LABEL`. Label strings stay as today: `ALLOW`, `SAFE COMPLETION`, `HUMAN REVIEW`, `BLOCK` (uppercase, sentence-case for the icon's accessible name -- see `disposition-tier-icons.md`).
- **Schema-version chip.** `v5 schema {schema_version}`. Already in render at line 308-310; keep. Note from audit P2.4: if a downstream sanitizer flags the version string as a suspected JWT, the chip will read `[BLOCKED: JWT token]`. This is a third-party sanitizer artifact, not a renderable fix here; flagging only.
- **Confidence readout.** `Disposition confidence: <strong>NN%</strong>` right-aligned. Keep current treatment (line 311-313).

**Confidence -> non-color affordance.** When `disposition.confidence < 0.70` add a small "low-confidence" tag (text-only, neutral gray) next to the number. This is a soft signal -- it does NOT change the action and does NOT trigger any disposition recomputation. Threshold of 0.70 chosen to match the existing UI display threshold for sub-typologies (`DISPLAY_THRESHOLD_PCT = 65` in page.js, rounded up slightly so the tag fires on adjacent calls but not borderline). If implementation surfaces friction with that threshold, fall back to 0.65 to align with the existing constant rather than introduce a new one.

**Acceptance:**
- Each of the four dispositions renders with its assigned icon.
- Banner row remains single-line at >=900px viewport width; wraps cleanly at narrower widths with icon + pill staying together and confidence readout dropping to the next line.
- Banner aria-label includes both the disposition string and the icon's accessible name; banner is inside the existing `aria-live="polite"` container (already in place from phase 2a, commit `db43090`).

### 2.2 Reasoning + narrative summary

Per schema 3.3 these are two distinct fields with two distinct purposes. The current render (line 315-319) only shows `reasoning_summary`. The narrative summary was added in v5.0.1 and must surface.

**Render rule.** Show `reasoning_summary` always (when present), as today: small body text, white card on the tier background, 12-13px font, line-height 1.5. Show `narrative_summary` immediately below, in the same card visual, separated by a thin horizontal rule, with a leading muted label "Narrative". If both summaries are present and the combined height exceeds approximately 8 lines of body text, collapse the narrative section behind a "Read more" toggle that expands inline; do not move the narrative to a separate accordion -- this is the same reader scan as the reasoning, just more depth.

**Clean-boundary guarantee.** Per policy memo decision 2.4 and schema rule 9 / 9a, both fields are spec'd to end at a sentence-final punctuation (`.`, `!`, `?`). UI does not need to trim, hyphenate, or ellipsize. If a malformed envelope arrives with mid-word truncation, render as-is -- the wrongness is the engine's responsibility to fix and the visual reflection of "this was wrong" is part of the audit signal.

**Safe-completion guidance chip.** When `disposition.safe_completion_guidance` is non-null (always coincides with `action === "safe_completion"` per schema 3.3), render the existing amber-on-amber guidance chip (line 320-325) below the narrative. Keep label `Guidance:`. Per ops memo section 4.4: the guidance string is the framing constraint for the safe-completion response itself, not a UX explanation -- preserve its wording verbatim.

**Acceptance:**
- Both fields render when present; only `reasoning_summary` when narrative is absent.
- "Read more" toggle for narrative only fires when combined-content height threshold is exceeded; otherwise both expanded.
- The two fields are visually separated by the horizontal rule and the "Narrative" label, so a reader can tell they are two distinct artifacts (audit-grade vs stakeholder-readable).

### 2.3 Classification envelope (L1 / L2 / L3)

The current render (line 328-389) is structurally correct: L1 / L2 / L3 rows, monospace value chips, percent confidence. Two changes from the phase-1 audit and the policy memo:

**Display labels: no prose dictionary in this iteration.** Per the policy inbox post (2026-05-25), policy can supply a label dictionary (`deceptive_fraud` -> "Deceptive Fraud", etc.). Ux's decision for this iteration: keep the underscore-form values as-is, with the monospace treatment that already conveys "this is a structured enum value." Rationale: (a) the L1 / L2 vocabulary is the load-bearing concept v5 is presenting, and obfuscating it under a prose layer trades audit-readability for friendliness; (b) the monospace + chip style telegraphs "this is a code, not a label" which is the right reader frame; (c) the README link to the policy framework is the right path for a reader who needs to know what `deceptive_fraud` means. We can revisit and add a tooltip-layer display-label dictionary in a future iteration if the audit surface keeps reading as too jargon-dense; flagging the option, not closing it.

**Closed-set rendering.** Per policy memo decisions 2.1 and 2.2 plus ontology section 1 closed-set enforcement clause: the seven legal L1 values are `benign`, `security_education`, `ambiguous_dual_use`, `deceptive_fraud`, `privacy_abuse`, `platform_abuse`, `cyber_intrusion`. Any other rendered L1 value (including the observed `PHISHING` and `NONE` carry-overs) is an out-of-spec engine output. Spec for this UI: render whatever the envelope contains -- do NOT add a UI-side correction map. Out-of-spec values surface as the underscore-form chip just like legal values, which is the right behavior: the bug is in the engine and must remain visible until the engine fix ships (separate VS Code dispatch, per policy memo section 4 item 4). No defensive transform; let the bug be seen.

**L3 grouping.** Already correct: six categories (`method`, `tactic`, `target`, `context_marker`, `overlap`, `risk_marker`), each with its own row of value chips. Sort within a category by descending confidence. No change.

**Acceptance:**
- All three rows (L1, L2, L3) render when present; L3 empty-state message ("No L3 tags above emit threshold") preserved.
- L1 / L2 values render verbatim from the envelope (underscore form), no prose label layer.
- Component-score row is NOT rendered here -- it lives in section 2.5 evidence panel under its own vocabulary.

### 2.4 Triggered-by block

The current render (line 391-416) covers three sub-rows: bright lines, thresholds, rules. One field is missing in the current render and one rendering decision is needed.

**Missing field: `policy_note`.** Per schema 3.3 + rule 9c, `disposition.triggered_by.policy_note` is a non-empty string when `triggered_by.rules` contains `bright_line_forces_block`; null otherwise. The current render ignores it. Spec: when `policy_note` is non-null, render below the three sub-rows as a flat callout (one line, neutral background, leading icon TBD in `disposition-tier-icons.md`, prefix label `Non-negotiable:`), full prose verbatim from the envelope. This is the load-bearing signal that a bright-line decision is not downgradeable; the current UI hides it entirely.

**Rendering decision for bright-line vs rules.** The current chip treatment uses bright-line-red for `bright_lines`, orange for `thresholds`, gray for `rules`. Keep. Bright-line chips already invoke `BRIGHT_LINE_DESCRIPTIONS` (page.js lines 8-23) for hover descriptions; keep that pattern. Add the same hover-description treatment to `rules` chips -- the named rules (`bright_line_forces_block`, `validation_fallback`, `low_l2_confidence_review`, `security_education_safe_completion`) need short descriptions so a reader doesn't have to grep `04-enforcement-design.md` to know what fired. The descriptions are short prose owned by ops; ux drafts an initial dictionary in this spec, ops can revise via inbox.

**Initial rules-description dictionary** (ops to confirm via inbox):

| Rule key | Hover description |
|----------|-------------------|
| `bright_line_forces_block` | Bright-line policy match. This disposition is non-negotiable -- no downstream stage may downgrade it. |
| `bright_line_forces_review` | Bright-line policy match that routes to human review (cf. block). |
| `low_l2_confidence_review` | L2 confidence below the human-review threshold; the model adjudicator was not confident enough to commit. |
| `security_education_safe_completion` | Prompt classified as security education; framed as defender-side training rather than executed verbatim. |
| `validation_fallback` | Envelope failed a schema invariant (e.g., L2 not in the probability map); coerced to human review per schema rule 12. |

**Acceptance:**
- `policy_note` renders when non-null; suppressed when null/absent.
- Each chip (bright-line and rule) has a hover-description from its respective dictionary; missing descriptions render the underscore-form code as the description, which is the same fallback the bright-line code already uses.
- Empty arrays render an empty row (label + grayed "none") rather than suppressing the row -- consistent with the audit affordance.

### 2.5 Evidence panel

This is where Update B from CURRENT_ux.md lands. The current render (line 418-507) collapses component scores and process flags into a chip-row treatment that visually conflates them. Policy memo decision 2.3 plus the new ontology section 3.7 explicitly state they are two distinct fields with two distinct closed vocabularies and must not collapse into a single labeled list.

**Two distinct sub-sections required.**

**Component scores** (`evidence.component_scores`). Render as a 5-row numeric table. Rows in order: `target`, `lure`, `trust`, `extract`, `evade` (the canonical FAF component vocabulary). Each row: monospace label on the left, integer score 0-3 in the middle, a 3-dot or 3-segment progress indicator on the right showing the score visually. Sample treatment:

```
target    3   [###]
lure      3   [###]
trust     2   [##.]
extract   3   [###]
evade     2   [##.]
                                     aggregate 13/15
```

Aggregate row at the bottom (sum of components, range 0-15). Per schema rule 7, the aggregate MUST equal the sum -- but UI does not enforce; renders whatever is in `evidence.aggregate_score`. Mismatch surfaces as visible inconsistency, which is the right audit signal.

**Process flags** (`evidence.process_flags[]`). Render as a list of `{ category, description }` rows. Categories: `Trigger`, `Incentive`, `Control`, `Delivery`, `Template` (the FAF v4 carry-forward process-flag vocabulary). Keep the existing list treatment (line 465-478): a row per entry, leading dot, monospace category label, prose description. Order entries by category alphabetically when more than one entry shares a description theme; otherwise preserve envelope order. The existing render is structurally correct -- the bug was that the OTHER sub-section (component scores) was labeled with these category names. With the two now separated, the existing rendering of process flags is fine; just make sure the headline label reads `Process flags` and not `Triggers / Incentives / Controls / Delivery / Template`.

**Other evidence sub-sections** (kept from current render): `Bright lines` (chip row with `BrightLineChip` hover descriptions, keep), `FAF nodes` (pretty-printed JSON in a code block, keep), `L2 probabilities` (sorted descending, percent chips, keep).

**L2 probabilities now has a load-bearing invariant** per policy memo decision 2.5 + new schema rule 12. Spec: render the picked `l2.value` chip with a subtle ring or accent treatment when it appears in the probability map (the in-spec case). When the picked `l2.value` does NOT appear in the map (out-of-spec per rule 12), render the picked L2 as a separate inline note above the probability chips: `L2 picked as <value> but not present in probability map -- engine validation failure (rule 12).` This is an audit-time signal, not a user-facing crisis -- the user sees their disposition; the engine-team-style reader sees the inconsistency.

**Acceptance:**
- Component scores render as a 5-row table with explicit `target / lure / trust / extract / evade` labels and integers, NOT as chip-row with category names.
- Process flags render as the existing categorized prose list, headline label `Process flags`.
- The two sub-sections are visually distinct (table vs list) and labeled distinctly (`Component scores` vs `Process flags`).
- Picked L2 in probability map: rendered with accent. Picked L2 NOT in map: rendered with the rule-12 inline note above the chip row.

### 2.6 Stage trace

New section, replaces the current `pipeline_trace` raw-JSON block (line 509-532). The `pipeline_trace` field is debug-only (omitted by default per schema 3.6) and is not the reader-friendly trace. The reader-friendly trace lives in `disposition.confidence_path`.

**Render rule.** Parse `disposition.confidence_path` (regex per schema rule 9b: `^(triage:[0-9.]+ -> )?(faf:[0-9.]+ -> )?(classify:[0-9.]+ -> )?disposition:[0-9.]+$`). Render the four stages as a horizontal stepper with:

- One column per stage that ran. Columns appear left-to-right in the static order `triage / faf / classify / disposition`. Stages absent from the string (short-circuit case) render as a dimmed "skipped" column with the stage name and "--" for the confidence.
- Each column shows the static label from Update A: `Triage`, `FAF analysis`, `Classification`, `Disposition`.
- Each column shows the per-stage confidence as a 2-decimal float, parsed from the regex.
- A connecting line between columns shows the confidence trajectory direction (rising / falling / flat). Use the same per-tier color as the disposition banner so the trace inherits the urgency signal.

**Source of truth.** Per ops memo section 2.4: `model_pipeline` is model identifiers and is NOT the source of stage names. Stage names are the four static labels above, hardcoded in the UI. Stages-that-ran count is `min(model_pipeline.length, parsed_confidence_path.length)`. This stepper is reading `confidence_path` and using `model_pipeline` only to cross-validate the count.

**Collapsibility.** Collapsed by default. The summary line when collapsed: "Pipeline: 4 stages, confidence climbed from 0.87 to 0.97" (compose from the parsed values). Expand to see the full stepper. The raw `pipeline_trace` JSON block (debug only, only present when `?debug=1`) keeps its existing rendering (line 509-532) below the stage trace section, still collapsible, still labeled "Pipeline trace (debug)".

**Acceptance:**
- The four columns render in static order with the four static labels from Update A.
- Skipped stages (short-circuit case) render dimmed, not absent.
- Confidence values match what the regex parses out of `confidence_path` exactly (no rounding before display; round only at percent-format time, same as elsewhere).
- The debug `pipeline_trace` JSON block continues to render below the stepper when the field is present (i.e., `?debug=1`).

### 2.7 Degraded chip

Per audit P1.3, ops memo section 3, and CURRENT_ux.md.

**Render rule.** Show a small chip labeled "Degraded" next to the confidence readout in section 2.1 disposition banner when the result is degraded. Detection:

- **Once the `disposition.degraded` boolean ships:** `v5.disposition.degraded === true`. Covers all section-9 fallback paths (Stage 2, Stage 3, Stage 4, Stage 4 plus validation_fallback).
- **Interim, before the boolean ships:** `v5.disposition.reasoning_summary === "Model unavailable; rule-derived disposition."` (exact equality, NOT substring; per ops memo section 3.4 the string is a fixed rule template). Covers Stage 4 only. Document the partial coverage in the chip's hover description.

**Chip visual.** Neutral gray background, dark gray text, small chip size (smaller than the disposition pill), uppercase "DEGRADED" label, leading icon (see `disposition-tier-icons.md`). On hover / focus, show description: "Model was unavailable; this disposition was derived from rules only. Result is still operational but lacks model-side rationale." (Interim version, when only the Stage 4 case is caught, append: "Detection currently covers Stage 4 fallback only; some Stage 2/3 degraded results may not be flagged. Tightens once the `disposition.degraded` field ships.")

**Placement.** Inside the disposition banner row, after the confidence readout, before any row wrap. Does not change the disposition itself; the disposition is correct, it's the production path that was degraded. (Cf. ops memo section 3.5 paragraph two: "The disposition itself is not degraded; the production of it was.")

**Acceptance:**
- Chip absent when neither the boolean nor the interim string matches.
- Chip present with correct hover copy in both the boolean-shipped and pre-boolean-shipped cases.
- Chip placement inside the disposition banner; does not push the schema-version chip off the row at >=900px width.

### 2.8 Loading state

Replaces the entire result-card region while `loading === true`. Per audit P1.2, this resolves the 18-30s blank wait.

**Primary treatment: four-stage progress indicator.** Render a four-column stepper identical in shape to section 2.6 Stage trace (so the loading affordance and the trace-after-result share a visual grammar -- the reader sees the same four-stage shape evolve from "pending" to "done"). Columns in static order `Triage / FAF analysis / Classification / Disposition`, each starting as "pending" (dimmed, dashed border).

**Driving the progress.** Since v5.0 is non-streaming (per schema 3.6 Decision 6), there is no real per-stage signal during the wait. Drive progress with two layers:

1. **Best-effort animated cycle.** A repeating animation walks the four stages with an average duration of (`p50_total_eval_time` / 4) per column -- start at 4.5s/column for a 18s total, recalibrate after a few hundred observed evaluations. Each column transitions pending -> active -> complete. The fourth column reaching active is the "almost there" affordance.

2. **Validation against `model_pipeline.length` at result time.** When the response arrives, before tearing down the loading state, validate that `model_pipeline.length` matches the number of columns the animation marked complete. If they differ (short-circuit case where Stage 1 returns and only `triage` ran), retroactively dim the columns that should not have run before transitioning to the result card. This avoids the misleading "looked like four ran, actually one ran" footgun.

**Optional expanded label.** Per ops memo section 2.3, the four labels may expand to short phrases for animated states: `Triaging prompt`, `Running FAF analysis`, `Classifying`, `Choosing disposition`. Implementation can use the short or expanded forms; expanded forms are friendlier for first-time readers and read less like a status code. Defaults to expanded.

**Fallback treatment: skeleton result card.** Per ops memo section 2.5, if the four-stage indicator reads as cluttered or noisy in implementation, the fall-back is a skeleton result card (not a button spinner). Skeleton: greyed-out shapes for the disposition pill + classification block + triggered-by block, no actual content. Communicates "structure is coming" without committing to per-stage progress. Decision authority: ux track at implementation time, based on user testing or a calibrated screenshot review.

**Accessibility.** The loading region is inside the existing `aria-live="polite"` + `aria-busy={loading}` container from phase 2a (commit `db43090`). Stage transitions during the loading animation should NOT each trigger a new aria-live announcement -- only the result card materializing should. Implementation: keep the live announcement on the result region, not on the loading region itself.

**Acceptance:**
- Loading state renders when `loading === true`, replaces the entire result card region.
- Four-stage columns render with the static labels from Update A; optional expanded phrases acceptable.
- `model_pipeline.length` is used at result time to validate / retroactively correct the displayed column count; stage names are NOT pulled from `model_pipeline` strings (Update A).
- Falling back to the skeleton card is a one-line implementation switch; both treatments live in the codebase and the choice is a config (or a hardcoded constant) the next ux session can flip.

## 3. Cross-section consistency rules

A few rules that apply across sections rather than to any one of them:

1. **Color use.** The four tier colors from `V5_ACTION_CONFIG` are reserved for disposition-bearing chrome only -- disposition banner, stage-trace connecting line, evidence panel border accent (a tinted version, opacity ~10%), result-card border. Never use these colors for non-disposition-bearing chrome (chip backgrounds for classification, evidence, process flags, etc.). This is what makes the urgency signal scannable.
2. **Monospace usage.** Reserved for envelope vocabulary -- L1, L2, L3 values, bright-line codes, rule codes, model identifiers. Prose (reasoning summary, narrative summary, descriptions, process-flag descriptions, hover descriptions) is in the body sans-serif. This is what makes "this is a code" vs "this is prose" scannable.
3. **Iconography.** Per-tier icons are full-color SVG inheriting the tier ramp (defined in `disposition-tier-icons.md`). All other icons (chevrons, info indicators, the leading dot on process-flag rows) are neutral gray, single-color, single-pixel stroke -- not full SVG illustrations. The disposition icon is the only "alive" icon on the card.
4. **Empty-state policy.** When a field is absent or empty, render an empty row with a muted "none" placeholder, not a suppressed row. The exception is the degraded chip (suppressed when no degraded state) and `policy_note` (suppressed when null) -- both of these are render-when-set affordances by design, where presence is the signal. Everywhere else, presence of the field structure with no value is the affordance: it tells the reader "this section exists; no value this evaluation" instead of "this evaluation has fewer parts than usual."
5. **Out-of-spec render policy.** When the engine emits values outside the closed sets (e.g., legacy v4 `PHISHING` in an L1 slot per policy memo decisions 2.1 / 2.2), render the value as-is in the same chip treatment as legal values. Do NOT add UI-side correction or translation. The UI must surface engine bugs faithfully so audits can spot them; defensive translation in the UI would hide the underlying issue.

## 4. References to Update A and Update B (per acceptance criterion)

Two updates from phase 2b that this spec must explicitly incorporate:

**Update A -- stage labels.** Stage labels come from the four static keys `triage / faf / classify / disposition`, not from `model_pipeline` (which is model identifiers). User-facing display strings from ops memo §2.3: `Triage`, `FAF analysis`, `Classification`, `Disposition` (optional expanded phrases: `Triaging prompt`, `Running FAF analysis`, `Classifying`, `Choosing disposition`). Applied in:
- Section 2.6 Stage trace -- column labels.
- Section 2.8 Loading state -- progress-indicator labels; count derived from `model_pipeline.length`, NOT from any string-parsing of pipeline contents.

**Update B -- two distinct evidence vocabularies.** `evidence.component_scores` (keys: `target / lure / trust / extract / evade`, integer 0-3 values) and `evidence.process_flags[]` (categories: `Trigger / Incentive / Control / Delivery / Template`, prose descriptions) are two distinct fields with two distinct closed vocabularies. They do NOT collapse into a single labeled list. Applied in:
- Section 2.5 Evidence panel -- component scores render as a 5-row numeric table with the component vocabulary; process flags render as a categorized prose list with the process-flag vocabulary; the two are visually distinct sub-sections with distinct headlines.

If either reference becomes stale (because the spec it cites changes), this section is the audit anchor for what was current at draft time.

## 5. Handoff guidance for the phase 2d VS Code dispatch

This spec is the source-of-truth for the next VS Code render dispatch. The dispatch will need to:

1. Add the per-tier icon component(s) per `disposition-tier-icons.md`.
2. Add the `narrative_summary` rendering (new section 2.2 second field).
3. Restructure the evidence panel into two distinct sub-sections (section 2.5 Update B fix).
4. Add the stage-trace stepper (new section 2.6); the existing raw `pipeline_trace` debug block stays below.
5. Add the degraded chip with the interim string-equality detection rule (section 2.7); the boolean version lands once the engine field ships from a separate dispatch.
6. Add the loading-state four-stage progress indicator with `model_pipeline.length` validation (new section 2.8).
7. Add `policy_note` rendering in the triggered-by block (section 2.4 missing-field fix).
8. Add the hover-description dictionary for rules chips (section 2.4 initial dictionary, ops to confirm via inbox).
9. Add the low-confidence text tag at confidence < 0.70 (section 2.1 affordance).
10. Add the L2/probability rule-12 inline note for the out-of-spec case (section 2.5 invariant).

Each numbered item maps to one section in this spec. The dispatch can either bundle all ten or split into a few smaller dispatches; ux defers to orchestrator on packaging.

Visual acceptance criteria for the dispatch (per the parallel-tracks memo section 4.2): a screenshot of the result card for the BEC example prompt with v5 enabled, showing the disposition banner with the per-tier icon, both summaries, the restructured evidence panel with the two distinct sub-sections labeled correctly, the stage-trace stepper expanded, and either the loading-state stepper or skeleton card during a re-evaluation. Pixel-contrast verification on the four tier ramps stays as audit P1.1 follow-up and lands in the phase 2e mobile + contrast audit.

## 6. What this spec does NOT do

- Does not propose any new disposition, severity tier, typology, or threshold.
- Does not change the four-tier color ramp from `V5_ACTION_CONFIG`. It adds an icon to each tier, which is non-color affordance per WCAG 1.4.1; the color ramp itself is unchanged.
- Does not propose a prose display-label dictionary for L1 / L2 values. That option is documented in section 2.3 as a future iteration if jargon-density continues to be a reader-trip point.
- Does not specify mobile-viewport pixel layout, pixel contrast measurements, or `human_review` rendering details -- all deferred to phase 2e per CURRENT_ux.md.
- Does not edit `src/`, `tests/`, `scripts/`, `agents/`, `data/`, any FAF policy doc, the enforcement-design doc, the threat-model docs, or any of the parallel-tracks workflow docs. This file is the only ux-track write in this turn (plus the companion icon spec, the follow-up audit, the two inbox notifications, and the Notes back in CURRENT_ux.md).

---

# v5 classifier-display extension (phase 2 / plan 0002)

**Extension date:** 2026-05-26
**Extension author:** ux track (Cowork)
**Status:** spec, ready for the phase 3 vscode dispatch
**Phase:** live-v5-classifier-display phase 2
**Vocabulary source (authoritative):** `docs/memos/2026-05-26-policy-v5-classifier-display-vocabulary.md` -- closed-set labels (§2 process flags, §3 prompt summary), Explanation/Attributes call (§3.5), envelope shape Choice A (§4.3).
**Plan:** `handoff/board/orchestrator/plans/0002-live-v5-classifier-display.md`.

This extension layers onto sections 1-6 above. It commits the **display** half of the operator's "classifier output, not prose" critique: how the closed-set labels surface in the existing result-card chrome, how the prose explanations attach, how the L3-tag-aliased Target Attributes render, and how the existing 8-section card absorbs the new chrome without breaking the WCAG AA + mobile-reflow guarantees verified in the phase 2e re-audit (`docs/ux/audits/2026-05-25-live-v5-surface-post-fix.md`).

**Decision: single-file extension** (per §15 below) rather than a companion `v5-classifier-display.md`. The new sections extend section 2.5 (process flags sub-section of the Evidence panel) and add a new sibling section 2.9 (Prompt summary). Splitting to a companion file would force a reader to chase between two design-system docs to understand a single card; the cost of doc-cohesion loss outweighs the cost of file length here.

## 9. Display surfaces -- process flags (extends section 2.5)

Section 2.5 above ("Evidence panel") establishes process flags as a categorized prose list -- one row per `{ category, description }` entry under the Evidence collapsible. This phase adds a **classifier-label chip** to the Template / Delivery / Control rows, drawn from `evidence.process_flags[].label` (single-valued) or `evidence.process_flags[].labels` (multi-valued) per the vocabulary memo §4.3 Choice A. The existing prose description stays as the row's secondary content, demoted from the visible chrome to a hover/expand affordance.

### 9.1 Per-row visible chrome

The process-flags row chrome changes from `{ category, description }` to `{ category, label(s), description }`, with the visible row laid out as:

```
[CATEGORY-CHIP] [classifier-label-chip(s)] -> truncated prose snippet, max 1 line
```

Where:

- **Category chip.** Existing leading-dot monospace category label from section 2.5 (e.g., `Template`, `Delivery`, `Control`, plus the carry-forward `Trigger` / `Incentive` rows which keep their prose-only shape -- see §9.5). Keep current treatment.
- **Classifier-label chip.** New element. Monospace, underscore-form (e.g., `synthetic_document`, `urgency_or_deadline`), background `bg-slate-100`, text `text-slate-800`, 11px padding-x:2 padding-y:0.5, 4px border-radius. Visually distinct from L1/L2/L3 chips (no tier-color accent) and from bright-line chips (no red). The label is the **load-bearing visible scan**; the category chip says *what kind of flag this is*, the classifier label chip says *what value the flag took*.
- **Prose snippet.** Existing prose description, truncated to one line with `text-overflow: ellipsis`. On desktop hover or mobile tap of the row (any non-chip target), expand the row to show the full prose. Keep the row content in the same visual position; do not push the row into a side-drawer.
- **Tooltip on the classifier-label chip.** Per the vocabulary memo §2.1-2.3 tooltip-descriptor column. Reuse the existing `HoverChip` component from section 2.4 / 2.5 (the wrapper that already powers L1/L2/L3 descriptions and bright-line descriptions). On hover (desktop) or focus (keyboard) or tap (mobile), surface the tooltip-descriptor text verbatim from the memo. See §12 for accessibility.

### 9.2 Single-valued vs multi-valued chrome split

Two distinct label-shape variants. The display patterns must distinguish them visually so a reader can tell at a glance whether the flag is one value or a stack.

**Single-valued (Template, Delivery):** one classifier-label chip per row. JSON field is `evidence.process_flags[i].label: <string>`.

```
Template      [synthetic_document]            -> Government-issued ID generation request
Delivery      [email]                         -> Templated mass-email format
```

**Multi-valued (Control):** zero, one, or many classifier-label chips per row. JSON field is `evidence.process_flags[i].labels: [<string>, ...]`. Render as a chip-strip inside the row, with chip count visible:

```
Control       [urgency_or_deadline] [reply_suppression]   -> 24-hour deadline + reply-to suppression
```

When `labels` is an empty array or missing, render the row with an empty chip-strip and a muted placeholder chip `[none_observed]` (gray text, no tier accent) -- consistent with the empty-state policy in cross-section consistency rule 4. Do NOT suppress the row.

**Cardinality cap and overflow.** Control caps at 11 labels per the memo §2.3. Realistic prompts will trigger 1-4 labels (the memo's prose-to-label mapping examples cap at 2 per row). If `labels.length > 4`, render the first four chips inline and append a `+N more` overflow chip; activating the chip surfaces a tooltip disclosing all hidden values per §35 (the row's prose-expand affordance per §9.1 remains independent and is not coupled to the `+N more` chip).

### 9.3 Prose-to-label rendering contract

The classifier label is the **primary scan**; the prose description is the **specific particularity**. Per the vocabulary memo §1 ("audit-grade vocabulary stability"), two prompts that classify to the same label may have different prose snippets ("Phishing email for CFO impersonation" vs "BEC lure targeting AP team"); both render as `[phishing_message]` in the chip and surface their distinct prose on expand.

When `label` is present but prose `description` is empty/null, render the chip alone with the chip's tooltip-descriptor as the row's secondary line (italic, muted, "Tooltip: <descriptor text>"). When `description` is present but `label` is missing (legacy v4 envelopes during the dual-emit window per memo §4.3), render the prose without a chip but with a muted `legacy emission` tag inline -- the same audit-affordance pattern as cross-section consistency rule 5 (surface engine state faithfully, do not hide).

### 9.4 Trigger and Incentive rows -- unchanged

The vocabulary memo §4.3 explicitly **does not** add `label` fields to the `Trigger` and `Incentive` process_flag rows in this iteration. The operator's directional example named only Template / Delivery / Control as the visible-card targets; Trigger and Incentive remain `{ category, description }` prose rows with the existing section-2.5 treatment.

If a future audit determines these two also belong in the classifier-chip-with-hover-prose pattern, a follow-up policy dispatch fills the vocabulary gap and a minor extension to §9.1-9.2 re-uses the same chrome. **Flagged but not triggered in phase 2** (see §15 below for the extension-hook decision).

### 9.5 Section heading and order

Inside the Evidence panel sub-section "Process flags" (per section 2.5 above), order the rows as: Template, Delivery, Control, Trigger, Incentive. This puts the three classifier-labeled rows first (the load-bearing scan) and the two prose-only rows last (the legacy v4 carry-forwards). When the envelope's `process_flags[]` array order differs, the renderer sorts to this canonical order; the underlying array remains the audit source.

## 10. Display surfaces -- prompt summary (new sub-section)

The current card does not surface `evidence.prompt_summary` as a distinct visible sub-section; the prose fields (`topic`, `target`, `objective`, `pretext`, `persona`) are part of the envelope but not rendered. This phase commits prompt summary as a **new top-level section in the result card** -- sibling to section 2.5 (Evidence panel), inserted between section 2.4 (Triggered-by) and section 2.5 (Evidence panel) so prompt anatomy reads before evidence detail.

### 10.1 Section placement and order

**New card section: 2.4a -- Prompt summary.** Renders between section 2.4 (Triggered-by block, visible by default) and section 2.5 (Evidence panel, collapsible). Default state: **visible** (not collapsible). The classifier labels are short enough that the section adds ~6 rows of vertical space, which the audit-grade scan benefits from having at-a-glance rather than folded.

If the cumulative card height becomes a concern in future iterations (the phase 2e re-audit noted ~1500-2000px when all collapsibles are expanded), this section can be moved into a collapsible with default-expanded; flagging not blocking. The default is visible because the operator's critique was specifically that the visible card should show classifier output -- moving classifier output behind a collapsible would re-instate the same complaint.

### 10.2 Per-field visible chrome -- single-valued labels (Topic, Target, Objective, Pretext)

Four rows, one per field, in the order Topic / Target / Objective / Pretext. Each row is a **label-value pair** -- distinct from the process-flags chip-row treatment in §9 because the prompt-summary fields are top-level and have at most one classifier label each. The label-value pair shape signals to a reader "this is a top-level classifier output," not "this is one of several flags."

```
Topic       [document_generation]       (?)  -- Topic Explanation: "California Driver's Licence"
Target      [enterprise_employee]       (?)  -- Target Attributes: [enterprise_it_credentials]
Objective   [credential_capture]        (?)
Pretext     [it_support]                (?)  -- Pretext Explanation: "Mandatory security update"
```

Where:

- **Field label** (left column). Sans-serif, weight-medium, 13px, color `text-slate-700`. Right-aligned for two-line balance with multi-line explanations. Fixed column width (approximately 88-96px on desktop, see §13 for reflow).
- **Classifier-label chip** (middle column). Monospace, underscore-form, same chip treatment as §9.1 process-flag classifier-label chips. Background `bg-slate-100`, text `text-slate-800`. This is the **load-bearing visible scan** -- the answer to "what did the classifier say about this prompt's topic / target / objective / pretext."
- **Tooltip affordance (?).** Existing `HoverChip` icon (small `Info` from Lucide, neutral gray, 12px). Surfaces the vocabulary-memo tooltip-descriptor on hover / focus / tap. Distinct from the row-expand affordance.
- **Companion content** (right column). For Topic and Pretext: the prose **Explanation** field (see §11). For Target: the **Target Attributes** tag-strip (see §11.2). For Objective: nothing -- no companion field exists in the envelope. When companion content is absent or empty, the right column renders muted "--" rather than collapsing the column structure (preserves visual alignment across rows).

### 10.3 Empty-state and `none_observed` / `other` handling

When the envelope reports `none_observed` (which the memo names as the default for benign / awareness-education prompts) or `other`, render the chip with reduced visual weight:

- `none_observed` -> chip background `bg-slate-50`, text `text-slate-500` (muted), tooltip remains the vocabulary-memo descriptor for the value. Reads as "the classifier found nothing in this category" -- the right scan for a benign prompt.
- `other` -> chip background `bg-amber-50`, text `text-amber-900`, plus a small `audit me` text-tag in muted amber to the right of the chip. The vocabulary memo §2.1/§2.2/§2.3 explicitly says "if `other` recurs, add a label rather than letting `other` become a catchall" -- the amber tag is the visual audit-affordance for that.

Empty companion content (e.g., empty `topic_explanation` string): render "--" in muted gray. Do NOT suppress the row; the row's structural presence is itself the affordance (cross-section consistency rule 4).

### 10.4 Process-flags vs prompt-summary chrome -- section-distinct (deliberate)

The brief asks (item 3.e) whether the two card areas should be visually uniform or section-distinct. **Decision: section-distinct**, with a shared chip vocabulary.

The shared part: classifier-label chips render identically in both sections (same monospace, same `bg-slate-100`, same `text-slate-800`, same `HoverChip` tooltip pattern). A reader trained to recognize `[synthetic_document]` as a process-flag classifier label can also recognize `[document_generation]` as a prompt-summary classifier label -- the visual grammar is consistent.

The distinct part: process flags render as **chip-rows inside a collapsible Evidence panel** (per existing section 2.5), with a prose snippet as the row's secondary scan; prompt summary renders as **label-value pairs in a visible top-level section** (new section 2.4a), with rich companion content (Explanation prose / Target Attributes tag-strip) as the right column.

The rationale: the two card areas have different audit-grade purposes. Process flags answer "what FAF process-level signals did the prompt emit" -- a list, naturally heterogeneous, fits inside Evidence. Prompt summary answers "what is this prompt structurally about" -- four fixed top-level facets, naturally tabular, fits in the credibility-bearing top half of the card next to the Triggered-by block. Forcing them into a uniform chrome (e.g., a single chip-row treatment for both) would either bury prompt summary in Evidence (losing the visible-classifier-output property) or promote process flags to the top half (cluttering the credibility-bearing area). Section-distinct is the right call.

## 11. Explanation prose and Target Attributes -- companion content

The vocabulary memo §3.5 commits: Topic Explanation and Pretext Explanation stay as **free-text prose**; Target Attributes is a **multi-valued L3-tag-aliased list**. The display spec commits the visible chrome for each.

### 11.1 Explanation prose -- Topic Explanation and Pretext Explanation

**Placement.** Inline in the right column of the relevant row in section 2.4a (per §10.2). Same-row treatment: the label-value pair is left/middle, and the Explanation prose is right -- visually a **label-prose-paired-on-same-row** pattern.

Operator's directional example (per the plan §"Goal") showed the prose under the label as separate lines. That shape is fine for narrow viewports (and is what mobile reflow falls back to per §13.2), but on desktop the same-row treatment scans faster: a reader sees `Topic [document_generation] -- "California Driver's Licence"` in one horizontal sweep, which is the audit-grade ideal. Same-row is the desktop default; under-the-label is the mobile reflow.

**Visual treatment of the prose.** Sans-serif, weight-normal, 13px, color `text-slate-600`. Prefixed with em-dash + space for visual separator from the chip (`-- "California Driver's Licence"`). The prose itself is rendered with surrounding double-quotes when it reads as a noun phrase or a verbatim model emission, no quotes when it reads as a complete clause -- but in practice all observed Stage 2 emissions read as noun phrases or compact phrases, so default treatment is **with quotes**.

**Length and truncation.** Per the vocabulary memo §3.5, the explanation prose is short ("California Driver's Licence", "Mandatory security update", "password reset"). Realistic length: 2-8 words. Cap visible prose at 80 characters or one line, whichever comes first; if exceeded, truncate with ellipsis and expand the row on hover/tap (same affordance as §9.1 process-flag prose).

**Empty / null explanation.** Render "--" (em-dash, muted gray) in the right column. Common case: `topic_label: 'general_information'` paired with `topic_explanation: null` for benign prompts.

### 11.2 Target Attributes -- tag-strip pattern

**Field shape.** `evidence.prompt_summary.target_attributes: [<string>, ...]`, where each string is an L3 `target:` or `tactic:` value aliased per vocabulary memo §3.5. Multi-valued, may be empty.

**Placement.** Right column of the Target row in section 2.4a (per §10.2). Distinct from the Explanation pattern in §11.1 because the content is a tag-set, not prose.

**Visual treatment -- chip strip.** A horizontal strip of small chips, one per attribute. Each chip:

- Monospace, underscore-form (`enterprise_it_credentials`, `tactic:isolation`), background `bg-slate-100`, text `text-slate-700`, smaller padding than the §10.2 classifier-label chips (padding-x:1.5 padding-y:0.5, 3px border-radius). The size hierarchy (slightly smaller chips for attributes) signals "secondary tag" vs the primary classifier label.
- No tooltip on the chip itself (the L3 tag's meaning is already covered by L3 chip tooltips in section 2.3); on hover the chip just highlights faintly. This keeps the attributes from competing with the primary classifier-label tooltip in the same row.
- Chip values prefixed with `target:` or `tactic:` are stripped of the prefix for display (`enterprise_it_credentials`, `isolation`) and the prefix is conveyed via chip styling: `target:`-prefixed chips render with a neutral border (`border-slate-300`), `tactic:`-prefixed chips render with a dotted border (`border-slate-300 border-dotted`). Same prefix grammar as L3 chips in the existing section 2.3, just at smaller size.

**Empty state.** Per the vocabulary memo §3.5, the operator's directional example showed Target Attributes empty. Render the empty case as a single muted placeholder chip `[none observed]` (lowercase, gray text `text-slate-500`, italic). Do NOT suppress the right column or the row.

**Maintainer note (aria-describedby intentionality).** Chips in the Target Attributes strip deliberately have **no per-chip `aria-describedby`**. Per the bullet above, the L3 tag's meaning is already covered by the L3 chip tooltips in section 2.3, and doubling up describedby here would surface duplicate tooltip content to screen-reader users. A future maintainer auditing the live DOM may notice this and assume the attribute was forgotten -- it was not. Do not add per-chip tooltips to this strip. (Phase 4 re-audit P2-B documents this divergence between visible chip count and `aria-describedby` count as intentional; cross-reference there if a future audit re-flags it.) Recommended follow-up for the vscode track: add a one-line inline source-code comment near `TargetAttributesStrip` in `src/app/page.js` capturing the same rationale -- flagged here, not actioned, because `src/**` is out-of-bounds for the design track.

**Count-limit behavior.** Realistic L3 emissions per prompt are 0-6 attributes total across `target:` and `tactic:`. Cap visible chips at 5; if `target_attributes.length > 5`, render the first five and append a `+N more` overflow chip. Activating the chip surfaces a tooltip disclosing all hidden values per §35. Same overflow grammar as §9.2 multi-valued Control row.

### 11.3 Persona handling

The vocabulary memo §3.5 / §4.3 commits: `persona` remains as prose, unchanged in this phase. The brief item 3.f asks ux to commit one of: (i) absorb in-spec as-is, defended; or (ii) flag as an extension-hook for a follow-up policy dispatch.

**Decision: absorb in-spec as-is (zero extension hooks for persona).**

Defense: the same argument that keeps Topic Explanation and Pretext Explanation as prose (memo §3.5: "the explanation fields' job is to carry *what's specific about this prompt*, not what category it falls into") applies one-for-one to persona. Stage 2 emits `persona: "IT support agent"` / `persona: "CFO"` / `persona: "elderly woman's grandson"` -- specific noun phrases, audit-valuable as the verbatim emission. A closed-set persona enum would balloon (every role / relationship / authority signal the model ever observes) and lose the noun. The audit-stable classification this would provide is already captured downstream: `persona: "IT support agent"` co-occurs with `pretext_label: 'it_support'`, which is the closed-set sibling. The persona prose carries the specific role; the pretext label carries the categorical frame. The two together do the work; replacing persona with a second closed set duplicates the pretext-label work and discards the specific noun.

**Render.** Persona renders as a row in section 2.4a, but as a **prose-only row** -- no chip, no tooltip-descriptor, just `Persona -- "IT support agent"`. Placed below the four classifier-labeled rows (Topic / Target / Objective / Pretext / Persona, in that order). Same `text-slate-600` prose treatment as the Explanation columns. When persona is null/empty (benign prompts, awareness-education prompts), render "--" muted; suppress the row only if the field is wholly absent from the envelope (legacy v4 envelopes), per the empty-state policy.

**Rationale for not flagging.** The phase-2 extension-hook mechanism exists for vocabulary gaps -- card sections where a closed-set classifier label would help but isn't covered by the phase-1 memo. Persona is not a vocabulary gap: it's a deliberate prose field that the memo already decided not to convert, for the same reasons §3.5 names for Topic/Pretext Explanation. Flagging it would re-litigate a decision the memo already made and didn't ask ux to revisit.

## 12. Accessibility -- WCAG 2.1 AA extension

The phase 2e re-audit (`docs/ux/audits/2026-05-25-live-v5-surface-post-fix.md` §0) verified pixel contrast on all four tier ramps, mobile reflow at 375/414, and `aria-live` / `aria-busy` wiring on the result region. The classifier-display extension must preserve those guarantees and add WCAG AA coverage for the new chrome. This section extends -- not duplicates -- the existing a11y pattern in `disposition-tier-icons.md` and section 2 above.

### 12.1 Color contrast on classifier-label chips

Contrast ratios below are **live-measured** against the deployed Vercel bundle via `getComputedStyle` on rendered chip nodes (phase 4 re-audit, `docs/ux/audits/2026-05-26-live-v5-classifier-display-reaudit.md` §2.4). Earlier drafts of this spec quoted ratios computed against Tailwind hex tokens at authoring time; those values (15.6 / 5.0 / 8.9) diverged from the rendered-pixel values once the compiled stylesheet, font-smoothing, and parent-tier card backgrounds were factored in. **Future authors of this spec must measure against the live render, not the hex tokens, before asserting a ratio.**

| Variant | Background | Foreground | Computed (live) | AA threshold (4.5:1) | Result |
|---|---|---|---|---|---|
| Primary chip (classifier labels, default) | `bg-slate-100` `#f1f5f9` | `text-slate-800` `#1e293b` | **13.35:1** | 4.5:1 | PASS AA + AAA |
| Muted (`none_observed`) | `bg-slate-50` `#f8fafc` | `text-slate-500` `#64748b` | **4.55:1** | 4.5:1 | PASS AA (0.05 above floor; **at-risk**) |
| Audit (`other`) | `bg-amber-50` `#fffbeb` | `text-amber-900` `#78350f` | **8.75:1** | 4.5:1 | PASS AA + AAA |

**Soft guardrail on the muted (`none_observed`) variant.** The 4.55:1 ratio clears AA by only 0.05 and fails AAA (7:1). Any future Tailwind palette upgrade, font-weight shift (e.g., dropping from `font-medium` to `font-normal` on the chip text), or change to the chip's surrounding card-background tint must re-verify this pair via `getComputedStyle` before merging. Treat this variant as the canary for palette drift -- if it breaks, the other two are likely close behind. If a future audit measures it below 4.5:1, the fix is to darken `text-slate-500` to `text-slate-600` (`#475569`); do not change the background tone, which is load-bearing for the "this is empty / not-found" visual reading.

**All three chip variants pass WCAG 2.1 AA on all four disposition tier card backgrounds** because the chips render on the card-interior neutral background (`bg-white` for v5 card-body, per existing chrome in `src/app/page.js`), not directly on the tier-tinted card border. The tier-tinted border is a 10% opacity accent per cross-section consistency rule 1, not the chip-rendering surface.

**Methodology note (for future spec authors).** Compute contrast against rendered pixels, not authoring-time hex tokens. The canonical protocol: open the production deploy, inspect a chip with the relevant variant, run `getComputedStyle(node).color` and `.backgroundColor` to extract the actual rendered sRGB values, then feed those into the WCAG luminance formula. Hex tokens from the Tailwind palette are a starting point but routinely diverge from the rendered pixel by 1-2 luminance steps once `color-scheme`, font-rendering, and parent stacking-context blending apply. The 15.6 -> 13.35 gap on the primary variant is the largest divergence observed in this spec's history; the 5.0 -> 4.55 gap on the muted variant is the smallest but the most consequential because it crosses an AA-adjacency threshold.

### 12.2 Keyboard navigability of tooltips

The vocabulary-memo tooltips on classifier-label chips must be reachable without a mouse. Reuse the existing `HoverChip` keyboard pattern from section 2.4 (bright-line chips) and section 2.3 (L1/L2/L3 chips, post-2d audit Followup 3.1 resolution):

- Chip is a `<button type="button">` (or equivalent ARIA-button), reachable via Tab in document order.
- Tooltip surfaces on `:focus` (keyboard) and `:hover` (mouse), with `aria-describedby` pointing to a hidden tooltip-text element.
- Escape dismisses the tooltip while keeping focus on the chip.
- Tooltip text is the vocabulary-memo descriptor verbatim (e.g., for `synthetic_document`: "A forged or fabricated document (ID, statement, regulatory letter, legal notice). Includes both image-like artifacts and structured-text equivalents.").

**Tab order within a row.** Category chip -> classifier-label chip(s) (left-to-right for multi-valued Control) -> companion-content chip(s) (Target Attributes left-to-right) -> next row. The row-expand affordance (per §9.1 / §11.1 prose truncation) is reachable by activating any chip in the row OR by Tab-focusing the row container (which the existing collapsible-region pattern already supports per section 2.5).

### 12.3 Screen-reader behavior for multi-valued Control and Target Attributes

The two multi-valued patterns (Control's labels strip, Target Attributes' tag strip) need to read coherently as a list, not as a stream of unlabeled chips.

**Control row.** Wrap the labels chip-strip in a `<ul role="list" aria-label="Control labels">` with one `<li>` per chip. Each chip's accessible name is the underscore-form label; the chip's `aria-describedby` points to the tooltip-descriptor text. Screen-reader read: "Control labels list, 2 items: urgency or deadline, with description: time pressure -- act within 24 hours, lock in 60 minutes, expires today; reply suppression, with description: the prompt instructs the target not to reply, not to forward, not to confirm by another channel."

**Target Attributes row.** Same `<ul role="list" aria-label="Target attributes">` pattern; each chip's accessible name is the L3 tag value (with prefix stripped for display but **included for the accessible name** -- `target:enterprise_it_credentials` reads as "target enterprise it credentials," not as "enterprise it credentials" alone, so a screen-reader user can disambiguate target-type from tactic-type tags).

**Overflow chip (`+N more`).** Accessible name: "Show N more items" (literal N from the actual count). Activation surfaces a tooltip disclosing all hidden values per §35; Escape (or tap-outside / second-tap on mobile) dismisses the tooltip and returns focus to the chip. The disclosure does not modify row layout.

### 12.4 Focus order

The new section 2.4a (Prompt summary) inserts between section 2.4 (Triggered-by) and section 2.5 (Evidence panel). Focus order: section 2.1 disposition banner -> 2.2 reasoning + narrative -> 2.3 classification envelope -> 2.4 triggered-by block -> **2.4a prompt summary (Topic row -> Target row -> Objective row -> Pretext row -> Persona row)** -> 2.5 Evidence panel toggle -> 2.6 Stage trace toggle.

Within each prompt-summary row: field-label is not focusable (decorative); classifier-label chip is focusable; tooltip (?) icon is focusable but redundant with the chip (same tooltip-descriptor target -- the (?) icon exists for mouse users who don't realize the chip itself is hoverable, so keyboard users can skip it via the chip). Target Attributes chips are focusable in left-to-right order after the Target classifier-label chip. Explanation prose is not focusable (it's just text; if it's truncated, focus the row container to expand).

### 12.5 Non-color affordance

Cross-section consistency rule 1 already reserves the four tier colors for disposition-bearing chrome only. The classifier-label chips use a neutral palette (`bg-slate-100`) precisely because they are NOT disposition-bearing; the chip's affordance is semantic (the label text) and shape (the monospace chip telegraphs "this is a code"), not color. This satisfies WCAG 1.4.1 (Use of Color) for the new chrome: a reader cannot mistake `[document_generation]` for `[synthetic_document]` based on color, only on reading the label, which is the correct read.

The two audit-affordance variants (`other` in amber, `none_observed` in muted slate) DO use color, but each is paired with a non-color affordance: `other` has the `audit me` text-tag; `none_observed` has the italic + muted-gray treatment, distinguishable in monochrome. Both pass WCAG 1.4.1.

## 13. Mobile reflow -- 375 and 414 viewports

The phase 2e re-audit verified clean reflow at 375 and 414 widths for the existing 8 sections. The classifier-display extension introduces two new layout challenges: the prompt-summary label-value-pair rows (variable companion-content width per row) and the 15-value Target chip rail (the memo's intentional ceiling on Target cardinality, per the orchestrator verification block on the phase 1 archive). This section commits the reflow behavior for both.

### 13.1 Prompt-summary section -- vertical stack at narrow widths

At desktop (>=768px viewport), section 2.4a renders as a 3-column grid: field-label (88-96px fixed) | classifier-label chip + tooltip (flex-shrink-0) | companion content (flex-1, wraps as needed). Same-row treatment per §10.2.

At <768px (Tailwind `md:` breakpoint), collapse the 3-column grid into a vertical stack per row:

```
Topic
[document_generation] (?)
-- "California Driver's Licence"
```

That is: field-label on its own line (left-aligned, slightly larger, weight-medium to maintain hierarchy), classifier-label chip on the next line (left-aligned), companion content on the third line (em-dash prefix preserved). Each row separated by ~12px vertical gap. Total per-row height grows from ~32px (desktop) to ~80-100px (mobile); cumulative section height grows from ~200px to ~480px at five rows, still well within the existing section-height budgets verified in the phase 2e audit.

**Why 768px (Tailwind `md:` default) rather than the original <900px.** Earlier drafts of this spec asserted `<900px` as the reflow threshold, tied loosely to the phase 2e re-audit's narrow-mode reflow check. The phase 4 re-audit (P1-B) found that the implementation in `src/app/page.js` (`PromptSummaryRow` + `PersonaRow`) uses Tailwind's `md:` utilities, which fire at `@media (min-width: 768px)` -- the framework default. The spec was over-specifying without checking the framework defaults that the implementation already commits to. Aligning the spec to 768px is the cheaper move because (a) tablets in the 768-900 portrait range render the 3-column layout legibly -- the 88-96px field-label column, the fixed-width chip, and the flex-shrinking prose compose acceptably at those widths; (b) Tailwind's `md:` is the industry-canonical mobile/desktop pivot, so aligning reduces future drift risk; (c) the visual difference between 768 and 900 was not material in practice per phase 4 verification.

**Methodology rule for future spec authors.** Before asserting a custom pixel breakpoint, grep `tailwind.config.js` (and inspect the relevant components in `src/app/**`) for the canonical breakpoints already in use. If the implementation commits to a framework default (`sm:` 640, `md:` 768, `lg:` 1024, `xl:` 1280, `2xl:` 1536), the spec should reuse that default unless there is a documented reason to override it. Custom breakpoints introduce a spec-vs-implementation tightness gap that a later audit will have to reconcile -- exactly the loop that produced this amendment.

### 13.2 Target Attributes chip strip -- mobile wrap with overflow

The Target Attributes strip already caps visible chips at 5 with an overflow chip per §11.2. At 375/414 widths, the chip count plus the overflow chip will fit on a single line for the common case (1-3 attributes). For the rare wide-set case (4-5 attributes), let the strip wrap to a second line within the cell. Do NOT add horizontal-scroll on this strip; it's a small enough set that wrapping is the cleaner pattern.

### 13.3 The 15-value Target chip rail -- the policy-flagged challenge

The vocabulary memo §3.2 commits Target to 15 closed-set labels (the top of the 5-15 cardinality range, intentionally mirroring L3 `target:`). The phase-1 orchestrator verification block flagged the chip-rail-for-15-values as a phase-2 reflow concern.

**Critical disambiguation:** Target is **single-valued per prompt** per the memo §3.2 ("Single-valued for prompt-summary purposes -- the *primary* target"). The 15-value cardinality is the closed-set vocabulary, not the per-prompt render count. A single prompt's Target row renders **one chip**, not fifteen.

So the "15-value chip rail at 375px" challenge does NOT arise on the *result* card -- the result card shows one Target value per evaluation. The 15-value rail challenge arises in **adjacent surfaces** where a reader sees the full vocabulary at once:

- **Hover-tooltip's `other` audit-affordance.** When the chip's tooltip surfaces, "if `other` recurs add a label rather than letting `other` become a catchall" -- the implied full vocabulary is reference material, not rendered visibly. No reflow problem.
- **Vocabulary documentation surfaces (this design-system doc, the memo).** These render in markdown tables, not in chip rails. Not the result card's concern.
- **Future filter / browse views** (if the portfolio grows to show prompt-classification distributions or filter-by-target queries). At that point a 15-chip horizontal rail at 375px would need horizontal-scroll with edge-fade or wrap-to-multi-row. Flagging as a future affordance, not in scope for phase 2.

**For the result card at 375 / 414 viewports: one Target chip per prompt; reflow trivial.** The existing label-value-pair pattern (§13.1 vertical stack) handles this with room to spare.

If a future iteration surfaces the full Target vocabulary in a chip rail (e.g., a filter-bar above a result list), the recommended pattern is **wrap to two rows at 375/414** with the rail container set to `flex-wrap: wrap; gap: 6px`; chips average 95-115px wide each, so 15 chips wrap to 2-3 rows at 375 width. Horizontal scroll is a worse fallback because it hides chips off-screen and breaks discoverability. Flagging the recommended pattern here so a future iteration doesn't relitigate.

### 13.4 Process-flags Control row -- mobile chip wrap

Inside the Evidence panel, the Control row's chip strip (multi-valued, capped at 4 visible + overflow per §9.2) wraps to a second line within the row at 375/414. Same wrap pattern as §13.2 Target Attributes. The category chip + multi-label strip + truncated prose fit comfortably on two lines at 375 width when there are <=2 labels, three lines at four-labels-or-more-with-overflow.

### 13.5 Tooltip interaction on mobile -- tap to surface

WCAG AA requires non-mouse access to the tooltip-descriptor content; mobile-tap is the primary fallback. Reuse the existing `HoverChip` mobile-tap pattern from section 2.4 (already in place for bright-line chips post-phase 2d): tapping the chip surfaces the tooltip as a positioned tooltip-bubble above or below the chip (placement chosen to avoid viewport edges); tapping outside the chip dismisses; a second tap on the same chip dismisses (toggle).

For multi-chip rows (Control labels, Target Attributes), each chip's tap-tooltip is independent -- tapping a second chip dismisses the first and surfaces the second. Same pattern as L3 chip rows in the existing section 2.3.

## 14. Extension-hook decision

The brief (work-item 6) asks ux to commit one of: zero hooks / <=2 hooks (named) / >=3 hooks (pause for operator).

**Decision: zero extension hooks.**

Defense:

- **Persona is not a hook.** Per §11.3 above, persona stays as prose by the same reasoning the vocabulary memo applied to Topic Explanation and Pretext Explanation. The decision to keep persona as prose is consistent with the memo, not a deferred vocabulary gap.
- **Trigger and Incentive process-flag rows are not hooks.** Per §9.4 above, the vocabulary memo §4.3 deliberately did not add classifier labels to these two rows in this iteration; the operator's directional example named only Template / Delivery / Control as the visible-card target. Adding Trigger / Incentive labels would be a scope expansion, not a vocabulary gap that blocks the current display spec from rendering. The current card's section 2.5 process-flags treatment already handles these rows as prose-only and continues to work; if a future audit determines they belong in the classifier-chip pattern, the chrome in §9.1-9.2 extends to them with no spec rewrite. **Flagged as a future-iteration consideration in §9.4 above, not as a phase-2 hook.**
- **No adjacent card section surfaces a prose-as-classifier mismatch outside of process flags and prompt summary.** The remaining card sections (disposition banner, reasoning + narrative summary, classification envelope, triggered-by, evidence panel beyond process flags, stage trace, degraded chip, loading state) either already use closed-set vocabulary (disposition values, L1/L2/L3 closed enums, bright-line codes, rule keys, stage names) or are deliberately prose (narrative summary, policy_note, safe_completion_guidance) per the v5 architecture. None of them have the "Stage 2 prose where a classifier label belongs" shape that this phase 1 + phase 2 effort exists to fix.

The phase-1 memo's vocabulary fully covers the surface the operator's directional critique named. Phase 3 vscode can implement against the combined phase 1 + phase 2 spec without waiting on a follow-up policy dispatch.

**Consequence for the orchestrator:** no follow-up policy dispatch queued; phase 3 vscode is unblocked. The policy inbox post is therefore **skipped** per the brief's conditional rule (post if ≤2 hooks; skip if zero). The vscode inbox post is **mandatory** and is sent.

## 15. Single-file decision (per brief work-item 3)

**Decision: single-file extension to `docs/ux/design-system/v5-result-card.md`** (this file).

Defense: the new sections (9-14 plus this one) reference sections 2.1-2.8 above for visual grammar (chip treatments, hover patterns, mobile reflow precedents, focus order, empty-state policy, color reservation rules). Splitting to a companion file would force a reader to bounce between two docs to understand a single card's behavior, and would duplicate the cross-section consistency rules in §3 above (or worse, would split them silently). The cost of the extra file length is small (this extension is roughly the size of one of the original eight sections); the cost of split-doc cognitive load is meaningful.

A companion file would be the right call if (a) the classifier-display work were targeting a different card or surface, (b) the chrome were diverging from the existing card's visual grammar, or (c) the audit-grade reader audience for the classifier-display content were different from the result-card reader. None of those apply: same card, same grammar, same reader.

## 16. Handoff guidance for the phase 3 vscode dispatch (extends section 5)

This extension is the source-of-truth (combined with the phase 1 vocabulary memo) for the phase 3 vscode dispatch. The dispatch will need to (in addition to the 10 items in section 5):

11. **Read the envelope at the new field paths** per vocabulary memo §4.3 Choice A:
    - `evidence.process_flags[i].label` (single-valued, for `Template` and `Delivery` rows).
    - `evidence.process_flags[i].labels` (multi-valued array, for `Control` rows).
    - `evidence.prompt_summary.topic_label`, `target_label`, `objective_label`, `pretext_label` (strings).
    - `evidence.prompt_summary.topic_explanation`, `pretext_explanation` (strings, nullable).
    - `evidence.prompt_summary.target_attributes` (array of L3-prefixed strings, possibly empty).
    - `evidence.prompt_summary.persona` (string, nullable, unchanged from current envelope).
12. **Render the new chip vocabulary** per §9 / §10 / §11 above. Reuse the existing `HoverChip` component for tooltip-descriptor surfacing; the descriptor texts come verbatim from the vocabulary memo §2 / §3 tables.
13. **Add the new section 2.4a (Prompt summary)** in `src/app/page.js`, between the existing Triggered-by block and the Evidence panel collapsible. Default-visible (not collapsible).
14. **Extend section 2.5 (Evidence panel) process-flags rendering** to surface the classifier-label chip(s) on Template / Delivery / Control rows. Trigger / Incentive rows stay prose-only.
15. **Tooltip-descriptor dictionary.** Add a `CLASSIFIER_LABEL_DESCRIPTIONS` constant in `src/app/page.js`, structured as `{ Template: { synthetic_document: "...", ... }, Delivery: {...}, Control: {...}, Topic: {...}, Target: {...}, Objective: {...}, Pretext: {...} }`. Each value is the vocabulary-memo descriptor verbatim. Same pattern as the existing `BRIGHT_LINE_DESCRIPTIONS`, `L1_DESCRIPTIONS`, `L2_DESCRIPTIONS`, `RULE_DESCRIPTIONS`.
16. **Schema-version bump.** `schema_version` 5.0.1 -> 5.1, additive per vocabulary memo §4.3. Stage 2 emits new fields; existing fields retained as backward-compat aliases during dual-emit.
17. **Engine-side closed-set enforcement** per vocabulary memo §4.4. Either tool-use enforcement (preferred, matches Stage 3) or plain-JSON-plus-validator (current Stage 2 pattern). New JSON Schema validator at `tests/schema/v5-envelope.schema.json` to encode the new fields and enum constraints.
18. **Lockstep extension.** `scripts/check-lockstep.js` grows checks that each of the seven new closed enums (Template, Delivery, Control, Topic, Target, Objective, Pretext) is consistent across the vocabulary memo, `docs/07-v5-schema.md`, and the engine constants. See vocabulary memo §8.
19. **Empty / fallback handling.** Per §10.3 above: render `none_observed` muted, `other` with audit-affordance amber tag, null companion content as `--`. Per §11.2: empty Target Attributes renders a single muted placeholder. Per §9.3: legacy v4 envelopes without `label` fields render prose-only with a `legacy emission` tag.
20. **Mobile reflow.** Vertical-stack-per-row at <900px (§13.1). Chip wrap on multi-valued strips at 375/414 (§13.2, §13.4). No new horizontal-scroll regions.
21. **Accessibility wiring.** `<ul role="list">` wrappers on multi-chip strips (§12.3). `aria-describedby` on each classifier-label chip pointing to its tooltip-descriptor (§12.2). Tab order per §12.4. Re-verify against the phase 2e WCAG AA contrast guarantees on all four tier ramps.

Visual acceptance criteria for the dispatch: a screenshot of the result card for the BEC example prompt with v5 enabled, showing (a) the new Prompt summary section (2.4a) with four classifier-label chips, Topic Explanation prose, Target Attributes tag-strip, Persona prose; (b) the Evidence panel expanded showing the Template / Delivery / Control rows with classifier-label chip(s) and prose-on-hover; (c) the same card at 375 width showing the vertical-stack reflow; (d) keyboard-only tab traversal screenshot demonstrating focus-ring on chips, tooltip surfacing on focus.

## 17. What this extension does NOT do

- Does not add a typology, sub-typology, bright-line, or threshold. The seven closed-set vocabularies are render labels, not typology axes (vocabulary memo §5).
- Does not change the schema. The schema delta is committed in the vocabulary memo §4.3; phase 3 vscode implements it.
- Does not edit `src/`, `tests/`, `scripts/`, `agents/`, or any FAF policy / enforcement / threat-model / parallel-tracks doc. This extension is doc-only.
- Does not change the existing chrome of sections 2.1-2.8. The disposition banner, reasoning + narrative summary, classification envelope, triggered-by block (including `policy_note`), evidence panel (component scores sub-section), stage trace, degraded chip, and loading state all render exactly as section 2 above commits.
- Does not respec the disposition-tier-icons.md a11y patterns. References them; does not duplicate.
- Does not commit a label dictionary for L1 / L2 prose-display (the deferred work flagged in section 2.3). That remains a separate future iteration.
- Does not specify the rendering for filter / browse / vocabulary-overview surfaces that might surface the full Target / Topic / etc. vocabularies at once. Flagged as a future affordance in §13.3, not in scope for phase 2.

## 18. Amendment log

In-place amendments to this spec after initial publication. New entries append to the bottom; entries are dated and reference the originating audit or dispatch.

- **2026-05-27 -- §12.1 contrast ratios + §11.2 maintainer note.** §12.1 chip-contrast ratios updated to live-computed values per phase 4 re-audit (`docs/ux/audits/2026-05-26-live-v5-classifier-display-reaudit.md` §2.4): primary 15.6 -> 13.35, muted 5.0 -> 4.55, audit 8.9 -> 8.75. Added soft guardrail flagging the muted variant as at-risk (0.05 above AA floor; fails AAA) and a methodology note requiring `getComputedStyle` on the live render for any future ratio assertion. §11.2 gained a maintainer note documenting that the Target Attributes chip strip intentionally omits per-chip `aria-describedby` (P2-B fold-in). Originating dispatch: backfill brief 0015 (design track).
- **2026-05-27 -- §13.1 mobile-stack threshold changed from <900px to <768px** to align with Tailwind `md:` default; tablet-portrait 768-900 range renders desktop layout, verified acceptable per phase 4 audit P1-B (`docs/ux/audits/2026-05-26-live-v5-classifier-display-reaudit.md` §2.5 + §6 P1-B). Added a methodology rule for future spec authors: grep `tailwind.config.js` (and the relevant `src/app/**` components) for canonical breakpoints before asserting a custom pixel value. Originating dispatch: backfill brief 0016 (design track).
- **2026-05-28 -- §§19-25 conversation-evaluation phase 2 display spec extension.** New top-level sections appended: §19 mode-switch UI; §20 conversation input UI (image + text + preview-confirm + sender-labeling); §21 result-card extension for conversation envelopes (arc timeline + per-turn drawer + sender attribution + 7 new L3 chips); §22 WCAG AA + mobile reflow at 375/414; §23 single-file decision; §24 alternatives considered; §25 phase 3 vscode handoff checklist (11 items). Source vocabulary: `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md`. Spike evidence: `handoff/reference/10a-vision-spike-report.md`. Originating dispatch: conversation-eval phase 2 (design track).
- **2026-05-28 -- §27 conversation-mode example pill row.** New section appended. Commits pill row UI shape: positioning above textarea in text sub-modality (§27.2), `{label, turns}` payload contract (§27.3), click contract that skips Stage 0 and loads pre-canonicalized turns directly into preview-confirm state (§27.4), tab-order keyboard nav + `role="group"` semantics (§27.5), natural flex-wrap on mobile at 375/414 with 24x24 AA touch-target floor met (§27.6), conversation-mode + text-sub-modality render guard (§27.7), testable acceptance criteria for vscode + phase 5 qa (§27.8), three alternatives with honest rejection rationale (§27.9). Originating dispatch: `conversation-eval-example-pills` 3-track parallel (design track).
- **2026-05-28 -- §§28-34 mobile UX cluster fixes (`ux-cluster-mobile-fixes` phase 1).** New top-level sections appended addressing three live-mobile UX issues surfaced by Steven's 2026-05-27 manual native-mobile pass on https://safeeval.vercel.app. §28 commits the React-portal pattern for tooltip render-position-escape from parent stacking-context bounds (issue 1: first-in-component chip tooltip clipping behind previous card); three alternatives (auto-flip / always-below / overflow-visible) rejected with reasoning. §29 adjudicates issue 2 (per-turn-card `+`/`×`/`+` icon stack at mobile) in favor of **honoring §22.2 as-spec'd** -- vscode phase 2 implements §22.2's three-vertical-dots overflow-menu pattern (path (a)) rather than amending §22.2 to a reduced two-icon inline stack (path (b)); §22.2 text stands unchanged. Defense in §29.2: the overflow-menu dissolves all three failure modes (icon-collision, duplicate-`+` ambiguity, no direction affordance) by replacing icon-only signals with text-labeled menu items; path (b) preserves the failure-mode shape, just smaller; three-vertical-dots is industry-standard discoverability. §30 commits issue 3 mobile reflow for §2.3 L3 chip row: vertical-stack category-name above chip row at <768px (extends §13.1 precedent), `overflow-wrap: anywhere` for long underscored labels, full-width flex-wrap chip row; four alternatives (horizontal-scroll / ellipsis-with-expand / shortened-labels / smaller-chips) rejected. §31 declares §22.2 amendment status (unchanged). §32 acknowledges path-B real-device audit methodology gap (all three issues missed by path-A emulation). §33 scope-fence (no policy, no engine, no new tokens). §34 phase 2 vscode handoff checklist (8 implementation items + qa criteria in §34.1). Originating dispatch: `ux-cluster-mobile-fixes` (design track, architect-direct, brief 0033).
- **2026-05-27 -- §35 `+N more` overflow-chip disclosure pattern + §9.2 / §11.2 / §12.3 in-place amendments (`disclose-hidden-values-plus-n-more-chip` phase 1, brief 0045).** New §35 appended (16 sub-sections). Commits tooltip-disclosure semantics on the `+N more` overflow chip (Option 1 per brief 0045 adjudication): hover/focus/tap surfaces a `PortalTooltip` body containing comma-separated hidden values; Escape / tap-outside / second-tap dismisses; ARIA contract `aria-haspopup="true"` + `aria-expanded` toggle + `aria-describedby` linkage; reuses §28 portal infrastructure and §13.5 mobile tap pattern with zero net-new dependencies. Commits shared `OverflowChip` component spec (§35.9) for vscode phase 2 to extract once and consume from both `TargetAttributesStrip` (line ~2093) and `ProcessFlagRow` Control multi-label strip (line ~2185) -- per brief drafter's grep-before-template-inherit finding (bug lives in two surfaces). §9.2 "Cardinality cap and overflow" paragraph, §11.2 "Count-limit behavior" paragraph, and §12.3 "Overflow chip" ARIA paragraph all amended in-place to replace pre-amendment row-expand language with cross-references to §35's tooltip pattern. Pre-amendment row-expand pattern preserved as Alternative B (§35.13) -- non-breaking-replaceable if a future audit surfaces tooltip-discoverability friction. Lockstep impact: doc-only; no new lockstep groups. Note: this entry is dated 2026-05-27 but appended below the 2026-05-28 §§28-34 entry per the "append to bottom" convention rather than strict date-ordering -- ordering by append-time is the load-bearing audit signal for "what came in latest." Originating dispatch: `disclose-hidden-values-plus-n-more-chip` phase 1 (design track, brief 0045, from-track=orchestrator). Screenshot evidence: `uploads/71b138e9-image.png`.

---

# v5 conversation-evaluation extension (phase 2 / `conversation-evaluation` goal)

**Extension date:** 2026-05-28
**Extension author:** design track (Cowork)
**Status:** spec, ready for the phase 3 vscode dispatch
**Phase:** `conversation-evaluation` phase 2 (display spec)
**Vocabulary source (authoritative):** `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md` -- envelope shape (§2), turn structure + sender canonicalization (§3), 7 new L3 entries under `arc:` + `cadence:` (§4), ontology 5.0 -> 5.1 (§5), Stage 0 contract (§6), threat-model addition (§8).
**Spike evidence:** `handoff/reference/10a-vision-spike-report.md` (vision validated; `parse_confidence` uninformatively stable at 0.95-0.98 on clean inputs; SECURITY-block holds against prompt-injection-via-screenshot).
**Scoping memo:** `handoff/reference/10-conversation-eval-scoping.md` (timeline-as-default visualization, color in timeline + numerics in drawer per §2.6).
**Precedent shape:** §§9-17 above (v5 classifier-display extension, shipped 2026-05-26). Same single-file pattern, same 11-item phase 3 handoff checklist (§16 precedent), same qa-acceptance-criteria-in-dispatch discipline. Two deltas acknowledged in §23: (i) **three** new surfaces this phase (mode switch + input UI + result-card extension), not one; (ii) the arc timeline is a **net-new visualization pattern** not present in §§9-17.

This extension layers onto sections 1-18 above. It commits the display half of the conversation-evaluation goal: how the existing single-prompt result card absorbs a new `input.kind: "conversation"` envelope shape without forking, how the page surfaces the mode-switch UI without disturbing prompt-mode users, how the new conversation input modalities (image upload + text upload + preview-confirm) feel safe under the prompt-injection-via-screenshot threat model, and how the seven new `arc:` / `cadence:` L3 chips render alongside the existing single-prompt L3s.

## 19. Mode-switch UI (extends `src/app/page.js` header chrome)

The existing single-prompt page (`src/app/page.js`) renders a textarea + Evaluate button at the top of the result region. This phase commits a **mode toggle** that sits immediately above the input area, switches between `"Evaluate a prompt"` and `"Evaluate a conversation"`, and maps one-to-one to the envelope's discriminator (`input.kind`).

### 19.1 Visual chrome -- segmented control

**Decision: segmented control** (two-button pill-style toggle), placed at the top-left of the input region, immediately above the prompt textarea.

```
[ Evaluate a prompt  |  Evaluate a conversation ]
```

Alternatives considered (collapsed defense, full survey in §24):

- **Radio buttons** (rejected) -- correct ARIA semantics, but visually heavier and consumes more vertical space than a 2-state toggle requires.
- **Tabs above the input area** (rejected) -- implies an "either-or workspace" pattern that suggests state for each side is preserved indefinitely; we explicitly want switch behavior (§19.3) that is mode-aware and not workspace-aware.
- **Dropdown / select** (rejected) -- hides one option behind a click for a binary choice; the segmented control surfaces both options at all times.

**Visual treatment.** Single horizontal pill, fixed two-segment, ~340-380px wide on desktop. Active segment: `bg-slate-900 text-white` (primary tier-neutral color, same neutral grammar as classifier-label chips in §9 / §10 to preserve "this is structural chrome, not disposition-bearing chrome" per cross-section consistency rule 1). Inactive segment: `bg-slate-100 text-slate-700` with `hover:bg-slate-200`. 8px border-radius on the pill container; 6px on each inner segment. Single-line label per segment, sentence-case, sans-serif weight-medium 13px.

### 19.2 Default state

**Default: `"Evaluate a prompt"` is active on first load.** Preserves the current single-prompt user behavior. Conversation mode is opt-in. Rationale: (a) prompt mode is the established v5 interaction; defaulting to it minimizes user-visible churn; (b) conversation mode requires an image upload or a multi-turn paste, both of which are heavier commitments than typing a prompt; defaulting to conversation would surprise users coming for a quick single-prompt eval; (c) the URL persistence rule (§19.4) lets a user who repeatedly evaluates conversations bookmark the conversation-mode URL and skip the default.

### 19.3 Switch behavior -- all four scenarios

The mode switch operates on transient input state. The four scenarios the brief calls out, each with concrete behavior:

**Scenario A -- prompt -> conv with empty input.**
- Pre-state: prompt textarea empty; conversation input area not rendered.
- User action: click "Evaluate a conversation".
- Behavior: instant transition. Prompt textarea unmounts; conversation input UI (§20) mounts in its place. No confirmation dialog (nothing is being discarded).
- Result region: any prior prompt-mode result card remains visible below the input until the user submits a new evaluation in conversation mode.

**Scenario B -- prompt -> conv with text already typed in the prompt textarea.**
- Pre-state: prompt textarea contains user-typed text (length > 0); conversation input area not rendered.
- User action: click "Evaluate a conversation".
- Behavior: **show a confirm dialog** -- "Switching modes will discard the text in your prompt. Switch anyway? [Switch] [Cancel]". On Switch: prompt textarea content discarded, conversation input UI mounts. On Cancel: stay in prompt mode, segmented control reverts to "Evaluate a prompt" active. The discarded text is NOT preserved across the switch (no clipboard offer, no auto-save) -- discarding is the affordance; preserving would invite users to misread the switch as "stash for later" rather than "change input shape entirely."
- Result region: prior prompt-mode result card remains visible.

**Scenario C -- conv -> prompt with an attached image (image uploaded but not yet evaluated).**
- Pre-state: conversation mode active; user has attached an image in the upload widget; Stage 0 has NOT yet been invoked (the user has not clicked the parse / preview button).
- User action: click "Evaluate a prompt".
- Behavior: **show a confirm dialog** -- "Switching modes will discard the image you attached. Switch anyway? [Switch] [Cancel]". On Switch: attached image discarded (revokeObjectURL on the blob), prompt textarea mounts with empty content. On Cancel: stay in conversation mode.

**Scenario D -- conv -> prompt with parsed turns (image already through Stage 0, turns confirmed or pending confirmation).**
- Pre-state: conversation mode active; Stage 0 has returned a parsed turn array; user is either looking at the preview-confirm step or has confirmed it but not yet submitted Stages 1-4.
- User action: click "Evaluate a prompt".
- Behavior: **show a confirm dialog** -- "Switching modes will discard your parsed conversation (N turns from image / paste). Switch anyway? [Switch] [Cancel]". On Switch: parsed turn array discarded, conversation input UI fully resets (no half-state preserved), prompt textarea mounts. On Cancel: stay in conversation mode at whichever step the user was on (preview vs confirmed-but-unsubmitted).

**Switch behavior summary.** Empty switches are silent (Scenario A). Switches that discard user-visible content prompt for confirmation (Scenarios B, C, D). No switch preserves state across the boundary -- mode is the input-shape commitment, not a workspace tab.

### 19.4 URL / state persistence

**URL parameter:** `?mode=conversation` (conversation mode) vs no parameter or `?mode=prompt` (prompt mode, the default).

- **Survives refresh:** yes. On page load, if `?mode=conversation` is present in the URL, the segmented control's active segment is `"Evaluate a conversation"` on first paint (no flash of prompt-mode chrome). If absent, prompt mode is active.
- **Survives copy-paste of a result URL:** yes. After a conversation evaluation submits and the result card lands, the URL is rewritten via `history.replaceState` to `?mode=conversation` (without query-encoding the conversation content -- conversations are too large for URL state and persistence of conversation content is out of scope for v1 per scoping memo §4.6). A user who copies the URL and shares it lands on conversation mode with an empty conversation input area; the result card itself is NOT shareable via URL.
- **Switch behavior on URL:** when the user clicks the segmented control, the URL is updated immediately via `history.replaceState` (not `pushState` -- mode-switching should not pollute the browser back-stack). Browser back/forward navigation across modes is not a supported flow in v1; the URL is for bookmarkability and refresh-survival, not navigation history.
- **Other state:** transient input state (uploaded image blob, parsed turns, typed prompt text) is NOT persisted across refresh. Refreshing the page clears the input. This matches the existing prompt-mode behavior and avoids the "did the page remember my image upload?" surprise.

### 19.5 Accessibility -- keyboard nav between modes

- **Tab order.** Segmented control is reachable via Tab in document order: it sits after the page header and before the input area, so it's the first interactive element in the result region.
- **Within the segmented control.** The two segments are implemented as `<button role="tab">` inside a `<div role="tablist" aria-label="Evaluation mode">`. Left/Right arrow keys move focus between segments per the WAI-ARIA Authoring Practices tab pattern. Space or Enter activates the focused segment.
- **Active state.** `aria-selected="true"` on the active segment, `aria-selected="false"` on the inactive. The associated tabpanel (the input area below) is updated via `aria-controls` linkage so screen readers understand the relationship.
- **Live-region behavior on switch.** When the user activates a segment, a brief polite announcement fires: "Switched to conversation evaluation" or "Switched to prompt evaluation". This is inside the existing `aria-live="polite"` container from phase 2a (commit `db43090`), with a one-shot deduped string so rapid back-and-forth toggling does not spam the SR.
- **Focus after confirm dialog.** When a switch is canceled (Scenarios B/C/D), focus returns to the segment that was clicked but does NOT shift to the alternate segment (i.e., the visual state of the segmented control reverts; focus stays where the user was). When a switch is confirmed, focus moves to the first interactive element of the newly-mounted input UI (the textarea for prompt mode; the upload button / first input for conversation mode per §20).

### 19.6 Acceptance gates

- Segmented control renders with two segments, default-active is `"Evaluate a prompt"` on first load (unless `?mode=conversation` is in the URL).
- All four switch scenarios behave per §19.3 (silent for empty switches, confirm dialog for content-discard switches).
- `?mode=conversation` in URL survives refresh; `history.replaceState` is used (not `pushState`).
- Keyboard nav: Tab into the segmented control, Left/Right between segments, Space / Enter activates. `aria-selected` and `aria-controls` wired correctly.
- Switch announcement fires once per switch via the existing aria-live region.
- WCAG AA contrast verified at production time per the §22 methodology (no hex-token assertion in this spec).

## 20. Conversation input UI (new sub-section, replaces prompt textarea when conversation mode is active)

When the segmented control selects conversation mode, the prompt textarea unmounts and the conversation input UI mounts in its place. Three sub-modalities + a preview-confirm step + sender-labeling rules.

### 20.1 Image upload sub-section

**Visual chrome -- drag-and-drop zone + file-picker button (both).**

A bordered drop zone occupies the same vertical footprint the prompt textarea would have. Inside the zone: a large icon (a generic image / screenshot SVG, neutral gray), a one-line label ("Drop a screenshot here, or click to choose a file"), and a secondary line in muted text ("PNG, JPG, or HEIC. Max 10 MB."). Clicking anywhere in the zone opens the OS file picker; dragging a file over the zone surfaces a tinted hover state (`bg-slate-50`, dashed border becomes solid `border-slate-400`); dropping the file invokes the same upload handler as the file picker. Both affordances always available -- never force-choose between drag-and-drop and click; some users do one, some do the other.

**File-format restrictions: PNG, JPG, HEIC.**

Defense: these are the three formats real fraud screenshots arrive as. PNG is the iOS / Android / desktop screenshot default; JPG is the universal compressed alternative (and the format most forwarded screenshots arrive as); HEIC is the iOS default for camera-roll exports and many users save screenshots there without converting. The spike report's corpus (`handoff/reference/10a-vision-spike-report.md` §2.2) was PNG-only, but PNG-only support would frustrate iOS users with HEIC screenshots and Android users with JPG-compressed forwards. GIF / WEBP / TIFF / BMP / SVG explicitly NOT supported in v1 -- GIF would let users upload short videos by frame (out of scope); WEBP support is a phase-2 follow-up if user demand surfaces; SVG is rejected outright because SVG-as-screenshot is essentially never a legitimate user pattern and SVG can carry script payloads (security-belt-and-suspenders). File-extension check on the client (cheap UI gate) + MIME-type check on the server (authoritative). Reject other formats with the message: "Unsupported file format. Please upload a PNG, JPG, or HEIC screenshot."

**Max size: 10 MB.**

Defense: spike corpus screenshots ranged from approximately 100 KB to 800 KB (HTML mockups rendered via headless Chrome at 1080-1280px wide); a 10 MB ceiling gives ~12x headroom for real-world iOS screenshots (which can be 3-4 MB at 1290x2796 retina) and forwarded multi-screen stitches (5-7 MB) without admitting full-resolution photos-of-a-monitor (which routinely exceed 10 MB and are not the target use case). Reject larger uploads with the message: "Screenshot is too large (size: X MB). Please upload an image under 10 MB."

**Loading state during Stage 0 vision parse.**

Spike timings (§3 of the report): ~1-3s per parse for haiku-4-5 (default), ~2-4s for sonnet-4-6 (escalation tier). The loading-state pattern from §2.8 above ("four-stage progress indicator") does NOT apply to Stage 0 -- Stage 0 is one stage, not four, and is upstream of the four-stage pipeline.

The Stage 0 loading state:

- The upload zone replaces its drop-zone chrome with a single-card centered spinner + status line: `"Parsing your screenshot..."` (haiku default) or `"Re-parsing with a higher-quality model..."` (sonnet escalation tier, when invoked per §20.3).
- The status line is announced via aria-live polite when it changes.
- A **Cancel** button is available next to the status line -- pressing it aborts the in-flight `fetch` (via AbortController) and returns the upload zone to its pre-parse state with the previously-attached image still attached and visible. The user can re-trigger parse or attach a different image.
- Stage 0 timeout: 30s. If 30s elapses without a response, treat as a parse failure (§20.3 parse_warnings + error state) and surface "Parse took too long. Please try again or upload a different screenshot."
- The four-stage progress indicator from §2.8 fires after the user confirms the preview (§20.3) and Stages 1-4 begin -- those are still the four-stage pipeline, unchanged.

### 20.2 Text upload sub-section

**Visual chrome -- single multi-line textarea, file picker optional.**

The conversation-mode "text" sub-modality renders a single multi-line textarea, taller than the existing prompt textarea (~10 rows initial height), with a helper label above ("Paste a conversation, one turn per line, with sender labels"). A small secondary button below the textarea: "Upload a .txt file instead" (opens a file picker for .txt / .md, file size capped at 100 KB to prevent paste-bomb attacks). No drag-and-drop on the textarea; only the file-picker button.

**Multi-turn formatting expectation: open-ended, with structured-format documentation surfaced.**

Per the brief: structured (`Sender: text\nSender: text`) vs open-ended (Stage 0 parses heuristically). **Decision: open-ended with structured-format documentation prominently surfaced via a "Show formatting tips" disclosure.**

Defense: spike report §3 surfaces that the vision-based parser handles screenshot inputs robustly but the text-mode parser is deterministic regex / sender-line heuristics (memo §6.2 -- `model: null` for text inputs). Forcing strict `Sender: text` format would frustrate the majority of users who paste from chat apps that use varying conventions (iMessage exports use `[timestamp] Sender: text`; WhatsApp exports use `[dd/mm/yyyy, hh:mm] Sender: text`; Slack uses `Sender, X minutes ago\ntext`; copy-paste from a chat UI typically loses sender labels entirely). The text parser should accept all these and degrade gracefully when sender attribution is ambiguous (raising `parse_warnings` per memo §6.2).

The disclosure ("Show formatting tips") expands to show:

- **Best:** `Alice: Hi! Long time no see.\nBob: Hey, how are you doing?` (one turn per line, `Sender: text` colon-separated).
- **Also works:** WhatsApp / iMessage / Slack export formats (the parser detects the modality via leading bracket/timestamp patterns and strips the chrome).
- **Limits:** "If the parser can't tell who's speaking, you'll see warnings on the preview step and can re-label senders before evaluating."

**File-format support.** `.txt` and `.md` only. No `.docx`, no `.html`, no JSON; the v1 text path is paste-or-text-file. Cap at 100 KB (roughly 25,000 words -- well beyond any realistic conversation length).

**Sub-modality selection.** Inside conversation mode, a small secondary segmented control above the input area chooses between "Upload screenshot" and "Paste text". Default: "Upload screenshot" (the load-bearing primary use case per scoping memo §1). Same segmented-control treatment as §19.1 but smaller (~280-300px wide), `aria-label="Conversation input type"`.

### 20.3 Preview-confirm step (LOAD-BEARING SAFETY SURFACE per memo §8)

After Stage 0 returns (image parse via Claude vision OR text parse via deterministic heuristics), the UI MUST display a preview-confirm step BEFORE invoking Stages 1-4. This is the safety net against (a) OCR-dropped turns, (b) sender-attribution errors, (c) PII leak surprise, and (d) prompt-injection-via-screenshot per memo §8.

**Preview chrome.**

The preview replaces the upload zone (or textarea) in the input region, structured top-to-bottom:

1. **Preview header.** "We parsed N turns. Please confirm before evaluating." (literal N from the parsed array length).
2. **Per-turn preview list.** Each turn rendered as an editable card. Sender label as a small editable field (free-text input, pre-filled with the parsed sender after canonicalization per §20.4). Turn text as a multi-line editable textarea (pre-filled with the parsed text verbatim, auto-resizing to fit content). Timestamp (if present, per memo §3.1) as a small muted text line below the turn text -- read-only in v1 (editing timestamps is out of scope).
3. **Per-turn affordances.** Each card has three icon-buttons in the top-right: "Delete this turn" (X icon), "Insert a turn above" (+ icon, prepends a blank turn), "Insert a turn below" (+ icon at bottom of card, appends a blank turn). All affordances are keyboard-reachable (Tab order through the cards). The card order is the canonical turn order from `turns[]`; reordering turns is NOT supported in v1 (out of scope; if the parser got the order wrong, delete + re-insert is the workaround).
4. **Parse-confidence and parse-warnings strip.** Below the turn list, a status strip surfaces `parse_confidence` and `parse_warnings` per §20.3.1 and §20.3.2.
5. **Confirm CTA + Cancel.** A primary button at the bottom: `"Evaluate these N turns"` (the same N from the header, updates live when the user adds/removes turns). A secondary button next to it: "Start over" (discards the parse and returns to the upload zone). The primary CTA is the trigger that invokes Stages 1-4; the result card lands below the preview after Stages 1-4 complete.

**Why a preview-confirm step is non-negotiable.** Per memo §8 and spike report §5: the parser SECURITY block held against the synthetic adversarial fixture (`IGNORE ALL PREVIOUS INSTRUCTIONS`), but the load-bearing safety net is the user seeing what was parsed before evaluation runs. The two failure modes a preview defends against, in priority order:

1. **OCR-dropped turn.** The model silently drops a turn (zero confidence signal from the spike's `parse_confidence`; haiku returned 0.95 on every clean fixture per spike §4). A user looking at the preview can compare turn count to their screenshot and catch a missing turn before Stage 1-4 runs over an incomplete conversation.
2. **PII leak surprise.** Conversations carry PII (names, phone numbers, addresses, account numbers). The user has implicit understanding that they uploaded a screenshot; the preview makes the data the engine will process explicit. Editable fields let the user redact PII before Stages 1-4 (and the eventual stored eval) see it.

### 20.3.1 parse_confidence display

Per memo §6.2 and spike report §4 (surprise finding 2): `parse_confidence` is **uninformatively stable at 0.95-0.98 on clean inputs**. Both haiku and sonnet returned ~0.95-0.97 across every non-adversarial spike fixture, including the messy mixed-language and small-font cases. The number does not discriminate "easy clean screenshot" from "messy real-world screenshot" -- both look identical to the model on synthetic data.

**Display call: error-only.** Do NOT surface a confidence number on the happy path. Surface it only when `parse_confidence < 0.85` (the spike-report-recommended escalation threshold).

Defense:

- A persistent "Parse confidence: 95%" badge on every preview is **misleading affordance**: it suggests the number is meaningful when, empirically, it is not -- a user seeing 95% on a clearly-degraded screenshot would be falsely reassured; a user seeing 95% on a clean screenshot has no actionable information.
- Suppressing the number on the happy path matches the actionable-only chrome pattern across the existing card (the `Degraded` chip in §2.7 is suppressed when not degraded; the `policy_note` line in §2.4 is suppressed when null).
- Surfacing the number on the unhappy path -- when `parse_confidence < 0.85` -- is where the field carries information: at that point the system can offer an escalation ("would you like to retry with a higher-quality parser?" per §20.3.3) and the number contextualizes the offer.
- Phase 5 fixture work (per memo §6.2) is what will calibrate this threshold against real degraded screenshots. The 0.85 threshold is the spike-report-recommended starting point; the display rule does NOT depend on the exact threshold value (error-only suppression works at 0.80 or 0.90 just as well).

**Low-confidence chrome.** When `parse_confidence < 0.85`, surface a tinted strip above the preview turn list:

- Background `bg-amber-50`, border `border-amber-200`, padding 12px.
- Headline: "Parse confidence is low ({N}%). The preview may have missed or mis-attributed turns."
- Affordances: a "Retry with higher-quality parser" button (invokes sonnet-4-6 escalation per spike §5 + memo §6.4) and a "Continue anyway" link.
- The number IS shown here (the percentage rounded to integer) because it contextualizes the affordance.

### 20.3.2 parse_warnings display

Per memo §6.2: `parse_warnings` is a string array of human-readable warnings (e.g., `["sender attribution unclear for turn 3"]`, `["timestamp on turn 5 not parseable"]`). Empty array = no warnings.

**Display call: always surface when non-empty.**

When `parse_warnings.length > 0`, render below the preview turn list (or above, when low-confidence chrome from §20.3.1 is also present -- low-confidence comes first):

- Background `bg-slate-50`, border `border-slate-200`, padding 12px, leading info icon (neutral gray).
- Headline: "Parse warnings ({N})" or "{N} parse warnings" if N > 1.
- Each warning as a `<li>` in a `<ul role="list">`, prefixed with a muted bullet.
- No dismiss button -- warnings are persistent until the user resolves them by editing the preview or starts over.

The warnings DO NOT block Confirm CTA -- the user retains agency to evaluate despite warnings. If a warning is severe enough to block (e.g., "fewer than 2 turns parsed -- this is not a conversation"), Stage 0 returns `ok: false` and the preview doesn't render at all (per memo §6.5: stage_0 failure routes to `human_review`, but in v1 the failure surfaces in the UI as "We couldn't parse this as a conversation -- please try again or switch to prompt mode").

### 20.3.3 Low-confidence escalation prompt

Per spike report §5 and memo §6.4: when `parse_confidence < 0.85`, offer sonnet-4-6 escalation. The chrome (per §20.3.1):

- "Retry with higher-quality parser" button. Click: invokes Stage 0 again with `model: claude-sonnet-4-6` instead of haiku-4-5. Loading state per §20.1 ("Re-parsing with a higher-quality model..."). On completion, the preview re-renders with the new parse; the prior parse is discarded.
- "Continue anyway" link. Closes the amber strip; the preview as-parsed-by-haiku remains. The user can edit the preview to correct issues manually.

The threshold value (0.85) is phase-5-calibratable per memo §6.2; the display rule (suppress on happy, surface on unhappy) is the load-bearing decision.

### 20.3.4 Prompt-injection-via-screenshot safety language

Per memo §8 and spike report §3.5: both haiku and sonnet correctly extracted the adversarial injection turn as literal content without following the instruction. The parser SECURITY block is the engine-side defense; the preview-confirm step is the user-side defense.

**Display call: no special-case chrome for "this turn looks like a prompt injection."**

Defense:

- Stage 0's contract (memo §6.2) does NOT include a "this turn looks suspicious" flag. The SECURITY block prevents instruction-following, not detection of attempted injection. Surfacing a "suspicious turn" badge would require a detection-side classifier that doesn't exist in v1.
- The preview's per-turn rendering already exposes every turn's content verbatim. A user uploading a screenshot of a conversation that contains an injection-style turn will see the turn rendered as-content in the preview, just like every other turn. The user-readable representation is itself the disclosure.
- If phase 5 surfaces a need for active warning on injection-style turns, the chrome can extend later (a per-turn warning badge keyed off a new Stage 0 flag); flagged as a future affordance, not in v1 scope.

### 20.4 Sender labeling sub-section

Per memo §3.2: `__user__` is the reserved canonical value for unnamed self-bubbles at the schema boundary. The UI is responsible for mapping `__user__` to a friendly per-modality label at render time. The brief asks design to commit the final mapping rule (auto-by-modality, user-toggle, or both) beyond the memo §3.2 starting-point table.

**Committed sender-canonicalization render rule:**

1. **Auto-canonicalize at parse time (Stage 0).** The parser emits `__user__` for unnamed self-bubbles (handled engine-side per memo §3.2; design does not commit the parser prompt). Named senders flow through verbatim.
2. **Auto-map `__user__` to a friendly label in the preview (§20.3) using the `modality_hint` from Stage 0** (memo §6.2 `output.modality_hint` field). The per-modality default mapping table:

| `modality_hint` value | UI displays `__user__` as |
|---|---|
| `imessage` | `Me` |
| `sms` | `Me` |
| `email` | `Me` |
| `slack` | `Me` |
| `whatsapp` | `You` |
| `generic` (or absent) | `Me` |

The `Me` default for `generic` is the most common convention across the spike corpus and the most familiar to US-English users. WhatsApp's `You` convention is preserved per the spike's empirical observation (memo §3.2 starting-point table).

3. **Per-turn override allowed in the preview-confirm step.** The sender field on every preview card (per §20.3) is a free-text input. A user who disagrees with the auto-mapping can re-label any sender for any turn -- including switching `Me` to `You`, switching a named sender to a different name (e.g., correcting a misread), or canonicalizing a misattributed turn. The override is per-turn, not global -- a user can have `Me` on turn 1 and a name on turn 2 if the parser got one wrong. Edits survive into the envelope sent to Stages 1-4 as the literal sender string.
4. **No global "toggle Me/You" affordance.** A separate global toggle ("display all my self-bubbles as You instead of Me") was considered (alternative D in §24) and rejected: per-turn editability is the more powerful primitive (the user can already achieve global by editing each card or by editing the canonical first card with most users not bothering to flip the default).
5. **Named senders rendered verbatim.** Per memo §3 ("Named bubbles -- where the source UI displays a real name or handle for the sender -- MUST keep that name verbatim, with no transformation other than whitespace trimming"). The preview surfaces the parsed name as-is; if the user wants to anonymize ("Alice" -> "Friend"), they edit the field. The engine sees what the user confirms.

**Defense.** The rule is "auto-map by modality at parse time, user override per-turn at preview time." Auto-only would frustrate WhatsApp users who think of self-bubbles as "Me" colloquially despite the app's "You" convention. User-toggle-only would force every user to manually canonicalize, which adds friction to the common case. The hybrid -- auto-default + per-turn override -- captures both: the common case is one click (confirm), the override case is two (edit, then confirm).

### 20.5 Acceptance gates

- Drag-and-drop + file-picker both work; both restricted to PNG / JPG / HEIC and 10 MB max.
- Text upload: textarea + .txt file picker (100 KB max).
- Sub-modality segmented control between "Upload screenshot" / "Paste text"; default "Upload screenshot".
- Stage 0 loading state with cancellable spinner; 30s timeout.
- Preview-confirm renders parsed turns with editable sender + text, per-turn delete + insert affordances.
- `parse_confidence` suppressed on happy path; surfaced (with escalation offer) only when `< 0.85`.
- `parse_warnings` always surfaced when non-empty.
- Sender canonicalization: `__user__` auto-mapped per `modality_hint` table; per-turn override available; named senders verbatim.
- Confirm CTA invokes Stages 1-4; "Start over" returns to upload zone.
- WCAG AA contrast verified at production time per §22.

## 21. Result-card extension for conversation envelopes (extends §§1-18 with conversation-mode chrome)

When `input.kind === "conversation"`, the result card renders the existing 8-section structure plus three new sub-sections specific to conversation envelopes:

- **§21.1 Arc timeline** (new -- inserted between §2.1 Disposition banner and §2.2 Reasoning + narrative summary).
- **§21.2 Per-turn drawer** (new -- expandable detail attached to each timeline segment).
- **§21.3 Sender attribution panel** (new -- inserted after §21.2 in the timeline region).
- **§21.4 Conversation-specific L3 chips** (extends §2.3 Classification envelope's L3 row to surface `arc:` / `cadence:` chips alongside existing L3 categories).

The existing 8 sections (§§2.1-2.8) and the classifier-display extension (§§9-17) render unchanged when `input.kind === "conversation"` -- they describe the *output* of classification (disposition, L1, L2, L3, evidence, prompt summary, etc.), which is the same shape per memo §2.2's discriminated union. Only the new sub-sections in §§21.1-21.4 are conversation-specific.

### 21.1 Arc timeline (new, positioned between §2.1 and §2.2)

The arc timeline is the load-bearing conversation-specific visualization. Per scoping memo §2.6: timeline shows **color** (per-turn risk score), drawer shows **numerics** (per-turn risk + L3 hits). The timeline is THE at-a-glance answer to "where in this conversation did things go wrong."

**Visual chrome -- horizontal strip.**

A horizontal strip of segments, one segment per turn, filling the full width of the result card region (minus the existing 16-24px padding). Total height ~56px on desktop (40px for the colored segments + 16px for the bottom turn-index axis labels).

```
Turn:   1     2     3     4     5     6     7     8     9    10
       [.]  [..]  [..]  [..]  [..]  [.]   [.]  [::]  [##]  [##]
        ^_____________________________________________________
        Arc timeline: turns 1-7 low risk (green/yellow), turn 8 elevated (orange), turns 9-10 high (red).
```

**Per-segment shape.** Each segment is a flex-grown rectangle (equal width per turn for conversations with up to 25 turns; horizontal scroll kicks in at 26+ turns per §22 mobile reflow rules). Segments are 4px apart for visual separation. Each segment has a single color encoding the per-turn risk score; segments are interactive (hover / focus / tap, see §21.1.3 below).

**Color encoding.** Per scoping memo §2.6 default. Five-step ramp keyed off the per-turn risk score, with the ramp values aligned to the existing four-tier disposition palette where possible. The risk score is sourced from `evidence.per_turn[i].component_scores` aggregated (sum of `target / lure / trust / extract / evade`, range 0-15 per schema rule 7).

| Per-turn aggregate risk | Color | Reads as |
|---|---|---|
| 0-2 | `bg-emerald-100` border `border-emerald-200` | Low (benign-looking turn) |
| 3-5 | `bg-yellow-100` border `border-yellow-200` | Low-moderate |
| 6-8 | `bg-amber-200` border `border-amber-300` | Moderate (some signal) |
| 9-11 | `bg-orange-300` border `border-orange-400` | Elevated |
| 12-15 | `bg-red-400` border `border-red-500` | High (load-bearing turn) |

**Defense of five-step ramp (vs the four-tier disposition palette).** The disposition palette (`allow / safe_completion / human_review / block`) is **arc-level**; the timeline encodes **per-turn risk**, which is a continuous-aggregate scalar without the same four-way semantic split. Reusing the four tier colors would force every turn into one of four buckets and visually conflate "this turn is the pivot" with "this turn is benign but the arc is high-risk." The five-step risk ramp uses a separate palette (greens / yellows / oranges / reds) that does NOT collide with the four disposition tier colors -- preserving cross-section consistency rule 1 (four tier colors reserved for disposition-bearing chrome).

**Markers for bright-line firings.** Per memo §4: bright-line firings on any turn fire arc-level. The timeline overlays a small marker (a thin vertical line, 3px wide, full-segment height, `bg-red-700`) on segments where a bright-line fired (`evidence.per_turn[i].bright_lines.length > 0`). Multiple bright lines on the same turn: one marker (the presence of any bright-line is the signal; the specifics are in the drawer).

**Markers for the 7 new arc-level L3s.** The five `arc:` L3s (`trust_ramp`, `money_ask_pivot`, `contact_channel_jump`, `advisor_isolation`, `role_stability_breach`) are **arc-level attributions**, not per-turn. They render in the classification envelope (§21.4) and do NOT mark individual timeline segments. Cadence L3s (`always_available`, `escalation_compression`) are also arc-level.

**Exception: pivot-turn-attributable arc L3s.** If phase 3 vscode determines that a specific arc-level L3 (e.g., `arc:money_ask_pivot`) can be reliably attributed to a specific turn (e.g., "turn 41 is the pivot"), an optional secondary marker (small dot, 4px diameter, `bg-violet-600` for `arc:money_ask_pivot`; other arc L3s use neutral-gray markers) may be overlaid on the pivot turn's segment. This is conditional on Stage 2 / Stage 3 emitting a per-turn pivot-turn-index, which is NOT committed in phase 1's memo. Flagging as a phase 3 vscode call -- the spec supports it but does not require it; if the engine does not emit per-turn arc-L3 attribution, the timeline simply has no pivot markers and the L3 chips in §21.4 carry the signal.

### 21.1.1 Default state

**Default: timeline visible, all segments rendered at full color, no drawer expanded.**

The timeline is the at-a-glance affordance -- it should be the first thing a reader sees after the disposition banner. Drawers (§21.2) are collapsed by default; hovering / focusing / tapping a segment surfaces a small tooltip with the turn index + sender + risk score, but does not auto-expand the drawer.

### 21.1.2 Hover / focus / tap behavior

- **Hover (desktop, mouse).** Tooltip surfaces above the segment with: turn index ("Turn 8"), sender name (per §20.4 mapping), per-turn risk score ("Risk: 9/15"), and a one-line summary of any bright-line firing ("Bright line: `bank_evasion_script`" if applicable; "No bright lines" otherwise). Tooltip dismisses on mouseleave.
- **Focus (keyboard).** Same tooltip via `aria-describedby` linkage. Tab order: timeline is the first focusable region after the disposition banner; arrow-left / arrow-right move focus between segments; Enter or Space opens the drawer (per §21.2).
- **Tap (mobile).** First tap surfaces the tooltip; second tap on the same segment opens the drawer; tap outside dismisses both. Same tap-toggle pattern as the classifier-label chips per §13.5.

### 21.1.3 Acceptance gates

- Timeline renders one segment per turn, equal-width per turn for 2-25 turns, horizontal scroll at 26+ (see §22 mobile reflow).
- Color ramp per the five-step table above; aggregate risk computed from `evidence.per_turn[i].component_scores`.
- Bright-line markers overlay on turns with `bright_lines.length > 0`.
- Hover / focus / tap surfaces the tooltip; Enter / Space / second-tap opens the drawer.
- Tab order: timeline is first focusable region after disposition banner; arrow keys move between segments.

### 21.2 Per-turn drawer (expandable detail)

When a timeline segment is activated (Enter / Space on focus, click on hover, second-tap on mobile), a per-turn drawer expands inline below the timeline (above the §2.2 Reasoning + narrative summary). The drawer pushes the rest of the card content down; only one drawer is open at a time (clicking a second segment closes the first and opens the second).

**Drawer chrome.**

```
+-----------------------------------------------------------+
| Turn 8                                          [Close X] |
| Sender: Alice                                             |
|                                                           |
| "Hey -- I wanted to mention I have a private investment   |
|  opportunity that's worked really well for me. Want to    |
|  learn more?"                                             |
|                                                           |
| Risk: 9/15                                                |
|   target: 2  lure: 3  trust: 2  extract: 2  evade: 0      |
|                                                           |
| Bright lines: bank_evasion_script                         |
|                                                           |
| L3 (per-turn attributable): tactic:authority              |
+-----------------------------------------------------------+
```

The drawer contents:

- **Header row.** Turn index ("Turn 8") + Close button (X icon, top-right). Close returns focus to the activating segment.
- **Sender row.** Sender label per §20.4 mapping; for `__user__`, the friendly per-modality label.
- **Turn text.** The full verbatim text from `input.conversation.turns[i].text`, rendered as a left-bordered blockquote (4px `border-l-slate-300`, padding 12px, italic). Long turns wrap and the drawer height grows; no internal scroll.
- **Numeric per-turn risk** (PER SCOPING MEMO §2.6 RECOMMENDATION). Risk displayed as `Risk: {sum}/15` followed by the five component scores from `evidence.per_turn[i].component_scores` (`target / lure / trust / extract / evade`) on the next line. This is the **numerics-in-drawer** half of the timeline-shows-color + drawer-shows-numerics split.
- **Bright lines fired on this turn.** Listed as chips using the existing `BrightLineChip` component (§2.4 precedent); empty if none.
- **L3 (per-turn attributable).** Renders the L3 chips that Stage 3 attributes specifically to this turn (if the engine emits per-turn L3 attribution; see §21.1's exception note). Most arc-level L3s do NOT render per-turn -- they render in §21.4 only. The per-turn L3 list is typically empty or single-valued (`tactic:authority` on the turn where authority pressure landed, etc.).

**Default state: closed.**

One drawer open at a time. Closing one and opening another is a single click for the user; arrow-keys move between segments without auto-closing the drawer (the drawer follows the activated segment), so a keyboard user can sweep the conversation by holding the right-arrow key and seeing each turn in the drawer.

### 21.2.1 Acceptance gates

- Drawer renders on segment activation (Enter / Space / click / second-tap).
- Only one drawer open at a time; opening a second auto-closes the first.
- Drawer contents include: turn index, sender (mapped per §20.4), turn text verbatim, numeric per-turn risk + 5 component scores, bright lines fired, per-turn L3 chips.
- Close button returns focus to the activating timeline segment.
- Arrow-keys on the timeline keep the drawer in sync with the focused segment.

### 21.3 Sender attribution panel (when conversation has 2+ distinct senders)

Per scoping memo §2.6: when the conversation has 2+ distinct senders (the common case), a small attribution panel surfaces below the timeline. It answers: "which sender drove which fired bright-line, which sender's turns triggered which arc-level L3."

**Visual chrome.** A small two-or-more-column grid below the timeline, before the per-turn drawer's default position. Each column represents one sender; columns are sender-aligned (left-aligned for the first sender encountered, right-aligned for the second -- mimicking chat-app bubble alignment for the visual association `Me/You-on-right`).

```
+---------------------+---------------------+
| Alice (5 turns)     | Me (5 turns)        |
| Drove:              | Drove:              |
|   bank_evasion_     |   (none)            |
|     script (T8)     |                     |
|   arc:trust_ramp    |                     |
|   arc:money_ask_    |                     |
|     pivot           |                     |
+---------------------+---------------------+
```

Each sender column contains:

- **Header.** Sender name (mapped per §20.4 when `__user__`) + turn-count.
- **"Drove" list.** The bright-lines and arc-level L3s that the engine attributes to turns this sender authored. Bright-line items include a turn-pointer (`T8` = turn 8); arc-level L3 items do not (they are arc-level, not turn-level).
- **Empty state.** If a sender drove nothing on the arc, the column shows `Drove: (none)` in muted gray; do NOT suppress the column (cross-section consistency rule 4).

**When attribution panel is suppressed.** If the conversation has only ONE distinct sender (rare but possible -- e.g., a single-sender screenshot where the other side hasn't replied yet), the attribution panel is suppressed entirely. The arc-timeline + drawer carry all the signal.

**Mapping note for `__user__`.** This panel is where `__user__` -> friendly-label mapping (§20.4) is most visible to the user post-evaluation -- the sender column for the user's own turns shows `Me` (or `You` per WhatsApp) per the §20.4 table. This is the final commit of the canonicalization rule in render terms: the engine sees `__user__`; the user sees their preferred friendly label per modality.

### 21.3.1 Acceptance gates

- Panel renders below the timeline when distinct sender count >= 2.
- Suppressed entirely when distinct sender count is 1.
- Each sender column shows name (mapped per §20.4) + turn count + driven bright-lines + driven arc-level L3s.
- Sender columns are positionally aligned (left for first sender, right for second; subsequent senders stack below in source order if >= 3 senders).

### 21.4 Conversation-specific L3 chips (extends §2.3 Classification envelope L3 row)

Per memo §4: 7 new L3 entries -- 5 `arc:` + 2 `cadence:`. Per the brief work item 3.c: "Render alongside existing single-prompt L3 chips in section 3 of the card (Classification envelope), or in a dedicated section? Defend."

**Decision: render alongside existing single-prompt L3 chips in §2.3, with category-grouping preserved.**

Defense:

- The existing L3 row already groups by category (`method`, `tactic`, `target`, `context_marker`, `overlap`, `risk_marker`). Adding two new categories (`arc`, `cadence`) extends the existing grouping pattern by one row each; the existing chrome (one row per category, chips sorted by descending confidence) applies verbatim.
- A dedicated "conversation L3" section would split the L3 surface into two visual regions (prompt-mode L3 vs conversation-mode L3) and force readers to scan both to understand the full classification. Single L3 surface keeps the classification envelope as the single authoritative grouping.
- For prompt-mode envelopes (`input.kind === "prompt"`), the `arc` and `cadence` rows are simply absent -- the existing six L3 category rows render as today. For conversation-mode envelopes, the two new rows render alongside the existing six. No conditional layout, only conditional content.

**New L3 category rows in §2.3.**

After the existing six L3 category rows, append:

- **Arc** row -- chips for each `arc:` L3 fired on this arc. Tooltip-descriptor copy from memo §4.1 verbatim (`arc:trust_ramp`, `arc:money_ask_pivot`, `arc:contact_channel_jump`, `arc:advisor_isolation`, `arc:role_stability_breach`).
- **Cadence** row -- chips for each `cadence:` L3 fired on this arc. Tooltip-descriptor copy from memo §4.2 verbatim (`cadence:always_available`, `cadence:escalation_compression`).

Empty state: if `arc` or `cadence` row has no chips for this envelope (e.g., a conversation that fired no cadence L3s because timestamps were absent), render the row with the standard empty-state placeholder (`No arc tags above emit threshold` / `No cadence tags above emit threshold`).

**Chip chrome.** Same monospace + chip pattern as existing L3 chips. No new chip variant (no new color, no new shape) -- the `arc:` / `cadence:` chips share the L3 grammar. The category-row label (`Arc`, `Cadence`) is the disambiguator.

**Tooltip-descriptor pattern.** Reuse the `HoverChip` component from §2.3 / §9.1. The tooltip descriptor text is the memo §4.1 / §4.2 per-entry text verbatim where it ASCII-passes; per memo §4, all 7 entries are ASCII-clean (the memo is gitignored per `docs/memos/**` but ASCII-safety still holds), so verbatim quoting works.

**Multi-valued.** Both `arc:` and `cadence:` are multi-valued per arc (memo §4.1, §4.2). Multiple chips per row, same tag-strip layout as Control labels in §9.2 (chip-strip with overflow if needed; realistic cardinality is 1-3 chips per row).

### 21.4.1 Acceptance gates

- `arc` and `cadence` rows render in §2.3 L3 section when `input.kind === "conversation"`.
- Rows are suppressed for `input.kind === "prompt"` (no conditional layout, just conditional content).
- Each chip carries the memo §4 tooltip-descriptor verbatim via `HoverChip`.
- Empty rows render the standard L3 empty-state placeholder.
- Multi-valued: same tag-strip layout as Control labels in §9.2.

## 22. WCAG 2.1 AA + mobile reflow at 375 / 414

Applies the methodology lessons from the 2026-05-27 §12.1 contrast amendment + §13.1 breakpoint amendment.

### 22.1 WCAG AA -- contrast methodology, not authoring-time hex

Per the §12.1 amendment: WCAG contrast ratios for new chrome introduced in §§19-21 MUST be live-computed against the deployed bundle via `getComputedStyle`. Do NOT assert ratios in this spec from Tailwind hex tokens at authoring time; the rendered ratio diverges by 1-2 luminance steps once color-scheme, font-rendering, and parent stacking-context blending apply (see §12.1 methodology note for the canonical protocol).

**This spec's contrast assertions are written at-authoring-time as preliminary estimates ONLY. Phase 4 qa is responsible for live-measuring against the production deploy per the 2026-05-27 methodology and reporting any pair below 4.5:1.**

**Preliminary estimates (to be live-verified by qa phase 4):**

| Surface | Background (token) | Foreground (token) | Hex-estimated ratio | AA threshold | Notes |
|---|---|---|---|---|---|
| Segmented control active | `bg-slate-900` | `text-white` | ~18:1 | 4.5:1 | Estimated comfortably above AA + AAA |
| Segmented control inactive | `bg-slate-100` | `text-slate-700` | ~10:1 | 4.5:1 | Estimated above AA |
| Timeline segment, risk 0-2 | `bg-emerald-100` | (no text) | n/a | n/a | Non-text element; UI Components contrast 3:1 against card background |
| Timeline segment, risk 6-8 | `bg-amber-200` | (no text) | n/a | n/a | Same |
| Timeline segment, risk 12-15 | `bg-red-400` | (no text) | n/a | n/a | Same |
| Drawer turn text (blockquote) | `bg-white` | `text-slate-700` (italic) | ~10:1 | 4.5:1 | Estimated above AA |
| Low-confidence amber strip | `bg-amber-50` | `text-amber-900` | ~8.75:1 (per §12.1 live-measured precedent) | 4.5:1 | Same chrome as classifier `other` chip; precedent ratio holds |
| Parse-warnings strip | `bg-slate-50` | `text-slate-700` | ~10:1 | 4.5:1 | Estimated above AA |
| Preview-card sender input | `bg-white` | `text-slate-900` | ~16:1 | 4.5:1 | Estimated above AA + AAA |
| Sender-attribution panel header | `bg-white` | `text-slate-700` (bold) | ~10:1 | 4.5:1 | Estimated above AA |

**Methodology note (reaffirmed for this extension's authors).** Live-measure with `getComputedStyle(node).color` and `.backgroundColor` against the deployed bundle. Hex tokens are starting points only. The 2026-05-27 §12.1 amendment names the canonical protocol; this section reaffirms it for §§19-21.

**Non-text element contrast (timeline segments).** Per WCAG 2.1 SC 1.4.11 (Non-text Contrast), UI components and graphical objects must have at least 3:1 against adjacent colors. The timeline segments are graphical objects representing per-turn risk; they must contrast at >=3:1 against the card-interior background (`bg-white`). Preliminary estimates:

| Segment color | vs `bg-white` | 3:1 threshold | Result (estimated) |
|---|---|---|---|
| `bg-emerald-100` `#d1fae5` | ~1.2:1 | 3:1 | **FAIL** at-authoring -- segment border `border-emerald-200` provides edge contrast; live-verify |
| `bg-amber-200` `#fde68a` | ~1.5:1 | 3:1 | **FAIL** at-authoring -- same; border ramp may pass |
| `bg-orange-300` `#fdba74` | ~2.0:1 | 3:1 | **FAIL** at-authoring -- same |
| `bg-red-400` `#f87171` | ~2.8:1 | 3:1 | **CLOSE / FAIL** at-authoring |

**Critical phase 4 verification item.** The fill-only contrast of pastel risk-ramp colors against white may NOT clear the 3:1 non-text-contrast bar in some segments. The bordered chrome (each segment carries a 1px border at the next-darker token, e.g., `bg-emerald-100` + `border-emerald-200`) provides the edge contrast that makes the segment visually distinguishable from adjacent segments; the 3:1 check is against `bg-white`, not against adjacent segments. Phase 4 qa MUST live-verify each segment color's fill-or-border-contrast against the card background and flag any below 3:1. The likely remediation (if any color fails): bump the darker variant by one Tailwind step (e.g., `bg-emerald-200` instead of `bg-emerald-100`, `border-emerald-300` instead of `border-emerald-200`). The five-step ramp's ordering must be preserved -- a remediation must shift the whole ramp uniformly, not adjust individual steps.

Per §12.1's methodology rule: this spec does NOT commit specific live-measured ratios; phase 4 qa commits them.

### 22.2 Mobile reflow at 375 / 414

**Tailwind `md:` breakpoint applies** per the 2026-05-27 §13.1 amendment. Grep evidence: `tailwind.config.js` has no `theme.extend.screens` override (verified via Read of `tailwind.config.js` -- `theme.extend` is empty), so the framework default `md: 768px` holds. At <768px, the reflow rules below apply; at >=768px, the desktop layout per §§19-21 applies.

**Segmented control (§19) at <768px.** Stays inline (two segments horizontal pill). Width adapts to fill the input region (~95% of viewport width minus the existing 16-24px page padding). Both segment labels remain visible -- "Evaluate a prompt" and "Evaluate a conversation" both fit at 375px width within a ~340-360px pill (verified roughly by character count: longer label is "Evaluate a conversation" ~22 chars at sans-serif 13px medium ~= ~170px text width + 16px padding per side per segment = ~200px per segment * 2 = ~400px total; at 375px viewport minus 16px*2 page padding = 343px available, the pill clips slightly). Mobile mitigation: drop labels to "Prompt" / "Conversation" at <420px viewport width (i.e., narrow the labels at narrow widths to preserve the segmented-control shape). Aria-labels keep the full sentence.

**Image upload zone (§20.1) at <768px.** Drop zone takes full input-region width. Click-to-pick affordance remains; drag-and-drop affordance is still rendered visually (the dashed border + hover-state still works on tablets and touchscreen laptops at <768px width) but is not the load-bearing affordance on mobile (mobile users tap to open file picker). No layout collapse needed; the upload zone is single-column at all widths.

**Preview-confirm step (§20.3) at <768px.** Per-turn cards stack vertically (they already do at desktop -- only the per-card right-aligned affordances change). At <768px, the per-turn-card affordances (Delete, Insert above, Insert below) collapse from icon-buttons-in-top-right to a single overflow menu button (three vertical dots) opening a small popover with all three actions. Saves horizontal space; preserves all affordances.

**Arc timeline (§21.1) at 375 / 414 mobile -- horizontal scroll with snap.**

The brief asks for compressed view vs horizontal scroll vs collapse-to-list. **Decision: horizontal scroll with snap-points** at 375 / 414.

Defense:

- **Compressed view** (rejected): squeezing 10 segments into ~340px viewport width gives 30-34px per segment, which is below the WCAG 2.1 SC 2.5.5 target-size minimum (24px square; the bordered area must be at least 24x24 for AA-compliant tap targets, ideally 44x44 per Apple HIG and SC 2.5.8 AAA). At 30-34px wide x 40px tall, a segment is *just* clearing the AA bar but uncomfortably close, and a 14-turn conversation drops below it. Doesn't scale.
- **Collapse to vertical text list with risk-score chips** (rejected): loses the at-a-glance temporal scan that is the timeline's load-bearing property. A vertical list of turns is just the per-turn drawer expanded for all turns simultaneously, which is the drawer's job, not the timeline's. The timeline's visualization grammar (horizontal = time progression, color = risk) is the spec contribution; converting to vertical text discards it.
- **Horizontal scroll with snap-points** (committed): each segment is rendered at a fixed minimum width of 48px (clears WCAG SC 2.5.5 24px AA bar comfortably and gets close to the SC 2.5.8 44px AAA bar). Total timeline width = `48 * turn_count + 4 * (turn_count - 1)` (segment-gap is 4px). For a 10-turn conversation, total = 516px; at 375px viewport, this is a ~140px overflow that scrolls horizontally. Scroll snap is enabled (`scroll-snap-type: x mandatory; scroll-snap-align: start;` per segment), so a swipe lands cleanly on a segment boundary, not mid-segment. Edge fade gradients (`bg-gradient-to-r from-white via-transparent to-white`, ~24px wide on each edge) signal scrollability without an explicit scrollbar.

**Per-turn drawer (§21.2) at <768px.** Drawer width matches the input-region width (full-width minus page padding); same internal layout as desktop. No collapse; drawer content is read top-to-bottom. Tap-to-close (or tap a different segment) per existing pattern.

**Sender attribution panel (§21.3) at <768px.** Per-sender columns stack vertically (one column per row) instead of side-by-side. Each column keeps its full content (header + driven list). At <768px, the chat-app-bubble-alignment grammar (left for first sender, right for second) is lost -- columns are simply stacked top-to-bottom in source order. Acceptable trade-off; the at-a-glance "who drove what" content is preserved.

**Conversation-specific L3 chips in §2.3 at <768px.** Same mobile chip wrap as existing L3 chips (per §13.4 multi-chip-strip wrap pattern). No new mobile rule needed.

### 22.3 Keyboard nav + screen-reader semantics for the timeline

The timeline is a visual abstraction over an ordered list of turns. SR semantics MUST preserve the ordered-list reading.

- **Container.** `<ol role="list" aria-label="Conversation arc timeline, {N} turns">` wrapping the segments.
- **Each segment.** `<li>` containing a `<button>` with `aria-label="Turn {i}, sender {sender}, risk {risk}/15"` and `aria-describedby` pointing to a hidden description: "{bright-line summary if any} {arc-level L3 summary if any per-turn-attributable}".
- **Drawer.** When opened, the drawer is a region with `role="region" aria-label="Turn {i} details"` and focus moves to it via `tabIndex={-1}` + `.focus()` on activation. Close button returns focus to the timeline segment.
- **Sender attribution panel.** Each sender column is a `<div role="group" aria-label="Sender {name} drove {N} signals">` containing a `<ul>` of driven items.

**Tab order.** Disposition banner -> Arc timeline (first segment) -> per-turn drawer (when open) -> Sender attribution panel -> Reasoning + narrative summary (§2.2) -> rest of card per existing order (§2.3 Classification, §2.4 Triggered-by, etc.).

**Arrow-key nav within timeline.** Left/Right arrows move focus between segments. Home/End jumps to first/last segment. Arrow keys keep the drawer in sync if it's open (the drawer follows the focused segment).

**Screen-reader announcement on drawer open.** Aria-live polite: "Turn {i} expanded. Risk {risk}, sender {sender}. Press Escape to close."

### 22.4 Acceptance gates (extends §22.5 below)

- WCAG AA contrast live-computed at phase 4 qa for all new chrome (§§19-21).
- Non-text contrast (timeline segments) live-verified at >=3:1; remediate ramp uniformly if any segment fails.
- Mobile reflow at 375 / 414 holds for: segmented control (label-narrowed below 420px), upload zone (single-column), preview-confirm (per-card affordance collapse to overflow), arc timeline (horizontal scroll with snap, 48px min-width per segment), drawer (full-width), sender attribution (stacked columns).
- Keyboard nav: tab into timeline, arrow-keys between segments, Enter / Space to open drawer, Escape to close.
- SR semantics: timeline as `<ol role="list">`, segments as labeled buttons, drawer as labeled region.

### 22.5 Methodology gap acknowledgment

Per the §12.1 / §13.1 methodology rules: this spec authors at-authoring-time, not at-production-time. The Cowork sandbox running this design dispatch does not have a headless browser tool to live-measure contrast against a deployed bundle (the chrome doesn't exist yet -- phase 3 vscode implements it). The contrast estimates in §22.1 are starting points; phase 4 qa lives-measures against the deployed bundle and amends this spec via §18 amendment-log if any pair falls below threshold.

The `tailwind.config.js` grep evidence in §22.2 IS live (verified this turn): `theme.extend.screens` is empty, so framework defaults hold and the `md: 768px` rule applies.

## 23. Single-file decision (per brief work-item 1 + §-decision requirement)

**Decision: single-file extension to `docs/ux/design-system/v5-result-card.md`** (this file).

Defense:

- **Same precedent as §§9-17.** The classifier-display extension (shipped 2026-05-26) made the same call for the same reasons: the new sections reference the existing 8 sections for visual grammar (chip treatments, hover patterns, mobile reflow precedents, focus order, empty-state policy, color reservation rules). Splitting to a companion file (`v5-conversation-card.md`) would force a reader to bounce between two docs to understand a single card's behavior, and would duplicate the cross-section consistency rules in §3 above (or worse, would split them silently). The cost of the extra file length is small (this extension is approximately the size of one of the original eight sections plus the classifier-display extension); the cost of split-doc cognitive load is meaningful.
- **The two acknowledged structural deltas vs the §§9-17 precedent do NOT change the single-file calculus.**
  - (i) **Three new surfaces this phase** (mode switch + input UI + result-card extension) vs §§9-17's one surface (result-card chrome only). The three surfaces all live in the same `src/app/page.js` and all interact with the same envelope shape; the design-system doc that describes the chrome for one logically describes the chrome for all three. Splitting them into three files would shatter the single-card mental model; splitting into two (input UI + result card, with mode switch in one of them) would still force cross-references between the two files. Single-file holds.
  - (ii) **Arc timeline is net-new visualization** not present in §§9-17. The visualization is a new section (§21.1) within the existing file -- the same way the per-tier disposition icons are a new pattern (companion `disposition-tier-icons.md` for full icon spec, with cross-references from §2.1 in this file). The arc-timeline pattern is internal to the conversation extension; it does not warrant its own design-system file because it does not stand alone (the timeline only exists in the context of a conversation result card).
- **Companion-file alternative considered, rejected.** A companion `v5-conversation-card.md` would be the right call if (a) the conversation work targeted a different card or surface entirely, (b) the chrome diverged from the existing card's visual grammar (it doesn't -- the classification envelope, evidence panel, disposition banner all share grammar; only §§21.1-21.4 are new), or (c) the audit-grade reader audience differed (it doesn't -- the same audit-grade reader who reads about prompt-mode evaluation also reads about conversation-mode evaluation; they're variants of the same card). None of those apply.

Length consequence: this spec now extends from ~590 lines (pre-extension) to roughly ~1100 lines (post-extension). Still well within the read-end-to-end budget of an audit-grade design-system doc (~2-3 hour read for a phase 4 qa pass).

## 24. Alternatives considered (extends §-alternatives discipline from §§9-17)

At least three alternative result-card shapes per the brief work-item 5. Authored honestly -- alternatives that almost made the cut are flagged; alternatives that were near-zero are named only briefly.

### 24.1 Alternative A -- single-view-no-drawer

**Shape:** the arc timeline is the only conversation-specific surface. Per-turn detail is hover-only (tooltip), no expandable drawer. Per-turn risk + bright lines + per-turn L3s all live in the hover tooltip; there is no clicked / expanded "drawer" surface.

**Pros:**
- Simpler chrome (one fewer new surface to implement and maintain).
- Faster scan: reader hovers across timeline, sees per-turn detail without committing to a click.
- Less vertical real estate consumed in the result card.

**Cons:**
- Hover tooltips don't translate to mobile / touch (no hover affordance; tap-to-show-tooltip exists but reads differently from hover -- per §13.5 the mobile pattern is tap-toggle).
- Hover tooltip content cap is small (typically 1-3 lines before legibility degrades); the per-turn drawer needs to show 5+ lines (sender + text + risk + components + bright lines + per-turn L3) which a tooltip cannot hold without becoming a popover.
- Forces a reader who wants to audit "which turn drove the bright-line firing" to hover through every segment, with no persistent view -- worse for audit grade.

**Why rejected:** the audit-grade reader is the load-bearing audience (per the existing spec's §2.3 monospace-conveys-code-not-label principle). An audit reader needs to be able to read full per-turn detail without holding hover state, especially for long arcs. The drawer is the audit-grade affordance; the tooltip-only alternative is the casual-user affordance, and the casual user is not the load-bearing audience.

**Closest to adoption:** moderate. The drawer adds vertical space and implementation cost; if phase 4 qa surfaces that the drawer is rarely used in real audits, returning to a hover-tooltip-only pattern is a non-breaking simplification.

### 24.2 Alternative B -- separate-conversation-card

**Shape:** conversation evaluations render in a totally distinct card layout, not extending the existing 8-section structure. New card has: a conversation-specific header (sender + parse-confidence summary), the arc timeline as the primary visualization, per-turn detail in a vertically-stacked list (no timeline + drawer split), and conversation-specific L3 in a dedicated section -- entirely separate from the classification envelope.

**Pros:**
- Cleaner conceptual model: prompt evaluations and conversation evaluations are clearly different artifacts.
- More room to design conversation-specific visualizations without constraint from the existing prompt card chrome.
- Easier to retire / replace conversation-mode chrome without disturbing prompt-mode chrome.

**Cons:**
- Duplicates the shared sections (disposition banner, reasoning, classification envelope, evidence panel) in two card layouts -- forks every cross-section-consistency rule in §3.
- Inconsistent with memo §2.2's discriminated-union decision (the same envelope shape produces classification + disposition + evidence + prompt summary for both inputs; the rendering should reflect that).
- More code paths in `src/app/page.js`, more divergent design-system doc.
- Forces a reader of two evaluations (one prompt-mode, one conversation-mode) to context-switch between two card layouts to understand the disposition / classification of both.

**Why rejected:** the discriminated-union envelope is the architectural decision (memo §2.2); the card layout should mirror that. Conversation evaluations are an *input variant*, not an *output variant*; the output card chrome is largely shared (only §§21.1-21.4 are new). Forking the card would re-litigate the discriminated-union decision at the rendering layer.

**Closest to adoption:** low. The forked-card approach has surface appeal ("conversations feel different from prompts") but the empirical shared-output property (same L1, same L2, same disposition verbs, same evidence shape) wins.

### 24.3 Alternative C -- embedded-in-existing-card

**Shape:** the conversation surface is folded into existing sections. Arc timeline goes into §2.3 Classification envelope (above the L1 / L2 / L3 rows) as a small visualization; per-turn drawer is folded into the §2.5 Evidence panel (a collapsible per-turn rows section under the existing component-scores sub-section); sender attribution is collapsed into a small chip-strip in §2.1 Disposition banner ("Senders: Alice (5), Me (5)"). No new top-level sections; conversation-specific chrome is woven into existing sections.

**Pros:**
- Zero new top-level sections -- the existing 8-section structure is preserved exactly.
- Less vertical space consumed (everything fits within sections that already render).
- Easier to defend the single-file decision (no new sections to fork).

**Cons:**
- Loses the at-a-glance prominence of the arc timeline -- placing it inside the Classification envelope buries it three sections deep, behind disposition banner + reasoning summary.
- Forces the per-turn drawer into a sub-section of an already-collapsible Evidence panel, requiring two levels of collapse to reach per-turn detail.
- Loses the visual grammar that "conversation mode is a different evaluation" -- conversation-specific chrome dispersed across three existing sections reads as "conversation mode is just a few extra fields" rather than "conversation mode adds a visualization-bearing card extension."
- Forces the sender attribution to compete for space in §2.1 with the disposition pill, schema-version chip, confidence readout, and degraded chip -- already crowded at >=900px width per §2.1's wrap-cleanly guarantee.

**Why rejected:** the arc timeline is the load-bearing conversation-specific surface; placing it three sections deep buries it. The principle from §2.1 (credibility-bearing fields first) extends to the new conversation chrome -- the timeline is conversation-mode credibility, and should sit right after the disposition banner where a reader's eye lands first.

**Closest to adoption:** very low. The motivation (zero new sections) is undermined by the cost (every embedding decision is a compromise that makes a previously-clean section more crowded).

### 24.4 Alternative D -- global Me/You toggle (§20.4 sender-mapping alternative)

**Shape:** a small persistent toggle in the page header ("Display my self-bubbles as: [ Me / You ]") that globally overrides the per-modality `__user__` mapping. Per-turn override would NOT exist; the user picks a global preference and every conversation evaluation uses it.

**Pros:**
- Simpler chrome (one toggle, no per-turn editability).
- Captures user preference across sessions (could survive via cookie / URL param).

**Cons:**
- Less powerful than per-turn override (a user who has both iMessage and WhatsApp screenshots in mixed-modality workflow cannot get the right label per screenshot).
- Forces a binary preference where the modality-aware default is empirically the better starting point (per spike report §4: `Me` for iMessage / SMS / Email / Slack; `You` for WhatsApp matches the apps' conventions).
- Doesn't address sender re-labeling for parser errors (a user who needs to correct "Bob" -> "Alice" because the parser misread the name needs per-turn editability anyway).

**Why rejected:** the per-turn editability is the more general primitive. Global preference is a degenerate case of per-turn editability (the user just edits every card the same way) -- so the global toggle would be redundant chrome.

**Closest to adoption:** moderate. The global-toggle's appeal is "consistency across sessions"; if phase 4 qa surfaces that users routinely flip mappings the same way across screenshots, a global default that survives session can be added as a non-breaking opt-in on top of the per-turn-editable foundation.

### 24.5 Alternative E -- timeline as vertical stripe (rejected, brief mention)

**Shape:** timeline rendered as a vertical strip (top = turn 1, bottom = turn N) along the left edge of the result card, with per-turn detail to the right.

**Why rejected briefly:** vertical timelines work for very long arcs (50+ turns) where horizontal scroll becomes unwieldy, but for the spike's empirical 5-15-turn range, horizontal preserves the temporal-progression-left-to-right convention that matches Western reading order and the chat-app rendering grammar users are already familiar with.

### 24.6 Honest read on the cut

The §§21.1-21.4 chrome closest to adoption was Alternative A (no drawer); the §§19-20 chrome closest to adoption was Alternative D (global toggle). Both alternatives address concerns that may surface in phase 4 qa (drawer underused; users want global preference); both alternatives are non-breaking simplifications layered on top of the committed spec. If phase 4 qa surfaces either concern, the path to remediation is documented here.

The committed spec's bias is toward audit-grade richness (drawer + per-turn override) over chrome minimalism (tooltip + global toggle). This is consistent with the existing card's bias (per §0 "audit-grade vocabulary stability" / §2.3 "audit-readability over friendliness"); reversing the bias for conversation mode alone would be inconsistent.

## 25. Phase 3 vscode handoff checklist (extends §§5 + 16; precedent: 11 items)

This extension is the source-of-truth for the phase 3 vscode dispatch on conversation evaluation (combined with the phase 1 vocabulary memo `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md`). The dispatch will need to ship 11 distinct items per the §16 precedent. Each item names: the surface to touch, the file path, the envelope field consumed, the visual chrome to render, the WCAG / mobile constraint to honor.

**Item 1 -- Mode-switch segmented control.**
Surface: page header above the input region. File: `src/app/page.js`. Envelope coupling: `?mode=conversation` URL parameter wired to a `mode` React state; on Evaluate, `input.kind` is set from `mode`. Visual chrome: segmented control per §19.1, default-active `prompt` (§19.2). Confirm dialog wiring for Scenarios B/C/D (§19.3). `history.replaceState` to keep URL in sync (§19.4). ARIA: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, arrow-key nav, polite-region switch announcement (§19.5). WCAG: contrast live-verified per §22.1 methodology; segmented control fits at 375px viewport with label-narrowing below 420px (§22.2).

**Item 2 -- Sub-modality segmented control (Upload screenshot vs Paste text).**
Surface: inside conversation-mode input region, above the upload zone / textarea. File: `src/app/page.js`. Envelope coupling: `input.conversation.modality: "image" | "text"` set from this control (§20.1 + §20.2). Visual chrome: smaller segmented control per §20.2. Same ARIA pattern as Item 1.

**Item 3 -- Image upload zone with drag-and-drop + file picker.**
Surface: conversation-mode + `modality === "image"`. File: `src/app/page.js`. New helper file may be split out: `src/components/ImageUploadZone.jsx` if `page.js` size becomes unwieldy. Visual chrome per §20.1. File format: PNG / JPG / HEIC; max 10 MB. Loading state: cancellable spinner during Stage 0; 30s timeout (§20.1).

**Item 4 -- Text upload textarea with .txt file picker fallback.**
Surface: conversation-mode + `modality === "text"`. File: `src/app/page.js` (or `src/components/ConversationTextInput.jsx`). Visual chrome per §20.2. Max 100 KB for .txt upload. "Show formatting tips" disclosure per §20.2.

**Item 5 -- Stage 0 invocation + new parser implementation.**
Engine surface: `src/lib/conversation-parser.js` (new file per memo §1.1 + §6.2). For image: invokes Claude vision with the SECURITY-block-bearing parser prompt from `scripts/spike/parse-conversation-screenshot.js` per memo §6 + spike report §2.3. For text: deterministic regex + sender-line heuristics. Returns the Stage 0 output contract per memo §6.2. Cancellable via AbortController; timeout 30s.

**Item 6 -- Preview-confirm UI with editable per-turn cards.**
Surface: conversation-mode + post-Stage-0. File: `src/app/page.js` (or `src/components/ConversationPreview.jsx`). Visual chrome per §20.3. Per-turn cards with editable sender + text, delete + insert affordances (icon-buttons on desktop, overflow menu on mobile per §22.2). Confirm CTA invokes Stages 1-4. Sender canonicalization auto-mapping per §20.4 table (uses `output.modality_hint` from Stage 0).

**Item 7 -- parse_confidence + parse_warnings display logic.**
Surface: preview-confirm step. File: same as Item 6. Logic: suppress `parse_confidence` on happy path; surface low-confidence amber strip with "Retry with higher-quality parser" + "Continue anyway" affordances when `parse_confidence < 0.85` (§20.3.1). Always surface `parse_warnings` strip when non-empty (§20.3.2). Sonnet-4-6 escalation invocation per §20.3.3.

**Item 8 -- Arc timeline component with 5-step risk ramp + bright-line markers.**
Surface: result card, between §2.1 Disposition banner and §2.2 Reasoning. File: `src/app/page.js` (or `src/components/ArcTimeline.jsx`). Renders `evidence.per_turn[]` as segments per §21.1. Color ramp per §21.1's five-step table; bright-line markers overlaid per §21.1. Hover / focus / tap surfaces tooltip; activation opens drawer. ARIA per §22.3 (`<ol role="list">`, labeled buttons). Mobile reflow: horizontal scroll with snap, 48px min-width per segment (§22.2).

**Item 9 -- Per-turn drawer + sender attribution panel.**
Surface: result card, below timeline. File: `src/app/page.js` (or `src/components/PerTurnDrawer.jsx` + `src/components/SenderAttribution.jsx`). Drawer per §21.2 (single-drawer-open-at-a-time, contents per §21.2 listing). Sender attribution panel per §21.3 (suppressed when distinct sender count is 1; renders side-by-side at >=768px, stacked at <768px per §22.2). ARIA per §22.3.

**Item 10 -- Conversation-specific L3 chip rows in §2.3 Classification envelope.**
Surface: existing classification envelope section. File: `src/app/page.js`. Logic: append two new L3 category rows (`Arc`, `Cadence`) when `input.kind === "conversation"` (§21.4). Suppress rows for prompt-mode envelopes. Chip chrome inherits from existing L3 chip treatment (no new chip variant). Tooltip-descriptor dictionary in `CLASSIFIER_LABEL_DESCRIPTIONS` constant (per §16 precedent) extended with 7 new entries from memo §4.1 + §4.2.

**Item 11 -- Tailwind + Tailwind-config grep verification + WCAG live-measure plan.**
Surface: build + verification gate. Tasks: (a) confirm `tailwind.config.js` `theme.extend.screens` is still empty (re-grep before merge); (b) confirm `bg-emerald-100`, `bg-amber-200`, etc. are not in any `safelist` config that might prevent JIT compilation (Tailwind 3+ JIT compiles only classes appearing in source files -- ensure timeline color classes appear literal in JSX, not dynamically computed); (c) write a one-page live-WCAG-measure plan that phase 4 qa executes: list the chrome pairs from §22.1 that need live-`getComputedStyle` measurement, plus the four non-text-contrast checks for timeline segment colors per §22.1 critical-verification item.

### 25.1 qa acceptance criteria embedded for phase 4 qa to audit

Per the §16 precedent and the brief work-item 5. The audit criteria phase 4 qa will execute against:

- **Mode-switch interaction** matches §19 for all four switch scenarios; confirm dialog wording matches §19.3 verbatim; URL `?mode=conversation` survives refresh (§19.4); keyboard nav per §19.5.
- **Conversation input UI** renders both image and text sub-modalities (§20.1 + §20.2); file-format restrictions enforced (PNG/JPG/HEIC at 10MB for image; .txt/.md at 100KB for text); Stage 0 cancellable with 30s timeout.
- **Preview-confirm step** renders parsed turns with editable sender + text per §20.3; per-turn delete + insert affordances reachable via keyboard; `parse_confidence` suppressed on happy path / surfaced below 0.85 with escalation offer (§20.3.1 + §20.3.3); `parse_warnings` surfaced when non-empty (§20.3.2); sender canonicalization auto-maps per §20.4 table.
- **Arc timeline** renders with color-encoded per-turn risk ramp (§21.1); bright-line markers overlay turns with `bright_lines.length > 0`; hover / focus / tap surfaces tooltip; Enter / Space / second-tap opens drawer; horizontal scroll with 48px min-width at <768px (§22.2).
- **Per-turn drawer** expands on activation; only one drawer open at a time; contents include sender (mapped per §20.4), turn text verbatim, numeric per-turn risk + 5 component scores, bright lines fired, per-turn L3 chips (§21.2).
- **Sender attribution panel** renders when distinct sender count >= 2; columns positionally aligned per §21.3; suppressed when sender count is 1.
- **Conversation-specific L3 chips** -- `Arc` and `Cadence` rows render in §2.3 when `input.kind === "conversation"`; suppressed for prompt-mode; tooltip-descriptor copy verbatim from memo §4.1 + §4.2.
- **WCAG AA contrast** live-computed via `getComputedStyle` per §22.1 methodology; non-text-contrast for timeline segments >=3:1 against `bg-white`; any pair below threshold triggers an §18 amendment-log entry with remediation (uniform ramp shift, not individual step adjustment).
- **Mobile reflow at 375 / 414** holds for: segmented control (label-narrowed below 420px), upload zone (single-column), preview-confirm (per-card affordance collapse to overflow), arc timeline (horizontal scroll with snap, 48px min-width per segment), drawer (full-width), sender attribution (stacked columns).
- **Screen-reader semantics** per §22.3 -- timeline as `<ol role="list">`, segments as labeled `<button>`s with `aria-describedby`, drawer as labeled region with focus management, sender attribution as labeled `<div role="group">`.
- **Prompt-injection-via-screenshot** -- no special-case chrome required per §20.3.4; preview-confirm renders adversarial-injection-style turns verbatim alongside legitimate turns. Engine-side defense (SECURITY block) verified by phase 5 fixture corpus, not by phase 4 qa.

## 26. What this extension does NOT do

- Does not add a typology, sub-typology, bright-line, or threshold. The 7 new L3 entries (`arc:*` + `cadence:*`) are render labels for the closed-set vocabulary committed in memo §4; no new typology in scope here.
- Does not change Stage 0 output contract or per-turn schema. The schema is committed in memo §3 + §6; this extension consumes it.
- Does not commit a `parse_confidence` warn/fail threshold value. Memo §6.2 names the field; phase 5 fixtures calibrate the threshold. This extension commits 0.85 as the spike-report-recommended starting point for the display-rule's surface-vs-suppress decision; the display rule (error-only suppression) works at any threshold value.
- Does not edit `src/`, `tests/`, `scripts/`, `agents/`, or any FAF policy / enforcement / threat-model / parallel-tracks / quickstart doc. This extension is doc-only.
- Does not change the existing chrome of sections 2.1-2.8 or §§9-17. The disposition banner, reasoning summary, classification envelope, triggered-by block, evidence panel, stage trace, degraded chip, loading state, and classifier-display chrome all render unchanged when `input.kind === "conversation"`; only the conversation-specific extensions in §§19-21 add new chrome.
- Does not respec the disposition-tier-icons.md a11y patterns. References them; does not duplicate.
- Does not commit an L1 / L2 prose-label dictionary (the deferred work flagged in §2.3) or change the existing L3 chip variants. The two new L3 categories use the existing L3 chip grammar; no new chip color or shape introduced.
- Does not surface a "this turn might be a prompt injection" badge or other detection-side UI for adversarial inputs (per §20.3.4). The SECURITY-block + preview-confirm step are the v1 defenses; phase 5 fixture work may surface a need for active per-turn warning chrome and the spec can extend later.
- Does not commit URL-shareable conversation result links (per §19.4). Conversation content is too large for URL state in v1; the result URL persists mode only, not content.
- Does not specify multi-screenshot stitching, conversation history persistence, or cross-conversation deduplication. All out of scope for v1 per scoping memo §4.6.

---

# v5 mobile UX cluster fixes (phase 1 of ux-cluster-mobile-fixes goal)

**Extension date:** 2026-05-28
**Extension author:** design track (Cowork)
**Status:** spec, ready for the vscode phase 2 dispatch
**Goal:** `ux-cluster-mobile-fixes` phase 1 (design spec for three live-mobile UX issues)
**Originating brief:** `handoff/board/pending/0033-ux-cluster-conversation-mobile-tooltip-buttons-overflow.md` (promoted to `handoff/board/tracks/design/CURRENT_design.md` 2026-05-28; architect-direct routing)
**Predecessor audit:** `docs/qa/audits/2026-05-27-live-v5-classifier-display-native-mobile.md` (P1-E real-device-audit recommendation -- the methodological gap this cluster confirms empirically)
**Evidence:** Steven's 2026-05-27 manual native-mobile pass on https://safeeval.vercel.app surfaced three independent issues (tooltip clipping, three-icon button stack, L3 chip overflow) on real mobile hardware that constrained-width emulation had missed. The cluster is the empirical-evidence cost of not running path-B real-device audits.
**Precedent shape:** §§19-26 above (conversation-evaluation phase 2 extension) and §§9-17 (classifier-display phase 2 extension). Same single-file pattern, same authoring-time-vs-production-time contrast methodology (§12.1 + §22.1), same §-alternatives discipline.

This extension layers onto sections 1-26 above. It commits the display half of the `ux-cluster-mobile-fixes` goal: how the tooltip render position escapes parent-container stacking-context bounds (issue 1), how the per-turn-card affordance pattern at <768px reconciles with §22.2's already-committed overflow-menu shape (issue 2), and how the L3 chip strip at narrow viewports stops overflowing the Classification card's right edge (issue 3).

## 28. Tooltip portal escape pattern (issue 1)

**Problem.** Tooltip on a first-in-component chip (representative case: PROCESS FLAGS section, TEMPLATE row, `script_or_dialogue` chip; same failure mode for any first-row chip in a card whose previous sibling is another card with its own background fill) renders with the pointer triangle visible but the tooltip body clipped behind the previous card. Live reproduction: bottom-anchored tooltips extending upward into the previous card's territory are clipped by the parent card's stacking context (or by a parent with `overflow: hidden` / `overflow-x: clip` set for chip-strip wrap or rounded-corner clipping).

**Root cause (high confidence).** Tooltip is rendered inside the chip's parent DOM subtree. Any ancestor with `overflow` set to anything other than `visible`, or any ancestor establishing a new stacking context (z-index, transform, filter, will-change, etc.) at or below the tooltip's render depth, clips or reorders the tooltip body relative to the previous card. The card-to-card gap is small enough (~12-16px) that even modest tooltip heights (~64-96px) project above the chip's bounding box into the previous sibling card's painted region.

### 28.1 Decision -- React-portal the tooltip body to `document.body`

**Committed pattern: portal.** The tooltip's positioning trigger remains anchored to the chip element (so the pointer triangle still tracks the chip), but the tooltip's rendered DOM lives under `<body>` via `ReactDOM.createPortal(tooltipNode, document.body)`. Portaling removes the tooltip from every ancestor's stacking context and overflow bounds; the only clipping surface left is the viewport itself.

**Positioning contract.** The tooltip's `position: fixed` (or `position: absolute` with `top` / `left` computed against the document, not the parent) is set from the chip's `getBoundingClientRect()` at open time, recomputed on scroll and on resize. The pointer triangle position is computed from the chip rect minus the tooltip rect (chip-center-X minus tooltip-left, clamped to the tooltip's horizontal bounds so the triangle never points outside the body). Direction (above vs below the chip) is chosen at open time: prefer above (the existing default), fall back to below if `chipRect.top - tooltipHeight - 8 < 0` (the tooltip would clip above the viewport). The 8px is a safety margin above the OS chrome.

**Z-index.** Tooltip element gets `z-index: 50` (or whatever the existing tooltip z-index is in the codebase -- vscode greps and matches). Portaled tooltips do not need to compete with parent z-index; the portal target is the body, so any z-index >= 1 is visible above siblings of the chip's parent.

**Scroll / resize re-anchoring.** Open tooltip listens to `scroll` (capture-phase, on `window`) and `resize` events; recomputes `top` / `left` from a fresh `chipRect`. Cleanup on tooltip close. This is the standard floating-element pattern.

**Animations / transitions.** Portal-rendered tooltips support the same enter / exit transitions as inline-rendered tooltips. CSS transitions on `opacity` and `transform: translateY()` are unaffected by the portal target. If the existing chip-tooltip pattern uses a CSS transition, preserve it; if it uses Framer Motion or another animation lib, ensure the animation target node is the portaled element, not the chip.

### 28.2 Alternatives considered and rejected

**Alternative A -- auto-flip tooltip direction when above-clip detected (Popper / floating-ui pattern).** When the tooltip would clip above (or above the previous card's painted region), flip to render below the chip instead. Tools like `@floating-ui/react` provide this as a one-line middleware (`flip()`). Rejected because: (a) the clip is not symmetrical -- a tooltip rendered below the chip can still be clipped by the *next* card if there is one (same parent-stacking-context bug, just on the other side); flip moves the problem, doesn't solve it; (b) adds a runtime dependency (`@floating-ui/react` or a similar lib) for a problem that `createPortal` solves with zero net dependencies (React already includes `react-dom`); (c) the chip + tooltip pair becomes harder to reason about visually because direction is dynamic per render and depends on chip's vertical position relative to viewport, which makes screenshots and a11y testing context-dependent.

**Alternative B -- always render below for first-in-component items.** Hard-code "first-row-in-card-body" chips to render their tooltip below. Rejected because: (a) requires detecting "first in component" at render time -- the chip component doesn't have that context without prop-drilling or DOM-walking; (b) doesn't solve the general case (a chip at the bottom of one card with a tooltip rendered below clips into the next card's territory); (c) introduces a special case that future audits will keep finding edge cases for. Portal is the principled fix.

**Alternative C -- remove the inter-card gap or set `overflow: visible` on the card-body ancestor.** Rejected because: (a) the gap is load-bearing visual rhythm; removing it produces a denser, harder-to-scan card stack; (b) `overflow: visible` on every card ancestor would break legitimate clipping behaviors (chip-strip wrap with rounded corners, drawer expand-collapse animations). Local fix that breaks global invariants.

### 28.3 DOM verification contract

Portal correctness is verifiable in the DOM. Phase 2 vscode and phase 3 qa both check:

```
document.querySelector('[data-tooltip-content]').parentNode === document.body  // true when portal correct
```

(or whatever testid / attribute the implementation uses to mark the tooltip body). If the parent of the rendered tooltip body is anything other than `<body>`, the portal is misconfigured.

### 28.4 Acceptance gates (phase 2 vscode)

- Tooltip on `script_or_dialogue` chip (and any first-in-component chip) renders fully visible at 375 / 414 viewports; tooltip body is not clipped by the previous card's painted area.
- DOM check: tooltip body's parent is `<body>` (portal correct).
- Pointer triangle still tracks chip horizontal center, clamped to tooltip horizontal bounds.
- Direction-flip on viewport-edge collision still works (above by default, below when `chipRect.top - tooltipHeight - 8 < 0`).
- Scroll / resize re-anchoring works (open tooltip stays anchored to chip during page scroll).
- Existing tooltip a11y semantics preserved (`aria-describedby` linking chip to tooltip body, focus management, keyboard dismissal per §12.2).

## 29. Per-turn-card affordance pattern at <768px -- §22.2 adjudication (issue 2)

**Problem.** Preview-confirm step's per-turn cards stack `+` / `×` / `+` icons vertically along the right edge at mobile widths. Three failure modes (per brief): (a) `+` and `×` visually too similar at mobile icon size; (b) two `+` symbols both add a turn -- top-`+` of turn N equals bottom-`+` of turn N-1; (c) no direction affordance.

**Brief's adjudication call.** Two paths defensible:
- **(a) Honor §22.2 as-spec'd** -- vscode implements the overflow menu (more work, semantically richer pattern, button stack drops below the breakpoint entirely).
- **(b) Adjudicate §22.2 was over-engineered** -- keep the inline button stack but reduce to 2 icons (drop top-`+`, keep bottom-`+`, restyle `×` as red destructive). Amend §22.2 to match.
- **(c) Different shape** -- propose if (a) and (b) both feel wrong.

### 29.1 Decision -- honor §22.2 (path (a))

**Committed:** §22.2's three-vertical-dots overflow-menu pattern is the right answer. Vscode phase 2 implements §22.2 as originally specified. §22.2 text stands unchanged; no §22.2 amendment is required.

### 29.2 Defense

1. **§22.2 already solves the three failure modes directly.** The overflow-menu collapses three icon-buttons into one button (the three-dots affordance), opening a popover with three **text-labeled** menu items: "Delete", "Insert turn above", "Insert turn below". Every failure mode the brief names is dissolved: (a) `+`/`×` icon collision is gone because the inline icons are replaced by a single more-actions button; (b) duplicate-`+` confusion is gone because the menu items are explicitly directional; (c) direction affordance is explicit in the text label, not implied by icon position.

2. **Path (b) preserves the failure-mode shape, just smaller.** Reducing to two inline icons (`+` and red `×`) still leaves: an icon-only affordance with no text label; a destructive action distinguished only by color (which fails on color-blindness without an accompanying icon-shape change); ambiguity about whether the `+` inserts above or below; the same low touch-target density that produced the three-icon stack's problems in the first place. Path (b) is a smaller version of the same anti-pattern. The original cluster bug surfaced because icon-only affordances at mobile sizes lose disambiguation; the fix should change the pattern, not shrink it.

3. **The "discoverability cost" of three-dots is industry-standard.** Three-vertical-dots is the canonical Material Design + iOS + Android overflow-menu glyph. Users encountering it on a per-turn card will read it as "more actions" without instruction. The brief flagged this cost as the reason to prefer path (b); on reflection, this is a misweighted concern -- three-dots is more discoverable than two unlabeled icons whose meanings differ only by color.

4. **§22.2 was over-implementation cost, not over-design.** The brief implies §22.2 was over-engineered. It was not -- it was correctly specified and never implemented. The cluster bug exists because §22.2 was treated as deferred work; the cluster is the bill coming due for that deferral. Honoring §22.2 in vscode phase 2 closes the deferral, not adds new scope.

5. **No spec churn.** Path (a) leaves §22.2 verbatim; the lockstep gate, the §22.2 cross-reference in §25 (phase 3 vscode handoff checklist), and the §22.2 reference in §25.1 (qa acceptance criteria) all continue to read the same way. Path (b) would force amendments to §22.2 text + §25 item 6 + §25.1 mobile-reflow bullet + §22.4 acceptance gates + a new §18 amendment log entry explaining the reversal -- a non-trivial cross-section ripple for a strictly-worse pattern.

### 29.3 Implementation spec (extends §22.2 verbatim; reproduced here for vscode phase 2 clarity)

Per §22.2: "At <768px, the per-turn-card affordances (Delete, Insert above, Insert below) collapse from icon-buttons-in-top-right to a single overflow menu button (three vertical dots) opening a small popover with all three actions."

Additional implementation guidance for phase 2 (not amending §22.2; clarifying):

- **Glyph.** Three vertical dots (Unicode `⋮` "vertical ellipsis" rendered as text, OR an inline SVG of three 4px circles stacked with 4px gaps -- vscode picks; both render identically at standard zoom). Touch target >= 44x44px per Apple HIG and WCAG SC 2.5.5 AAA; the visible glyph is centered in the touch area.
- **Position.** Top-right of each per-turn card, replacing the icon stack. Same vertical alignment as the desktop icon-stack's top-right anchor (no layout shift between breakpoints; the icon stack hides at <768px, the dots button shows).
- **Popover contents.** Three items, in this order:
  1. `Insert turn above` (icon: `↑+` or just the text label; vscode picks)
  2. `Insert turn below` (icon: `↓+` or just the text label; vscode picks)
  3. `Delete this turn` (visually destructive -- red text OR red icon; vscode picks, but must clear the §22.1 / §12.1 contrast methodology -- see §29.4 below)
- **Popover positioning.** Opens below the dots button by default; flips above if `dotsRect.bottom + popoverHeight > viewportHeight - 8`. Same direction-flip pattern as the §28 tooltip portal (and the popover MAY be portaled to body for the same parent-stacking-context reasons -- vscode's call; if the per-turn-card ancestor chain doesn't have a clipping parent, inline is fine).
- **Dismiss.** Tap outside the popover; tap the dots button again; Escape key. Focus returns to the dots button on dismiss.
- **Aria.** Dots button: `role="button" aria-label="Turn {i} actions" aria-haspopup="menu" aria-expanded={open}`. Popover: `role="menu" aria-label="Turn {i} actions"`. Each item: `role="menuitem"`.

### 29.4 Destructive-action contrast methodology

Per §22.1 (and §12.1's underlying methodology): if the Delete menu item uses red text or a red icon, the implementation MUST live-measure `getComputedStyle(deleteItem).color` against `getComputedStyle(popover).backgroundColor` and verify the ratio against the WCAG 2.1 SC 1.4.3 AA threshold (4.5:1 for normal text, 3:1 for large text >= 18px or 14px-bold). Suggested starting tokens (preliminary estimates only, phase 3 qa live-verifies):

| Surface | Background (token) | Foreground (token) | Hex-estimated ratio | AA threshold | Notes |
|---|---|---|---|---|---|
| Delete menu item text | `bg-white` (popover) | `text-red-700` (`#b91c1c`) | ~5.9:1 | 4.5:1 | Estimated above AA |
| Delete menu item text | `bg-white` (popover) | `text-red-600` (`#dc2626`) | ~4.8:1 | 4.5:1 | Estimated close to AA -- live-verify |
| Delete menu item icon stroke | `bg-white` (popover) | `stroke-red-600` (non-text, SC 1.4.11) | ~4.8:1 | 3:1 | Above non-text-contrast |

Phase 3 qa live-measures and either confirms or triggers a §18 amendment-log entry per §22.1 protocol.

**Non-color affordance for the destructive action (per §12.5 non-color-affordance principle).** The Delete item MUST carry a non-color signal in addition to red color -- the text label "Delete this turn" already provides this (the verb "Delete" is the disambiguator), so the requirement is met. If vscode chooses an icon-only treatment for the Delete item, an icon shape that reads as destructive without color (e.g., a trash-can SVG glyph) is required; do not rely on color alone to communicate destructiveness.

### 29.5 Acceptance gates (phase 2 vscode)

- Per-turn cards at <768px render a single three-dots button in the top-right, not the three-icon stack.
- Tapping the dots button opens a popover with three labeled items (Insert turn above / Insert turn below / Delete this turn), in that order.
- Delete item carries non-color affordance (text label "Delete" present; color is supplementary, not load-bearing).
- Popover dismisses on tap-outside, tap-dots-again, Escape. Focus returns to dots button.
- Aria: `aria-label`, `aria-haspopup="menu"`, `aria-expanded`, `role="menu"` + `role="menuitem"` per §29.3.
- Touch target >= 44x44px for the dots button; >= 44px height for each popover item.
- At >=768px, the existing desktop icon-stack pattern continues to render unchanged (no regression).

### 29.6 Grep-before-template-inherit note (per memo §5.7)

Vscode phase 2 MUST grep `src/app/page.js` (and any extracted component files) for other instances of inline icon-stack patterns that mimic the per-turn-card shape. Reproduce the grep result in the archive's `Notes back`. The grep should look for: `<button` elements containing only single-character glyphs (`+`, `×`, `−`, `↑`, `↓`) without accompanying text labels; stacks of two-or-more such buttons; flex columns of icon-buttons inside a card edge. Apply the same overflow-menu treatment if any sibling pattern is found, or document why it should remain as-is.

## 30. L3 chip overflow at narrow viewports -- Classification card mobile reflow (issue 3)

**Problem.** At 375 / 414 viewport widths, the §2.3 Classification envelope's L3 row renders long underscored labels (`payment_fraud_enablement`, `deceptive_effectiveness_requested`, `payment_instruction_embedded`, `money_laundering_overlap`, `specific_victim_targeted`, etc.) inside chip elements that exceed the available chip-row width. `white-space: nowrap` on the chip prevents intra-chip wrapping; `flex-wrap: wrap` on the chip row prevents row-overflow but individual oversized chips still overflow the card's right edge into the gutter.

**Root cause (high confidence).** The current L3 layout is a label/value column pair: the L3 category name (METHOD, TACTIC, TARGET, OVERLAP, RISK MARKER, CONTEXT MARKER) on the left in a fixed-width column, chips on the right in the remaining flex-1 column. At narrow viewports the chip column is too narrow to accommodate any single chip whose label is > ~24 characters; `nowrap` forces the chip to its full natural width which exceeds the column.

### 30.1 Decision -- vertical stack at <768px with overflow-wrap on chips

**Committed pattern.** At <768px, restructure the §2.3 L3 row layout so the L3 category name stacks **above** its chips full-width, and the chip row uses the full card-interior width below the label. Chips wrap to multiple lines as needed; individual chips with long underscored labels MAY break mid-label via `overflow-wrap: anywhere`. Confidence percentage stays attached to its chip (rendered as a suffix inside the chip element or as a sibling sub-chip; existing pattern preserved).

**Defense.**

- **Aligns with §13.1 precedent.** §13.1 already commits to "vertical stack per row" at <768px for the §10.2 prompt-summary rows (field-label on its own line; classifier-label chip on the next line; companion content on the third line). The §2.3 L3 row at <768px is the same shape: category-name on one line; chip row on the next; trivial extension of the §13.1 pattern.
- **Industry-standard mobile pattern.** Vertical stacking of label/value pairs at narrow widths is the default mobile pattern for definition lists, key/value displays, and form labels. Reader-friendly; well-understood.
- **`overflow-wrap: anywhere` is the right escape valve.** The underscored L3 labels (e.g., `payment_fraud_enablement`) are pseudo-tokens, not natural-language words; mid-label breaking does not damage readability the way mid-word breaking of English prose would. Underscores already signal "this is a code value," and breaking at any point preserves the underscore-form pattern. `anywhere` is appropriate here precisely because the labels are structured-enum values, not prose.
- **Wrap-multiline preferred over horizontal-scroll.** Horizontal scroll on the chip row would hide chips off-screen and break at-a-glance discoverability of all L3 tags on a turn. Wrap-multiline keeps every chip visible (the load-bearing property of the L3 row -- the reader needs to see all tags simultaneously).

### 30.2 Implementation spec

```
At >=768px (existing desktop layout):
  [METHOD]          [chip] [chip] [chip] [chip]...

At <768px (new mobile layout):
  METHOD
  [chip] [chip] [chip]
  [chip] [chip]
```

CSS contract:

- **Category-name container.** At <768px: `display: block`; full card-interior width; left-aligned; same typography as desktop (small-caps or uppercase tracking; existing pattern -- vscode greps and matches the §13.1 field-label treatment for visual consistency); ~4-6px vertical gap before the chip row begins.
- **Chip row container.** At <768px: `display: flex`; `flex-wrap: wrap`; `gap: 6px` (vertical and horizontal); `width: 100%` (full card-interior width minus card padding); `min-width: 0` (allows children to shrink).
- **Chip element.** At <768px: `max-width: 100%` (prevents individual chips from forcing horizontal scroll); `overflow-wrap: anywhere` (allows mid-label breaking for oversized tokens); `white-space: normal` (overrides the desktop `nowrap`); existing chip background / border / typography preserved.
- **Confidence percentage suffix.** Inside the chip element, after the underscored label; rendered as a smaller, lighter-weight text fragment per existing pattern. Stays glued to its chip via the chip element's own flex layout (no separate wrap point).

**Tailwind utilities (vscode picks specific class names; this is the shape):**

```jsx
// Wrapper (existing -- gains md:flex-row at >=768px or stays as-is if already correct)
<div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-3">

  // Category-name (existing -- gains md:w-* if a fixed desktop column width was used)
  <div className="text-xs uppercase tracking-wider text-slate-600 md:w-24 md:flex-shrink-0">
    METHOD
  </div>

  // Chip row (existing -- gains min-w-0 and flex-wrap if not already set)
  <div className="flex flex-wrap gap-1.5 min-w-0 w-full md:w-auto md:flex-1">
    {chips.map(chip => (
      <span className="... break-words [overflow-wrap:anywhere] max-w-full whitespace-normal ...">
        {chip.label} <span className="opacity-70 ml-1">{chip.confidence}%</span>
      </span>
    ))}
  </div>

</div>
```

The exact class strings are vscode's call; the shape above commits the contract. Match the §13.1 prompt-summary vertical-stack visual rhythm (12px row gap; field-label sizing; chip wrap pattern) so the §2.3 L3 mobile layout reads as a sibling pattern, not a new one.

### 30.3 Alternatives considered and rejected

**Alternative A -- horizontal scroll on the chip row.** Set `overflow-x: auto` on the chip row, keep `nowrap` on chips. Rejected: hides chips off-screen, breaks at-a-glance discoverability of all L3 tags. The L3 row's load-bearing property is "see all tags on this turn simultaneously"; horizontal scroll defeats it.

**Alternative B -- truncate chip text with ellipsis + tap to expand.** `text-overflow: ellipsis` on each chip with a fixed max-width; full label revealed on tap. Rejected: introduces a new interaction layer (tap-to-reveal) on top of the existing tap-for-tooltip pattern (§13.5), which is a discoverability and a11y mess (which tap does what?). Also damages screenshot-readability and copy-paste UX.

**Alternative C -- shorten the L3 labels in a display-label dictionary.** Per §2.3's note on prose-label dictionaries: rejected. §2.3 explicitly commits to rendering the underscore-form verbatim ("the L1 / L2 vocabulary is the load-bearing concept v5 is presenting, and obfuscating it under a prose layer trades audit-readability for friendliness"). The same argument applies to L3. The fix is layout, not vocabulary.

**Alternative D -- reduce chip padding and font size at <768px.** Shrink chips to fit more per row. Rejected: damages touch-target size (§22.1 / WCAG SC 2.5.5 requires 24x24 AA minimum, ideally 44x44); and the underscored labels still exceed any reasonable chip width even at smaller fonts. Cosmetic tweak that doesn't solve the underlying overflow.

### 30.4 Acceptance gates (phase 2 vscode)

- At 375 / 414 viewports, every L3 chip is fully visible inside the Classification card's painted area; no chip extends past the card's right edge into the gutter.
- L3 category names (METHOD, TACTIC, TARGET, OVERLAP, RISK MARKER, CONTEXT MARKER) stack above their chips at <768px.
- Chip row wraps to multiple lines as needed; chips with long underscored labels (>= 24 characters) break mid-label via `overflow-wrap: anywhere` cleanly.
- Confidence percentage suffix stays attached to its chip (no separate wrap point between chip-label and confidence).
- At >=768px, the existing desktop label-on-left / chips-on-right layout continues to render unchanged.
- §13.1 vertical-stack visual rhythm matched (no two-sibling-pattern drift).

## 31. Cross-cutting -- §22.2 amendment status

Per §29.1: §22.2 stands unchanged. This cluster honors §22.2 as-spec'd rather than amending it. No §22.2 text edit is required for vscode phase 2; vscode implements §22.2's already-committed overflow-menu shape.

If a future audit reverses this adjudication (e.g., phase 3 qa finds the overflow-menu has discoverability problems severe enough to revisit), the reversal lands as a new §18 amendment-log entry and a §22.2 edit in-place; for now, §22.2 holds.

## 32. Methodology gap acknowledgment -- path-B real-device audits

All three cluster issues were missed by the 2026-05-27 native-mobile audit's emulation tooling and surfaced only on Steven's real-device pass. The 2026-05-27 audit (`docs/qa/audits/2026-05-27-live-v5-classifier-display-native-mobile.md` P1-E) explicitly flagged this gap and recommended path-B real-device audits as a follow-up. This cluster is the empirical cost of not running them.

Phase 2 vscode's qa re-audit (qa-required: true per the brief) SHOULD be path-B (real-device) where possible. Chrome MCP at 375 / 414 is the next-best fallback, but as the cluster demonstrates, emulation under-detects mobile-stacking-context, mobile-touch-target, and mobile-overflow issues. The qa re-audit's verdict on whether path-B was used (and what it caught that path-A would have missed) feeds the tracks-architect retro on the path-B recommendation.

## 33. What this extension does NOT do

- Does not change tooltip *content* (§2.3 / §13.5 / §22.3 tooltip-descriptor copy unchanged). Only render position / portal target / direction-flip behavior.
- Does not amend §22.2 text (the §22.2 overflow-menu pattern is honored, not changed). See §29 / §31.
- Does not introduce new icon libraries, new chip variants, new color tokens, or new typography. All chrome reuses existing tokens; vscode picks specific Tailwind class strings.
- Does not commit live-measured WCAG ratios for the new chrome (destructive Delete-item color). §29.4 lists preliminary estimates only; phase 3 qa live-measures per §22.1 / §12.1 protocol.
- Does not edit `src/`, `tests/`, `scripts/`, `agents/`, or any FAF policy / enforcement / threat-model / parallel-tracks / quickstart doc. Doc-only.
- Does not add new typology, sub-typology, bright-line, threshold, or L3 vocabulary. UX-only.

## 34. Phase 2 vscode handoff checklist (extends §§5 + 16 + 25 precedent)

Single bundled commit if scope allows; split if not (acceptable split: issue 1 tooltip-portal in one commit; issues 2 + 3 layout-only in a second commit). Per CLAUDE.md venue-boundary rules, vscode owns the implementation; design owns this spec.

**Item 1 -- Tooltip portal refactor (issue 1).** Surface: chip-tooltip component (likely `ClassifierLabelChip` or `HoverChip` per §13.5 reference). File: `src/app/page.js` or extracted component. Apply `ReactDOM.createPortal(tooltipNode, document.body)` per §28.1. Preserve pointer-triangle positioning, direction-flip, scroll/resize re-anchoring, a11y semantics. DOM verification per §28.3.

**Item 2 -- Per-turn-card overflow-menu (issue 2 / §22.2 implementation).** Surface: preview-confirm step's per-turn card. File: `src/app/page.js` or extracted component (likely `PreviewTurnCard` or similar). At <768px: hide the existing icon-button stack; render a single three-vertical-dots button per §29.3; tap opens popover with three labeled items (Insert turn above / Insert turn below / Delete this turn). At >=768px: existing icon-stack pattern unchanged. Aria + dismiss + focus management per §29.3 / §29.5.

**Item 3 -- Destructive Delete-item contrast verification (issue 2 / §29.4).** Live-measure `getComputedStyle` for the Delete menu item's color against popover background. If below 4.5:1, bump token (e.g., `text-red-600` -> `text-red-700`) per §22.1 protocol and log §18 amendment-log entry.

**Item 4 -- L3 chip mobile reflow (issue 3).** Surface: §2.3 Classification envelope's L3 row. File: `src/app/page.js` (the L3-row rendering block). At <768px: vertical-stack the category-name above the chip row; add `flex-wrap`, `min-w-0`, `overflow-wrap: anywhere`, `whitespace-normal`, `max-w-full` per §30.2. At >=768px: existing layout unchanged. Match §13.1 vertical-stack visual rhythm.

**Item 5 -- Grep-before-template-inherit (issue 2 / memo §5.7).** Grep `src/app/page.js` for sibling inline-icon-stack patterns that mimic the per-turn-card +/× shape. Reproduce grep result in archive Notes back. Apply same overflow-menu treatment OR document why sibling pattern remains as-is.

**Item 6 -- Build + lockstep + ASCII gates.** `npm run build` PASS; `node scripts/check-lockstep.js` PASS; ASCII-safe `.js` per CLAUDE.md.

**Item 7 -- Live verification at 375 / 414 viewports.** Per feedback_live_verification_classifier.md and feedback_live_dom_verification_ui.md: fetch the live deploy at https://safeeval.vercel.app, evaluate a representative prompt that exercises all three surfaces (long-L3-label prompt for issue 3; multi-turn conversation for issue 2; first-row chip with tooltip for issue 1), screenshot or read DOM at 375 / 414, paste evidence into archive Notes back. Live-DOM proxy is acceptable per memory live_dom_verification_ui; real-device verification is the qa phase 3 path-B job.

**Item 8 -- qa re-audit dispatch hint.** Brief carries qa-required: true. After vscode phase 2 archives, qa dispatches a re-audit. The re-audit SHOULD be path-B (real-device) per §32; Chrome MCP at 375 / 414 is next-best fallback. The re-audit verifies all four §28.4 / §29.5 / §30.4 acceptance-gate lists and any phase 4 contrast-amendment per §29.4.

### 34.1 qa acceptance criteria embedded for phase 3 qa to audit

- **Issue 1 (tooltip portal):** tooltip on `script_or_dialogue` chip and any first-in-component chip fully visible at 375/414; tooltip body's DOM parent is `<body>` (portal correct).
- **Issue 2 (overflow-menu):** per-turn cards at <768px render single three-dots button (not icon stack); popover opens with three labeled items in spec order; Delete item carries non-color affordance + clears 4.5:1 contrast live-measured.
- **Issue 3 (L3 chip reflow):** L3 chips at 375/414 fully inside card painted area; category names stack above chips; long underscored labels break mid-label cleanly via `overflow-wrap: anywhere`.
- **Methodology:** path-B real-device audit preferred; path-A emulation noted as known-insufficient per the cluster's empirical evidence.
- **WCAG SC 1.4.3 (text contrast) + SC 1.4.11 (non-text contrast) + SC 2.5.5 (target size 24x24 AA) + SC 2.5.5 AAA aspiration (44x44):** all four checks live-measured against the post-fix deploy.

---

## 27. Conversation-mode example pill row (extends §20, conversation-mode-only)

**Extension date:** 2026-05-28
**Originating dispatch:** `conversation-eval-example-pills` phase 1 of 3-track parallel dispatch (design track brief `handoff/board/tracks/design/CURRENT_design.md`).
**Companion tracks:** policy curates scenarios + labels (`docs/memos/2026-05-28-policy-conversation-example-scenarios.md`); vscode builds plumbing against this spec's §27.4 click contract + §27.8 acceptance criteria.
**Scope discipline:** UI shape only -- content-agnostic. Policy owns the curated scenarios + label strings; this section commits the pill-row shape vscode implements against. Single-file extension (no fork) per the §23 precedent.

### 27.1 Purpose

Render a row of click-to-load example pills inside the conversation-mode input UI (§20). Each pill, when activated, loads a pre-canonicalized `turns[]` array directly into the preview-confirm state defined in §20.3, bypassing Stage 0 (parser invocation) and the image-upload path entirely. The pill row is a sub-modality-aware shortcut for the text sub-modality (§20.2) -- never image (§20.1) -- and it must NOT render in prompt mode.

Cross-reference: this section couples to §20.2 (text upload sub-section), §20.3 (preview-confirm step), §20.4 (sender canonicalization), and §19 (mode-switch state). The pill-row content shape (`{label, turns}` per §27.3) is the wire policy + vscode integrate against in the post-track wire-up step.

### 27.2 Positioning and visual style

**Positioning -- inside the text sub-modality input region, above the textarea (committed).**

The pill row sits inside the conversation-mode input region, scoped to the text sub-modality (§20.2). Concretely: when `mode === 'conversation'` AND `subModality === 'text'`, the pill row renders as the first child of the text-input card, above the helper label ("Paste a conversation, one turn per line, with sender labels") and above the textarea itself. The row does NOT render when `subModality === 'image'` (the image sub-modality's drop zone is the focal affordance and a pill row would compete with it).

**Defense for "above the textarea" placement:** the prompt-mode pill row (`src/app/page.js` lines 1992-2004) sits below the textarea, sharing the row with the Evaluate button. That placement is acceptable in prompt mode because the textarea is short (`h-36`, ~9 lines) and the pill row is a fallback for users who paste their own content first. In conversation mode the textarea is taller (~10 rows initial height per §20.2) and the user's mental model is "this is going to take work -- give me a starting point" -- the pill row pre-selects the work; placing it above the textarea matches the read order (look at examples, click one, see the loaded content in the preview-confirm step). The placement also keeps the pill row visually adjacent to the sub-modality segmented control (§20.2 "Sub-modality selection"), reinforcing that the pills are a text-sub-modality affordance.

**Visual style -- option (a): visually identical to prompt-mode pills (committed).**

Same chrome as `src/app/page.js` lines 1995-2003: `flex flex-wrap gap-2` container, each pill a `<button type="button">` with `text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors`. No new chip color, no border accent, no leading icon.

**Defense for visual identity over visual differentiation (option a over option b):** the pills do the same thing semantically -- "load a curated example into the input region" -- in both modes. Differentiating with chip color or border accent would suggest a different *kind* of affordance, when the affordance is the same shape with different payload (text string in prompt mode; `turns[]` array in conversation mode). The render guard in §27.7 (`mode === 'conversation'`) already ensures the two pill rows are never visible at the same time, so visual differentiation cannot disambiguate -- a user only ever sees one. A second argument: the v5 chrome has resisted introducing new chip colors throughout (§24.3 "no new chip variant" precedent for conversation L3 chips). Visual differentiation here would set a precedent for future "this pill is special" chrome that breaks the established chip vocabulary. Alternatives B + C in §27.9 cover the differentiation path; option (a) wins on consistency.

### 27.3 Pill structure (shape contract for vscode + policy)

Each pill is an object of the shape:

```
{
  label: string,     // 2-4 words, terse, typology-identifying; see §27.3.1
  turns: [           // pre-canonicalized array; loaded verbatim into preview-confirm state
    {
      sender: string,    // canonical sender per §20.4 (Me / You / Alice / __user__ / etc.)
      text: string,      // turn content verbatim
      timestamp: string  // optional; ISO 8601 or empty string
    },
    ...
  ]
}
```

The constant is exported from `src/app/page.js` as `EXAMPLE_CONVERSATIONS` (naming mirrors the existing `EXAMPLE_PROMPTS` const at line 26). Policy supplies the array contents (4-5 scenarios per policy track's deliverable); vscode imports the const and renders the row. No new fields beyond `{label, turns}` -- timestamp is optional inside each turn but `parse_confidence` / `parse_warnings` / `modality_hint` are NOT part of the pill payload (the click contract in §27.4 skips Stage 0 entirely, so those Stage-0-output fields are inapplicable).

**§27.3.1 Label copy convention.**

- **Length:** 2-4 words. Hard cap at 4 words; soft cap at 3 (prefer 2-3 where possible).
- **Case:** Title Case (matches existing prompt-mode pill convention -- e.g., `Romance / Pig Butchering`, `BEC / Executive Impersonation`).
- **Content:** typology-identifying, no verbs. The label answers "what kind of conversation is this?" -- not "what does clicking do?". Examples of the convention: `Romance / Pig Butchering`, `Marketplace Impersonation`, `Tech Support Scam`, `Recovery Scam`. Examples of what to avoid: `Click for romance scam` (verb), `A long-running romance scam with a fake widow` (too long), `romance` (too terse, lowercase).
- **Slash separator allowed:** `/` is the existing convention for compound labels (`Romance / Pig Butchering`, `BEC / Executive Impersonation`). Use sparingly; one slash per label maximum.
- **ASCII only in labels:** label strings must be ASCII-safe per CLAUDE.md (em dashes -> `--`, smart quotes -> straight). Policy track is on notice.

**§27.3.2 Width / overflow behavior.**

At 2-4 words and rounded-full chrome, pills are typically 80-140px wide at desktop. The `flex flex-wrap` container handles natural wrapping. No `max-width` constraint, no text truncation, no ellipsis: a pill with a 4-word label that exceeds the row simply wraps to the next line. If a label exceeds 4 words (policy MUST cap at 4), the implementation does not need to defend against it -- the convention is enforced by review, not by CSS. (vscode is free to add a soft `max-width: 18ch` defensive style if it wants belt-and-suspenders behavior; not required.)

### 27.4 Click contract (the wire vscode implements against)

On pill activation (click or keyboard Enter / Space):

1. **Set the preview-confirm state from the pill payload.**
   - Set `convTurns` (or whatever §20.3 state holder vscode chooses; the brief names `convTurns`) to a deep clone of `pill.turns`. Deep clone, not reference -- the user may edit the preview-confirm cards and edits must not mutate the constant.
   - Set sub-modality state (`subModality`) to `'text'`. If the user was on `'image'` when they clicked, the click flips them to text first.
   - Set the Stage 0 phase indicator to "done" / skip-state (whatever state shape vscode uses to gate the preview-confirm render after Stage 0 completes). The preview-confirm cards must render immediately on click; no spinner, no parse step.

2. **Skip the parser. Skip image upload.**
   - Do NOT call `parseConversationImage` / `parseConversationText` / any Stage 0 invocation. The turns are pre-canonicalized.
   - Do NOT mount the image drop zone (§20.1) or trigger a file picker.
   - Do NOT issue any `fetch` for Stage 0; do not wire an AbortController for this path.

3. **Clear prior state explicitly.**
   - `imageBase64` -> `null` (any prior image upload is discarded).
   - `convText` -> `''` (any prior pasted text is discarded).
   - `parseWarnings` -> `[]` (any prior parser warnings are discarded).
   - `parseConfidence` -> `null` (no Stage 0 ran; field is inapplicable).
   - `parsedTurns` -> set to the deep clone from step 1 (this is the canonical pre-canonicalized payload).
   - Any in-flight Stage 0 `fetch` -- if a parse is mid-flight when the user clicks a pill, abort it via the existing AbortController (§20.1 spec).
   - Any prior preview-confirm edits the user made (turn deletions, sender re-labels) -- discarded. The pill click is a "reset and load" affordance, not a "merge" affordance.

4. **Land the user at the preview-confirm step.**
   - After the state writes above, the conversation-mode input region must render the preview-confirm chrome (§20.3) with all N turns visible. The page should NOT show: an empty textarea, the image drop zone, the sub-modality switcher between image and text. The sub-modality switcher MAY remain visible above the preview-confirm chrome with `'text'` selected (per §27.7).
   - The browser viewport must scroll the preview-confirm region into view if it is below the fold. Implementation: `previewConfirmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })` after the React state writes flush.
   - Focus management: programmatic focus moves to the preview-confirm region's first focusable element (typically the first turn card's sender field, or the Confirm CTA if the sender field is non-interactive in v1). See §27.5 for the ARIA / SR contract.

5. **Sender canonicalization is pre-applied.**
   - Policy is responsible for emitting `turns[].sender` already canonicalized per §20.4 (e.g., `Me` / `You` / named senders). The pill click does NOT re-run §20.4 mapping; the labels in the payload are authoritative. (If the user wants to re-label, they edit the per-turn sender field per §20.3.)
   - `modality_hint` is inapplicable here -- no Stage 0 ran. If `__user__` somehow appears in a `turns[].sender` (a policy authoring bug), the preview-confirm renders it verbatim and the user can edit it. No fallback mapping inside the click handler.

### 27.5 Accessibility

**§27.5.1 Keyboard navigation -- tab order (committed).**

Each pill is a `<button type="button">`. Tab order traverses the pill row in DOM order (left-to-right, top-to-bottom within the flex-wrap). Enter and Space both activate (browser default for `<button>`). No arrow-key intra-row traversal -- defense: the existing prompt-mode pill row uses tab order (no roving tabindex), and conversation mode should not introduce a different keyboard pattern for the same chrome. Roving-tabindex / arrow-key nav is the pattern for `role="tablist"` and `role="toolbar"` (per §19.5 mode-switch + §20.2 sub-modality switcher) where the row members are mutually-exclusive selections; example pills are not mutually exclusive -- the user picks one to load, and the picks are equivalent in kind. Tab-through matches the user's mental model: "browse the options, pick one."

**§27.5.2 Focus ring.**

Each pill must show a visible focus ring on `:focus-visible`. Spec:

- Ring color: `ring-gray-400` (Tailwind), 2px width, 2px offset from the pill edge.
- Ring contrast vs background: against `bg-white` (the input-card background), `gray-400` computes to a 3.13:1 ratio per the v5-result-card §12.1 / §22.1 live-compute methodology -- meets WCAG 2.1 SC 2.4.7 (visible focus indicator, no minimum contrast required beyond "visible") and SC 1.4.11 (non-text contrast, 3:1 minimum -- this passes at 3.13:1).
- Implementation: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2` Tailwind classes.
- Live-compute deferral: per §22.1 methodology, the exact ratio is to be verified via `getComputedStyle` at production time. The 3.13:1 figure here is the design-time estimate using Tailwind's documented `gray-400` token; if production rendering yields a lower ratio (e.g., due to a theme override), phase 5 qa surfaces it per §27.8 and the ring color may step to `gray-500` (4.7:1 estimated). This is the same fallback pattern §22.1 uses for the disposition pill contrast.

**§27.5.3 ARIA.**

- Each pill is a native `<button type="button">`; no `role="button"` override needed.
- The row itself: `<div role="group" aria-label="Example conversations">`. `role="group"` (not `toolbar`, not `tablist`) -- defense: `toolbar` implies a set of mutually-related action controls operating on a target; the pills are equivalent independent shortcuts, not a toolbar. `tablist` implies mutually-exclusive selection state; the pills don't carry selection state (clicking one doesn't visually select it; the state lives in the preview-confirm region). `group` is the loosest correct semantic -- a labeled grouping of related controls -- and matches the WAI-ARIA spec for "a set of user interface objects which are not intended to be included in a page summary or table of contents by assistive technologies."
- Each pill's accessible name is the label text (no `aria-label` override -- the visible text is the name, which matches WCAG 2.5.3 Label in Name).
- No `aria-describedby` per-pill; the row's `aria-label` describes the purpose. Per-pill descriptions would be redundant (every pill does the same thing, just with different payload).

**§27.5.4 Screen-reader announcement on activation.**

When a pill is activated, the preview-confirm region's `<section role="region" aria-label="Preview parsed conversation">` (the chrome §20.3 already specs) receives programmatic focus per §27.4 step 4. The SR announces:

1. The region label ("Preview parsed conversation") on focus entry.
2. A polite `aria-live` announcement on the preview header: "Loaded N turns from example. Please confirm before evaluating." (literal N from `pill.turns.length`).

The `aria-live="polite"` strip is the same chrome §20.3.1 uses for parse-status announcements; the pill click reuses it with a different message. No new live region.

### 27.6 Mobile reflow at 375 / 414

**Wrap behavior:** the `flex flex-wrap` container wraps naturally; no manual viewport breakpoints. With 4-5 pills at 2-4 words each (~80-140px desktop width), the row typically wraps:

- **375px (iPhone SE / smaller):** 2 pills per row, 2-3 rows total for 4-5 pills.
- **414px (iPhone Pro Max / larger):** 2-3 pills per row, 2 rows total for 4-5 pills.

The exact wrap is content-dependent; the design does not force a specific row count. The `gap-2` (Tailwind 0.5rem / 8px) provides legible spacing between pills both horizontally and vertically when rows wrap.

**Touch target size:** WCAG 2.5.5 (target size minimum) requires 24x24 CSS px (2.1 AA) or 44x44 (2.2 AAA). The pill chrome is `px-3 py-1.5 text-xs`. Computed: `text-xs` is 0.75rem (12px) with `leading-4` default ~16px line-height; `py-1.5` is 6px top + 6px bottom -> 28px total height. Width varies but is always >= 60px at 2-word labels.

Computed height of 28px **exceeds the 24x24 AA floor** but **does not meet the 44x44 AAA target**. Defense: the existing prompt-mode pill row uses the identical chrome and ships at the same 28px height; the conversation-mode pill row matches that established baseline for consistency. If phase 5 qa surfaces touch-target friction (mis-taps on mobile), a bump to `py-2` (8px each -> 32px total) or `py-2.5` (10px each -> 36px) is a non-breaking adjustment, and the prompt-mode pills should bump in lockstep to preserve consistency. The 44x44 AAA target is not a blocker for this dispatch; the 24x24 AA floor is met.

**No mobile-specific layout changes.** No "overflow menu" affordance, no horizontal-scroll variant, no collapsed/expanded chrome. Mobile is the same `flex flex-wrap` row.

### 27.7 Conversation-mode-only gating

**Render guard:**

```
{mode === 'conversation' && subModality === 'text' && (
  <div role="group" aria-label="Example conversations" className="flex flex-wrap gap-2">
    {EXAMPLE_CONVERSATIONS.map(...)}
  </div>
)}
```

- **Primary gate:** `mode === 'conversation'`. The pill row MUST NOT render in prompt mode under any circumstance. Prompt mode has its own pill row (`EXAMPLE_PROMPTS` at `src/app/page.js` line 26 + render at lines 1994-2003); the two pill rows are mutually exclusive at the `mode` gate.
- **Secondary gate:** `subModality === 'text'`. The pill row only renders in the text sub-modality (§20.2). In the image sub-modality (§20.1) the drop zone is the focal affordance and the pill row is suppressed.
- **State coupling:** the `mode` state lives at the page level per §19; the `subModality` state lives in the conversation-mode input region per §20.2. The pill row reads both. No new state introduced by §27.

**Verification against §19:** the mode-switch state in §19 is the source-of-truth for `mode`; the §19.4 URL sync (`?mode=conversation`) means a deep-link to conversation mode renders the pill row immediately on page load. Prompt-mode deep-link (`?mode=prompt` or no param) does NOT render the pill row -- the §27.7 gate is sufficient; no additional URL check needed.

**Sub-modality switcher state on click:** per §27.4 step 1, the pill click sets `subModality` to `'text'`. The sub-modality segmented control (§20.2) reflects this via its existing `aria-selected` binding -- no additional chrome write needed. After click, the segmented control visually shows `'text'` as the active sub-modality (committed). Alternative considered: the switcher could be hidden after pill click to emphasize "you've already picked a path"; rejected because the user retains agency to switch back to image upload by clicking the switcher, and hiding the control removes that escape hatch.

### 27.8 Acceptance criteria (testable, for vscode + phase 5 qa)

- **Render gating.**
  - Pill row renders when `mode === 'conversation'` AND `subModality === 'text'`. Verified by toggling mode + sub-modality state and asserting DOM presence.
  - Pill row does NOT render when `mode === 'prompt'`. Verified by loading `/?mode=prompt` (or no param) and asserting `EXAMPLE_CONVERSATIONS` button text is not in the DOM.
  - Pill row does NOT render when `mode === 'conversation'` AND `subModality === 'image'`. Verified by clicking the image sub-modality in the §20.2 switcher and asserting the pill row hides.
- **Click contract (per §27.4).**
  - Clicking a pill sets `parsedTurns` to a deep clone of `pill.turns` (length, sender values, text values match). Verified by clicking each pill and asserting state shape.
  - Clicking a pill sets `subModality` to `'text'` even if `'image'` was active before click (after the §27.7 secondary gate flips visible -- this requires the click handler to set sub-modality first, then the pill row re-renders, then the click resolves; vscode chooses the implementation but the end state is what's tested).
  - Clicking a pill clears `imageBase64`, `convText`, `parseWarnings`, `parseConfidence` to their respective null / empty values.
  - Clicking a pill does NOT trigger a Stage 0 `fetch`. Verified by network-tab inspection or by mocking `parseConversationImage` / `parseConversationText` and asserting zero invocations after click.
  - Clicking a pill lands the user at the preview-confirm region (§20.3) with all N turns visible. Verified by asserting the preview-confirm DOM is present and the turn count matches.
  - Preview-confirm region scrolls into view on click (the user does not have to manually scroll).
- **Accessibility (per §27.5).**
  - Each pill is keyboard-reachable via Tab; Enter and Space activate.
  - Focus ring visible on `:focus-visible`; ring contrast >= 3:1 against the input-card background (live-computed at phase 5).
  - Row element carries `role="group"` and `aria-label="Example conversations"`.
  - On pill activation, the preview-confirm region's `aria-live="polite"` strip announces "Loaded N turns from example. Please confirm before evaluating." (or equivalent verbiage from §27.5.4).
- **Mobile reflow (per §27.6).**
  - At 375px viewport, pills wrap to multiple rows; no horizontal overflow.
  - At 414px viewport, pills wrap to multiple rows; no horizontal overflow.
  - Pill height >= 24px (WCAG 2.5.5 AA floor). Per existing prompt-mode chrome: 28px computed.
- **No prompt-mode leakage.**
  - Loading `/?mode=prompt` does not import or reference `EXAMPLE_CONVERSATIONS` in the prompt-mode render tree. Verified by DOM inspection.
  - Toggling mode prompt -> conversation -> prompt does not leak `parsedTurns` state into prompt-mode `prompt` state (the two are separate state holders per §19; verified by switching and asserting `prompt` is empty after the round trip if it was empty before).

### 27.9 Alternatives considered

Per the §-alternatives discipline (precedent: §§9-17 + §24). At least two alternative pill placements and at least two alternative visual styles, evaluated honestly.

**§27.9.1 Alternative A -- pill row below the textarea (placement variant).**

**Shape:** mirror prompt-mode placement exactly. Pill row sits below the textarea, sharing a row with the Evaluate CTA (the conversation-mode Evaluate CTA, which is the Confirm CTA in §20.3 -- but on the preview-confirm step, not the input step). In the input step the pill row would sit between the textarea and the sub-modality switcher.

**Pros:**
- Exact parity with prompt-mode chrome -- one fewer chrome difference for users who switch modes.
- Pill row is adjacent to the action (paste-or-pick + Evaluate), which is the prompt-mode mental model.

**Cons:**
- The conversation-mode Evaluate CTA is gated by Stage 0 + preview-confirm, not by the textarea contents (per §20.3). The pill row's purpose is "load a starting point" -- placing it adjacent to a CTA that doesn't fire until preview-confirm passes obscures the affordance's function.
- A taller textarea (10 rows per §20.2) means the pill row at the bottom is below the fold for many viewports, pushing the affordance out of sight at first paint.
- Conversation-mode users coming fresh have a higher cognitive load than prompt-mode users (paste from a chat app, deal with sender labels, confirm parse); surfacing the pre-made shortcuts above the textarea is a stronger affordance for that user.

**Why rejected:** the conversation-mode textarea is taller and the CTA chain longer (input -> parse -> preview -> evaluate, not input -> evaluate). The above-textarea placement surfaces the shortcut where it earns its keep, before the user starts the longer chain. Below-textarea is the right pattern for prompt mode and the wrong pattern here.

**Closest to adoption:** moderate. If phase 5 qa surfaces that users miss the pill row entirely (eye-tracking lands on the textarea immediately), a non-breaking move to below-textarea remains possible.

**§27.9.2 Alternative B -- visually differentiated pills (visual variant).**

**Shape:** option (b) from the brief. Same chrome shape (rounded-full, `text-xs`, `px-3 py-1.5`) but with a different chip color or accent. Two sub-variants considered:

- **B1:** `bg-blue-50 hover:bg-blue-100 text-blue-800` -- soft blue signals "loads an example" without competing with the V5 disposition palette (green/amber/yellow/red).
- **B2:** keep `bg-gray-100` but add a leading icon (a small "play" or "open" Lucide icon at 12px) to signal "load this".

**Pros:**
- Visual differentiation could in principle reduce confusion if a user switches modes and is briefly disoriented by the same chrome doing different things.
- B1's blue is outside the V5 disposition palette, so a sky-blue pill won't be confused with a `safe_completion` (amber) or `block` (red) tier indicator.
- B2's icon adds a non-color signal (WCAG 1.4.1) that the affordance has action semantics distinct from a static chip.

**Cons (both B1 and B2):**
- The §27.7 render guard already ensures the two pill rows are never visible at the same time -- a user never sees both side-by-side. Visual differentiation can't disambiguate what the user can't see.
- A new chip color (B1) sets a precedent for "this pill is special" chrome that breaks the chip vocabulary established across §§2.3, §11, §21.4 (which explicitly resisted new chip colors per §24.3 "no new chip variant").
- A leading icon (B2) adds non-trivial chrome (icon library binding, sizing, vertical alignment, focus-ring offset) for a pure-redundancy signal.
- Both variants make the conversation-mode pill row feel "different" in a way that suggests a different *kind* of affordance, when the affordance is the same shape with different payload (text string in prompt mode; `turns[]` array in conversation mode -- both load curated content into the input region).

**Why rejected:** the chip vocabulary discipline (§24.3 precedent) wins over speculative disambiguation. The §27.7 gate is sufficient guard against confusion; visual differentiation is a solution looking for a problem.

**Closest to adoption:** low. B2 (icon variant) is closer than B1 (color variant) because an icon is a chrome-additive change rather than a vocabulary-additive change; if phase 5 qa surfaces "users don't realize the pills do something" friction, a minimal leading icon is the non-breaking remediation.

**§27.9.3 Alternative C -- no pill row, textarea placeholder examples (rejected, brief mention).**

**Shape:** kill the pill row entirely. Surface the example scenarios as a multi-line `placeholder` inside the §20.2 textarea (e.g., "Alice: Hi! Long time no see.\nBob: Hey, how are you doing?"). On focus, placeholder clears; user pastes or types real content.

**Why rejected briefly:** placeholder examples teach format but don't load a working scenario; a user wanting to evaluate "what does the engine say about a romance scam?" has to type or paste a romance scam by hand, which they can't do without authoring one (and that's the whole point of curated examples). Placeholder-only would also collide with §20.2's existing helper-label chrome ("Paste a conversation, one turn per line, with sender labels"). No teaching affordance carries the load of "click once, see an evaluation."

**§27.9.4 Honest read on the cut**

The committed §27 spec is "above-textarea + visually identical (option a)" because both choices reinforce the affordance's function (a curated starting point that bypasses the parser) without introducing chrome that would suggest a different *kind* of thing than the prompt-mode pill row. Alternative A (below-textarea) is the most defensible fallback if phase 5 qa surfaces discoverability friction; Alternative B2 (leading icon) is the most defensible fallback if phase 5 qa surfaces "I didn't realize these did something" friction. Both fallbacks are non-breaking and documented here.

### 27.10 What §27 does NOT do

- Does not commit the actual scenarios or label strings -- policy track owns content (`docs/memos/2026-05-28-policy-conversation-example-scenarios.md`). §27 commits the shape; policy fills it.
- Does not implement the pill row -- vscode track owns implementation in `src/app/page.js` per the §27.4 click contract + §27.8 acceptance criteria.
- Does not add an image-modality pill variant -- text sub-modality only per the scope brief.
- Does not introduce new state holders beyond what §§19-20 already commit; the pill row reads `mode` + `subModality` and writes `parsedTurns` + `subModality` + the clear-list in §27.4 step 3, all of which already exist in §§19-20.
- Does not add a "save my own example" affordance, a pill reordering UI, a per-pill description tooltip, or a "more examples" expansion link. All deferred; v1 ships the curated row from policy.
- Does not commit a `parse_confidence` value or a `modality_hint` value in the pill payload -- those are Stage 0 output fields, and Stage 0 does not run on the pill-click path (§27.4 step 2).
- Does not change §20.3's preview-confirm chrome -- the pill row uses §20.3 as-is. If a user clicks a pill, the preview-confirm renders exactly as it would after a parse, with all per-turn edit affordances intact.

### 27.11 Amendment log entry

Append to §18 amendment log:

- **2026-05-28 -- §27 conversation-mode example pill row.** New section appended. Commits pill row UI shape: positioning above textarea in text sub-modality (§27.2), `{label, turns}` payload contract (§27.3), click contract that skips Stage 0 and loads pre-canonicalized turns directly into preview-confirm state (§27.4), tab-order keyboard nav + `role="group"` semantics (§27.5), natural flex-wrap on mobile at 375/414 with 24x24 AA touch-target floor met (§27.6), conversation-mode + text-sub-modality render guard (§27.7), testable acceptance criteria for vscode + phase 5 qa (§27.8), three alternatives with honest rejection rationale (§27.9). Originating dispatch: `conversation-eval-example-pills` 3-track parallel (design track).

## 35. `+N more` overflow-chip disclosure pattern (issue: hidden values inaccessible)

**Extension date:** 2026-05-27
**Originating dispatch:** `disclose-hidden-values-plus-n-more-chip` phase 1 of 2 (brief 0045, from-track=orchestrator, routed-to=design,vscode).
**Companion tracks:** vscode phase 2 implements per this section + amended §9.2 / §11.2 / §13.2.
**Scope discipline:** UI shape only -- spec which gesture surfaces hidden values, how the tooltip is structured, what keyboard / mobile / ARIA contracts hold, and the shared component shape vscode extracts. No new policy, no new vocabulary, no threshold change.

### 35.1 Problem and screenshot reference

In the result card's PROMPT SUMMARY section, the TARGET row renders chips with an overflow indicator (e.g., `lonely_individual`, `trust_love`, `lonely_individual`, `greed`, `isolation`, `reciprocity`, `+3 more`). The `+3 more` element is currently a static `<span>` -- clicking, hovering, focusing, and tapping all do nothing. The user sees that three values are hidden but has no way to surface them. The same inert-`+N more` pattern appears on the section 2.5 Control multi-label row.

This makes `+N more` actively worse than just listing all values: it advertises hidden information while preventing access to it. Screenshot evidence: `uploads/71b138e9-image.png` -- TARGET row in PROMPT SUMMARY section showing six visible chips followed by an inert `+3 more` pill. The two surfaces that carry this bug are `TargetAttributesStrip` (`src/app/page.js` line ~2093, cap 5) and `ProcessFlagRow`'s Control multi-label strip (`src/app/page.js` line ~2185, cap 4).

### 35.2 Decision -- tooltip disclosure on `+N more` (Option 1)

**Committed pattern.** The `+N more` chip becomes an interactive trigger that surfaces a tooltip body containing the comma-separated list of hidden values. The tooltip body is rendered through the existing `PortalTooltip` infrastructure committed in §28 (React-portal to `document.body`, viewport-edge direction-flip, scroll/resize re-anchoring, Escape dismissal, focus-visible parity). No new tooltip variant; no new state model; no new collapse / `show less` affordance.

**Defense (extends brief 0045's recommendation rationale).**

1. **Spec-vs-pragmatism tradeoff.** Pre-amendment §11.2 / §13.2 prescribed row-expand with a `show less` toggle and a focus-shift-on-expand contract. The bug under fix is "user cannot see hidden values"; the tooltip pattern solves it with zero net-new infrastructure (one `PortalTooltip` call) and zero net-new ARIA contract (the §28 portal tooltip already documents Escape / focus-return / `aria-describedby`).

2. **Density.** Result cards are already dense. A row-expand state pushes other rows further down, especially noticeable on the PROMPT SUMMARY card which has five rows (TOPIC / TARGET / OBJECTIVE / PRETEXT / PERSONA). Tooltip disclosure leaves the card geometry unchanged.

3. **Consistency with existing chip tooltips.** `ClassifierLabelChip`, `BrightLineChip`, `HoverChip`, and `TriggerChipWithTooltip` all already use `PortalTooltip` for descriptor reveal post-§28. Surfacing hidden chip values via the same affordance reads as a sibling pattern, not a new mode of interaction.

4. **A11y inheritance.** `PortalTooltip` already has the ARIA / Escape / focus contract from §28. Row-expand would have required inventing the contract from scratch (announce expanded state, manage focus on first revealed chip, decide whether `show less` is a separate focus stop).

5. **Mobile tap parity.** `ClassifierLabelChip` already implements tap-to-open + second-tap-close + tap-outside-close + Escape-dismiss for chip descriptors at <768px (per §13.5 + the §28 portal pattern). The same gesture set carries to `+N more` with zero net-new behavior.

### 35.3 Trigger interactions

The `+N more` chip is a `<button type="button">` (NOT a `<span>`; the tag swap is load-bearing -- a `<span>` cannot receive `Enter` / `Space` activation even with handlers attached). Three gesture sets open the tooltip:

- **Desktop -- hover.** Mouseenter on the chip opens the tooltip; mouseleave closes. Same hover-open / leave-close semantics as every other `PortalTooltip` consumer post-§28.
- **Desktop -- keyboard.** Tab focuses the chip; `Enter` or `Space` opens the tooltip; `Escape` closes it and returns focus to the chip (per §28 / §12.2 keyboard contract). Tab off the chip also closes the tooltip.
- **Mobile -- tap.** First tap opens; second tap on the chip closes; tap outside the chip closes; `Escape` (where a soft-keyboard ESC key is present, e.g., attached BT keyboard) closes. This is the §13.5 tap-toggle pattern verbatim; reuse the existing dismiss-state hook from `ClassifierLabelChip` rather than re-implementing per-chip.

### 35.4 Tooltip content

**Body content.** Comma-separated list of the hidden values, in the same order they appear in the underlying array (so the reader sees positions 6, 7, 8 of the Target Attributes array, or positions 5, 6, 7, 8 of the Control labels array, in source order -- no resorting at disclosure time).

**Prefix-stripping rule.** The hidden values render with the same prefix-stripping the visible chips use: `target:enterprise_it_credentials` displays as `enterprise_it_credentials`, `tactic:isolation` displays as `isolation`. For Target Attributes the prefix grammar is committed in §11.2 (`target:` and `tactic:` prefixes stripped for display); for the Control row the chip values do not carry prefixes (per §9.2, the label is the underscore-form ontology value directly), so the strip rule is a no-op there but the component MUST still apply it idempotently for forward compatibility with any future prefix grammar.

**Layout.** Plain comma-separated text, no per-value chips inside the tooltip (the tooltip is a disclosure affordance, not a secondary chip surface). Whitespace after each comma; no leading or trailing whitespace.

**Width and wrapping.** Tooltip body `max-width: 300px`; `word-wrap: break-word` (CSS `overflow-wrap: anywhere` on the body element to handle the rare case of a single unbroken underscored token wider than 300px). No truncation, no ellipsis -- the worst-case hidden count is bounded: Target Attributes caps at 6 attributes total per §11.2 (`+1 more` is the typical case); Control labels cap at 11 per §9.2 (`+7 more` is the theoretical worst case). Seven comma-separated underscored tokens fit comfortably within 300px when wrapped to two or three lines.

**No truncation inside the tooltip.** If a future cap raise produces a tooltip body taller than the viewport, the §28 portal already handles viewport-edge clamping; the tooltip becomes scroll-able within itself. Do NOT add a custom truncation pass.

### 35.5 Keyboard behavior

The `+N more` chip participates in document-order Tab traversal per §12.4 focus order: after the last visible chip in its strip, before the next row's first focusable element. Activation:

- **`Tab` to focus chip.** Focus ring renders per `focus-visible` (same focus-ring chrome as every other chip; tokens picked by vscode from the §27.5.2 / §12.5 family).
- **`Enter` or `Space` to open tooltip.** Either key opens; both are browser-default `<button>` activations. Open state sets `aria-expanded="true"` on the trigger and `aria-describedby` pointing at the rendered tooltip body's id.
- **`Escape` to dismiss.** Closes the tooltip, restores `aria-expanded="false"`, removes the `aria-describedby` linkage. Focus stays on the trigger (does NOT shift to any other element). Same Escape contract as §28.4 / §12.2.
- **`Tab` off the chip.** Closes the tooltip; focus moves to the next focusable element in document order. Same blur-close contract as the existing `PortalTooltip` consumers.

The tooltip body itself is NOT focusable (it has no `tabindex`). The reader reaches the body content via `aria-describedby` announcement, not via Tab.

### 35.6 Mobile behavior

At any viewport width, the touch contract follows §13.5 / the `ClassifierLabelChip` dismiss-state pattern:

- **First tap on chip.** Opens the tooltip; sets `aria-expanded="true"`; `aria-describedby` points at the body id.
- **Second tap on chip.** Closes the tooltip; resets `aria-expanded="false"`.
- **Tap outside the chip and tooltip body.** Closes the tooltip. Implementation: the existing `PortalTooltip` outside-click listener (registered when the tooltip is open, deregistered when closed) handles this -- no per-chip wiring needed.
- **`Escape` (where a hardware keyboard is present).** Closes the tooltip per §35.5.

The tooltip body itself is NOT a tap target for dismissal -- tapping inside the body does nothing (it is a passive disclosure surface). This avoids the common mobile-tooltip anti-pattern where tapping the body to read its content also dismisses it.

### 35.7 ARIA contract

- **Trigger element.** `<button type="button" aria-label="Show N more items" aria-haspopup="true" aria-expanded={open} aria-describedby={open ? tooltipBodyId : undefined}>`.
  - The accessible name is the literal-N form `Show N more items` (e.g., `Show 3 more items`), inherited verbatim from pre-amendment §13.2 (which committed this string before the disclosure pattern existed; the string survives unchanged).
  - `aria-haspopup="true"` rather than `aria-haspopup="menu"` -- the disclosed content is a tooltip body, not an actionable menu. The WAI-ARIA spec accepts `true` as the generic value when the popup is not a menu, listbox, tree, grid, or dialog.
  - `aria-expanded` toggles between `false` (closed) and `true` (open) on every open/close transition.
  - `aria-describedby` is set to the tooltip body's id ONLY when the tooltip is open; removed entirely when closed (do not set `aria-describedby=""`; remove the attribute).

- **Tooltip body element.** `<div role="tooltip" id={tooltipBodyId}>{commaSeparatedHiddenValues}</div>`.
  - `role="tooltip"` per WAI-ARIA 1.2 tooltip role definition.
  - `id` is a stable string per chip instance (e.g., `overflow-tooltip-target-${rowId}` or a `useId()` value); vscode picks the generation scheme, but the id MUST be unique within the document or `aria-describedby` resolution breaks.
  - No `aria-live` on the body -- the body is announced via `aria-describedby` from the trigger, not as a live-region update.

- **Screen-reader announcement on open.** When a screen-reader user activates the chip (`Enter` / `Space` / VoiceOver-rotor activation), the assistive technology reads: "Show 3 more items, button, expanded" (the trigger's `aria-label` + role + `aria-expanded` state), then reads the tooltip body via `aria-describedby` resolution: "lonely_individual, greed, isolation". Total announcement is one focus event, not a separate live-region announcement.

### 35.8 Animation, z-index, and visual style

- **Animation.** 100ms fade-in on open; 100ms fade-out on close. CSS transitions on `opacity` only (do NOT animate `transform` or position -- the §28 portal positioning is computed once at open time and the body should not shift during fade). Matches the existing `PortalTooltip` animation timing post-§28 (vscode greps for the existing transition string and reuses it verbatim).

- **Z-index.** Tooltip body inherits the `PortalTooltip` z-index per §28.1 (which sits above all other portaled content because the portal target is `<body>`, escaping every parent stacking-context). No new z-index value needed; do NOT introduce a tooltip-specific z-index variable.

- **Visual style.** Match the existing chip-tooltip visual chrome verbatim: white background, slate border, drop shadow, pointer triangle tracking the chip's horizontal center. No new tooltip variant. No new color tokens. The tooltip body's text uses the same typography as descriptor tooltips (`text-xs` slate-800 on white, per §12.1 / §22.1 live-measured contrast methodology).

- **Pointer triangle.** Tracks the chip's horizontal center, clamped to tooltip horizontal bounds per §28.1's positioning contract. No special case for `+N more` -- the chip is a chip; the triangle behavior is unchanged.

### 35.9 `OverflowChip` -- shared component spec

The `+N more` pattern lives in TWO surfaces of `src/app/page.js` (per memo §5.7 grep-before-template-inherit applied at brief drafting time: drafter confirmed both `TargetAttributesStrip` line ~2093 AND `ProcessFlagRow` line ~2185 render the same inert `<span>`). The vscode phase 2 implementation MUST extract a shared component rather than fix the two sites independently, because: (a) the two sites have identical visible chrome and identical interaction contract under this spec; (b) extraction prevents the all-too-common "fixed one, forgot the other" follow-up bug; (c) the §5.7 atomic memo amendment commits this discipline explicitly.

**Component name.** `OverflowChip` (vscode confirms in implementation; if a different name reads better in the codebase context, vscode may pick another -- but the component MUST be shared, not duplicated).

**Props contract.**

```
OverflowChip({
  hiddenValues: string[],   // the array of hidden values to disclose (already sliced to the overflow tail)
  count: number,            // the literal N for the trigger label "Show N more items"
                            // (typically hiddenValues.length; passed explicitly to avoid recomputing
                            // and to allow the parent to pass a precomputed value)
  prefixStrip?: boolean,    // optional, default true; when true, strip `target:` and `tactic:`
                            // prefixes from each hiddenValues entry before joining (idempotent
                            // for values without prefixes, so safe to leave on)
  chipClassName?: string,   // optional, additional Tailwind class string applied to the trigger
                            // button so the parent can match the visible chip strip's
                            // sizing/border (different between TargetAttributesStrip and
                            // ProcessFlagRow per §9.2 / §11.2 visual treatments)
})
```

The component does NOT take a `cap` prop -- the cap (5 for Target Attributes, 4 for Control) is the parent's concern; the parent slices the array and passes only the overflow tail. This keeps the component cap-agnostic (per the brief 0045 §gotchas: "shared component takes the cap as a prop; do NOT hard-code 5 or 4 inside the component" -- restated more tightly here as "do NOT take cap as a prop either; the parent owns slicing").

**Rendering.**

- Outer element: `<button type="button" className={chipClassName} aria-label={...} aria-haspopup="true" aria-expanded={open} aria-describedby={open ? id : undefined}>+{count} more</button>`
- The visible label is the literal string `+{count} more` (matches the existing inert chip's visible text -- per Acceptance Criterion #1, the chip MUST render identically to the existing `+3 more` visual).
- On open: render a `PortalTooltip` body with `role="tooltip"`, `id={tooltipBodyId}`, and content = the prefix-stripped, comma-separated `hiddenValues.join(", ")`.

**Accessibility hooks.** All ARIA per §35.7. Reuse the dismiss-state hook from `ClassifierLabelChip` per §35.6 if extracted; otherwise wire the same first-tap-open / second-tap-close / tap-outside-close pattern inline.

**No internal state beyond open/closed.** The component does NOT track which values have been "seen" or maintain any per-chip history. Open/closed is the only state.

**Implementation guidance.** The component lives in the same file as the existing chip components (`src/app/page.js`) unless vscode chooses to extract chip components to a sibling module; that extraction is out-of-scope for this brief but flagged as a reasonable follow-up if `src/app/page.js` continues to grow.

### 35.10 Acceptance criteria for vscode phase 2

Each criterion is independently testable; vscode phase 2 ships only when all pass.

1. **Visual parity.** `+N more` chip renders identically to the existing `+3 more` visual at desktop and mobile -- same Tailwind classes (modulo the `<span>` -> `<button>` tag swap), same padding, same border, same color, same vertical alignment within the chip strip. Verified by side-by-side screenshot comparison against the pre-fix screenshot in `uploads/71b138e9-image.png` (the trigger must look unchanged; only the interaction changes).

2. **Hover discloses on desktop.** Mouseenter on `+N more` opens the tooltip body within ~100ms; mouseleave closes it. Tooltip body contains the comma-separated hidden values per §35.4.

3. **Focus discloses on desktop keyboard.** Tab to the chip; tooltip opens on focus (per the existing `PortalTooltip` focus contract); `Enter` / `Space` also explicitly open the tooltip (idempotent if already open via focus -- both gestures must be wired).

4. **Keyboard navigation full sequence.** Tab to focus chip -> `Enter` (or `Space`) shows tooltip -> `Escape` dismisses tooltip and returns focus to the chip. Verified by stepping through the chip with a keyboard-only test (no mouse, no touch) at desktop.

5. **Mobile tap works.** First tap opens tooltip; second tap on the chip closes it; tap outside the chip-and-tooltip closes it. Verified manually at 375px viewport.

6. **Screen reader announces correctly.** With VoiceOver (macOS) or NVDA (Windows) running, focusing the chip announces "Show N more items, button, collapsed" (where N is the literal count, e.g., 3); activating reads "expanded" and the comma-separated body via `aria-describedby`. Verified manually at desktop with a screen reader active.

7. **Both surfaces fixed.** `TargetAttributesStrip` AND `ProcessFlagRow`'s Control multi-label strip BOTH use the shared `OverflowChip` component. Verified by grep: no remaining inert `<span>` with `+{` text in either component's render tree.

8. **Manual screenshots at 1280px and 375px before close.** Phase 2 archive Notes back includes two screenshot file paths (or inline images / base64): one at 1280px desktop showing tooltip open over `+N more`; one at 375px mobile showing tooltip open on tap. Per brief 0045's "1280px + 375px floor" gate; no qa path-B real-device escalation required for this brief because the interaction is pure DOM (no live API, no engine work).

9. **No regression on existing tooltip behavior.** §28's `PortalTooltip` portal-escape fix stays intact. Bundle-grep `data-tooltip-portal` count (or whatever testid the §28 portal uses) >= prior count post-deploy. Verified by `curl https://safeeval.vercel.app` post-deploy and grepping the rendered bundle.

10. **ASCII discipline.** `src/app/page.js` stays ASCII-only per CLAUDE.md (em dashes -> `--`, smart quotes -> straight, etc.). Verified by `scripts/check-null-bytes.js` (existing pre-flight) plus a grep for non-ASCII codepoints in the changed lines.

### 35.11 Lockstep impact

This section commits no engine, schema, ontology, or fixture changes; `scripts/check-lockstep.js` impact is doc-only.

The cross-references added to §9.2 / §11.2 / §13.2 (each pointing here) are in-place amendments to existing spec sections, not new lockstep groups. No new check needed.

### 35.12 What §35 does NOT do

- Does not change the cap logic. `slice(0, 5)` for Target Attributes (§11.2) and `slice(0, 4)` for Control labels (§9.2) stay verbatim. The cap is the parent's concern.
- Does not introduce per-value chips inside the tooltip body. The body is plain comma-separated text per §35.4.
- Does not add a `show less` toggle, a row-expand state, or any persistent disclosure mode. The tooltip is the entire disclosure surface.
- Does not add `+N more` to rows that don't have it today. TOPIC, OBJECTIVE, PRETEXT, PERSONA are single-valued or prose-only and do not overflow. New overflow surfaces are separate briefs if needed.
- Does not change tooltip *content semantics* for any other chip (`ClassifierLabelChip`, `BrightLineChip`, `HoverChip`, `TriggerChipWithTooltip`). Only `+N more` gets a tooltip body of hidden-values-comma-separated; other chips keep their descriptor-prose bodies.
- Does not change L3 chip overflow handling at <768px (§30's vertical-stack + overflow-wrap pattern is unchanged; that handles chip-wrap behavior on the L3 row, distinct from explicit `+N more` triggers).
- Does not edit `src/`, `tests/`, `scripts/`, `agents/`, or any FAF policy / enforcement / threat-model / parallel-tracks / quickstart doc. Doc-only.
- Does not add new typology, sub-typology, bright-line, threshold, or L3 vocabulary. UX-only.

### 35.13 Alternatives considered and rejected

Per the §-alternatives discipline (precedent: §§9-17, §24, §28, §29). Two were named by brief 0045; both rejected here with reasoning preserved.

**Alternative B -- click to expand row (the pre-amendment §9.2 / §11.2 / §13.2 pattern).** Clicking `+N more` flips the row to show all values inline (chips wrap to a second line), with a `show less` toggle to collapse. More discoverable in the sense that the disclosed values use the same chip chrome as the visible ones. Rejected because: (a) implementation cost is meaningfully higher -- new state, new collapse affordance, focus-management on first revealed chip, a new `show less` button that didn't exist before; (b) row-reflow pushes other rows down, which is especially expensive on the PROMPT SUMMARY card (five rows already); (c) the row-expand a11y contract would need to be invented from scratch (announce expanded state, focus on first revealed chip, focus-return on collapse) -- §28's `PortalTooltip` already documents the parallel contract for the tooltip path.

**Alternative C -- hybrid (tooltip preview + click expands fully).** Hover/focus shows a tooltip preview; click expands the row to show all values inline. Rejected because: (a) inherits Alternative B's full implementation cost (the click-expand path still requires the row-expand state machine); (b) introduces a two-mode interaction (hover-preview vs click-expand) where the brief's failure mode is "user cannot see hidden values" -- one mode solves it; (c) belt-and-suspenders adds complexity without dissolving any failure mode that pure tooltip leaves open.

**Closest to adoption.** Alternative B remains the most defensible fallback if a future audit surfaces "users don't notice the tooltip" friction. The tooltip pattern is non-breaking-replaceable by row-expand if needed; the §35 spec is the cheaper-by-construction starting point. The honest read on the cut: the brief 0045 recommendation aligns with the architectural inertia of the §28 portal cluster -- once `PortalTooltip` exists, every new disclosure should ride it unless there's a specific reason not to. There isn't, here.

### 35.14 Cross-references

- **Brief 0045** (`disclose-hidden-values-plus-n-more-chip`) -- the originating dispatch. Screenshot evidence at `uploads/71b138e9-image.png`.
- **§28** (Tooltip portal escape pattern) -- the `PortalTooltip` infrastructure §35 reuses verbatim.
- **§9.2** (Single-valued vs multi-valued Control chrome) -- amended per §35.15 below.
- **§11.2** (Target Attributes tag-strip pattern) -- amended per §35.15 below.
- **§13.2** (Target Attributes mobile wrap with overflow) -- amended per §35.15 below.
- **§12.2 / §12.4** (Keyboard navigability + focus order) -- the `+N more` chip participates in document-order Tab traversal per §12.4 and dismisses on Escape per §12.2.
- **§13.5** (Tooltip interaction on mobile -- tap to surface) -- the mobile dismiss-state pattern §35.6 inherits.

### 35.15 Amendments to §9.2, §11.2, §13.2

The pre-amendment language in §9.2 / §11.2 / §13.2 prescribed row-expand semantics for the `+N more` chip. This section adjudicates the disclosure pattern as tooltip-based; the affected sections amend in-place to point here for the disclosure contract.

**§9.2 amendment.** Replace the final sentence of the "Cardinality cap and overflow" paragraph -- which currently reads `"... append a +N more overflow chip; expanding the row's prose (per §9.1) also expands the full chip list. The overflow chip is keyboard-focusable and toggles the same expanded-row state."` -- with: `"... append a +N more overflow chip; activating the chip surfaces a tooltip disclosing all hidden values per §35 (the row's prose-expand affordance per §9.1 remains independent and is not coupled to the +N more chip)."`

**§11.2 amendment.** Replace the final sentence of the "Count-limit behavior" paragraph -- which currently reads `"... append a +N more overflow chip. Overflow chip is keyboard-focusable and toggles a row-expanded state that shows all chips wrapped to a second line. Same overflow grammar as §9.2 multi-valued Control row."` -- with: `"... append a +N more overflow chip. Activating the chip surfaces a tooltip disclosing all hidden values per §35. Same overflow grammar as §9.2 multi-valued Control row."`

**§13.2 amendment.** Replace the final sentence of §12.3's "Overflow chip (`+N more`)" paragraph -- which currently reads `"Activation expands the row and shifts focus to the first newly-revealed chip; collapsing returns focus to the overflow chip. Same pattern as the existing collapsible-region toggle from section 2.5."` -- with: `"Activation surfaces a tooltip disclosing all hidden values per §35; Escape (or tap-outside / second-tap on mobile) dismisses the tooltip and returns focus to the chip. The disclosure does not modify row layout."` Note: the §13.2 overflow-chip language lives in §12.3 per the spec's section numbering convention (§12.3 is "Screen-reader behavior for multi-valued Control and Target Attributes" and contains the overflow-chip ARIA paragraph); the `§13.2` references in brief 0045 and §11.2's tail map to the same paragraph by way of the cross-references. The visible-mobile-wrap text in §13.2 itself ("The Target Attributes strip already caps visible chips at 5 with an overflow chip per §11.2.") is unchanged -- it only references the cap, not the disclosure semantics.

### 35.16 Amendment log entry

Append to §18 amendment log:

- **2026-05-27 -- §35 `+N more` overflow-chip disclosure pattern.** New section appended. Commits tooltip-disclosure semantics on the `+N more` overflow chip (Option 1 per brief 0045 adjudication): hover/focus/tap surfaces a `PortalTooltip` body containing comma-separated hidden values; Escape / tap-outside / second-tap dismisses; ARIA contract `aria-haspopup="true"` + `aria-expanded` toggle + `aria-describedby` linkage; reuses §28 portal infrastructure and §13.5 mobile tap pattern with zero net-new dependencies. Commits shared `OverflowChip` component spec (§35.9) for vscode phase 2 to extract once and consume from both `TargetAttributesStrip` and `ProcessFlagRow` (per brief drafter's grep-before-template-inherit finding -- bug lives in two surfaces). Amends §9.2 / §11.2 / §13.2 in-place (§35.15) to replace the prior row-expand language with cross-references to §35's tooltip pattern. Pre-amendment row-expand pattern preserved as Alternative B (§35.13) -- non-breaking-replaceable if future audit surfaces tooltip-discoverability friction. Originating dispatch: `disclose-hidden-values-plus-n-more-chip` phase 1 (design track, brief 0045, from-track=orchestrator). Screenshot evidence: `uploads/71b138e9-image.png`.
