# QA Track audit request — VS Code shipment sweep (2026-05-30)

**Requested by:** Steven (via Dispatch orchestrator)
**Audit window:** commits `4e073d5..5f54937` (live on safeeval.vercel.app)
**Severity required:** CRITICAL / MEDIUM / LOW per finding
**Verdict required:** PASS / CONDITIONAL / FAIL

## Context

Over the past day ~30+ VS Code sessions shipped substantial work directly to `origin/main`, bypassing the normal Cowork track-architect dispatch flow. The suite grew from roughly ~668 tests to 908 — a +240 delta — across many new surfaces. CI is green, but a green suite is not the same as a *meaningful* suite. This memo requests a QA-lens audit of whether the new coverage actually exercises behavior or just asserts structure.

## What to audit (track-specific scope)

1. **Test count delta quality.** The ~+240 new tests: sample broadly and judge whether they assert real behavior (inputs -> outputs, edge cases, failure modes) or are structural assertions (file contains string, component renders, export exists). Flag clusters of low-value structural assertions masquerading as coverage. Note: this repo's vitest runs in node with no jsdom, so UI is tested via pure `.ts` helpers + `readFileSync` source-reads — distinguish "legitimately constrained to source-reads" from "source-read used where a behavioral test was possible."
2. **Coverage of new surfaces.** Confirm meaningful coverage exists for: custom-patterns matcher / inference pass / promotion gate (`src/lib/data/custom-patterns/`), synthetic media detectors (image + audio), OSINT page + source fetchers, and the report generator (`src/lib/report-generators/`, `src/app/app/reports/`). Flag any new surface that shipped with only smoke coverage or none.
3. **Fixture quality for new typologies.** For synthetic media especially: do the sample image/audio fixtures actually exercise the detectors meaningfully (a real positive and a real negative path), or are they placeholder bytes that pass without testing detection logic? Same question for OSINT signal fixtures and report-generation inputs.
4. **Regression guards.** Audit the new guards — palette-surfaces (`601cd3c`), marketing-depth (`013a3d4`), theme/severity-color (`b7f160a`), and the lockstep validator (`scripts/check-lockstep.js`). Do they catch the right things, or are they brittle (asserting exact strings that drift) or toothless (asserting presence without correctness)?
5. **Golden case coverage.** Confirm the 8 case-study scenarios still have golden-case coverage that would catch a regression in their classification, and that the case-study restructure (`6fb6fa6`, `76c7ba5`) didn't orphan any golden assertions.

## What NOT to audit

- Whether the policy vocabulary the tests assert against is *correct* — Policy track's scope. QA audits whether tests faithfully exercise the spec, not whether the spec is right.
- Design rendering quality — Design track's scope.
- Test runtime / CI performance unless a test is so slow it risks timeout.
- Adding the missing tests — this audit identifies gaps; remediation is a follow-up dispatch.

## Verification baseline

- All CI green: lockstep, tsc, vitest 908/908, next build
- Live on https://safeeval.vercel.app
- HEAD: `5f54937` (verify with `git log --oneline -1`)
- Confirm the 908 count yourself: `npm test` (or the project's vitest invocation)

## Deliverable shape

A response memo at `docs/audits/2026-05-30-qa-track-audit-findings.md` containing:
- Top-line verdict: PASS / CONDITIONAL / FAIL
- Findings table: severity / file:line (or surface) / description / suggested fix / effort
- A short "coverage gap list" of surfaces needing tests, ranked by risk
- Recommended next step if not PASS

## Authorizing context

Steven approved a cross-track audit cycle on 2026-05-30. This is a regular hygiene sweep after a high-velocity VS Code shipment week, not an emergency response. Writing the missing tests is a separate VS Code dispatch — this memo authorizes the *audit* and the gap inventory, not the remediation.
