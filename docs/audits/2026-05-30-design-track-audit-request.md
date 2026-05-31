# Design Track audit request — VS Code shipment sweep (2026-05-30)

**Requested by:** Steven (via Dispatch orchestrator)
**Audit window:** commits `4e073d5..5f54937` (live on safeeval.vercel.app)
**Severity required:** CRITICAL / MEDIUM / LOW per finding
**Verdict required:** PASS / CONDITIONAL / FAIL

## Context

Over the past day ~30+ VS Code sessions shipped substantial work directly to `origin/main`, bypassing the normal Cowork track-architect dispatch flow. Much of it is visual: a full cool-institutional palette repaint of all marketing surfaces, landing-page visual depth restoration, case-study restructure, trust-signal and stat-scaling changes, and an evaluator media-tab convergence. None of it has been reviewed against the Design track's design-system and voice standards. This memo requests a design-lens audit.

## What to audit (track-specific scope)

1. **Cool palette migration completeness.** The repaint (commits `60bc817`, `77d163c`, `e848561`, `788d7ab`, `8bbb42f`, `e058afe` and the `601cd3c` regression test) migrated cream/sage/coral to the cool institutional palette. Audit for any surviving warm tokens (cream / sage / coral / warm-* classes) outside the explicitly warm-allowed comment guards. The `601cd3c` palette-surfaces test claims full coverage — verify it actually greps every surface, not a subset.
2. **Design-system token usage in new components.** New components shipped this window: the custom-pattern composer, the report list/detail views (`src/app/app/reports/`), and the evaluator synthetic-media tab. Audit whether they consume design-system tokens from `docs/ux/design-system/` rather than hardcoded hex/spacing values.
3. **Marketing-page copy voice consistency.** The depth restoration, trust-signals proof strip (`068266e`), and stat scaling (`76c7ba5`) added/changed marketing copy. Audit voice consistency against the established SafeEval marketing voice — sentence case, plain language, no jargon creep.
4. **Synthetic media tab convergence UX.** Image + audio detection were converged into a single "Synthetic media" tab (`5e05cf5`, formerly separate tabs from `7864b5a`). Audit whether it reads as one coherent thing or as two stitched-together tabs sharing a label — input affordances, result presentation, and empty/preview state (`24c114f`).
5. **Case-study WhatChanged restructure.** Pill labels were converted to section headers in the "What changed" block (`6fb6fa6`). Audit whether the header treatment reads correctly and the restructure preserves scannability.
6. **Landing depth restoration.** The hero illustration was restored as an evaluation-flow mockup (`ac8f79f`), cards elevated with shadows/slate borders (`5ba26fa`), section backgrounds alternated for rhythm (`c5ea853`), and feature-section icons added (`c7a56f4`). Audit whether the hero mockup actually works as an illustration and whether alternating section backgrounds read as intentional rhythm vs. visual noise.

## What NOT to audit

- Functional correctness of the evaluator / detectors — QA + Engineering scope.
- Governed FAF display vocabulary on the result card (classifier labels, disposition verbs) — that is Policy-governed display vocabulary, not free design copy.
- Accessibility contrast as a formal WCAG pass unless a contrast regression is obvious — note it as a finding but a full a11y audit is a separate effort.
- Code quality / idiom of the components — Engineering scope (this audit is about the rendered design, not the source style).

## Verification baseline

- All CI green: lockstep, tsc, vitest 908/908, next build
- Live on https://safeeval.vercel.app
- HEAD: `5f54937` (verify with `git log --oneline -1`)

## Deliverable shape

A response memo at `docs/audits/2026-05-30-design-track-audit-findings.md` containing:
- Top-line verdict: PASS / CONDITIONAL / FAIL
- Findings table: severity / file:line (or live URL + surface) / description / suggested fix / effort
- Recommended next step if not PASS

## Authorizing context

Steven approved a cross-track audit cycle on 2026-05-30. This is a regular hygiene sweep after a high-velocity VS Code shipment week, not an emergency response. Design-system changes or new tokens the audit recommends remain Cowork/Design decisions and must be dispatched normally — this memo authorizes the *audit*, not unilateral component edits.
