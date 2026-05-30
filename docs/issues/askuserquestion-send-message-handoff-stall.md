# AskUserQuestion -> send_message handoff doesn't wake child sessions

**Filed:** 2026-05-29
**Severity:** high (can erase long-context sessions)
**Tag:** tracks-architect attention; framework-level Cowork session lifecycle bug
**Reporter:** orchestrator catch-up session 2026-05-29

## Pattern

1. A child session (e.g. a VS Code dispatch or Cowork track session) calls `AskUserQuestion` mid-task to request adjudication from Steven.
2. Dispatch / the orchestrator cannot relay `AskUserQuestion` to the user directly, so the orchestrator uses `send_message` to deliver Steven's adjudication into the child session's transcript instead.
3. The `[user]` message lands in the child session's transcript -- but the assistant in the child session never wakes to act on it.
4. The session is effectively stalled: it has the answer it asked for, but the runtime doesn't fire another turn.

## Cost when it fires

Today's worked example: `local_3fa8d2ee` (SaaS P2 original) consumed ~39 turns of conflict analysis -- the M6 numbering collision, the 8 vocabulary disagreements between the SaaS scoping memo and the data-track schema -- before stalling on the AskUserQuestion. The orchestrator delivered the adjudication via `send_message`. The session never woke. The only recovery was killing the session and refiring as `local_2b62bfa7` with all 8 adjudications pre-baked into the refire brief. **~40 turns of context analysis lost.** The refire reproduced most of the analysis in the brief authorship pass, but the lost work was non-trivial.

## Current workaround

Kill the session and refire with the adjudication pre-baked into the brief. This works but:

- It's expensive when the session has built substantial in-context analysis (`local_3fa8d2ee`'s 39 turns).
- It requires the orchestrator to detect that the child session has stalled rather than is still working, which is non-trivial without polling.
- It compounds with the next item -- if the orchestrator has to refire often, the framework friction-tax on long-context sessions is real.

## Recommendation for architect to consider

Three options, increasing intervention level:

1. **Document the failure mode and make pre-baking the default.** Brief authors who anticipate a route-to-steven adjudication mid-session pre-resolve the question in the brief rather than authoring against the assumption that AskUserQuestion will work. This is the cheapest fix but it disables the AskUserQuestion -> adjudication loop for in-flight clarifications.

2. **Add an orchestrator-side detection rule.** If a dispatched session goes idle for >N minutes after AskUserQuestion was the last assistant turn, the orchestrator proactively kills and refires with the adjudication baked in. Avoids manual detection but requires polling.

3. **File an upstream bug against Cowork's session-wake mechanism.** The runtime expectation is that a `[user]` message in the transcript -- regardless of how it got there -- triggers an assistant turn. If `send_message`-delivered messages are silently dropped at the wake-trigger layer, that's a Cowork bug, not a SafeEval workflow problem.

The right call is probably (1) for now, (3) upstream, and (2) only if (1) and (3) both prove insufficient over the next few weeks.

## Related observations

The pattern has surfaced before today but was treated as one-off. Today's session is the first time the cost was high enough to make it framework-level visible. If it recurs once more before tracks-architect dispatches a fix, treat that as the third strike per the disclosure-debt-prevention pattern.
