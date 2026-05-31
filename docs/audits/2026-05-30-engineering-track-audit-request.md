# Engineering Track audit request — VS Code shipment sweep (2026-05-30)

**Requested by:** Steven (via Dispatch orchestrator)
**Audit window:** commits `4e073d5..5f54937` (live on safeeval.vercel.app)
**Severity required:** CRITICAL / MEDIUM / LOW per finding
**Verdict required:** PASS / CONDITIONAL / FAIL

## Context

Over the past day ~30+ VS Code sessions shipped substantial work directly to `origin/main`, bypassing the normal Cowork track-architect dispatch flow. High velocity with no architecture review means abstraction boundaries, error handling, and technical debt have not had an engineering lens. This memo requests a code-quality / architecture audit of the shipped surfaces.

## What to audit (track-specific scope)

1. **Custom patterns/classifiers 4-phase architecture.** Phases 1-4 plus the M13/M14/M15 schema backfill shipped the matcher, inference pass, and promotion gate (`src/lib/data/custom-patterns/`). Audit phase boundaries: are concerns cleanly separated (storage / matching / inference / promotion), or do layers leak into each other? Per existing notes the matcher (substring bright-line) and inference pass are *not yet live-wired into the engine* — confirm whether that's still true and whether the seam is clean or a half-finished integration.
2. **Supabase auth abstraction.** The provider abstraction (`src/lib/auth/provider.ts`) was fixed to read env vars per-request as literal `process.env.NEXT_PUBLIC_*` (the dynamic-access bug: `process.env[KEY]` isn't inlined into the client bundle; fixed tip `4e073d5`). Audit whether the per-request read is the right shape (not re-instantiating a client needlessly per call) and whether the literal-access fix was applied everywhere a dynamic read could recur, not just the one site.
3. **HF router migration debt.** Media detection migrated from the retired `api-inference` host to `router.huggingface.co` (`ae886f8`, with diagnostics `821d731`/`2f15054`). Audit for leftover debt — dead references to the old host, diagnostic logging left in that should be removed or gated, hardcoded URLs that should be config.
4. **Gemini bump contract changes.** The reasoning layer bumped `gemini-1.5-flash` -> `gemini-2.5-flash` (`349d8d3`, retired model). Audit whether any request/response contract changed between 1.5 and 2.5 that wasn't fully addressed (response shape, token limits, safety-setting fields), and confirm the impl-spec URL sync (`35a3827`) matches the code.
5. **Feedback loop architecture.** The feedback loop (recordEdit API + clustering/aggregation) shipped Phase 1-2. Audit whether the clustering + aggregation approach scales appropriately (is aggregation incremental or full-recompute, is it cron-driven or request-driven, are there unbounded growth paths in stored edits).
6. **Recent UI polish idiom.** The trust-signals strip (`068266e`), stat scaling (`76c7ba5`), evaluator empty-state preview (`24c114f`), and hero mockup (`ac8f79f`) — audit whether the component code is idiomatic for this codebase (consistent with surrounding patterns, no duplicated logic, no inline magic values that belong in tokens/config). Note: all `.js` files must stay ASCII-safe — flag any non-ASCII that slipped in.

## What NOT to audit

- Rendered visual design quality — Design track's scope.
- Policy vocabulary correctness — Policy track's scope.
- Test coverage adequacy — QA track's scope (though flag obviously untestable code shapes).
- PII / data-flow compliance — Compliance track's scope.
- Promotion-gate threshold *values* — Ops track's scope (Engineering audits the gate's *implementation correctness*, not whether 0.7/50/10/2 are the right numbers).

## Verification baseline

- All CI green: lockstep, tsc, vitest 908/908, next build
- Live on https://safeeval.vercel.app
- HEAD: `5f54937` (verify with `git log --oneline -1`)

## Deliverable shape

A response memo at `docs/audits/2026-05-30-engineering-track-audit-findings.md` containing:
- Top-line verdict: PASS / CONDITIONAL / FAIL
- Findings table: severity / file:line / description / suggested fix / effort
- A short tech-debt inventory ranked by interest rate (how much it costs to leave it)
- Recommended next step if not PASS

## Authorizing context

Steven approved a cross-track audit cycle on 2026-05-30. This is a regular hygiene sweep after a high-velocity VS Code shipment week, not an emergency response. Refactors the audit recommends are follow-up VS Code dispatches — this memo authorizes the *audit* and the debt inventory, not the refactors themselves.
