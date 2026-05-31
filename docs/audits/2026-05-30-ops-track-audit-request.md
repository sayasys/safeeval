# Ops Track audit request — VS Code shipment sweep (2026-05-30)

**Requested by:** Steven (via Dispatch orchestrator)
**Audit window:** commits `4e073d5..5f54937` (live on safeeval.vercel.app)
**Severity required:** CRITICAL / MEDIUM / LOW per finding
**Verdict required:** PASS / CONDITIONAL / FAIL

## Context

Over the past day ~30+ VS Code sessions shipped substantial work directly to `origin/main`, bypassing the normal Cowork track-architect dispatch flow. Several of the new surfaces introduce *operational* surface area — a custom-pattern promotion lifecycle, a reviewer workflow for pending patterns, a report-generation dispatcher, and OSINT source fetchers. This memo requests an ops-lens audit of whether those operations are runnable, gated correctly, and documented.

## What to audit (track-specific scope)

1. **Shadow -> live promotion gates for custom patterns.** The M15 promotion-lifecycle migration (`src/lib/data/schema/M15_promotion_lifecycle_persistence.sql`) and the Phase-4 promotion gate enforce a multi-condition gate: precision proxy 0.7 / 50 evals / 10 feedback / >=2 reviewers. Audit whether these thresholds are the right operational bar (too lax = bad patterns promote; too strict = nothing ever promotes), whether the gate is conjunctive as intended, and whether a pattern stuck below the gate has a clear operational disposition.
2. **Custom-pattern review workflow.** Patterns have an `active | archived` lifecycle (not draft/live). Audit whether there is a reviewer SOP under `docs/ops/reviewer-sops/` covering how a reviewer handles a pending/shadow pattern — what they check, how they record a review, how the >=2-reviewer requirement is satisfied operationally. Flag if the workflow exists in code but has no SOP.
3. **Report generator dispatcher behavior.** Audit `src/lib/report-generators/` (incl. `cache.ts`) and the route `src/app/api/app/reports/.../route.ts` for operational soundness: is there caching (and does it invalidate correctly), what happens on an Anthropic call failure (retry / dead-letter / surfaced error), and is there any queueing or is it synchronous-per-request? Identify any unbounded or unguarded operational path.
4. **OSINT source fetcher ops procedures.** The OSINT Phase 1-2 source fetchers make outbound calls. Audit whether there are operational procedures for them — rate limiting, failure handling, what happens when a source is unreachable — and whether any of this is documented under `docs/ops/`.
5. **Disposition coverage for new typologies.** The disposition vocabulary is a closed 4-verb set (`allow`, `safe_completion`, `human_review`, `block`; `docs/policy-spec-v5.0.md` §6). Audit whether the new surfaces (synthetic media, OSINT, custom-pattern hits, reports) all resolve to one of these four verbs operationally, with no surface inventing a fifth disposition or leaving a hit undispositioned.

## What NOT to audit

- Whether the disposition *vocabulary itself* should change — Policy track's scope. Ops audits whether operations stay inside the closed set.
- Code architecture of the dispatcher / fetchers — Engineering track's scope (Ops cares about runbook-ability and gating, not abstraction shape).
- Threshold *policy* correctness for classification (0.60/0.65) — out of scope.
- Writing the missing SOPs/runbooks — this audit identifies the gaps; authoring is a follow-up dispatch.

## Verification baseline

- All CI green: lockstep, tsc, vitest 908/908, next build
- Live on https://safeeval.vercel.app
- HEAD: `5f54937` (verify with `git log --oneline -1`)

## Deliverable shape

A response memo at `docs/audits/2026-05-30-ops-track-audit-findings.md` containing:
- Top-line verdict: PASS / CONDITIONAL / FAIL
- Findings table: severity / file:line (or surface) / description / suggested fix / effort
- A short "missing operational docs" list (SOPs / runbooks not yet written)
- Recommended next step if not PASS

## Authorizing context

Steven approved a cross-track audit cycle on 2026-05-30. This is a regular hygiene sweep after a high-velocity VS Code shipment week, not an emergency response. Changing a promotion threshold or the disposition vocabulary remains a Cowork decision — this memo authorizes the *audit* and the gap inventory, not unilateral threshold or vocabulary changes.
