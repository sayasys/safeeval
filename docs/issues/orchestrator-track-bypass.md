# Orchestrator track bypass under Dispatch-driven workflows

**Filed:** 2026-05-29
**Severity:** medium (recoverable via catch-up, but lets STATE.md / dispatch-log go stale)
**Tag:** tracks-architect attention; framework-level workflow design
**Reporter:** orchestrator catch-up session 2026-05-29

## Pattern

1. Steven uses Dispatch (via safeeval-dispatch slash commands or terse prefix syntax) to fire work directly to a venue -- typically VS Code for shipping, or a Cowork track session for authoring.
2. The dispatched session ships and writes its own STATE.md row update at closure (per memo §6 dispatch-closure ritual).
3. The orchestrator session is never invoked. No brief is written to `handoff/board/pending/`. No `dispatch-log.md` entry is appended at dispatch time. No `dispatch-log.md` entry is appended at closure time. No cross-track coordination check happens.
4. STATE.md's per-track rows stay accurate (each track updates its own row), but the orchestrator row goes stale and `dispatch-log.md` falls behind.
5. The next time someone needs the cross-track picture (orchestrator catch-up, status command, weekly digest), they discover N sessions of un-logged work and have to backfill from `git log` + memory.

## Cost when it fires

Today's worked example: 12 sessions ran through Dispatch without filing through Orchestrator. Most shipped clean (10/12 shipped, 1 in-flight, 1 stalled). But:

- The orchestrator row on STATE.md was three days stale (last update 2026-05-28).
- `dispatch-log.md` was missing ~14 lines (12 session entries + process change + retro).
- The 3 friction items surfaced during the day (this one + the AskUserQuestion stall + the OneDrive lock) had no filing surface and were retained only in working memory until the catch-up session.
- The Sayasy name correction, the case-study restructure, the custom-patterns scoping memo, and the SaaS P2 conflict resolution all happened without dispatch-log breadcrumbs -- making it harder to reconstruct "what got decided today" for future readers.

Catch-up cost: one orchestrator session (this one) to backfill. Roughly bounded, but the unbacked-up state is fragile -- if Steven's working memory is lost (a closed conversation, a kernel restart) before catch-up runs, the dispatch-log gap becomes permanent and the cross-track narrative for the day is lost.

## Current workaround

Periodic orchestrator catch-up sessions to backfill. Works but is reactive, not preventive.

## Recommendation for architect to consider

Steven authorized Option B in-session during the 2026-05-29 catch-up: **every Dispatch from 2026-05-29 forward routes through Orchestrator on both dispatch (brief authorship) and closure (STATE.md + dispatch-log relay)**. This is the right policy direction. The framework-level question is how to codify it:

1. **Memo §6 amendment by tracks-architect.** Add an explicit clause to the dispatch-closure ritual stating that every Dispatch operation requires an orchestrator brief at dispatch time and an orchestrator closure relay at closure time. The orchestrator becomes a required step in the Dispatch workflow, not an optional one. This is the most durable fix.

2. **Slash-command-level enforcement.** Modify the safeeval-dispatch slash commands so they cannot fire a brief directly to a venue without an orchestrator step. Mechanical, hard to bypass, but limits Dispatch's flexibility when the operator knows what they want and doesn't need orchestrator decomposition.

3. **Status quo with this catch-up as precedent.** Document the Option B policy in STATE.md / agent memory only; rely on operator discipline to follow it; run periodic catch-ups when discipline slips. Cheapest now, weakest as a long-term commitment.

Recommend (1). The Option B policy is a memo-level commitment, and the framework's principle is "if it's load-bearing, codify it." Today's catch-up demonstrates the cost of not having §6 codify the orchestrator-routing requirement.

## Related observations

The bypass pattern is not specific to today -- the orchestrator row on STATE.md has been "idle" for multiple days at a time across the recent history, which suggests Dispatch has been routing around orchestrator more than the framework anticipated. The Option B change is overdue rather than premature.
