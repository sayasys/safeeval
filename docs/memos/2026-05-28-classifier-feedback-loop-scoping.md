# Classifier-edits feedback loop -- scoping memo

**Status:** draft, recommends-only (memo proposes a new persistence-layer surface and an API module; no schema applied, no engine code, no ontology amendment, no closed-set vocabulary addition committed against the lockstep validator in this commit).
**Date:** 2026-05-28
**Author:** `safeeval-policy` (Cowork), via `safeeval-agents:design-memo-author` (mode A).
**Companion to:** `docs/memos/2026-05-28-data-track-implementation-spec.md` (Compliance-ready data-track storage pattern; M1 `evaluations` table the M5 `classifier_edits` table joins via FK; KMS / RLS / role-grant precedent the edits-table grants mirror), `docs/memos/2026-05-28-data-track-scoping.md` (PII sanitization spec; reviewer edits write back to the sanitized envelope only -- no raw-PII surface in any edit row), `docs/memos/2026-05-28-report-generator-implementation-spec.md` (auth-gate Phase 2 stub pattern in `src/lib/report-generators/index.ts:84` -- `LegalAccessGateError` is the structural model the `EditorRoleGateError` mirrors), `docs/memos/2026-05-28-osint-monitoring-scoping.md` (`proposal_status` closed-set vocabulary; `propagation_status` adopts the same shape), `docs/08-v5-ontology.md` (closed-set L1 / L2 / L3 vocabularies that reviewer edits target; the §3.15 / §3.16 / §3.17 additions land alongside the implementation dispatch), `docs/memos/2026-05-24-parallel-cowork-tracks.md` (parallel-tracks framework; fifth atomic amendment escalation-field convention; seventh atomic amendment §4.5.1 ID-collision protocol for parallel dispatch filings).
**Hard dependency:** the data track's `evaluations` table and `PrePersistSanitizer` must be in place before this spec's M5 migration applies (Compliance-ready tier shipped via commit `33a6075`); the PII zero-storage adjudication firing in parallel determines whether reviewer edits can ever touch a raw-input column (the answer per current scope: never; edits target the sanitized envelope's fields).
**Scope:** scope the addition of a reviewer-edit-and-feedback loop behind the existing engine -- a Postgres `classifier_edits` table that records structured overrides of classifier outputs by named reviewer roles, an API surface (`src/lib/feedback/`) that validates a closed-set notation grammar and rejects malformed inputs, a daily aggregation job that surfaces consistent reviewer disagreement as `route-to-steven` proposals to the architect track, and a fine-tuning corpus export shape for the eventual commercial-tier self-hosted-model path. Three scope tiers (MVP / Standard / Full), five risks with five mitigations, five open questions with escalation-field convention, adversarial review per design-memo-author mode C. The closed-set `field_path` / `rationale_tag` / `editor_role` vocabularies are proposed for `docs/08-v5-ontology.md` §§3.15 / 3.16 / 3.17 as new lockstep-verifiable sections (`checkEditableFieldsLockstep` and `checkRationaleTagLockstep` as new lockstep functions). The reviewer UI itself is OUT of scope (named at §10) -- this memo lands the API surface and the supervision-signal storage layer; the UI work is a separate later memo.

Steven has adjudicated two decisions in advance that this memo treats as locked and does not re-open:

- **Who can edit: closed-set reviewer roles, default-deny.** Not "any authenticated reviewer." Specific roles (`senior_reviewer`, `policy_lead`, etc.) have edit authority per a permission matrix; everything else is denied. The pattern matches the legal-audience auth-gate from `src/lib/report-generators/index.ts:84` (commit `2632a66`'s Phase 2 stub).
- **Rationale field: hybrid (closed-set primary tag + free-text elaboration).** Steven's exact framing: "structured format for cleaner data training but free text to semantically look for patterns over time periods and to identify coverage gaps." The closed-set primary tag is the supervision signal; the free-text field is the pattern-discovery signal.

## 1. Problem statement

SafeEval's classifier outputs are one-way today. The engine emits a v5 envelope -- L1 / L2 / L3 vocabulary assignments, reason codes, component scores, disposition, persona claim -- and the reviewer reads it. The reviewer can disagree silently; they cannot communicate that disagreement back through any structured surface. The closest thing to a feedback channel is the reviewer's manual case notes, which live outside any system the engine or the policy author can read.

The cost of the gap is concrete and cross-track:

- **Policy track is blind to reviewer disagreement at population scale.** Today policy authors revise FAF text against case studies, golden fixtures, and the architect's discriminator-boundary memos -- a closed sample. Reviewers see far more cases than any case-study cycle covers; their adjustments to the engine's classifications are the single richest signal of where the FAF underspecifies, overspecifies, or misfires. That signal vanishes the moment the reviewer closes their browser tab.
- **The classifier has no supervision signal to learn from.** The longer-horizon ambition Steven approved is stage-specialized fine-tuning -- a Stage 2 discriminator trained on its own production traffic, a Stage 4 cascade tuned to the reviewer-override distribution. The training data those models need is the `(input, original_output, corrected_output, rationale)` tuple structure that reviewer edits would emit. Without persisted edits, the supervision signal does not exist.
- **Hiring-reader artifact is incomplete.** A reader evaluating SafeEval as a portfolio artifact looks at the engine's classification surface, infers there must be a way reviewers adjust it, and finds nothing. The framework's policy loop has an outer half (OSINT-driven L3 evolution; sibling memo 2026-05-28-osint-monitoring-scoping.md) but its inner half (reviewer-driven envelope correction) is open. The framework is half-finished where the JD signal expects a closed loop.
- **Reviewer disagreement becomes a labor-intensive memory task.** Reviewers who notice the same pattern of engine misclassification across many cases have no structured surface to surface it on; the only escalation path is to file a brief to the architect track manually, which scales with the reviewer's attention and not with the volume of cases. Structured edits convert the labor of "filing a brief" into the cost of "checking a tag" -- the architect-aggregation surface does the brief-filing work on aggregate evidence.

This memo proposes a structured edit-and-feedback loop behind the persistence layer. Edits are first-class records in a new `classifier_edits` table; an API module validates each edit against a closed-set notation grammar; a daily aggregation job clusters consistent disagreement into amendment proposals routed to the architect; the resulting edit corpus is the substrate the eventual fine-tuned model trains against. The closed-set vocabularies (`field_path`, `rationale_tag`, `editor_role`) get the same lockstep discipline as L1 / L2 / L3 -- divergence between docs and code is a build break.

The framing line, mirrored from the OSINT memo's §1 framing discipline:

> SafeEval consumes reviewer edits as supervision signal for L3 vocabulary evolution and for fine-tuning corpus generation. SafeEval does not autonomously revise its taxonomy from edits; it surfaces amendment proposals to a human adjudicator and applies new vocabulary only after explicit approval.

## 2. The notation grammar (Steven-mandated)

Every edit MUST conform to the following form, enforced at the API layer:

```
classifier <field_path>, changed <before_value> to <after_value>, because <rationale_tag> [: <rationale_text>]
```

Concrete examples:

- `classifier disposition.action, changed allow to human_review, because policy_circumvention_undercaught`
- `classifier l1.category, changed privacy_abuse to deceptive_fraud, because wrong_l1_category`
- `classifier reason_codes[2], added impersonation_authority_figure, because missing_reason_code`
- `classifier l3.method, changed phishing to vishing, because wrong_l3_method: the prose explicitly mentions a phone call, not an email`
- `classifier component_scores.target, changed 0.42 to 0.71, because component_score_off: target is named (the CFO) and the rubric weight for named-individual targets pushes above 0.6`
- `classifier reason_codes[3], removed (was synthetic_identity_construction), because extra_reason_code: the L2 is romance_fraud and the synthetic-identity tag fires on a different L2`
- `classifier disposition.action, changed block to safe_completion, because disposition_too_strict: the prose is security-education research-framed and Stage 1 mishandled the framing`
- `classifier other-field-not-in-vocabulary, [...], because other: <free-text elaboration explaining why this case needs a new closed-set entry>`

The grammar is the API contract. The API's `recordEdit()` entry point parses each input against this shape and rejects malformed records before any row hits the database. Specifically:

- `<field_path>` MUST be drawn from the closed-set §4 vocabulary; any other value is rejected with a `MALFORMED_NOTATION` error (with the unknown field-path returned in the error body so the reviewer's tooling can surface the rejection inline).
- `<before_value>` and `<after_value>` MUST match the type the field expects (string for enum fields, number for score fields, array index notation `[i]` for reason-code slots, etc.); type-mismatch is rejected.
- `<rationale_tag>` MUST be drawn from the closed-set §5 vocabulary OR be the literal value `other`.
- `<rationale_text>` is optional unless `<rationale_tag> = 'other'`, in which case it is MANDATORY (the closed-set escape valve costs the reviewer a sentence; otherwise reviewers will use `other` for everything and the closed-set vocabulary becomes vestigial).

The notation grammar is intentionally human-readable -- a reviewer typing edits into a future UI sees the same shape as a reviewer running edits from curl. The shape is also the audit trail: every `classifier_edits` row reconstructs to a single notation-grammar line via `SELECT format(...)`, which is the form the architect reads when adjudicating aggregated edits. Notation-grammar conformance is what makes the data trainable downstream -- malformed inputs cannot become training tuples because they never become rows.

## 3. `classifier_edits` table -- concrete DDL

A new migration M5 in the data-track schema directory (`src/lib/data/schema/005_create_classifier_edits.sql` or `src/lib/feedback/schema/005_create_classifier_edits.sql`; the colocation question is named at §14 open question 5). The table sits next to `evaluations` and `reports` and follows the same RLS / role / 90-day-TTL conventions per the data-track implementation spec.

```sql
-- M5: create classifier_edits table + indexes + RLS
-- Reversible via the DOWN section at the bottom of this file.

CREATE TABLE classifier_edits (
  id                    SERIAL PRIMARY KEY,
  evaluation_id         BIGINT NOT NULL
                          REFERENCES evaluations(id) ON DELETE CASCADE,

  -- Editor identity. Phase 2 stub: editor_id is a placeholder for future
  -- auth; for now it stores the role name from the auth gate (mirrors the
  -- LegalAccessGateError unredacted_access=true stub in
  -- src/lib/report-generators/index.ts:84 / Phase 2 commit 2632a66).
  editor_id             TEXT NOT NULL,
  editor_role           TEXT NOT NULL
    CHECK (editor_role IN (
      'senior_reviewer',
      'policy_lead',
      'qa_reviewer'
    )),

  -- The edit itself. field_path / change_type / before / after / rationale_tag
  -- are the load-bearing supervision-signal fields; rationale_text is the
  -- pattern-discovery signal per Steven's hybrid framing.
  field_path            TEXT NOT NULL,         -- closed-set vocab per docs/08-v5-ontology.md §3.15
  change_type           TEXT NOT NULL
    CHECK (change_type IN ('remove', 'add', 'modify')),
  before_value          JSONB,                  -- NULL when change_type = 'add'
  after_value           JSONB,                  -- NULL when change_type = 'remove'

  rationale_tag         TEXT NOT NULL,         -- closed-set vocab per docs/08-v5-ontology.md §3.16
  rationale_text        TEXT,                   -- mandatory when rationale_tag = 'other'

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Workflow state column; vocabulary mirrors the OSINT memo's proposal_status
  -- shape (docs/memos/2026-05-28-osint-monitoring-scoping.md §3).
  propagation_status    TEXT NOT NULL
    DEFAULT 'pending'
    CHECK (propagation_status IN (
      'pending',
      'aggregated',
      'applied_to_prompt',
      'applied_to_vocab',
      'dismissed'
    )),

  -- Application-layer assertion: rationale_text NOT NULL when rationale_tag
  -- = 'other'. CHECK constraint enforces at the database layer too.
  CHECK (
    rationale_tag <> 'other'
    OR rationale_text IS NOT NULL
  ),

  -- Application-layer assertion: change_type = 'add' implies before_value
  -- IS NULL; change_type = 'remove' implies after_value IS NULL.
  CHECK (
    (change_type = 'add'    AND before_value IS NULL) OR
    (change_type = 'remove' AND after_value  IS NULL) OR
    (change_type = 'modify' AND before_value IS NOT NULL AND after_value IS NOT NULL)
  )
);

-- Indexes per the five most-frequent query shapes the aggregation job + the
-- architect's adjudication queue hit.
CREATE INDEX idx_classifier_edits_evaluation_id
  ON classifier_edits (evaluation_id);

CREATE INDEX idx_classifier_edits_editor_role
  ON classifier_edits (editor_role);

CREATE INDEX idx_classifier_edits_rationale_tag
  ON classifier_edits (rationale_tag);

CREATE INDEX idx_classifier_edits_created_at
  ON classifier_edits (created_at DESC);

CREATE INDEX idx_classifier_edits_propagation_status
  ON classifier_edits (propagation_status, created_at DESC);

-- Composite index for the aggregation hot path: group by
-- (field_path, change_type, before_value, after_value, rationale_tag) within
-- a rolling 14-day window. The (field_path, rationale_tag, created_at)
-- composite carries most of the work; histogram aggregation in pure SQL
-- does the rest.
CREATE INDEX idx_classifier_edits_aggregation
  ON classifier_edits (field_path, rationale_tag, created_at DESC);

-- Row-level security inheriting from the data-track convention.
ALTER TABLE classifier_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY classifier_edits_tenant_isolation ON classifier_edits
  USING (EXISTS (
    SELECT 1 FROM evaluations e
    WHERE e.id = classifier_edits.evaluation_id
      AND e.customer_id = current_setting('app.current_customer_id', true)
  ));

-- Default reviewer grant: SELECT on all non-PII columns. classifier_edits
-- never contains raw PII (the before / after values are envelope-field
-- values, which are sanitized by the PrePersistSanitizer before they ever
-- reach this table). All columns are reviewer-readable.
GRANT SELECT (
  id, evaluation_id, editor_id, editor_role,
  field_path, change_type, before_value, after_value,
  rationale_tag, rationale_text,
  created_at, propagation_status
) ON classifier_edits TO reviewer;

-- Senior reviewers and policy leads need INSERT capability via the API
-- module. The grants are scoped to the API role (a separate Postgres role
-- the feedback module connects as; see §7).
GRANT INSERT ON classifier_edits TO safeeval_feedback_writer;

-- pii_reviewer grant: no additional surface. classifier_edits does not
-- contain raw PII; the two-key escape valve does not need extension here.

-- DOWN (reversal):
-- REVOKE ALL ON classifier_edits FROM safeeval_feedback_writer;
-- REVOKE ALL ON classifier_edits FROM reviewer;
-- DROP POLICY IF EXISTS classifier_edits_tenant_isolation ON classifier_edits;
-- ALTER TABLE classifier_edits DISABLE ROW LEVEL SECURITY;
-- DROP INDEX IF EXISTS idx_classifier_edits_aggregation;
-- DROP INDEX IF EXISTS idx_classifier_edits_propagation_status;
-- DROP INDEX IF EXISTS idx_classifier_edits_created_at;
-- DROP INDEX IF EXISTS idx_classifier_edits_rationale_tag;
-- DROP INDEX IF EXISTS idx_classifier_edits_editor_role;
-- DROP INDEX IF EXISTS idx_classifier_edits_evaluation_id;
-- DROP TABLE IF EXISTS classifier_edits;
```

A 90-day TTL is applied via cascade -- when the upstream `evaluations` row ages out (per data-track scoping memo §7.2's 90-day live tier), the `ON DELETE CASCADE` on `evaluation_id` removes the associated edits. No separate edit-TTL job is required, matching the report-generator pattern in `docs/memos/2026-05-28-report-generator-implementation-spec.md` §6.1.

The schema fields map directly to the notation-grammar parse output from §2. The `propagation_status` column adopts the OSINT memo's `proposal_status` shape (§3 of `docs/memos/2026-05-28-osint-monitoring-scoping.md`) -- workflow states are an intentional borrow, the two surfaces benefit from the same convention. State transitions:

- `pending` (default at insert) -- API recorded the edit; aggregation job has not yet processed it.
- `aggregated` (intermediate) -- aggregation job clustered this edit with others into a candidate proposal; the proposal is in the architect's queue.
- `applied_to_prompt` (terminal) -- the architect adjudicated the cluster and the resulting amendment landed as a Stage N prompt revision (not a vocabulary change).
- `applied_to_vocab` (terminal) -- the architect adjudicated the cluster and the resulting amendment landed as an L1 / L2 / L3 / reason-code vocabulary addition or revision.
- `dismissed` (terminal) -- the architect adjudicated the cluster and decided no amendment was warranted (the edit was reviewer error, the cluster size was insufficient signal, or the proposed change conflicts with policy intent).

## 4. Closed-set `field_path` vocabulary

The set of envelope fields a reviewer can edit. Closed-set, lockstep-verified by a new `checkEditableFieldsLockstep` function in `scripts/check-lockstep.js`. Lands as `docs/08-v5-ontology.md` §3.15 alongside the implementation dispatch.

**Editable fields (closed set):**

| field_path | What it represents | Edit semantics |
|---|---|---|
| `l1.category` | L1 domain assignment (one of 7 closed-set values per `docs/08-v5-ontology.md` §1) | `change_type='modify'` only; before / after are L1 enum values |
| `l2.subcategory` | L2 risk pattern (closed-set per L1 per ontology §2) | `change_type='modify'` only; before / after are L2 enum values valid under the current L1 |
| `l3.method` | L3 `method:` value (open vocabulary per ontology §3.1) | `add` / `remove` / `modify` |
| `l3.tactic` | L3 `tactic:` value (open vocabulary per ontology §3.2) | `add` / `remove` / `modify` |
| `l3.target` | L3 `target:` value (open vocabulary per ontology §3.3) | `add` / `remove` / `modify` |
| `l3.overlap` | L3 `overlap:` value (open vocabulary per ontology §3.5) | `add` / `remove` / `modify` |
| `reason_codes[i]` | Indexed reason-code slot in the envelope's reason_codes array (the index `i` is part of the field_path) | `add` (at index i), `remove` (at index i), `modify` (at index i) |
| `disposition.action` | Stage 4 four-verb disposition (closed-set per `docs/04-enforcement-design.md`) | `change_type='modify'` only; before / after are in (`allow`, `safe_completion`, `human_review`, `block`) |
| `evidence.aggregate_score` | Stage 4 aggregate score in `[0, 1]` | `change_type='modify'` only; before / after are numbers |
| `evidence.component_scores.target` | Component score for the target dimension | `change_type='modify'` only; before / after are numbers in `[0, 1]` |
| `evidence.component_scores.lure` | Component score for the lure dimension | same as target |
| `evidence.component_scores.trust` | Component score for the trust dimension | same as target |
| `evidence.component_scores.extract` | Component score for the extract dimension | same as target |
| `evidence.component_scores.evade` | Component score for the evade dimension | same as target |
| `persona.claimed` | Stage 4 persona claim (closed-set per ontology §3.10 v5.3 draft) | `change_type='modify'` only; before / after are persona enum values |

**Explicitly NOT editable:**

- `audit_metadata.*` -- provenance is immutable. The Stage 1-4 prompt hashes, the cache key, the ontology / schema versions, the engine timestamp -- none can be edited. Modifying audit_metadata would break the replay surface and create a class of evaluations whose recorded state diverges from the engine's actual output. The reviewer who needs to override audit_metadata is asking the wrong question; the right path is to re-run the engine against the new prompt revision, which produces a new evaluation row.
- `pii_redaction_log` -- sanitizer output, not classifier output. The sanitizer is a separate concern (see `docs/memos/2026-05-28-data-track-scoping.md` §4.4); editing the redaction log retroactively would inject sanitizer-error signals into a corpus that should reflect what the sanitizer actually produced. If the sanitizer was wrong, the right fix is to revise the sanitizer and re-process; the right table to record that is `pii_redaction_log_amendments`, not `classifier_edits`.
- Raw input fields -- they don't exist in the persisted envelope per the PII zero-storage memo firing in parallel. Even if they did, editing user-submitted text would change the meaning of every other classifier field that referenced it. Edits target the classifier's outputs, not the engine's inputs.

The `field_path` list is a closed set: future fields are added via the standard architect-amendment flow plus a `checkEditableFieldsLockstep` build-break, identical to the L1 / L2 / L3 add-a-value workflow. The lockstep function reads the §3.15 markdown table, parses out the `field_path` column, and verifies it matches a `EDITABLE_FIELD_PATHS` constant exported from `src/lib/feedback/types.ts`. Divergence fails the build.

## 5. Closed-set `rationale_tag` vocabulary

Eighteen entries in the initial closed set. Lands as `docs/08-v5-ontology.md` §3.16; lockstep-verified by `checkRationaleTagLockstep`. The set is intentionally sized between "minimal" (5-7 entries; misses too much) and "comprehensive" (50+ entries; reviewers can't remember which to pick) -- 18 is the sweet spot per the closed-set-vocabulary discipline lessons from L1 (7 values, easy to memorize) and L2 (10-15 per L1, requires the L1 context for memorability). The `other` tag is the escape valve when no closed-set entry fits.

| rationale_tag | Definition |
|---|---|
| `wrong_l1_category` | L1 assignment was incorrect; the case belongs in a different L1 domain |
| `wrong_l2_subcategory` | L2 assignment was incorrect given the L1; a different L2 within the same L1 better fits |
| `wrong_l3_method` | The L3 `method:` value misidentifies the attack mechanic (e.g., phishing labeled as vishing) |
| `wrong_l3_tactic` | The L3 `tactic:` value misidentifies the psychological lever (e.g., urgency vs. authority) |
| `wrong_l3_target` | The L3 `target:` value misidentifies who or what was targeted |
| `wrong_l3_overlap` | The L3 `overlap:` value misidentifies the cross-typology overlap |
| `missing_reason_code` | A reason code that should have fired did not; the reviewer is adding it |
| `extra_reason_code` | A reason code fired that should not have; the reviewer is removing it |
| `false_bright_line_fire` | A bright-line indicator fired on a case that does not actually match the bright-line definition |
| `missed_bright_line` | A bright-line indicator should have fired but did not (typically due to prose-pattern miss in Stage 2) |
| `discriminator_boundary_unclear` | The Stage 2 discriminator-boundary prose did not give the model enough signal to choose between two adjacent L2s (e.g., `method:advance_fee_lawyer_fee` vs `L2:recovery_fraud` per ontology §3.1) |
| `severity_mismatch` | The case severity inferred by the engine (and reflected in the cascade) does not match the reviewer's assessment |
| `disposition_too_lenient` | The disposition was less restrictive than the case warranted (`allow` -> `human_review`, `safe_completion` -> `block`, etc.) |
| `disposition_too_strict` | The disposition was more restrictive than the case warranted (the inverse) |
| `component_score_off` | One of the five component scores (`target`, `lure`, `trust`, `extract`, `evade`) was numerically miscalibrated against the rubric |
| `persona_misidentified` | The Stage 4 persona claim (v5.3 draft vocabulary) misidentifies who the attacker is impersonating |
| `coverage_gap` | No existing vocabulary fits this case; the reviewer is signaling that the L3 vocabulary needs an addition (the architect's queue picks up the signal for a candidate amendment proposal) |
| `other` | None of the above fits; `rationale_text` MUST be populated with a free-text elaboration. The aggregation job clusters `other` entries by free-text semantic similarity (deferred to Phase 2; see §8) to identify candidate new closed-set additions. |

The `coverage_gap` tag is structurally distinct from `other` in an important way: `coverage_gap` is a *category-of-disagreement* tag (the reviewer thinks the vocabulary itself is missing something), whereas `other` is a *catch-all* tag (the reviewer's rationale does not fit any existing tag). Both deserve aggregation but for different reasons:

- `coverage_gap` clusters surface vocabulary-extension proposals to the architect at higher priority than aggregated tagged-edits (because the reviewer is explicitly saying "the FAF is missing a concept").
- `other` clusters require semantic similarity to be useful (multiple reviewers needing to write the same free-text explanation is the signal that a new tag should be added to the closed set). The Phase 2 LLM-assisted clustering of `rationale_text` is what makes `other` cluster usefully.

## 6. Closed-set `editor_role` vocabulary

Three entries at MVP. Lands as `docs/08-v5-ontology.md` §3.17 alongside the implementation dispatch. The permission matrix below is the load-bearing security property -- which role can edit which `field_path` value -- and is enforced in `src/lib/feedback/auth-gate.ts` (see §7).

| editor_role | Definition | Edit authority |
|---|---|---|
| `senior_reviewer` | Internal fraud reviewer with case-adjudication authority; senior in the sense of "has been trained on the discriminator-boundary policy" not in any HR sense | Edit L1 / L2 / disposition / component_scores / reason_codes; NOT permitted to edit L3 vocabularies or persona (those affect the closed-set vocabulary discipline at a level senior_reviewer is not authorized to influence) |
| `policy_lead` | The policy-track author equivalent; the person who authors FAF amendments | Edit anything except `audit_metadata` (which is structurally not editable -- see §4). Includes L3 vocabularies, persona, all reason_codes |
| `qa_reviewer` | Flag-only role; proposes edits to a senior_reviewer queue but cannot directly commit edits to `classifier_edits` | Edit NOTHING directly. QA reviewer edits go to a separate `qa_proposed_edits` queue (deferred to Standard tier; not in MVP -- see §11) |

**Permission matrix:**

```
                  senior_reviewer   policy_lead   qa_reviewer
l1.category              allow         allow        deny
l2.subcategory           allow         allow        deny
l3.method                deny          allow        deny
l3.tactic                deny          allow        deny
l3.target                deny          allow        deny
l3.overlap               deny          allow        deny
reason_codes[i]          allow         allow        deny
disposition.action       allow         allow        deny
evidence.aggregate_score allow         allow        deny
evidence.component_scores.*  allow     allow        deny
persona.claimed          deny          allow        deny
audit_metadata.*         deny          deny         deny    (structurally not editable)
```

The matrix is encoded in code as the `EDITOR_ROLE_PERMISSIONS` constant in `src/lib/feedback/auth-gate.ts`; the `checkEditableFieldsLockstep` validator also verifies the matrix in the ontology §3.17 markdown matches the code constant.

Why three roles and not more:

- The MVP three-role set covers the actual escalation gradient: case-level reviewer (senior_reviewer), framework-level author (policy_lead), and pre-adjudication flagger (qa_reviewer).
- Additional roles (`admin`, `auditor`, `read_only_observer`) are deferred. The `read_only_observer` role overlaps with the existing reviewer Postgres-grant pattern from the data-track Compliance-ready scope; the Postgres role grants do the work without a separate edit-table role being defined.
- Three roles is also a manageable matrix to memorize. A nine-role set would push reviewer training into a separate doc; three roles fit in one paragraph of the runbook.

## 7. API surface -- `src/lib/feedback/` module

New directory at `src/lib/feedback/` houses the API surface. Module layout mirrors the report-generator convention (`docs/memos/2026-05-28-report-generator-implementation-spec.md` §1) -- TypeScript, one-directory-per-concern, separate from `src/lib/safeeval-v5.js` (the engine stays pure; feedback is a downstream consumer).

```
src/lib/feedback/
  index.ts                 -- public entry point; exports recordEdit() and the error types
  notation-validator.ts    -- parses + validates inputs against the §2 grammar
  auth-gate.ts             -- enforces the §6 permission matrix; throws EditorRoleGateError
  db-client.ts             -- thin wrapper around the data-track db-client for INSERT path
  aggregation.ts           -- daily-cron aggregation job (§8); writes propagation_status transitions
  export.ts                -- fine-tuning corpus export (§9); produces JSONL output
  types.ts                 -- shared types (EditRecord, EditorContext, etc.)
  __tests__/               -- vitest suite
```

### 7.1 `recordEdit()` -- main entry point

```typescript
// src/lib/feedback/index.ts

export interface EditorContext {
  editor_id: string;      // placeholder for future auth; for now, the role name
  role: 'senior_reviewer' | 'policy_lead' | 'qa_reviewer';
}

export interface RecordEditArgs {
  evaluation_id: string;
  field_path: string;
  change_type: 'remove' | 'add' | 'modify';
  before_value: unknown;            // null when change_type = 'add'
  after_value: unknown;             // null when change_type = 'remove'
  rationale_tag: string;
  rationale_text?: string;          // mandatory when rationale_tag = 'other'
  editor_context: EditorContext;
}

export interface RecordEditResult {
  edit_id: number;
  propagation_status: 'pending';    // always 'pending' at insert
}

export async function recordEdit(args: RecordEditArgs): Promise<RecordEditResult>;
```

Pipeline inside `recordEdit()`:

1. Validate the input against the §2 notation grammar (closed-set checks for `field_path` and `rationale_tag`, type checks on `before_value` / `after_value` per the field, `rationale_text` presence when tag is `other`, `change_type` consistency with before / after nullness). Throw `MalformedNotationError` on any failure.
2. Consult the auth gate (§7.2) with `(editor_context.role, field_path)`. Throw `EditorRoleGateError` if the role is not authorized to edit the field per the permission matrix.
3. Insert into `classifier_edits` via `db-client.ts`. Return the edit_id and the initial `propagation_status: 'pending'`.

The function is intentionally idempotent across retries on the same `(evaluation_id, field_path, change_type, before_value, after_value, editor_id, created_at)` -- if the same edit is submitted twice (e.g., reviewer's tooling retries on a network blip), the second insert is a no-op (catch the UNIQUE-violation-on-equivalent-row and return the existing edit_id). The UNIQUE constraint is implicit (no DDL-level UNIQUE is added; the deduplication is application-layer on the millisecond timestamp).

### 7.2 Auth gate -- `EditorRoleGateError`

Mirrors the `LegalAccessGateError` pattern from `src/lib/report-generators/index.ts:84` (commit `2632a66`'s Phase 2 stub). The shape:

```typescript
// src/lib/feedback/auth-gate.ts

export class EditorRoleGateError extends Error {
  override readonly name = 'EditorRoleGateError';
  readonly editor_role: string;
  readonly field_path: string;
  constructor(editor_role: string, field_path: string) {
    super(
      `Editor role '${editor_role}' is not authorized to edit field_path ` +
        `'${field_path}'. See docs/runbooks/classifier-edits-access.md for ` +
        `the permission matrix. Phase 2 stub: roles are passed via the ` +
        `editor_context object; Phase 3 will replace this with a real ` +
        `token-validation routine consulting a role-grant table.`
    );
    this.editor_role = editor_role;
    this.field_path = field_path;
  }
}

// EDITOR_ROLE_PERMISSIONS is the §6 permission matrix in code form.
const EDITOR_ROLE_PERMISSIONS: Record<string, Set<string>> = {
  senior_reviewer: new Set([
    'l1.category', 'l2.subcategory',
    'reason_codes', 'disposition.action',
    'evidence.aggregate_score',
    'evidence.component_scores.target',
    'evidence.component_scores.lure',
    'evidence.component_scores.trust',
    'evidence.component_scores.extract',
    'evidence.component_scores.evade',
  ]),
  policy_lead: new Set([
    'l1.category', 'l2.subcategory',
    'l3.method', 'l3.tactic', 'l3.target', 'l3.overlap',
    'reason_codes', 'disposition.action',
    'evidence.aggregate_score',
    'evidence.component_scores.target',
    'evidence.component_scores.lure',
    'evidence.component_scores.trust',
    'evidence.component_scores.extract',
    'evidence.component_scores.evade',
    'persona.claimed',
  ]),
  qa_reviewer: new Set(),  // flag-only; deferred to Standard tier
};

export function checkAuthGate(
  editor_role: string,
  field_path: string
): void {
  // Normalize reason_codes[i] -> reason_codes for permission check
  const normalized = field_path.startsWith('reason_codes[')
    ? 'reason_codes'
    : field_path;
  const allowed = EDITOR_ROLE_PERMISSIONS[editor_role]?.has(normalized) ?? false;
  if (!allowed) {
    throw new EditorRoleGateError(editor_role, field_path);
  }
}
```

The Phase 2 boundary is identical to the report-generator pattern: the auth gate is a stub (the editor_id is the role name passed in by the caller; there is no real authentication). Phase 3 replaces the stub with a token-validation routine that consults a `reviewer_role_grants` table. The boundary is the `checkAuthGate` function's signature; replacing its body does not touch callers.

### 7.3 Notation validator

Validates input against the §2 grammar. Rejects malformed records before any database side effect. Returns void on success; throws `MalformedNotationError` on failure with a structured `reason` field naming the specific violation (`unknown_field_path`, `unknown_rationale_tag`, `before_after_type_mismatch`, `rationale_text_required_for_other`, `change_type_nullness_violation`).

The validator is a pure function (no I/O), which makes it test-friendly and cheap to invoke. The closed-set vocabularies it consults (`EDITABLE_FIELD_PATHS`, `RATIONALE_TAGS`, `EDITOR_ROLES`) are imported from `types.ts` and lockstep-verified against `docs/08-v5-ontology.md` §§3.15 / 3.16 / 3.17 by `checkEditableFieldsLockstep` and `checkRationaleTagLockstep` in `scripts/check-lockstep.js`.

## 8. The aggregation loop (the constructive-feedback part)

This is the section that turns reviewer edits into supervision signal for policy and (eventually) for the fine-tuned model. The Standard tier ships a daily aggregation job; Full tier adds free-text semantic clustering. The MVP tier defers aggregation to manual SQL queries against the table -- the operator runs the histogram by hand.

### 8.1 Daily aggregation cron

A cron job (Vercel cron per the OSINT memo's §11 Q3 recommendation, or GitHub Actions if Vercel cron is rejected) runs `src/lib/feedback/aggregation.ts` once per day. The job:

1. Selects all `classifier_edits` rows with `propagation_status = 'pending'` and `created_at >= now() - INTERVAL '14 days'`.
2. Groups by the tuple `(field_path, change_type, before_value, after_value, rationale_tag)`. Note that `rationale_text` is intentionally NOT in the grouping key -- the closed-set tag carries the supervision signal; the free-text is for semantic clustering deferred to Phase 2.
3. For each group, counts the number of distinct edits (a "cluster size") and the number of distinct `editor_id` values contributing to the cluster.
4. When a cluster meets the surfacing threshold (default: cluster size >= 5 AND distinct editors >= 3), the cluster is surfaced as a `route-to-steven` proposal to the architect track. The proposal shape:

```
## Architect proposal -- classifier-edit cluster (N=<cluster_size>)

**Field:** <field_path>
**Change type:** <change_type>
**Before -> After:** <before_value> -> <after_value>
**Rationale tag:** <rationale_tag>
**Cluster size:** <cluster_size> edits from <distinct_editor_count> distinct editors
**Time window:** <earliest_created_at> to <latest_created_at>
**Sample edit IDs:** <up_to_10_edit_ids>

**Suggested amendment:** <rendered from the (field_path, change_type, rationale_tag) tuple>

**Architect adjudication options:**
- `applied_to_prompt` -- the cluster indicates a Stage N prompt revision (e.g., disposition-rule clarification, discriminator-boundary tightening)
- `applied_to_vocab` -- the cluster indicates an L1 / L2 / L3 / reason-code vocabulary addition or revision
- `dismissed` -- the cluster does not warrant an amendment (reviewer error, insufficient signal, conflicts with policy intent)
```

5. Update `propagation_status = 'aggregated'` on every edit in a surfaced cluster.
6. Edits that did NOT meet the threshold stay at `propagation_status = 'pending'` and roll into the next cycle's window.

### 8.2 Threshold tuning

The MVP defaults (`cluster_size >= 5`, `distinct_editors >= 3`, `14-day window`) are starting points. Calibration:

- **Too low:** the architect gets deluged with under-evidenced clusters. The dismissed-rate metric (analogous to OSINT memo §9 M1) tracks this -- when `dismissed_rate_30d > 0.5`, the cron raises the threshold (e.g., to `cluster_size >= 8`).
- **Too high:** real signal sits below the threshold and never surfaces. The Phase 2 `other`/`coverage_gap` semantic-clustering audit (Full tier) catches missed signal as a backup; until Full tier ships, the operator runs a manual `propagation_status = 'pending'` SELECT once a quarter to spot-check whether anything was missed.

Threshold values are persisted in a `feedback_config` JSONB document (separate from the table; not a schema change) so the operator can tune without a code deploy. Default values are committed to the JSONB doc at migration time.

### 8.3 Free-text rationale semantic clustering (Phase 2 / Full tier)

Deferred from MVP and Standard. The Full tier adds:

- Periodic (weekly, monthly) LLM-assisted clustering over `rationale_text` for rows where `rationale_tag IN ('coverage_gap', 'other')`.
- The clustering identifies themes in the free-text that don't fit existing closed-set tags. Examples of what the clustering should surface:
   - Three different reviewers wrote `rationale_text` mentioning "the L3 method should be 'pretexting_video_call'" -- this becomes a candidate new L3 `method:` value.
   - Five different reviewers wrote `rationale_text` for `rationale_tag = 'other'` describing "the case was actually a recovery-fraud secondary victimization but the L2 stayed at romance_fraud" -- this becomes a candidate new rationale tag (`secondary_victimization_misclassified`) or a candidate strengthening of an existing tag's definition.
- The clustering job writes proposals to the architect queue with a different shape (`source: 'rationale_text_cluster'`) so the architect's adjudication routine differentiates closed-set-tag clusters from free-text clusters.

Phase 2 implementation requirements (not in MVP / Standard):

- LLM model choice (Haiku for cost; Sonnet if Haiku's surfacing-quality is insufficient).
- Cluster-quality metric (architect's accept-rate on free-text-cluster proposals; if accept-rate drops below 0.3 sustained, retune the prompt).
- Privacy guard: `rationale_text` MUST NOT contain raw PII (sanitizer runs on the text at write time per §11 R3 mitigation). The LLM clustering call therefore sees only sanitized text; even so, the call is made via the same Anthropic API contract as the engine (no third-party LLM service sees the corpus).

The Full tier defers naturally to once the Standard tier has accumulated enough edits to make clustering meaningful -- a clustering job over 20 rows is not useful; over 2000 rows is.

## 9. Fine-tuning corpus generation

Every `classifier_edits` row, joined to its upstream `evaluations` row, produces one training tuple:

```
{
  input: <sanitized envelope -- the engine's input that produced original_output>,
  original_output: <the engine's emitted envelope before the edit>,
  corrected_output: <the engine's envelope after the edit applied>,
  rationale: {
    tag: <rationale_tag>,
    text: <rationale_text or null>,
    editor_role: <editor_role>,
  },
  audit_metadata: <original envelope's audit_metadata for provenance>,
}
```

The corpus is exported as JSONL (one JSON object per line). Export shape is identical for both fine-tuning targets:

- **Stage 2 discriminator fine-tuning:** filter to edits where `field_path IN ('l1.category', 'l2.subcategory', 'l3.method', 'l3.tactic', 'l3.target')`. These are the L1 / L2 / L3 assignment fields the discriminator is responsible for. The `corrected_output` tells the discriminator what the right label was; the `rationale_tag` provides the structured rationale (training signal); the `rationale_text` is optional supervision (carried through to the corpus but typically dropped for the gradient signal).
- **Stage 4 cascade fine-tuning:** filter to edits where `field_path IN ('disposition.action', 'evidence.aggregate_score', 'evidence.component_scores.*')`. These are the cascade-evaluation fields. Same export shape; different target model.

The export module (`src/lib/feedback/export.ts`) gates the corpus dump behind a flag (`SAFEEVAL_FINETUNE_EXPORT_ENABLED`); when the flag is unset, the export entry point throws `ExportGatedError`. The recommendation per §14 Q5 is that the export is always gated (the corpus is a sensitive artifact -- if a misconfigured deployment exports it to a third party, the damage is unrecoverable).

The export shape preserves provenance via `audit_metadata` so a downstream pipeline can trace any training tuple back to the originating evaluation. If a fine-tuned model misbehaves in production, the offending training tuples are recoverable by `audit_metadata.cache_key`.

PII handling in the corpus: the export reads sanitized envelopes only (the data-track's PrePersistSanitizer ran before the envelope ever landed in `evaluations`). `rationale_text` is sanitized at write time per §11 R3 mitigation. The export does NOT touch the two-key unredacted column; that surface is never part of the fine-tuning corpus by construction.

## 10. Reviewer UI implication (out of scope; flagged for follow-on memo)

The reviewer UI is the surface a reviewer would actually click through to make edits. Today there is no UI surface for this; the API is built first; UI work is a separate later memo.

For the portfolio deployment, the API is sufficient: reviewers can invoke `recordEdit()` from curl, from Postman, or from a simple Python script that wraps the HTTP endpoint. This demonstrates the API design (the load-bearing portfolio signal) without requiring UI polish.

A reviewer-UI follow-on memo would cover:

- Inline edit affordances in the evaluation display (click a field -> edit -> rationale picker drops down).
- Permission-aware UI (qa_reviewer sees flag-only buttons; senior_reviewer sees edit affordances on permitted fields only; policy_lead sees the full edit surface).
- Bulk-edit workflow (when the architect's adjudication produces an `applied_to_prompt` decision, the same change needs to be applied to the population of pending re-evaluation cases).
- Undo / redo / edit-history view.
- Integration with the report generator's reviewer-audience view (the report-generator's `reviewer` audience already names "Adjudication checklist" as a section; the UI integration is the natural extension of that section into actionable buttons).

The follow-on memo unblocks once: (a) the API ships and accumulates enough edits to make the UI's affordance design concrete, or (b) Steven decides the portfolio narrative requires UI polish over API depth (in which case the API + UI ship together).

## 11. Three scope tiers

Three concrete tiers. Recommendation is Standard (§11.2).

### 11.1 MVP -- API + table + manual aggregation

- API module (`src/lib/feedback/` with `recordEdit()`, `notation-validator`, `auth-gate`, `db-client`, `types`).
- M5 migration applied (`classifier_edits` table, indexes, RLS).
- `editor_role` MVP set: `senior_reviewer` + `policy_lead` only; `qa_reviewer` deferred to Standard tier (its flag-only behavior requires a separate `qa_proposed_edits` table that adds scope).
- Closed-set vocabularies (`field_path` §4, `rationale_tag` §5, `editor_role` §6) authored in `docs/08-v5-ontology.md` §§3.15 / 3.16 / 3.17 and lockstep-verified.
- No aggregation cron. The operator runs SELECT queries by hand to spot patterns; the `propagation_status` column stays at `pending` until manual intervention moves it.
- No fine-tuning corpus export. The data is in the table; the export is a Standard-tier addition.

**Dispatch budget:** ~$50 - $80 (API module + migration + ontology amendments + lockstep validator extension + unit tests). Lands in roughly two to three days of dispatch work.

**Why this is named:** it is the smallest possible portfolio artifact that demonstrates the API design. A hiring reader sees the table, the API, the closed-set vocabularies, the auth gate; they can infer the aggregation loop from the schema's `propagation_status` column without seeing the cron implementation.

### 11.2 Standard (recommended) -- API + table + daily aggregation cron + structured proposals

Everything in MVP, plus:

- Daily aggregation cron (`src/lib/feedback/aggregation.ts` + Vercel cron / GitHub Actions cron).
- Structured `route-to-steven` proposals to the architect track when clusters meet the threshold.
- Fine-tuning corpus export (`src/lib/feedback/export.ts`) with the export-gated flag.
- `qa_reviewer` role added to the closed set, but its flag-only `qa_proposed_edits` queue is deferred to Full tier (the role is named in the closed set so the matrix has a slot; the actual flag-routing behavior ships later).
- Free-text semantic clustering of `rationale_text` is deferred to Full tier; the architect adjudicates `other`/`coverage_gap` clusters manually until Full ships.

**Dispatch budget:** ~$120 - $180 (MVP + cron implementation + corpus export + integration tests against a synthetic edit corpus + ontology vocabulary additions). Lands in roughly four to six days of dispatch work.

**Why this is the recommendation:** Standard is the "demonstrably working loop" tier. The aggregation cron is what turns the edit storage layer from "data that exists" into "supervision signal that influences the framework." A hiring reader sees the closed-loop policy framework end-to-end -- engine emits envelope, reviewer edits, edits aggregate, proposals reach architect, architect amends, amendment lands in the engine. The marginal cost over MVP is concentrated in the aggregation cron, which is also the highest-portfolio-value addition (the loop closure IS the JD signal).

### 11.3 Full -- Standard + LLM-assisted free-text clustering + UI affordances + auto-propagation

Everything in Standard, plus:

- LLM-assisted clustering over `rationale_text` for `coverage_gap` and `other` tagged edits per §8.3.
- `qa_reviewer` flag-only flow: `qa_proposed_edits` table, routing logic from QA proposal to senior_reviewer queue, accept / reject affordance for the senior_reviewer to promote the QA proposal into a `classifier_edits` row.
- Reviewer UI per §10 (substantial separate work; named here for completeness).
- Auto-propagation: when the architect adjudicates a cluster as `applied_to_prompt` or `applied_to_vocab`, an automated job re-evaluates the affected evaluations against the new prompt / vocabulary and surfaces any disposition changes for review. This is the closing-the-feedback-loop step.

**Dispatch budget:** ~$300 - $450 (Standard + LLM clustering + qa_reviewer flow + UI + auto-propagation). Lands in roughly ten to fifteen days of dispatch work.

**Why this is named but not recommended for adoption now:** the marginal value of Full over Standard is concentrated in the UI and the LLM-assisted free-text clustering. The UI requires its own design / engineering pair of dispatches (per §10); the LLM clustering requires the Standard tier to have accumulated enough edits to make clustering meaningful (a chicken-and-egg problem with the portfolio deployment's low expected traffic). Adopt Full when (a) the reviewer UI follow-on memo lands and is adjudicated, or (b) the corpus has accumulated past ~2000 edits and the architect's adjudication time on `other`/`coverage_gap` clusters becomes a measurable cost.

**Recommendation:** Standard (§11.2). The marginal value of Full over Standard depends on inputs the portfolio deployment cannot produce in the short term; Standard is the sweet spot.

## 12. Risks

Five named risks. Each is mitigated by the spec or flagged as a residual concern the feedback module manages going forward.

**R1: Notation grammar is too rigid -- reviewers go around the system.** A reviewer who cannot express their disagreement within the closed-set notation will resort to writing free-text case notes outside the system, or to giving up and not recording the disagreement at all. The notation grammar's value depends on reviewer adoption; if adoption is low, the table sits mostly empty and the aggregation loop never surfaces meaningful clusters.

**R2: Closed-set rationale vocabulary missing important patterns.** Reviewers use `other` for everything because the closed-set tags don't fit their actual reasoning. The structured supervision signal degrades to "edit count by field_path" without the rationale-tag dimension; free-text becomes the primary signal, and the closed-set discipline is vestigial.

**R3: Auth gate misconfiguration -- wrong reviewers edit fields they shouldn't.** The Phase 2 stub passes editor_role via the editor_context object; nothing verifies the caller is actually that role. A misconfigured deployment (or a malicious internal user) can submit edits claiming a higher role than the one they're entitled to, corrupting the supervision signal with unauthorized edits.

**R4: Aggregation surfacing too many or too few proposals.** Threshold tuning is hard: too low and the architect gets deluged; too high and real signal sits unsurfaced. The dismissed-rate metric mitigates but does not eliminate -- the metric only tells you when the surfacing is bad, not when it's silently missing signal.

**R5: Fine-tuning data leaks PII.** Edits target the sanitized envelope, so PII should never reach the corpus. But if the sanitizer ever has a bug that lets PII through (a class of bug that is structurally hard to eliminate per the data-track scoping memo's §4 false-negative discussion), the edits row would carry the PII forward into the fine-tuning corpus -- which the model trains on -- which is unrecoverable contamination.

## 13. Mitigations

Each mitigation is concrete and implementable:

**M1 (against R1, notation grammar too rigid):** The `other` rationale tag plus the `coverage_gap` tag together are the escape valves. A reviewer who cannot fit their reasoning into the closed set has two options that keep the system useful: (a) use `other` with a free-text elaboration, which the Phase 2 semantic-clustering surface picks up as a candidate new closed-set addition; (b) use `coverage_gap` to explicitly flag "the L3 vocabulary is missing something," which goes to the architect at higher priority. The escape valves keep adoption high while preserving the structured-signal discipline; the architect's review of `other` clusters tunes the vocabulary toward what reviewers actually need.

**M2 (against R2, closed-set vocabulary missing patterns):** The `dismissed_rate_30d` metric per `rationale_tag` is tracked separately from the overall metric (per-tag dismissed rates surface in the operator's dashboard query). When the `other` tag's share of total edits exceeds 30% sustained over two cycles, the architect's dispatch ritual includes a "vocabulary gap audit" session that reviews the `other` cluster and proposes tag additions. The metric is the trigger; the audit is the load-bearing mitigation.

**M3 (against R3, auth gate misconfiguration):** Three-layer defense. Layer 1: Phase 2 stub explicitly documents the assumption (editor_id is the role name passed in; there is no real auth). The runbook (`docs/runbooks/classifier-edits-access.md`) names the surface and forbids deploying to a multi-user posture without first landing Phase 3. Layer 2: Postgres role grants -- the API module connects as `safeeval_feedback_writer`, which has INSERT but no UPDATE / DELETE. A bug in the API cannot corrupt existing edits; it can only insert new ones, which are auditable by `created_at`. Layer 3: per-edit audit log -- every `classifier_edits` row records `editor_id`, `editor_role`, `created_at`, and the source IP of the inserting request (added to the schema in Phase 3 alongside the real auth). The audit log makes unauthorized edits detectable after the fact. Sanitization of `rationale_text` also runs at this layer to address the §11 R3 PII concern (the field is run through the same PrePersistSanitizer used for the evaluation envelope before INSERT).

**M4 (against R4, aggregation surfacing):** Two-direction metric -- `dismissed_rate_30d` tracks over-surfacing; the quarterly architect spot-check of `propagation_status = 'pending'` rows tracks under-surfacing. Both are in the operator runbook. When either metric exceeds its threshold (dismissed > 0.5 sustained two weeks; pending spot-check finds >5 missed clusters per quarter), the threshold tuning surfaces. The `feedback_config` JSONB doc lets the operator tune without a code deploy. Standard tier's recommendation: ship with the MVP defaults; expect to tune once in the first 90 days based on the first dismissed-rate readout.

**M5 (against R5, fine-tuning data leaks PII):** Three layers, mirroring data-track §4.5 two-key access tier. Layer 1: the corpus export reads sanitized envelopes only (PrePersistSanitizer ran upstream). Layer 2: `rationale_text` is sanitized at write time in the API module (R3 mitigation does double duty). Layer 3: the export module is gated behind `SAFEEVAL_FINETUNE_EXPORT_ENABLED`; the export gate is a separate access boundary from the database role grants. A misconfigured deployment that leaves the gate enabled but exposes the export endpoint to the public is still bounded by the database's RLS (the API connects as `safeeval_feedback_writer` which has no SELECT grant; the export module connects as a separate `safeeval_corpus_reader` role with SELECT but no INSERT). The three layers are independent; defense-in-depth.

## 14. Open questions for Steven -- escalation field per fifth atomic amendment

Five open questions, each carrying the `escalation:` field. Two are `route-to-steven`; three are `default-accept`.

1. *(escalation: default-accept, rec: cluster_size >= 5 AND distinct_editors >= 3 within a 14-day window)* **Aggregation threshold N and window.** The §8.1 default thresholds are starting points; the `feedback_config` JSONB doc lets the operator tune without a code deploy. Recommendation is to ship with the documented defaults and tune in the first 90 days based on dismissed-rate readout. Lower thresholds increase architect load; higher thresholds increase miss rate. Default-accept unless Steven has a specific calibration preference at launch.

2. *(escalation: default-accept, rec: defer qa_reviewer flow to Standard tier; ship MVP with senior_reviewer + policy_lead only)* **Whether `qa_reviewer` flag-only role ships in MVP or deferred.** The MVP recommendation defers `qa_reviewer` -- its flag-only behavior requires a separate `qa_proposed_edits` table and routing logic that adds scope beyond the API module. The role is named in §6 with the deferred-MVP marker so the closed set is correct on day one; the flag-routing infrastructure lands in Standard. Default-accept unless Steven wants the flag-only flow shipped at MVP.

3. *(escalation: route-to-steven, reason: affects architect cadence and queue management materially -- `coverage_gap` auto-notification produces architect work at the rate of OSINT-discovery-of-vocabulary-gaps, which could be weekly during early reviewer adoption; the choice between auto-notification and batched-review is a bandwidth allocation decision)* **Whether `coverage_gap` rationale-tag auto-creates a `safeeval-arch` notification.** The §5 vocabulary identifies `coverage_gap` as explicitly signaling vocabulary-extension proposals. Option A: each `coverage_gap` edit auto-creates a notification to the architect queue (high signal-to-noise, but high cadence). Option B: `coverage_gap` edits aggregate normally through the §8.1 threshold path (same cadence as other tags, but the dedicated semantic is lost). Recommendation tentatively Option B (same path as other tags; the §8.3 Full-tier free-text clustering catches the signal eventually) but Steven's call -- if Steven wants the dedicated coverage-gap path at higher priority, Option A is the right shape.

4. *(escalation: default-accept, rec: append-only with `propagation_status: dismissed` as the soft-delete path)* **Whether edit history is immutable (append-only) or supports redaction.** Recommendation is append-only. Reasons: (a) edits are supervision signal -- removing them retroactively distorts the corpus; (b) the auditable history is part of the M3 mitigation; (c) the soft-delete path via `propagation_status = 'dismissed'` covers the legitimate "this edit was wrong" case without removing the row (the architect adjudicates `dismissed` as the explicit signal that the edit was reviewer error). Default-accept unless Steven wants a hard-delete capability for compliance reasons.

5. *(escalation: route-to-steven, reason: the export-gated decision touches the commercial-tier roadmap -- if Steven wants the corpus always-available for portfolio demonstration of "look at the fine-tuning data we're collecting," gated-by-default-only conflicts with that narrative; if Steven wants the corpus only available when an export deploy is explicitly enabled, gated-by-default matches but reduces portfolio visibility)* **Fine-tuning corpus export -- gated behind a flag or always-available?** §9 names the recommendation as gated (the corpus is a sensitive artifact; default-deny matches the data-track's overall security posture). Alternative: always-available behind a separate `safeeval_corpus_reader` Postgres role with SELECT-only grant. The alternative is more "look, the data is here, queryable" for a hiring reader but increases the surface area for an accidental export to a third party. Recommendation tentatively gated; Steven's call because the portfolio-visibility tradeoff is his call.

**Two `route-to-steven` (Q3 coverage_gap notification routing, Q5 corpus export gating) pause auto-chaining; three `default-accept` (Q1 aggregation threshold, Q2 qa_reviewer deferral, Q4 append-only history) proceed with tentative recommendations.**

## 15. Adversarial review -- strongest case against this memo's conclusion

Required per design-memo-author skill (mode C). The adversarial review can only downgrade confidence; it does not flip the decision.

### 15.1 Strongest case against shipping this

"This is a feedback system without a UI to consume it. Reviewers will not use a curl API to file edits; the API is a hypothetical surface that demonstrates design intent without proving the loop actually closes. The portfolio value is the UI affordance that makes editing feel native -- without it, the M5 migration is just a table that lands a schema and accumulates zero rows."

This is the strongest single argument against the proposal. The Standard tier's recommendation rests on the claim that the API surface + aggregation cron + corpus export is the load-bearing portfolio signal. But a real reviewer in a real T&S org would not interact with `classifier_edits` via curl; they would interact via a UI. The proposal's value depends on the UI follow-on memo eventually landing; if the UI memo does not land (because it's a separate dispatch and the portfolio narrative might shift before it does), the M5 migration is a feature without a consumer.

**Refutation:**

- (a) Portfolio purposes are about API design demonstration, not UI polish. A hiring reader at an AI Trust & Safety org reads the M5 DDL, the closed-set vocabularies, the auth-gate stub, and the aggregation loop -- and recognizes the framework discipline. The JD signal is "you understand how reviewer supervision becomes training data"; demonstrating that understanding does not require a clickable surface. The exact analog is the report generator's Phase 2 surface (`docs/memos/2026-05-28-report-generator-implementation-spec.md`) which ships an API + storage + auth-gate stub without a reviewer-facing UI -- and is correctly characterized as portfolio-complete because the API design IS the JD signal.
- (b) Curl / Postman / scripted edits are sufficient for the dogfood demo Steven could run himself. A reviewer-style synthetic workload -- 50 evaluations, 20 edits across 3 simulated reviewer roles, aggregation cron runs, architect proposal surfaces -- demonstrates the closed loop end-to-end without a UI. The portfolio narrative includes "I ran the loop against synthetic reviewer workload and the aggregation surfaced N proposals," which is a stronger signal than "I built a polished UI that nobody used."
- (c) UI work is a separable follow-on memo (per §10). Bundling UI into this scope would crowd out other Phase 1 priorities -- the OSINT operationalization is in flight, the synthetic-media detection is in flight, the security/compliance posture is in flight. The Standard tier's dispatch budget assumes none of those compete with this work for the same architect / engineering attention; adding UI work blows that assumption.

The refutation does not eliminate the risk; it bounds it. The risk is "the UI never lands and the M5 migration is unused"; the bound is "the API design ships either way and the JD signal is demonstrated either way."

### 15.2 Strongest case FOR including UI in this scope

"Without the UI, edits are just an API hypothetical. The loop closure is invisible to the public surface (the live SafeEval Vercel app); a hiring reader visiting the deployment sees no edit affordances, no edit history, no aggregation widget. The portfolio value of the closed-loop framework depends on the loop being visible end-to-end, including the human-input side."

This argues that the policy-loop closure (the API + aggregation + export) is the wrong primary because it is invisible to the user-facing SafeEval surface. The OSINT memo's §12.2 made a structurally similar argument and refuted it on three grounds; the refutation applies here too with one important variation -- the reviewer UI is closer to user-facing than the OSINT pipeline is.

**Refutation:**

- (a) The same argument applies to the report generator's Phase 2 ship: the API + storage + auth-gate stub is portfolio-complete because the API design is the signal. The reviewer-UI argument is structurally identical and gets the same answer.
- (b) The visible-surface concern is real but bounded -- a hiring reader who reads the closed-loop architecture in the memo (engine -> reviewer edit -> aggregation -> architect amendment -> engine) sees the framework discipline. A hiring reader who clicks through the live app and looks for edit buttons sees a portfolio app, not a reviewer console. Those are different reviewer-personas reading the artifact; both are addressed by the memo (architecture) plus the live app (engine demo).
- (c) The §10 follow-on UI memo is the explicit answer to "when does the visible surface land?" The closure is sequenced: API + table + aggregation now (Standard); UI when the follow-on memo is adjudicated. Bundling them into one scope inverts the sequencing without adding value.

### 15.3 Recommended adjustment

The adversarial review **HOLDs** the proposal at Standard scope (§11.2) with one observability hardening:

- The §13 M2 vocabulary-gap audit metric (per-tag dismissed rates surfacing `other`'s share-of-total) MUST be in the operator runbook from Standard-tier ship, not as a Phase 2 add-on. The recommended Standard tier dashboard query is documented in the runbook the implementation dispatch produces. Without this metric in the runbook, the vocabulary-degradation failure mode (R2) is not visible to the operator until the corpus is corrupted.

This adjustment does not change the §11 decision. The proposal stands at Standard scope with the vocabulary-gap metric in the runbook as a load-bearing component.

## 16. Sequencing dependency

The implementation is gated on three upstream dependencies, one already resolved and two in flight:

- **Data track Phase 2 shipped (already done -- commit `33a6075`).** The M5 migration runs against the data-track schema-migrations runner; the runner exists because the data track has shipped its Compliance-ready tier. This dependency is satisfied at memo-authoring time.
- **PII zero-storage decision (firing in parallel).** If the parallel PII zero-storage memo adopts Tier A (no raw input ever persisted), the feedback module's R5 mitigation simplifies (the only PII surface is `rationale_text`, and §13 M5 layer 2 covers it). If Tier B or C is adopted (raw input persisted under the two-key access tier with stricter controls), the feedback module's `rationale_text` sanitizer needs to inherit the same controls. Implementation cannot land until the PII zero-storage memo's adjudication is in hand because the sanitizer surface for `rationale_text` depends on it.
- **Architect queue capacity.** Not a blocker (architect track is currently below capacity per the OSINT memo's §13 same flag). Worth noting that this proposal AND the OSINT proposal both surface `route-to-steven` clusters to the same architect queue; if both ship at Standard tier, the architect's combined load is two cron-driven proposal streams. The `feedback_config` threshold-tuning surface gives the operator a knob to reduce load if the combined volume exceeds capacity.

With the data-track dependency satisfied and the PII zero-storage decision in flight, the feedback-loop implementation dispatch can land on the data track's next available capacity window after the PII memo adjudication completes.

## 17. Closure

Scoping memo ready; implementation queued behind the PII zero-storage decision and Steven's adjudication of the two `route-to-steven` questions (Q3 coverage_gap auto-notification, Q5 corpus export gating). The proposal stands at Standard scope (§11.2) with the M2 vocabulary-gap metric promoted to a Standard-tier load-bearing component per the adversarial review's recommended adjustment.

**Cover-letter angle.** Even at scoping-memo stage, this work demonstrates the "AI-augmented investigation workflows that improve scale and repeatability" pillar of the OpenAI threat-intel JD bullet. The structured edit-and-feedback loop is the literal mechanism by which reviewer judgment scales -- it converts the labor of "filing a brief about a missed vocabulary entry" into the cost of "checking a tag," and converts that signal into both near-term policy amendment proposals and long-term fine-tuning corpus. Pair this memo with the OSINT scoping memo as the "shipping next" entries in the cover letter; together they close both halves of the framework's policy loop (OSINT closes the outer half on emerging-TTP detection; this memo closes the inner half on reviewer-judgment supervision).

## 18. Decisions-log entry (for docs/policy-spec-v5.0.md section 9)

**Not applicable.** This memo proposes an API and persistence-layer surface plus three new closed-set vocabularies (`field_path`, `rationale_tag`, `editor_role`). The vocabularies will warrant §9 entries once they land in the ontology (the implementation dispatch's lockstep-verifier additions are the triggering event); the API design itself is architecture-shape, which sits in the design-memo layer and does not promote to §9. Downstream amendments accepted by the architect via the aggregation loop will each generate their own §9 entries via `policy-author` at the time they land.

**Open questions enumerated:** 5 (Q1 through Q5 in §14).
**Of which `route-to-steven`:** 2 (Q3 coverage_gap auto-notification, Q5 corpus export gating).
**Of which `default-accept`:** 3 (Q1 aggregation threshold, Q2 qa_reviewer deferral, Q4 append-only edit history).
