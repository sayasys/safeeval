# Policy Track audit request — VS Code shipment sweep (2026-05-30)

**Requested by:** Steven (via Dispatch orchestrator)
**Audit window:** commits `4e073d5..5f54937` (live on safeeval.vercel.app)
**Severity required:** CRITICAL / MEDIUM / LOW per finding
**Verdict required:** PASS / CONDITIONAL / FAIL

## Context

Over the past day ~30+ VS Code sessions shipped substantial work directly to `origin/main`, bypassing the normal Cowork track-architect dispatch flow. The work is technically correct (CI green, 908 tests passing, live on Vercel) but the Policy track has not yet reviewed it against FAF policy standards. This memo requests a policy-lens audit of the shipped surfaces — vocabulary alignment, ontology consistency, and threat-model coverage — so the framework's two surfaces (docs and code) stay in lockstep.

## What to audit (track-specific scope)

1. **Custom patterns + classifiers vocabulary alignment.** The custom-patterns and custom-classifier features (Phases 1-4, M13/M14/M15 migrations) let operators author their own pattern/classifier definitions. Audit whether the vocabulary those features expose and emit stays inside the FAF governed vocabulary defined in `docs/policy-spec-v5.0.md` — L1 (§2, closed 7-value set), L2-by-L1 (§3, closed scoped sets), L3 (§4, *open* but categorized via `prefix:value`), bright-line feature codes (§5, closed enum), disposition verbs (§6, closed 4-value set). Flag anywhere a custom-authored artifact can introduce a label outside these governed sets without going through the §11 ontology extension policy.
2. **M14 bright-line column semantics.** The M14 migration (`src/lib/data/schema/M14_classifier_bright_line_and_conflicts.sql`) added bright-line + conflicts-with columns for custom classifiers. An earlier session deferred a reconciliation: is the stored bright-line indicator semantics "printable ASCII substring" or "lowercase regex-safe"? Confirm the column semantics in the migration + matcher code match what `docs/policy-spec-v5.0.md` §5 specifies, and that the two interpretations have actually been reconciled (not just both present).
3. **Threat-model coverage for new typologies.** New surfaces shipped this window touch synthetic media detection, fraud chains, and OSINT. Audit `docs/threat-models/` for whether these are represented — is there a threat model covering synthetic-media-enabled fraud and OSINT-enabled targeting, or are the new detectors live without a corresponding documented threat model?
4. **v5 ontology drift.** CLAUDE.md and `docs/07-v5-schema.md` now state ontology version 5.2. Sweep the docs surface for any lingering "5.1" references that should read "5.2" — `docs/08-v5-ontology.md`, `docs/policy-spec-v5.0.md`, threat models, and memos. Code is believed to be at 5.2; confirm docs match.
5. **L3 categorization coverage.** L3 is an open, multi-valued vocabulary categorized by `prefix:value` (§4). Given custom classifiers can now emit tags, audit whether the existing L3 prefix categories still cover what custom classifiers are capable of producing, or whether the open vocabulary needs a new prefix category to keep custom output classifiable.

## What NOT to audit

- Code architecture / abstraction quality of the custom-patterns phases — that is the Engineering track's scope.
- UI display vocabulary on the result card / evaluator — that is governed Cowork display vocabulary reviewed by the Design + Policy display-spec process, not part of this sweep.
- Test coverage adequacy — QA track's scope.
- Whether thresholds (API `0.60`, UI `0.65`) are correct — out of scope; threshold redesign is a separate authorized effort.
- Disposition *operations* (reviewer workflow, queue handling) — Ops track's scope.

## Verification baseline

- All CI green: lockstep, tsc, vitest 908/908, next build
- Live on https://safeeval.vercel.app
- HEAD: `5f54937` (verify with `git log --oneline -1`)

## Deliverable shape

A response memo at `docs/audits/2026-05-30-policy-track-audit-findings.md` containing:
- Top-line verdict: PASS / CONDITIONAL / FAIL
- Findings table: severity / file:line / description / suggested fix / effort
- Recommended next step if not PASS (e.g. a policy-author or classifier-translator dispatch)

## Authorizing context

Steven approved a cross-track audit cycle on 2026-05-30. This is a regular hygiene sweep after a high-velocity VS Code shipment week, not an emergency response. Any policy-text changes the audit recommends remain Cowork decisions and must be dispatched through the normal policy-author / classifier-translator flow — this memo authorizes the *audit*, not unilateral policy edits.
