# Parallel Cowork tracks with an orchestrator -- coordination design

**Status:** signed off 2026-05-24
**Date:** 2026-05-28 (last amended 2026-05-28 -- seventh atomic amendment: sec/compl Phase 1 hygiene additions. Pre-creates `docs/memos/sec/` and `docs/memos/compl/` filing surfaces (§4.5 extension, with `docs/memos/compl/` already on disk post-commit-`f62c34c` from the inaugural Phase 1 `compl:` exercise -- asymmetric creation noted); codifies the shared 4-digit memo / brief ID namespace rule (new §4.5.1) with the explicit grep-highest-before-assign protocol against concurrent-session races; documents when deferred questions bundle into one memo vs. ship as separate memos (new §4.5.2). Note on sequence numbering: a sixth atomic amendment was scoped for data-track registration concurrent with the data-track scoping memo (commit `be30894`) but has not yet shipped; the seventh amendment ships first because its inputs are independent and ready. Sequence numbers are content-keyed, not strictly chronological. Previous shipped amendment: fifth atomic amendment 2026-05-28 -- closure-report escalation-field convention. Extends §6 dispatch-closure step with the per-question `escalation: default-accept | route-to-steven` field requirement and inline-metadata format; adds new §6.1 codifying three framework-floor always-escalate triggers (adversarial-review self-flag, public-artifact materiality, project-boundary crossing); annotates §4.9 design and qa lens rows with escalation-field mapping notes. Earlier: fourth atomic amendment 2026-05-28 -- design-track disclosure-debt prevention. Before that: third atomic amendment 2026-05-27 -- tracks-refinement + proactive-discovery generalization (adds §4.9 per-track observational lens; §5.9 observations surface; new qa role definition in §4.4-style addendum to §4; per-track addenda in §4.1-4.6 covering staleness anchors, instruction refresh notes, and observational lens; dispatch-closure step in §6 track ritual; skills-to-tracks mapping table in new §4.10; tracks-architect role updated with hybrid HR + tech-process-author framing and monthly framework-drift scan cadence). Before that: second atomic amendment 2026-05-27 -- grep-before-template-inherit + variance-pattern hint + delete-permission VM-down clause + session-scoped delete grants in §5.7 + STATE-row-idle verification + one-time stale-CURRENT sweep.)
**Author:** Cowork (planning session)
**Supersedes:** nothing -- this extends `handoff/README.md`, does not replace it.

## 1. Problem

The current two-venue handoff (Cowork <-> VS Code via `handoff/CURRENT.md`) is correct but single-threaded. Two specific pains:

1. **Coordination is bottlenecked on `CURRENT.md`.** Only one task is in flight at any moment. Cowork cannot start a new piece of work while VS Code is still executing the previous one.
2. **Losing track of what each session knows.** When more than one Cowork session is open (today, ad hoc), they diverge -- one updates a doc, the other never sees it, and conflicting edits land later.

The goal is to fan the Cowork side out into multiple parallel "tracks" -- each a long-lived Cowork session with a defined scope -- with an **orchestrator** session on top that decomposes goals into per-track work, dispatches handoffs, verifies completion, and sequences phases so dependencies and conflicts are managed centrally. VS Code remains the single execution venue.

## 2. Non-goals

- Replacing the venue-boundary rules in `handoff/README.md`. Those stay verbatim.
- Adding tracks that edit hot JS files or run builds. Execution stays in VS Code.
- Building any tooling. This is a directory-layout + protocol change, runnable today.
- True cross-session triggering. **The orchestrator cannot start another Cowork session's turn.** It writes handoff files; you nudge the relevant project windows to pick them up.
- Round-robin "load balancing" across tracks. Each track owns specific artifacts; tasks go where the artifact lives, not where there's free capacity.

## 3. Mental model

- A **track** is a long-lived Cowork session scoped to an artifact set it solely writes.
- The **orchestrator** is another long-lived Cowork session that owns *coordination*, never *content*. It plans, dispatches, verifies, queues. It never writes to `docs/`, never claims artifacts, never edits track work directly.
- **VS Code** is unchanged: sole execution venue, sole writer of `src/`/`tests/`, sole runner of builds and `git push`.

Tracks are peers to each other and read-only to the orchestrator's plan files. The orchestrator is the only session that holds the full cross-track picture; tracks only need to know about their own work plus the shared board state.

What the orchestrator gives you is **decomposition, verification, and sequencing**, not automation. After it dispatches, you still click into each track's window and type a nudge to start its session. The win is that you no longer have to hold the cross-track plan in your head.

## 4. The tracks (phase 1)

Split is by **artifact ownership**, strictly single-writer. Every file in the repo that any track might touch has exactly one owner. Other tracks comment via inbox; they never edit.

As of 2026-05-27, phase 1 has four execution tracks: `policy`, `ops`, `design`, `qa`. The original three-track split (`policy`, `ops`, `ux`) was amended after the `qa-design-split-pilot` (VALIDATED 2026-05-27, retro at `handoff/reference/08c-pilot-retro-classifier-display-p1c.md`) showed that bundling acceptance-audit and design-spec authorship into a single `ux` track conflated two distinct identities -- a recommends-only auditor and a spec author -- with measurably different working modes. `ux` is now split: `design` owns spec / system / copy / README; `qa` owns audits and acceptance verification.

| Track | Owns (sole writer) | Default skills |
|-------|--------------------|----------------|
| `policy` | `docs/01-framework.md`, `docs/03-master-policy.md`, `docs/05-classifier-guidance.md`, `docs/06-stakeholder-brief.md`, `docs/07-v5-schema.md`, `docs/08-v5-ontology.md`, `docs/policy-spec-v5.0.md`; **in phase 1 only:** `docs/02-faf-to-l1l2l3-mapping.md`, `docs/threat-models/**` (transfers to `research` at phase 2) | `safeeval-agents:policy-author`, `safeeval-agents:classifier-translator` (produces the spec memo that gets attached to a VS Code handoff -- never edits `src/lib/safeeval*.js` directly), `safeeval-agents:design-memo-author`, `safeeval-agents:threat-modeler` (phase 1 only), `safeeval-agents:threat-intel-watcher`, `safeeval-agents:stakeholder-communicator`, `product-management:write-spec` (third atomic amendment 2026-05-27) |
| `ops` | `docs/04-enforcement-design.md`, reviewer SOPs, runbooks, postmortems under `docs/memos/` tagged `[ops]` | `safeeval-agents:enforcement-designer`, `operations:runbook`, `operations:process-doc`, `engineering:incident-response` (third atomic amendment 2026-05-27 -- replaces the `operations:*` wildcard with the three skills load-bearing for the portfolio FAF project; compliance / capacity / vendor / process-optimization / risk-assessment are off-scope until SafeEval grows those concerns) |
| `design` | `docs/ux/design-system/**`, `docs/ux/copy/**`, microcopy specs, IA recommendations, `README.md` (portfolio front door) | `editorial-web-style`, `design:design-system`, `design:design-critique`, `design:ux-copy`, `design:design-handoff`, `design:research-synthesis` (third atomic amendment 2026-05-27) |
| `qa` | `docs/qa/audits/**` (new directory for post-pilot audits), `docs/ux/audits/**` (pre-pilot audits stay put as historical artifacts -- see §4.0), acceptance-audit + WCAG re-audit + fixture-runner side checks | `safeeval-ui-review`, `design:accessibility-review` (see §4.4 for the full qa role definition added in the third atomic amendment 2026-05-27) |
| `orchestrator` | `handoff/board/orchestrator/**`, the orchestrator row in `STATE.md`, append rights on `claims.md`; creates `CURRENT_<track>.md` on dispatch and archives them on goal closure; creates `pending/NNNN-<slug>.md` on a track's behalf. Never authors content for any track. See §5.5.1. | `engineering:standup`, `operations:status-report` (third atomic amendment 2026-05-27 -- previously implicit "no enumerated default skills"; `product-management:stakeholder-update` rejected because orchestrator's audience is Steven, not external) |
| `tracks-architect` | this memo (`docs/memos/2026-05-24-parallel-cowork-tracks.md`) as a living document. See section 4.6 for full scope and the hard guard. | `engineering:architecture`, `operations:change-request`, `product-management:write-spec`, `safeeval-agents:design-memo-author` (third atomic amendment 2026-05-27 -- formalizes the hybrid HR + tech-process-author scope; the architect's atomic amendments ARE design memos in shape) |

### 4.0 Ownership rationale

The three judgment calls that mattered:

- **`README.md` -> design.** It's the portfolio front door. Most readers are evaluating presentation and narrative arc before they evaluate substance. Optimizing for "does the first-time reader get it" is a design call. Substantive accuracy in the README is a constraint, not the primary thing being optimized -- policy can flag accuracy issues via design's inbox.
- **`docs/06-stakeholder-brief.md` -> policy.** It's a translation of the FAF for non-technical stakeholders. The hard choices in it are "what does the framework actually say, and which parts to surface at this level of abstraction" -- those are policy calls. Design can comment on clarity and structure via inbox but doesn't own the file.
- **`docs/ux/audits/**` -> qa, not design.** This is the call the 2026-05-27 amendment formalizes. Audits (live-app re-audits, WCAG verification, fixture-runner side checks) are *recommends-only acceptance verification*; design specs / system / copy are *authored artifacts*. The pilot retro showed that bundling the two into a single `ux` track produced two failure modes: (a) the auditor was tempted to "fix-and-flag" rather than "flag-and-defer-to-owner," collapsing the recommends-only discipline; (b) the spec author was tempted to use the audit as a vehicle for re-litigating design choices already shipped. Splitting them gives each role a clean boundary. The pre-pilot audits under `docs/ux/audits/` stay where they are (path-of-least-disruption migration); post-2026-05-27 audits live under `docs/qa/audits/`.

All three files / paths have a single owner and a single defined reviewer (the other track) who communicates via inbox. No `claims.md` exception is needed for any of them.

**Alternative if this turns out wrong:** the cleanest fallback is to move `docs/06-stakeholder-brief.md` to design as well, so all user-facing prose lives with design and policy reviews via inbox. Cleaner mental model ("design owns prose, policy owns spec"), at the cost of putting a substantively policy-flavored file with a non-policy owner. Flip with a one-line edit to the table above if phase 1 surfaces friction.

### 4.1 The `docs/ux/` directory

> **Note (2026-05-27 amendment):** This subsection was written when the `ux` track owned all of `docs/ux/**`. After the qa-design split, ownership of `docs/ux/**` is divided per §4.4 -- `design-system/` and `copy/` belong to `design`; `audits/` belongs to `qa` (with new audits going to `docs/qa/audits/`). The directory layout below remains accurate; only the ownership changed. §4.2 below (visual-direction-implementation seam) likewise still applies, with "ux" replaced by "design" for spec authoring and "qa" for any audit step.

New directory at repo root, committed (unlike `handoff/`). Mirrors the existing `docs/threat-models/` pattern -- a focused subdirectory under `docs/` for one domain's artifacts. Suggested initial layout:

```
docs/ux/
  README.md                       (one-paragraph index)
  audits/
    YYYY-MM-DD-<surface>.md       (prioritized UI/IA review reports)
  design-system/
    visual-direction.md           (palette, type, spacing rationale -- the editorial-web-style anchor)
    component-notes.md            (per-component decisions, states, a11y notes)
  copy/
    microcopy-decisions.md        (per-string rationale where it matters)
```

This is a suggestion, not a contract -- ux owns the layout and can revise it. The constraint is just that everything ux produces as a *deliverable* lives under `docs/ux/`, so it's discoverable and so the ownership rule is enforceable by file path.

### 4.2 The visual-direction-implementation seam

Ux owns visual direction; it does NOT edit `src/app/page.js` or any other hot JS file. The workflow for a UI change initiated by ux:

1. Ux writes the spec under `docs/ux/design-system/` or as a new audit report under `docs/ux/audits/`.
2. Ux (or the orchestrator on its behalf) drafts a `handoff/board/pending/NNNN-ux-<slug>.md` for VS Code with the spec linked, exact files to edit, acceptance criteria including any visual verification step (screenshot, color contrast check).
3. VS Code implements per the spec, ships, posts back to ux's inbox.

Ux's authority is over *what the UI should be*; VS Code's is over *making the code reflect that*. Ux can bounce VS Code's implementation if it doesn't match the spec -- the bounce goes through the same `pending/` mechanism as a follow-up handoff.

### 4.3 Phase 2 additions

Phase 2 adds `research` (owns `docs/threat-models/**`, `docs/02-faf-to-l1l2l3-mapping.md`) only. Until then, research-flavored work goes to `policy` as the most adjacent owner. A `product` track is not currently scoped for phase 2 -- with ux owning the README and policy owning the stakeholder brief, there's no obvious unowned artifact set for it. Revisit only if external comms volume justifies a dedicated track.

### 4.4 Complete file-level ownership map (phase 1)

Audited against `git ls-files` on 2026-05-24. Every committed file has exactly one owner. No file has two owners; no file is unowned. When `research` stands up in phase 2, the rows tagged `(phase 1)` transfer to it.

| Path / pattern | Owner | Notes |
|---------------|-------|-------|
| `docs/01-framework.md`, `docs/03-master-policy.md`, `docs/05-classifier-guidance.md`, `docs/06-stakeholder-brief.md`, `docs/07-v5-schema.md`, `docs/08-v5-ontology.md`, `docs/policy-spec-v5.0.md` | `policy` | Core FAF spec |
| `docs/02-faf-to-l1l2l3-mapping.md` | `policy` (phase 1) -> `research` (phase 2) | Mapping doc, research-adjacent |
| `docs/threat-models/**` (9 files) | `policy` (phase 1) -> `research` (phase 2) | Threat models, research-adjacent |
| `docs/04-enforcement-design.md` | `ops` | Enforcement spec |
| `docs/ux/design-system/**`, `docs/ux/copy/**` | `design` | Design system, microcopy, IA recommendations |
| `docs/ux/audits/**` | `qa` | Pre-pilot audits (historical); kept here per §4.0 migration footnote |
| `docs/qa/audits/**` | `qa` | New directory for post-pilot acceptance audits |
| `README.md` | `design` | Portfolio front door (moved from `ux` row in original table -- now lives with the explicit `design` owner) |
| `docs/memos/2026-05-24-parallel-cowork-tracks.md` | `tracks-architect` | Living document, sole exception to read-only rule. See section 4.6. |
| `docs/OPERATOR-QUICKSTART.md` | `tracks-architect` | Living workflow reference for the user. Same edit rules as the memo. |
| `docs/memos/*.md` (other existing memos, e.g. `2026-05-24-coordinated-pattern-marker.md`, `2026-05-24-offline-sampling-stage-4.md`) | read-only history | "Once committed, the memo is read-only history" -- no one edits |
| `docs/memos/*.md` (new) | any track may write, see section 4.5 below | Filename must include track tag |
| `CLAUDE.md`, `handoff/README.md`, `.claude/commands/**` | VS Code (phase 1) -> orchestrator (phase 2+) | Meta-workflow files |
| `agents/**` (all agent definitions, READMEs, bundle scaffolds, HOWTO) | VS Code | Agent definitions are infrastructure; treated like `scripts/`. Cowork tracks request changes via `pending/` |
| `src/**` (all application code) | VS Code | Hot JS files per CLAUDE.md venue rules |
| `tests/**` (runner, schemas, golden fixtures, README) | VS Code | Test infrastructure |
| `scripts/**` (lockstep, null-bytes, precision) | VS Code | Build/CI scripts |
| `data/**` (`haiku-precision-seed.jsonl`, `seed-prompts.json`) | VS Code | Eval data used by scripts and tests |
| `.github/workflows/**`, `.gitignore`, `.env.example` | VS Code | CI and repo config |
| `next.config.js`, `tailwind.config.js`, `postcss.config.js`, `jsconfig.json`, `package.json`, `package-lock.json` | VS Code | Build config |
| `handoff/board/tracks/<track>/CURRENT_<track>.md` | the named track | Per section 5.5 |
| `handoff/board/tracks/<track>/archive/**` | the named track (write-once on archive, then read-only) | |
| `handoff/board/inbox/<track>.md` | append-only by any track sending; track may delete its own consumed messages | Inbox is peer-to-peer |
| `handoff/board/STATE.md` | each row owned by the named track; only that track edits its row | |
| `handoff/board/claims.md` | append-only by any track or orchestrator | Used only for genuine cross-ownership exceptions |
| `handoff/board/pending/**` | written by any track or orchestrator; mutated only by VS Code on promote | VS Code's inbound queue |
| `handoff/board/completed/**` | orchestrator (write-once on goal closure) | Per-goal completion entry + inline retrospective per section 5.1.1. Single-track asks without an orchestrator: originating track writes it, optional for trivial work. Read-only once written. |
| `handoff/board/orchestrator/track-usage.md` | orchestrator | Rolling utilization rollup per section 5.1.2; updated on every completion entry. |
| `handoff/board/orchestrator/**` (other files: `digest.md`, `dispatch-log.md`, `open-questions.md`, `plans/`) | orchestrator | |
| `handoff/board/observations/*.md` | the track named in `noticed_by_track` frontmatter at creation; orchestrator owns `triage_status` mutations after triage | Per §4.9 and §5.9. Append-only at creation; orchestrator-mutated only on triage. |
| `handoff/reference/cowork-projects/<track>.md` | tracks-architect | Per-track canonical instruction-prompt mirrors (manual sync per §6 ritual; `last_synced_commit:` header marks the memo SHA the mirror was last reconciled against). |

### 4.5 New memo creation

`docs/memos/*.md` files are committed history once they land, but creation rights need their own rule:

- **Phase 1 (no orchestrator):** Any track may create a new memo. The filename **must** include the originating track tag: `YYYY-MM-DD-<track>-<slug>.md` (e.g., `2026-05-24-policy-wire-fraud-decision.md`). The creating track must post a notification to every other active track's inbox in the same turn so the team isn't surprised by a memo landing in main.
- **Phase 2+ (orchestrator exists):** Memos are created either by the orchestrator (when a decision spans tracks and needs documenting) or by any track invoked through an orchestrator plan. Direct memo creation by a track without orchestrator awareness is allowed but discouraged -- prefer routing decisions through the orchestrator so `dispatch-log.md` captures them.

Existing memos (`2026-05-24-coordinated-pattern-marker.md`, `2026-05-24-offline-sampling-stage-4.md`, and this one) are read-only per the existing rule.

**Sec/compl subdirectory filing convention (added seventh atomic amendment 2026-05-28).** Memos authored under the architect's `sec:` and `compl:` Phase 1 lenses file under `docs/memos/sec/YYYY-MM-DD-<slug>.md` and `docs/memos/compl/YYYY-MM-DD-<slug>.md` respectively. Both subdirectories are pre-created at amendment-authoring time with a `.gitkeep` file so first-use friction is zero -- inaugural memos under either lens do not pay the cost of creating the subdirectory. **Asymmetric creation note:** `docs/memos/compl/` already exists on disk post-commit `f62c34c` (the inaugural Phase 1 `compl:` exercise, `docs/memos/compl/2026-05-28-pii-access-posture.md`, was filed before this amendment landed and the subdirectory was created as part of that filing); only `docs/memos/sec/` needs creation as a side-effect of this amendment. Once both subdirectories exist with their tracking files, the rule is symmetric and Phase 1 sec / compl asks file directly under the appropriate subdirectory without any first-use ceremony. Mitigates risk R4 in `docs/memos/2026-05-28-security-compliance-posture.md` §7 (subdirectory convention drift if not codified). **Why this exists:** the inaugural `compl:` exercise (commit `f62c34c`) had to create `docs/memos/compl/` on first use; the friction was small but compounds if not codified, and a convention introduced by a working memo without a framework anchor erodes within a few cycles. Tied to the compl-ask retrospective at `docs/memos/compl/2026-05-28-pii-access-posture.md` §8.1 #1.

### 4.5.1 Shared 4-digit ID namespace (memos and pending briefs)

Memo-companion IDs (the `(NNNN)` tag in commit messages like `docs(memo): pii access posture -- encryption + legal access (0068)`) and pending-brief filenames (`handoff/board/pending/NNNN-<slug>.md`) share a single monotonically-increasing 4-digit namespace. There is one source of truth for in-flight work IDs across both surfaces; the namespace is not split. This was implicit until the inaugural `compl:` exercise -- commits `3849510` (0064), `be30894` (0065), `45c2caa` (0066), `760a4df` (0067), `f62c34c` (0068) confirmed the convention by example without it ever being written down.

**Assignment protocol (mandatory).** Before assigning a new ID, the authoring track must grep the highest in-use ID across both surfaces immediately prior to assignment -- concurrent sessions race, and the value of "highest in-use" can change between when a track starts authoring and when it commits. The canonical grep:

```
ls handoff/board/pending/ | grep -oE '^[0-9]{4}' | sort -n | tail -1
git log --oneline -50 | grep -oE '\(0[0-9]{3}\)' | sort -u | tail -5
```

The new ID is `max(both surfaces) + 1`. Both queries are required -- pending IDs include briefs that have not yet shipped (commit-side), and commit IDs include memo-companion IDs that may not appear in `pending/` at all (memos that ship without a corresponding pending brief, e.g. when the memo is the deliverable). The grep happens at the latest possible moment before commit -- ideally in the same session turn as the commit -- to minimize the race window.

**Race-resolution rule.** If two sessions assign the same ID concurrently and both commits land on `main`, the later commit (by `git log` order) renames its artifact to the next free ID and rewrites references. Collisions surface in git history rather than in dispatch routing, so the cost of a collision is bounded to a single follow-up commit. The grep-before-assign protocol makes collisions rare; it does not make them impossible.

**Why this exists:** the inaugural `compl:` exercise's `docs/memos/compl/2026-05-28-pii-access-posture.md` took brief ID `0068` because briefs 0064-0067 were consumed by the same-day parallel bundle ship. The shared namespace works -- one source of truth for in-flight work IDs is the right design -- but operators were assuming the convention implicitly rather than reading it from the framework. Codifying the rule and the grep-before-assign protocol prevents the next concurrent-session race from producing a colliding ID. Tied to the compl-ask retrospective at `docs/memos/compl/2026-05-28-pii-access-posture.md` §8.1 #2.

### 4.5.2 Deferred-question bundling (when to ship as one memo vs. as separate memos)

When an upstream memo defers one or more open questions for later adjudication and the architect (or the owning track) later authors the follow-on memo, the question of *whether to bundle multiple deferred questions into a single follow-on memo or ship them as separate memos* is a judgment call governed by the following two-sentence guideline:

> **Bundle deferred questions when they share threat model, ontology section, or implementation surface.** **Ship separately when the decisions are independent or when bundling would force a single adjudication where two are warranted.**

The bundling rationale must be named explicitly in the bundled memo's §1 / §2 (background / threat model) so a future reader can verify the bundle was justified -- as in `docs/memos/compl/2026-05-28-pii-access-posture.md` §2 (shared threat model: "both decisions are about who can decrypt unredacted PII and under what conditions"). A bundled memo that does not name its bundling rationale is a candidate for re-splitting on adversarial review.

**Failure modes to avoid:**

- **Cancel-out bundling.** Two decisions land in one memo, the strong recommendation on Decision 1 is paired with a weak default on Decision 2, and the combination cancels out the safety property either choice was designed to provide. The pii-access-posture memo §1 names this as the explicit risk the bundling guarded against.
- **Argument-chain interleaving.** Two unrelated decisions are bundled, their argument chains interleave through §3-§7 of the memo, and the reader cannot disentangle them at adjudication time. Steven sees four open questions in §9 and cannot tell which two go together. This is the cost of bundling when the decisions are independent.
- **Forced-single-adjudication bundling.** Two decisions are bundled, both carry `escalation: route-to-steven` (per §6.1), and Steven is forced to adjudicate both in one turn even though one is materially less consequential than the other. The right move is to split into two memos so the consequential decision gets its own adjudication turn and the less-consequential one can be adjudicated quickly without dragging the harder decision's deliberation along with it.

**When bundling is unambiguously right:** when one decision's answer constrains the other's answer (the pii-access-posture case -- encryption-at-rest scheme determines what "decrypt" costs at the access-pattern layer, and the access-pattern decision determines how often decryption fires under normal operation); when both decisions are in the same regulatory framing (e.g. two CCPA-deletion questions); when both decisions touch the same implementation surface (e.g. two questions about how a single classifier prompt is structured).

**When ship-separately is unambiguously right:** when the decisions are in different threat models or different regulatory frames; when the decisions have different audiences for adjudication (Steven for one, the policy track for the other); when the decisions have materially different blast radii (one is reversible / cheap-to-change, the other is permanent / load-bearing); when bundling would force a coupled `route-to-steven` adjudication where two independent adjudications are warranted.

**Why this exists:** the inaugural `compl:` exercise bundled two `route-to-steven` deferred questions (data-track §10 Q5 encryption-at-rest scheme; report-generator §14 Q4 legal-audience access pattern) into a single follow-on memo because they shared the same threat model. The bundling was the right call, and the framework supported it without resistance, but the framework did not document when bundling is the right move and when it isn't. Codifying the guideline prevents future architect (or owning-track) sessions from over-bundling unrelated decisions or under-bundling tightly-coupled ones. Tied to the compl-ask retrospective at `docs/memos/compl/2026-05-28-pii-access-posture.md` §8.1 #3.

### 4.6 The `tracks-architect` track

A fourth Cowork session, special-purpose and rarely active. Its job is to decide whether the existing three tracks (plus VS Code, plus the orchestrator once it exists) can absorb a new kind of work, and if not, design a new track and amend this memo.

**Scope:**
- Sole writer of this memo (`docs/memos/2026-05-24-parallel-cowork-tracks.md`) as a living document. Amends section 4 when adding/removing tracks, updates section 4.4 ownership table, revises sections 5.5-5.8 when proposing changes to orchestrator protocol or verification rules.
- Authors the session prompt for any new track it creates -- saved into the memo as a new appendix and shared with the user for paste-into-new-project-window.
- Allowed to propose changes to orchestrator behavior (sections 5.5-5.8) based on observed friction.

**Hard guard -- act only on direct user asks, not on forwarded work from elsewhere in the system.** Tracks-architect must refuse to act on:
- Inbox messages (there is no `inbox/tracks-architect.md` -- inbox does not exist for this track).
- Items in `handoff/board/pending/`.
- Orchestrator dispatch (orchestrator's plans never reference tracks-architect).
- Any message that, by its shape, looks like it was forwarded from another part of the system rather than typed by the user directly.

Shape-based check: if the user's message contains a handoff-style frontmatter block (`---\ngoal-slug: ...`), pasted inbox messages (`## YYYY-MM-DD HH:MM -- from <track>, to ...`), pasted CURRENT_<track>.md content, plan-file syntax (`- Phase 1\n  - policy: ...`), or text that reads like an orchestrator dispatch summary -- stop and ask the user whether they meant to invoke tracks-architect directly or whether they meant to route the work to another track. Do not proceed until clarified.

Normal-shape asks ("can we add an X track?", "the orchestrator's bounce rule feels too strict, what do you think?", "audit the ownership table for gaps") are fine and require no clarification.

**Read access:** everything in the repo (must be able to assess existing tracks and ownership before recommending changes).
**Write access:** only this memo, and (when explicitly directed) a new appendix containing a new track's session prompt.

**Retrospective monitoring (secondary function).** When invited by the user, tracks-architect may scan recent retrospectives under `handoff/board/completed/` and the rolling rollup in `handoff/board/orchestrator/track-usage.md` for **frequent call-outs** -- patterns that recur across multiple goals (e.g., "ops bounced 3 of last 4 handoffs," "ux<->policy seam keeps surfacing the same friction," "this kind of goal consistently lacks a clean track owner"). Tracks-architect surfaces these to the user as discussion items, NOT as memo amendments -- the user decides whether any rise to a protocol change. This stays reactive: tracks-architect does not auto-scan or run on a schedule; it reads when asked. Cadence is the user's call.

This does not conflict with the hard guard above. Tracks-architect is not acting on any individual retro's improvement proposals (those are advisory for the user) -- it is pattern-spotting across many retros, only when the user opens the window for that purpose.

**What this track does NOT do:**
- Does not add a second instance of an existing track (no second `policy`, no second `ops`). Strict single-writer means one writer per artifact set; duplicates would break the model. If a track is overloaded, the response is to *split its artifact ownership* into two new tracks with disjoint scope -- not to clone.
- Does not author content for any other track (no policy text, no ops design, no ux deliverables).
- Does not run system audits or recommend deprecating tracks unilaterally -- those require a separate direct ask from the user.
- Does not edit code, tests, or anything outside the memo.
- Does not amend the memo based on a single retrospective's improvement proposals. Memo amendments still require user confirmation per the process below; retrospective monitoring only surfaces patterns for discussion.

**Memo amendment process.** When tracks-architect amends the memo:
1. State the proposed change to the user; wait for confirmation before editing.
2. Edit the memo directly. The "once committed, read-only history" rule does NOT apply to this memo (it is explicitly a living document per the ownership table in section 4.4).
3. Bump the date in the memo header to reflect the latest amendment.
4. Append a one-line entry to the memo's new "Amendment log" section (section 13) noting date and what changed.
5. If the amendment requires action elsewhere (e.g., a new directory has to be created), draft a `handoff/CURRENT.md` to VS Code for the implementation -- tracks-architect does not run mkdir or git commands itself.

### 4.7 Why there is no `engineering` track

This came up and is worth answering once in the memo so it doesn't keep coming back. The classifier code (`src/lib/safeeval.js`, `src/lib/safeeval-v5.js`) is where the risk-signal logic lives. By CLAUDE.md venue rules those are hot JS files -- VS Code edits them, period. So an `engineering` Cowork track wouldn't actually write the classifier code; it would write a spec or design memo describing what the code should do, then hand off to VS Code to implement.

That spec-writing work already has a home: `policy` produces it via `safeeval-agents:classifier-translator`, which is explicitly the FAF-policy-to-classifier-code translation skill. The output is a memo, not code. The memo gets attached to a VS Code handoff in `pending/`. VS Code implements.

In other words: **VS Code is the engineering venue.** Risk-signal logic, ASCII safety, lockstep validation, build, test, deploy -- all live there. There is no Cowork engineering track because there is no spec-design work for engineering that isn't already done by another track.

**When you'd actually want one.** If SafeEval grows non-classifier code surfaces -- a dashboard, a database, a real API, build tooling, multi-service architecture -- then `engineering:system-design`, `engineering:architecture`, and `engineering:tech-debt` become load-bearing skills with no current owner. At that point, stand up an `engineering` Cowork track that owns design specs for those surfaces (e.g., `docs/engineering/`), with the same arrangement as the others: track designs, VS Code implements. Not yet.

Cross-cutting design memos (`docs/memos/YYYY-MM-DD-*.md`) are written by whichever track originates the decision; other tracks comment via inbox messages, not by editing the memo. Once committed, the memo is read-only history.

### 4.8 Why qa is a gate, not a peer

A natural question after the 2026-05-27 split: if qa just runs audits, why is it a top-level track rather than a routine step inside design or ops or vscode? The answer is that **qa's authority pattern is different from every other track.**

The other four execution tracks (`policy`, `ops`, `design`, plus VS Code as a venue) are *authoring* identities -- they produce artifacts and own the artifacts they produce. Their core loop is "decide, write, ship." qa is a *verification* identity -- it never owns the artifact it audits; its output is a recommends-only report that gates whether work is considered done. Its core loop is "read, test, report."

That difference matters for three reasons that make the gate framing load-bearing:

1. **Recommends-only discipline.** qa's value depends on it not being able to "fix it on the way" -- if qa could patch the artifact it audited, the line between auditor and owner collapses and the audit becomes a rewrite. The pilot retro (08c §2.1) documented this discipline holding under tension on a finding (P2-A) where editing the upstream archive was the path of least resistance.

2. **Asymmetric routing.** Other tracks route to each other peer-to-peer via inboxes. qa routes asymmetrically: it consumes from `pending/` (dispatches from orchestrator), writes to `docs/qa/audits/`, posts mandatory digest lines, and posts conditional inbox lines back to the owning track. There is no "qa peer review of design's spec" mode -- that would be peer authoring, which is design or policy's job.

3. **Verification before goal closure.** When orchestrator runs §5.7 goal closure on visible-surface work, qa's pass verdict is the gate. A multi-phase goal with no qa phase ships on author self-assessment, which is fine for non-visible work but a weak gate for shipped UI. Standing qa up as a track (rather than a step inside design or vscode) makes the gating explicit -- the plan file shows a qa phase or it doesn't, and the absence is a deliberate `qa-required: false` per §5.7, not an oversight.

The contrast with `tracks-architect` (also non-authoring) is that tracks-architect is *meta* (it edits this memo when asked), whereas qa is *operational* (it gates every visible-surface goal). qa is the only execution-track gate; tracks-architect is reactive design judgment.

### 4.4-bis Per-track addenda (third atomic amendment 2026-05-27)

The third atomic amendment refreshes each track's identity, scope, and "what NOT to do" clauses against six staleness anchors that have accumulated since the original 2026-05-24 sign-off: (1) the 2026-05-27 qa-design split, (2) the 2026-05-27 second atomic memo amendment (six §5.7 / §9 additions), (3) the 2026-05-27 v4 sunset, (4) the 2026-05-28 conversation-eval ship, (5) the 2026-05-28 AI T&S language cleanup, (6) the 2026-05-27 Tier 1 vocabulary ship (ontology 5.2, bright-line count fifteen). The canonical per-track instruction mirrors are committed at `handoff/reference/cowork-projects/<track>.md` (gitignored) with `last_synced_commit:` headers; the manual sync ritual lives there. The addenda below are the memo-side anchors those mirrors derive from.

#### 4.4.1 `policy` addendum

Policy is the authoritative voice for the AI trust & safety positioning (project-agnostic) -- "FAF" stays as the technique name, "Anthropic's policy" framing is sunset; see `handoff/reference/11-language-cleanup-framing.md`. Policy now also authors vocabulary for conversation-shaped fixtures alongside single-prompt vocabulary. Policy never asserts ontology version or bright-line count in its instruction text -- session-start reads the live `docs/08-v5-ontology.md`. Grep-before-template-inherit per §5.7 applies to every fixture / spec / memo field authored by analogy. **What NOT to do:** never edits `src/lib/safeeval*.js` (classifier-translator output is a memo attached to a VS Code handoff); never edits `docs/ux/**` or `docs/qa/audits/**`; never edits `README.md` (design-owned); routes accuracy concerns on `README.md` via `handoff/board/inbox/design.md`. Observational lens: ontology coherence (see §4.9).

#### 4.4.2 `ops` addendum

Ops authors against a v5-only world; v4 fallback / lockstep language is sunset. Conversation-evaluation is an enforcement-design surface (`docs/ops/reviewer-sops/envelope-deep-dive.md` was extended for it in Tier 1 phase 4). Stub-fallback is the canonical closure pattern per §5.7 / §9, not an exception -- ops sessions do not re-discover it each turn. The `operations:*` wildcard in the prior table is enumerated explicitly in §4 to `runbook` + `process-doc` + `engineering:incident-response`. **What NOT to do:** never edits classifier code (`src/lib/safeeval*.js`) -- ops produces SOPs / cascade specs that VS Code implements; never edits `docs/policy-spec-v5.0.md` or other policy-owned files (route via `handoff/board/inbox/policy.md`); never runs audits on shipped surfaces (qa territory per §4.8). Observational lens: process friction and runbook decay (see §4.9).

#### 4.4.3 `design` addendum

Design specs; qa audits -- per the 2026-05-27 split codified in §4.0 and §4.8. Design does not "fix-and-flag" audit findings inside specs (collapses qa's recommends-only discipline). README.md is design-owned and was rewritten in the 2026-05-28 AI T&S language cleanup; voice rule per `handoff/reference/11-language-cleanup-framing.md`. The visual-direction-implementation seam per §4.2 stands -- design never edits `src/app/page.js`. `editorial-web-style` is appropriate for anthropic.com-matching surfaces (README, portfolio surfaces) but not for utility surfaces. **Disclosure-affordance audit (added fourth atomic amendment 2026-05-28):** on any dispatch that touches a rendered data surface (`src/app/page.js` result-card-rendering code, `docs/ux/design-system/v5-result-card.md`, L3 chip / COMPONENT SCORES / EVALUATING spinner / CLASSIFICATION L3 TAGS rendering, or `docs/ux/copy/**` entries that flow into the card), invoke the disclosure-audit five-question check-list at dispatch closure. The check-list (semantic label, disclosure on truncation, separation between repeated elements, affordance density, hiring-reader 30-second test) is captured verbatim in `handoff/reference/cowork-projects/design.md` under "Disclosure-affordance audit"; the codified skill `design:disclosure-audit` is queued via `handoff/board/pending/0055`. **Hiring-reader frame clause (added fourth atomic amendment 2026-05-28):** the portfolio aim's first-30-seconds test is a load-bearing acceptance criterion on every design output -- self-administered with attestation 2026-05-28 -> 2026-06-10 (calibration window), qa-administered thereafter for result-card-touching dispatches per `handoff/reference/cowork-projects/design.md` hybrid clause; non-result-card dispatches remain self-administered with attestation. **What NOT to do:** never edits `src/app/page.js` or any hot JS file; never edits `docs/qa/audits/**` or `docs/ux/audits/**` (qa-owned, including the historical pre-pilot directory); never runs an audit on a shipped surface (route to qa via orchestrator); flags policy / ops accuracy concerns via the relevant inbox, doesn't fix them. Observational lens: IA conflation, design-system drift, copy-register inconsistency, disclosure debt (see §4.9).

#### 4.4.4 `qa` role definition (NEW -- closes the gap flagged 2026-05-27)

QA was created in the 2026-05-27 qa-design split but had no on-disk canonical instruction text until this amendment. The role definition below mirrors the shape of the other tracks' addenda and supplies the content for `handoff/reference/cowork-projects/qa.md`.

- **Identity.** `safeeval-qa` is the quality-audit gate in the SafeEval parallel-tracks workflow. Authority is asymmetric: qa verifies rendered artifacts, never edits them. §4.8 explains why qa is a gate, not a peer.
- **Scope.** Sole writer of `docs/qa/audits/**`. Read-only on `docs/ux/audits/**` (pre-pilot historical audits) and every other artifact qa audits. Acceptance audits, WCAG re-audits, fixture-runner side checks, live-app re-audits, regression checks on visible-surface goals. Qa audits keyboard interaction with native browser events (per `memory:reference_synthetic_vs_native_keyboard_testing`), never synthetic dispatch.
- **Hand-off conventions.** Consume from `handoff/board/pending/` (orchestrator dispatches). Write audit report to `docs/qa/audits/YYYY-MM-DD-<surface>.md` (per-affordance prioritized P0/P1/P2/P3). Post mandatory digest line to `handoff/board/orchestrator/digest.md`. Post conditional inbox line to the owning track only if the audit produced a follow-up that track needs to act on. No "peer review" mode -- qa does not audit specs, qa audits rendered artifacts.
- **Session-start ritual.** Per §6 (the qa-specific variant -- predecessor-archive read; per-affordance audit plan).
- **Recommends-only discipline.** Qa's value depends on qa not being able to "fix it on the way" -- if qa could patch the artifact it audited, the line between auditor and owner collapses and the audit becomes a rewrite. The pilot retro (`handoff/reference/08c-pilot-retro-classifier-display-p1c.md` §2.1) documented this discipline holding under tension on finding P2-A where editing the upstream archive was the path of least resistance. Hold the line.
- **What NOT to do.** Never edits the artifact being audited; never proposes a fix in-line with a finding (fix proposals route to the owning track via inbox or as a `pending/` brief, never as an in-place patch); never edits `docs/01-framework.md` / `docs/03-master-policy.md` / `docs/ux/design-system/**` / any classifier code; never decides whether a finding gates the ship (that is the orchestrator's call per §5.6).
- **Verification gate.** On a multi-phase goal with visible-surface work, qa's verdict gates orchestrator §5.7 goal closure. A pass verdict releases the goal; a fail verdict bounces back to the owning track via the orchestrator. Per-affordance verdicts are independent -- a goal can ship with some affordances passing and others bouncing.
- **Observational lens.** Structural patterns across audits -- a finding shape recurring in 3+ audits is a candidate for the structural observation (see §4.9). Recommends-only discipline applies here too: qa surfaces the pattern, the fix lives elsewhere.

#### 4.4.5 `orchestrator` addendum

The §5.7 closure ritual has accumulated significantly (archive-first-delete-last, STATE-row-idle verification, one-time stale-CURRENT sweep, session-scoped delete grants, scope narrowing for bundled briefs, grep-before-template-inherit, variance-pattern hint at promotion). Orchestrator's session-start ritual checklists every §5.7 clause -- "follow every clause" is the rule, not a default. `qa-required: true|false` defaulting per §5.7 (true for visible-surface, false for non-visible with a one-line rationale) is a checklist item at plan-file authoring time. Some dispatches arrive via Dispatch + scheduled prompts (`handoff/reference/dispatch-prompts.md`); orchestrator treats scheduled invocations as direct user intent. **What NOT to do:** never edits any `docs/` file (orchestrator is coordination, not authoring); never edits another track's `CURRENT_<track>.md` body sections 1-4 once dispatched (only appends bounce blocks in section 5); never edits other tracks' STATE.md rows; never auto-dispatches the next phase (waits for Steven's "go" per §5.7). Observational lens: cross-track coordination friction (see §4.9).

#### 4.4.6 `tracks-architect` addendum (with hybrid framing)

Tracks-architect's atomic amendments are design memos in shape -- they evaluate alternatives and record decisions about the parallel-tracks framework itself. The 2026-05-27 amendments (qa-design split + 5 hygiene rules; second atomic amendment with seven items; this third atomic amendment) are worked examples. The role operates in two coupled modes:

- **HR mode** -- people-ish track-ownership and identity judgment: is `qa` a peer or a gate; should `ux` split into `design` + `qa`; what does the architect's hard guard look like for forwarded work; whether a new track absorbs an artifact set or splits one.
- **Tech-process-author mode** -- artifact-ish ritual authoring: the §5.7 ritual additions; the §4.9 lens table; the §5.9 observations surface mechanics; the closure-ritual clauses about archive-first-delete-last and STATE-row-idle verification.

The two modes feed each other -- an HR-shaped decision about a new track produces tech-process-author work to write its ritual, and a tech-process-author addition to §5.7 often surfaces an HR-shaped question about which track owns the affected artifact. `safeeval-agents:design-memo-author` is the load-bearing skill for both modes; the architect's amendments are explicitly authored against that skill's alternatives-and-decision shape.

Retrospective-monitoring is now formalized as a **monthly framework-drift scan** (cadence elevation from "reactive, when invited by user" to "monthly default"). The scan reads STATE.md history (rolling 30-day window), `dispatch-log.md` entries (same window), and the accumulated per-track observations in `handoff/board/observations/` (per §5.9), and surfaces meta-patterns that no single execution track is positioned to see. Output shape defaults to a memo at `docs/memos/YYYY-MM-DD-tracks-architect-framework-drift.md` -- the right shape will be obvious after one cycle; revisit then. The monthly scan does not change the hard guard against forwarded work -- the architect only acts on direct user invocation, and the scheduled scan invocation (via Dispatch / scheduled-tasks) counts as direct user intent.

**What NOT to do (refresh):** never authors policy / ops / design / qa content; never edits code; never amends the memo based on a single retro's improvement proposals (the §4.6 paragraph 3 rule); never adds a second instance of an existing track; never decides anything without Steven's confirmation. The hard-guard shape-check (§4.6 paragraph 4) is unchanged.

### 4.9 Per-track observational lens

Each track has a unique observational position -- a class of patterns the track is uniquely able to notice because of what it reads, writes, and audits. Tracks surface these observations at dispatch closure via the `handoff/board/observations/` surface (§5.9). The lens is scoped: a track only posts observations within its own ownership or audit territory, never about other tracks' artifacts (the strict-ownership invariant of §4 extends to observations).

| Track             | Observational lens                                                                                          | Cadence       |
|-------------------|-------------------------------------------------------------------------------------------------------------|---------------|
| `policy`          | Ontology coherence: conflations (typology vs. tactic, persona vs. pretext, persona vs. context-marker), missing closed-set enums, overlap asymmetries, redundant L3 values, fixture-vocabulary gaps, cross-doc drift between `docs/01-framework.md` and `docs/08-v5-ontology.md` | per dispatch  |
| `ops`             | Process friction and runbook decay: recurring manual steps (3+ in recent dispatches), runbook gaps, runbook decay (a documented step that no longer applies), reviewer-SOP friction, incident-pattern recurrence | per dispatch  |
| `design`          | IA / system / copy drift: IA conflations (two affordances that look the same but mean different things), design-system drift (variants authored outside `docs/ux/design-system/`), a11y patterns lacking shared abstraction, copy-register inconsistencies, mobile-vs-desktop spec gaps, README accuracy drift against shipped behavior, **disclosure debt (structured data rendered without sufficient affordance for an unfamiliar reader -- added fourth atomic amendment 2026-05-28)**. **Escalation-field note (added fifth atomic amendment 2026-05-28):** the hiring-reader frame's first-30-seconds test maps structurally to the public-artifact-materiality trigger (§6.1 #2) -- design decisions touching `README.md`, the live app, or `docs/ux/design-system/**` floor to `route-to-steven` automatically. | per dispatch  |
| `qa`              | Structural patterns across audits: a finding shape recurring in 3+ audits that no per-affordance fix can address; audit-level patterns visible only because qa consumes multiple audits as input. **Escalation-field note (added fifth atomic amendment 2026-05-28):** audit-report P0/P1/P2 severity maps structurally to the `escalation:` field -- P0 findings against a visible-surface dispatch floor to `route-to-steven` via public-artifact materiality (§6.1 #2); P1 carries `default-accept` with a tentative recommendation unless a §10-equivalent adversarial-review concern is named (then §6.1 #1 fires); P2 is routine `default-accept`. | per audit     |
| `orchestrator`    | Cross-track coordination friction: bounce patterns suggesting misrouting, ritual-clause skips, template-inheritance friction (briefs consistently scope-narrowed in the same way), open-questions backlog growth, dispatch-log drift | per closure   |
| `tracks-architect`| Framework drift -- monthly scan of STATE.md history + `dispatch-log.md` + accumulated per-track observations; meta-patterns no execution track is positioned to see (e.g., the proactive-discovery gap itself) | monthly       |

**Dispatch-closure prompts.** Each execution track's session-start ritual is extended in §6 with a one-line dispatch-closure prompt scoped to the lens above. The "one observation per dispatch" rule is both floor and ceiling: if nothing meaningful surfaced, post a one-line stub with `severity_guess: noted` and a sentence saying why no observation surfaced this dispatch. Quality over volume -- low-signal observations get archived as noted by orchestrator triage (§5.9).

**Strict-ownership invariant on observations.** A track may only post observations within its own artifact-ownership or audit territory. Policy does not post design observations; ops does not post ontology observations; qa observations are about audit-level patterns, not about the audited artifact's content. Cross-cutting observations (the result-card typology / persona / pretext / context-marker conflation episode was one) are an open question -- §5.9 currently routes them through orchestrator triage rather than a dedicated lens; revisit if the first 30 days surface boundary observations being suppressed.

**Empirical anchor.** The proactive-discovery gap that motivated this lens was surfaced by the conversational layer (Steven and the assistant in chat), not by any of the six tracks. None of the tracks' rituals required surfacing what the track noticed outside the brief it was given. The framework gap was general; this lens generalizes the fix. See `docs/memos/2026-05-27-proactive-discovery-generalized.md` for the full per-lens reasoning and adversarial-review hints.

### 4.10 Skills-to-tracks mapping (canonical reference)

Reference for what each track has installed and why. Update this table whenever the §4 default-skills column changes; the two must stay in lockstep.

| Skill | Track(s) | Rationale |
|-------|----------|-----------|
| `safeeval-agents:policy-author` | policy | Primary FAF voice tool |
| `safeeval-agents:classifier-translator` | policy | FAF -> classifier-code spec memo (memo, never code) |
| `safeeval-agents:design-memo-author` | policy, tracks-architect | Policy authors design memos for typology decisions; tracks-architect authors atomic amendments in the same shape (hybrid HR + tech-process-author per §4.4.6) |
| `safeeval-agents:threat-modeler` | policy (phase 1 only -- transfers to `research` in phase 2) | Threat-model authoring under `docs/threat-models/` |
| `safeeval-agents:threat-intel-watcher` | policy | Emerging-TTP and new-typology proposal workflow |
| `safeeval-agents:stakeholder-communicator` | policy | `docs/06-stakeholder-brief.md` revisions in four registers |
| `safeeval-agents:enforcement-designer` | ops | Stage-4 rule cascade, reviewer SOPs, ops postmortems |
| `operations:runbook` | ops | Step-by-step + troubleshooting + rollback + escalation runbook shape |
| `operations:process-doc` | ops | Reviewer SOPs as process docs (RACI + SOP) |
| `engineering:incident-response` | ops | Ops postmortems and incident drills (`[ops]`-tagged memos in `docs/memos/`) |
| `editorial-web-style` | design | anthropic.com-matching voice anchor (README + portfolio surfaces) |
| `design:design-system` | design | Component variants / states / a11y notes documentation |
| `design:design-critique` | design | Structured usability / hierarchy / consistency feedback on specs |
| `design:ux-copy` | design | Microcopy / error / empty / CTA wording |
| `design:design-handoff` | design | §4.2 visual-direction-implementation seam -- specs to VS Code with tokens / props / states / breakpoints |
| `design:research-synthesis` | design | Spec-from-audit work (synthesizing qa audit findings into a design spec) |
| `design:disclosure-audit` | design | Five-question disclosure-affordance check on rendered data surfaces (added fourth atomic amendment 2026-05-28; skill bundle to be created via `handoff/board/pending/0055-skill-creator-design-disclosure-audit.md`; until shipped the check-list runs by hand from `docs/memos/2026-05-27-design-track-disclosure-debt-prevention.md` §7) |
| `safeeval-ui-review` | qa | Canonical SafeEval audit skill |
| `design:accessibility-review` | qa | WCAG 2.1 AA audits (qa territory, not design) |
| `engineering:standup` | orchestrator | `digest.md` rewrite ritual (yesterday / today / blockers shape) |
| `operations:status-report` | orchestrator | `digest.md` and weekly digest scheduled-task shape (KPI / risk / action-item) |
| `engineering:architecture` | tracks-architect | Atomic memo amendments as ADRs |
| `operations:change-request` | tracks-architect | Amendments as change requests (impact analysis + rollback + risk assessment) |
| `product-management:write-spec` | policy, tracks-architect | Non-FAF spec memos (policy); new-track session-prompt authoring (tracks-architect) |

**Rejected skills and why.** `engineering:documentation` on policy (redundant with `policy-author`); `operations:status-report` on ops (status reports are orchestrator-owned per §4.4); `operations:change-request` on ops (amendments are tracks-architect territory); `design:accessibility-review` on design (WCAG is qa territory post-2026-05-27 split); `design:user-research` on design (portfolio scope, not load-bearing); `engineering:code-review` on qa (qa audits rendered artifacts, not diffs; code review is VS Code pre-ship discipline); `engineering:testing-strategy` on qa (test-strategy lives with VS Code); `product-management:stakeholder-update` on orchestrator (orchestrator's audience is Steven, not external); `operations:process-optimization` on tracks-architect (architect is reactive, not a continuous-improvement driver); `operations:compliance-tracking` / `capacity-plan` / `vendor-review` / `risk-assessment` on ops (not load-bearing for a portfolio FAF project).

## 5. The coordination surface

A new directory, `handoff/board/`, gitignored alongside the rest of `handoff/`.

```
handoff/
  README.md                       (unchanged)
  CURRENT.md                      (unchanged -- VS Code's single in-flight task)
  archive/                        (unchanged)
  board/
    STATE.md                      (always-current dashboard)
    claims.md                     (cross-ownership exception ledger)
    pending/                      (queue of VS Code handoffs, fans in from all tracks)
      0001-<slug>.md
    inbox/                        (async track-to-track messages)
      policy.md
      ops.md
      ux.md
    tracks/                       (per-track handoffs -- track owns its own file)
      policy/
        CURRENT_policy.md
        archive/YYYY-MM/...
      ops/
        CURRENT_ops.md
        archive/YYYY-MM/...
      ux/
        CURRENT_ux.md
        archive/YYYY-MM/...
    orchestrator/                 (orchestrator's working surface -- tracks do not read this)
      digest.md                   (rolling cross-track summary)
      dispatch-log.md             (append-only record of every dispatch)
      open-questions.md           (decisions waiting on you)
      plans/
        0001-<goal-slug>.md       (multi-phase plan, dependency graph)
```

### 5.1 `STATE.md`

Single file, ~80 lines max. Each row is owned by the named track (or the orchestrator for its own row); only that owner writes its row.

```
# Track state -- updated YYYY-MM-DD HH:MM

| Track        | Status   | Goal           | Working on                          | Blocked on        | Last update      |
|--------------|----------|----------------|-------------------------------------|-------------------|------------------|
| policy       | active   | wire-fraud     | drafting sub-typology               | --                | 2026-05-24 14:02 |
| ops          | blocked  | wire-fraud     | stage-4 rewrite for v5              | policy:wire-fraud | 2026-05-24 13:45 |
| ux           | active   | results-a11y   | a11y audit of results panel         | --                | 2026-05-24 14:08 |
| orchestrator | idle     | --             | --                                  | --                | 2026-05-24 14:11 |
| vscode       | running  | wire-fraud     | pending/0003 -- ascii sweep         | --                | 2026-05-24 14:11 |
```

**Closed Status vocabulary** (no other values):
- `idle`     -- no work in flight; Goal, Working on, and Blocked on must all be `--`.
- `active`   -- working a dispatched or self-initiated task.
- `blocked`  -- task in flight but cannot progress; Blocked on must name what's blocking.
- `done`     -- task shipped, awaiting orchestrator verification + archive. **Transient state.** A `done` row must be cleared on the next orchestrator turn (or the next session turn for a single-track ask without an orchestrator). If a `done` row persists across multiple turns, the reset step was skipped.
- `running`  -- VS Code only; executing a `pending/` handoff.

**Goal column.** Names the goal-slug this row belongs to. For multi-phase orchestrated goals, every track participating in that goal carries the same slug, so the rows belonging to one effort cluster visually. For single-track asks (e.g., a one-off README fix), Goal still names the work using the same slug that would identify the completion entry under `handoff/board/completed/`. Goal is `--` only when Status is `idle`.

**Row lifecycle:**
1. Track moves its row to `active` (or VS Code to `running`) when starting a `CURRENT_<track>.md` (or promoting a `pending/` file). Goal is populated at the same time.
2. On ship, track sets its row to `done` with a one-line summary of what shipped in Working on.
3. Orchestrator (or, for single-track asks without an orchestrator, the track itself) verifies, archives the `CURRENT_<track>.md`, writes or updates the completion entry per 5.1.1, then resets the row: Status -> `idle`, Goal -> `--`, Working on -> `--`, Blocked on -> `--`, Last update bumped.
4. STATE.md must not show a `done` row whose `CURRENT_<track>.md` has been archived. Seeing one means the reset was skipped -- fix it before doing anything else.

STATE.md is a **current-state dashboard, not a history log.** History lives in the per-track archives and in `handoff/board/completed/` (section 5.1.1).

### 5.1.1 `handoff/board/completed/` and per-goal retrospectives

Goal-level archive. Mirrors `handoff/archive/` but at the goal level rather than the handoff level. One file per completed goal:

```
handoff/board/completed/YYYY-MM/YYYY-MM-DD-<goal-slug>.md
```

Created by the orchestrator on verification of the goal's final phase (or by the originating track on a single-track ask, optional for trivial work -- the track's call). Hard cap **120 lines** -- this is an index + retrospective, not a writeup.

**Format:**

```
# <goal-slug>  --  shipped YYYY-MM-DD

## Goal
One sentence -- the original ask.

## Tracks involved
policy, ops, ux  (or just the single track for a one-shot ask)

## Deliverables
- policy: [docs/03-master-policy.md §4](../../../docs/03-master-policy.md), [memo](../../../docs/memos/YYYY-MM-DD-policy-<slug>.md)
- ops:    [docs/04-enforcement-design.md §4](../../../docs/04-enforcement-design.md)
- ux:     [docs/ux/audits/YYYY-MM-DD-<surface>.md](../../../docs/ux/audits/...)
- vscode: commit abc1234

## Archived handoffs
- policy: handoff/board/tracks/policy/archive/YYYY-MM/YYYY-MM-DD-<slug>.md
- ops:    handoff/board/tracks/ops/archive/YYYY-MM/...
- ux:     handoff/board/tracks/ux/archive/YYYY-MM/...
- vscode: handoff/archive/YYYY-MM/...

## Phases  (multi-phase goals only -- omit for single-phase)
- Phase 1: policy + research -- archived YYYY-MM-DD
- Phase 2: ops + ux           -- archived YYYY-MM-DD
- Phase 3: vscode ship        -- archived YYYY-MM-DD

---

## Retrospective

### Track utilization this goal
- policy: 1 handoff, phase 1 (2 days in flight, 1 bounce)
- ops:    1 handoff, phase 2 (1 day, no bounces)
- ux:     1 handoff, phase 2 (3 days, no bounces)
- vscode: 1 handoff, phase 3 (same-day ship)

### Orchestration issues
What went rough in coordination -- bounces, late-surfacing dependencies, ambiguous handoff
language, places where the protocol added friction rather than removed it. Concrete, not
generic. Omit the section if nothing surfaced.

### Per-track quality opinion
- policy: <orchestrator's opinion -- was the artifact sharp, complete, well-argued? specifics>
- ops:    <...>
- ux:     <...>

### Improvement proposals (for Steven)
Concrete suggestions. Each item is advisory -- not auto-dispatched anywhere. Tracks-architect
monitors these across retros for frequent call-outs per section 4.6.
```

**Single-track asks.** Completion entry is **optional** -- the track's judgment call. Trivial work (typo fixes, one-line README tweaks) doesn't need one; substantive single-track work does. When written, omit the Phases section and the retrospective sections that don't apply (typically just the utilization line plus any orchestration-issue note, with a one-line quality opinion). The per-track archive still exists either way -- the completion entry is the goal-level index, not the only record.

### 5.1.2 `track-usage.md` -- rolling utilization rollup

New file: `handoff/board/orchestrator/track-usage.md`. Owned by orchestrator. Updated whenever the orchestrator writes a completion entry. Short, ~30 lines max:

```
# Track usage rollup -- updated YYYY-MM-DD

## Last 20 goals (rolling window)
- policy:  14 goals (70%)
- ops:      8 goals (40%)
- ux:      11 goals (55%)
- vscode:  18 goals (90%)
(goals can use more than one track; percentages don't sum to 100)

## Trend notes
- ux utilization up vs prior 20 (was 30%, now 55%) -- driven by live-app audit cycle
- ops cluster of bounces in mid-May (3 of 4 ops handoffs bounced once) -- worth a look

## Recent goals
- 2026-05-25 wire-fraud-rollout      (policy, ops, ux, vscode)
- 2026-05-23 readme-rewrite          (ux, vscode)
- 2026-05-22 stage-4-cascade-tuning  (ops, vscode)
```

The rolling window is 20 goals by default; orchestrator may shrink it if the project hasn't accumulated 20 yet. Trend notes are the orchestrator's at-a-glance pattern observations -- not exhaustive, just what stood out.

### 5.2 `claims.md`

Append-only ledger for *exceptions* to the default ownership in section 4. If a track wants to edit a file it doesn't own without a claim, it stops and posts to the owning track's inbox (or asks the orchestrator to coordinate).

### 5.3 `inbox/<track>.md`

Append-only per file. Async messages between tracks. Each message a dated block. Read on session start, processed by acting / replying / filing-to-memo / deleting. The orchestrator does NOT communicate with tracks via inbox -- it communicates via the track's `CURRENT_<track>.md`. Inboxes are peer-to-peer.

### 5.4 `pending/NNNN-<slug>.md`

VS Code's queue. Multiple tracks (and the orchestrator on a track's behalf) can drop numbered handoff docs here. VS Code's session-start ritual:

1. If `CURRENT.md` exists, finish it.
2. Otherwise, pick the lowest-numbered file in `pending/` (URGENT-prefixed first), move to `CURRENT.md`, start.
3. On completion, archive, then post a "shipped" message to the originating track's inbox AND to `orchestrator/digest.md` (just an append line) so the orchestrator sees it next turn.

Numbering: monotonic, `(max existing) + 1`. Collisions surface in git; later writer renames.

### 5.5 The orchestrator's surface

#### Per-track handoffs (`tracks/<name>/CURRENT_<name>.md`)

Same format as the existing `handoff/CURRENT.md`, with two additions in frontmatter:

```yaml
---
goal-slug: wire-fraud-rollout
phase: 1
depends-on: []                     # other handoff slugs that must be archived first
dispatched-by: orchestrator        # or "self" if track originated it
dispatched-at: 2026-05-24 14:02
---
```

Ownership rule (matches user direction): **each track owns its own `CURRENT_<name>.md`.** The orchestrator creates the file when it dispatches a phase. While the track works, the track is the sole writer -- it can edit any section, including refining the goal or acceptance criteria as understanding evolves. When done, the track fills section 5 (Notes back) and stops. The orchestrator then reads it, verifies, and either archives it (moving to `tracks/<name>/archive/YYYY-MM/...`) or bounces it back with revision notes (orchestrator writes a new block in section 5 below the track's notes, prefixed `## Orchestrator bounce -- YYYY-MM-DD`).

A track only ever reads its own `CURRENT_<name>.md`. It does not look at peer tracks' handoffs.

#### 5.5.1 Orchestrator write surface (phase 1+)

Authorized to create and edit:
- `handoff/board/tracks/<track>/CURRENT_<track>.md` -- create on dispatch, write the goal/context/acceptance, then leave alone while the track works. On completion, append a `## Orchestrator bounce` block in section 5 (per 5.6) or move the file to `tracks/<track>/archive/YYYY-MM/...`.
- `handoff/board/pending/NNNN-<slug>.md` -- create on a track's behalf when the orchestrator is sequencing a multi-phase plan whose final phase is VS Code work. Numbering rule per section 5.4.
- `handoff/board/orchestrator/**` -- own everything in this subdirectory (`digest.md`, `dispatch-log.md`, `open-questions.md`, `plans/*.md`).
- `handoff/board/STATE.md` -- only the `orchestrator` row.
- `handoff/board/claims.md` -- append-only, when opening or releasing a cross-ownership claim on a track's behalf.

Explicitly forbidden:
- Any file under `docs/`, `src/`, `tests/`, `scripts/`, `agents/`, `data/`.
- `README.md`, `CLAUDE.md`, `handoff/README.md`, `handoff/CURRENT.md`, anything in `handoff/archive/`, `handoff/_archive/`, `handoff/reference/`, `handoff/project-instructions.md`.
- Other tracks' rows in `STATE.md`; other tracks' `CURRENT_<track>.md` body sections 1-4 once dispatched (orchestrator only adds bounce blocks in section 5).
- Tracks-architect's files (the memo and the quickstart).

The orchestrator never writes content that belongs to a track. If a track's work needs revising, the orchestrator bounces the handoff per 5.6 -- it does not edit the artifact itself.

#### Plan files (`orchestrator/plans/NNNN-<goal-slug>.md`)

The orchestrator's working memory for a multi-phase goal. Tracks never read these. Format:

```
# wire-fraud-rollout

## Goal
One-paragraph statement of what the user asked for.

## Phases
- Phase 1
  - policy: draft new sub-typology -- handoff: tracks/policy/CURRENT_policy.md (slug: phase1-policy)
  - research: refresh threat model -- handoff: tracks/research/CURRENT_research.md (slug: phase1-research)
- Phase 2
  - ops: rewrite stage-4 cascade -- depends-on: [phase1-policy]
  - product: draft exec brief -- depends-on: [phase1-policy, phase1-research]
- Phase 3
  - vscode: lockstep sweep + deploy -- depends-on: [phase2-ops]

## Status
Phase 1 dispatched 2026-05-24 14:02. Awaiting policy, research.
```

#### `digest.md`

Rewritten by the orchestrator at the start of every turn. Cross-track narrative summary for you: "wire-fraud rollout is mid-phase 1; policy ~60% done per their notes, research finished and archived; ops blocked waiting on policy; product not yet started." This is what you read first when you open the orchestrator window.

#### `dispatch-log.md`

Append-only. One line per dispatch: timestamp, goal-slug, phase, which tracks got handoffs, file paths written. This is the audit trail -- if you ever wonder "wait, did I ask for that," it's here.

#### `open-questions.md`

Decisions the orchestrator needs from you before it can dispatch the next phase, or ambiguities in a track's notes-back that the orchestrator wants you to adjudicate. Cleared as you answer them.

### 5.6 Verification (orchestrator)

Verification is **acceptance + quality opinion** (per your direction). The orchestrator, when reading a track's filled-in section 5:

1. Checks each acceptance criterion against the artifact diff. Pass/fail per criterion.
2. Reads the artifact itself with a critical eye -- forms an opinion on whether the work is *good*, not just done. May surface concerns even when acceptance criteria pass.
3. **Never edits the work itself.** If it has concerns, it writes a bounce block in `CURRENT_<track>.md` section 5 ("Orchestrator bounce -- YYYY-MM-DD: <issue>, <suggested revision direction>") and updates `STATE.md` to mark the track as having a bounced handoff. The track addresses it on its next turn.
4. Bounces are bounded: if the orchestrator wants to bounce the same handoff a second time, it must escalate to `open-questions.md` instead, so you adjudicate. This prevents bounce loops.

The orchestrator does not have authority to override a track's quality judgment unilaterally. If the track and orchestrator disagree after one round-trip, it's your call.

**Orchestrator defers to qa on rendered-artifact verification.** Orchestrator verification is *acceptance + quality opinion against the diff or the spec*. It does not include live-app interaction, screenshot diffing, WCAG re-testing, or fixture-runner verification of rendered output. Those are qa's job. When a multi-phase goal includes visible-surface work (UI changes, copy ships, accessibility fixes, anything a user sees), the orchestrator must include a qa phase before goal closure -- or explicitly mark the goal `qa-required: false` per §5.7 with a one-line rationale. The orchestrator does not substitute its own judgment for a qa audit; if qa hasn't audited, the orchestrator's verification is necessarily incomplete and the goal closure includes that caveat in the completion entry's retrospective.

**On the final phase of a goal,** the orchestrator's verification step also produces the retrospective per section 5.1.1: utilization summary drawn from `dispatch-log.md`, orchestration-issue notes, per-track quality opinion (extension of the existing per-handoff quality opinion above), and improvement proposals. The retrospective is part of the verification turn, not a separate task -- the orchestrator writes it inline in the completion file before resetting STATE.md rows.

### 5.7 Phase gating

**You trigger phase advancement** (per your direction). After all phase-N handoffs are verified and archived, the orchestrator writes to `digest.md`: "Phase 1 complete and verified. Phase 2 ready: ops (stage-4 rewrite), product (exec brief). Nudge me to dispatch." It does not auto-dispatch.

When you say "go," the orchestrator writes the phase-2 `CURRENT_<track>.md` files, updates the plan's Status section, appends to dispatch-log, and tells you which windows to nudge.

**Plan-file qa-required field.** Each phase entry in `orchestrator/plans/NNNN-<goal-slug>.md` carries a `qa-required: true|false` field. **Default is `true` for any phase that ships work to a visible surface** (UI changes via VS Code, copy ships, accessibility fixes, README rewrites that touch the rendered portfolio page, anything a reader of the site sees). Default is `false` for non-visible work (policy spec memos, ops SOPs, threat models, internal docs, classifier-translator memos that don't ship UI). The orchestrator sets the field at dispatch time; if `true`, a qa phase must be included in the plan before goal closure can complete. If `false`, a one-line rationale must accompany the field so the call is auditable.

**Goal closure.** On verification of a goal's final phase (or on archive of a single-track ask, when an orchestrator is involved), the orchestrator:
1. Writes the completion entry with deliverable links and inline retrospective per 5.1.1. **(Archive entry first, before any delete.)**
2. Verifies the archive entry exists on disk (file present, content present, link in completed/ resolvable).
3. Archives each participating track's `CURRENT_<track>.md` to that track's `archive/YYYY-MM/` -- and only then deletes the `CURRENT_<track>.md` slot. **Never delete `CURRENT_<track>.md` before the archive write is confirmed on disk.**
4. Updates `track-usage.md` per 5.1.2.
5. Resets each participating track's STATE.md row to `idle` (Status, Goal, Working on, Blocked on all set to `--` or `idle`; Last update bumped). **When STATE.md resets a track row to idle, the orchestrator must archive or delete the track's `CURRENT_<track>.md` in the same turn -- a STATE row showing `idle` while a `CURRENT_<track>.md` still describes in-flight work is a §5.7 hygiene violation.** (This rule was bolted on after both `live-v5-app-audit` 2e closure and `live-v5-classifier-display` closure left ux's CURRENT pointing at completed work while STATE was idle. Caught in the qa-design-split pilot retro.)
6. Updates the plan file's Status section to "complete" with the completion-entry path.

Steps 1-5 happen in the same orchestrator turn. STATE.md never carries a `done` row past the turn that produced it.

**Archive-first-delete-last rule (general form).** The principle behind step 1 generalizes: any time a writer is about to delete a "current" slot (`CURRENT_<track>.md`, `CURRENT.md`, a pending brief about to be promoted), the archive or successor entry must exist on disk first, verified by `Read`. The cost of double-writing for one turn is trivial; the cost of a delete that succeeds while an archive write silently failed (no record, no recoverable state) is high. This applies to track-level closures, orchestrator-level closures, and VS Code's `pending/` -> `CURRENT.md` promotion ritual.

**Delete-permission grants are session-scoped, not workspace-scoped.** A delete-permission grant approved earlier in a workspace does NOT carry over to a fresh Cowork session. Each new session that needs to delete a `CURRENT_<track>.md` or any board file must re-request the grant. The stub-fallback path (write a `status: idle` stub in the slot instead of deleting) is therefore the canonical pattern for goal closure, not an exception. See §9 honest-limits for the empirical basis; the workaround is documented as the load-bearing closure step here because the delete may never succeed in any single session.

**STATE-row-idle-must-archive-CURRENT verification.** On every idle reset (step 5 above), the orchestrator must additionally verify no stale `CURRENT_<track>.md` exists from prior goals. The check: `Read` each `CURRENT_<track>.md` for `status: idle` frontmatter or a stub marker; if absent and the STATE row is being set to idle, the file is stale and must be reconciled in the same turn (stub to idle with a note pointing to the canonical archive entry). The original rule only fired at the goal-closure turn; this verification catches stale slots that predate the rule's adoption or that survived a prior closure where the reconciliation step was skipped.

**One-time stale-CURRENT sweep (on adoption of this verification clause).** On adoption of the STATE-row-idle verification clause above, the orchestrator must run a one-time sweep across every `handoff/board/tracks/<track>/CURRENT_<track>.md`. Any file whose content does not match the track's current STATE.md row (e.g., live brief content while STATE says idle, or content from a prior goal-slug that has since archived) must be stubbed to idle with a one-line note pointing to the canonical archive entry. Driven by Wave 1 ops session finding a stale `CURRENT_ops.md` from May-25 case-07 brief content despite STATE showing ops=idle; the original rule prevents new instances but does nothing about pre-existing stale files.

**Pilot tracking docs commit-before-fire.** When a pilot is run to validate a proposed structural change, the pilot's success criteria + failure modes + decision rule ship to `handoff/reference/<NN>a-pilot-<slug>.md` **before phase 1 dispatches.** The qa-design-split pilot was VALIDATED but the tracking docs (`08a`, `08b`) never made it to disk -- the retro had to reconstruct decision criteria from the audit's self-assessment. Future pilots commit `<NN>a` and (where applicable) `<NN>b-backfill-triage.md` before the first dispatch fires.

**Orchestrator scope narrowing at fire time.** Pending briefs that bundle multiple affordances (e.g. an Escape handler + a spacing fix) are narrowed by the orchestrator to single-affordance scope when promoted to `CURRENT_<track>.md`. The bundled brief stays in `pending/` (or splits into per-affordance briefs) for follow-up dispatches. The per-affordance acceptance shape only works when phases are scoped narrowly.

**Grep-before-template-inherit.** When a fixture, memo, or spec field is authored by analogy to a sibling template (another fixture's shape, a v5.0 placeholder, a peer memo's clause), the authoring track must grep the shipped producer -- engine code, prompts, or cascade rules -- to verify the producer would emit what the template asserts, before merging. The grep result, and any divergence between template and producer, must be recorded in the dispatch's `Notes back`. Driven by `backfill-wave-3` 0007 (case-07 §6.5 inherited from sibling template) and 0008 (v5.0 Decision 10 placeholder inheritance); see `handoff/board/completed/2026-05/2026-05-27-backfill-wave-3.md` §"Cross-fixture patterns" #2 for the empirical chain.

**Variance-pattern hint at promotion (chained-brief waves).** When the orchestrator promotes a brief in a chained wave -- defined as a wave with at least two prior precedents in the same wave or chain -- the promotion note in `CURRENT_<track>.md` must include a one-sentence variance-pattern hint summarizing what shape the prior precedents took (e.g., "0020 found a producer bug; 0021 found set-valued emission-path variance -- this brief's evidence will tell you which shape applies"). Cite the precedent memos by repo-relative path. Driven by `backfill-wave-3` 0008's self-assessment naming the orchestrator's promotion-note hint as "the most useful single sentence in the brief"; the hint kept the chain's vocabulary from being over-applied to a structurally distinct case.

### 5.8 Queue conflict rules

The orchestrator enforces three rules at dispatch time:

1. **Same track, two phases.** Serial. Phase B's handoff for `policy` waits until phase A's `CURRENT_policy.md` is archived. Orchestrator holds phase B in the plan file's pending state.
2. **Different tracks, same artifact.** Checked against `claims.md`. If `ops` needs to edit a `policy`-owned file, orchestrator opens a claim in `claims.md` for the duration of that phase and requires the track to release it in section 5.
3. **Cross-phase dependency.** Encoded in `depends-on:` frontmatter. Orchestrator dispatches a handoff only when all its dependencies are archived. This is the load-bearing one for parallelism -- it's what lets phase 2's `product` brief wait on phase 1's `research` while phase 2's `ops` is also waiting on phase 1's `policy`, without the orchestrator having to remember the graph in conversation memory.

If a circular dependency is ever declared (A depends on B depends on A), the orchestrator stops, writes to `open-questions.md`, and asks you to break it. Does not attempt to resolve automatically.

### 5.9 Observations surface

`handoff/board/observations/` is the per-track proactive-discovery surface defined in §4.9. Gitignored alongside the rest of `handoff/`. Scope is SafeEval-only -- cross-project observations belong in a separate Dispatch-level surface, not this one.

**File naming.** `<track>-YYYY-MM-DD-<slug>.md`. Track is the value from `noticed_by_track` frontmatter; slug is a short kebab-case summary of the observation.

**Required frontmatter.**

```
---
id: <track>-YYYY-MM-DD-<slug>
noticed_by_track: policy | ops | design | qa | orchestrator | tracks-architect
noticed_during: <dispatch goal-slug, audit name, closure event, or "monthly-scan">
surface_area: <repo-relative path or area, e.g. docs/08-v5-ontology.md, src/app/page.js result card>
severity_guess: low | medium | high | noted
triage_status: untriaged | becomes-brief:<NNNN> | becomes-memo:<path> | archived-as-noted
---
```

**Body shape.** One paragraph (target 50-150 words). The observation itself, not a fix. If the observation suggests a fix, the fix is sketched in one clause -- it is not the body. Triage decides whether the fix becomes a brief. No remediation, no follow-up checklist, no acceptance criteria -- those shapes belong in briefs (§5.4) or memos (§4.5).

**Triage flow.** Orchestrator runs a monthly observations-triage turn. For each untriaged observation, exactly one of three outcomes:

- **becomes-brief** if the observation names a concrete artifact and a bounded change. Orchestrator (or the owning track on orchestrator's request) drafts the brief into `handoff/board/pending/NNNN-<slug>.md`; updates the observation's `triage_status` to `becomes-brief:NNNN`.
- **becomes-memo** if the observation surfaces a framework-level pattern that warrants explicit reasoning. Orchestrator routes to the owning track via inbox to author the memo; updates `triage_status` to `becomes-memo:<path>`.
- **archived-as-noted** if the observation is true but not actionable now, or describes a pattern that needs more occurrences to cross the change threshold. Updates `triage_status` to `archived-as-noted`. The file stays on disk; archive is metadata-only.

**Triage cadence.** Monthly default. Tighten to bi-weekly or per-goal-closure if the monthly queue routinely exceeds 15 untriaged observations; loosen if routinely under 3. See `docs/memos/2026-05-27-proactive-discovery-generalized.md` §5 for unblocker signals; recalibrate after 30 days of empirical triage data.

**Triage criteria (initial draft -- sharpen after 30 days).** `becomes-brief` requires a concrete artifact + a bounded change. `becomes-memo` requires a framework-level pattern that warrants explicit reasoning (the proactive-discovery memo itself is the worked example). `archived-as-noted` is the default when concreteness or boundedness is missing, or when the pattern hasn't recurred enough to be load-bearing. If after 30 days the bar is letting too many low-confidence observations through, add an N-times-recurrence threshold for `becomes-brief`.

**Ownership recap (§4.4 row).** The named track (per `noticed_by_track`) owns the observation file at creation. Orchestrator owns mutations to `triage_status` after triage. Observations are not edited after creation except for `triage_status` updates -- the body is a snapshot of what was noticed at that moment. Strict-ownership invariant from §4.9 applies: a track may only post observations within its own artifact-ownership or audit territory.

**Failure-mode mitigations.** Observation fatigue / low-signal noise is the most likely failure mode. Mitigations: (a) the one-per-dispatch ceiling caps volume; (b) the orchestrator's monthly-triage step is the rejection gate (low-signal observations get `archived-as-noted`, not promoted); (c) the per-track lens scoping (§4.9) keeps observations on-scope so they don't compete with each other across tracks. If after 60 days the triage step is rejecting >50% of observations, the calibration is wrong and §4.9 / §5.9 get revisited.

## 6. Session-start rituals

### Track session

Track identity is established by the Cowork project's persistent instructions, not by per-turn user declaration. Each Cowork project (`safeeval-policy`, `safeeval-ops`, `safeeval-design` -- renamed from `safeeval-ux` on 2026-05-27, `safeeval-qa` -- new on 2026-05-27, `safeeval-orchestrator`, `safeeval-tracks-architect`) has its track's full prompt pasted into the project's instructions field. The prompt establishes the session's identity, scope, hard boundaries, and the session-start ritual. The user's per-turn messages are then just normal asks -- no identity preamble.

The session-start ritual happens automatically at the beginning of each conversation in that project, because the project instructions tell the session to do it. The ritual for an authoring execution track (policy, ops, design) is:

> Read `CLAUDE.md`, `handoff/README.md`, `docs/memos/2026-05-24-parallel-cowork-tracks.md`, `docs/OPERATOR-QUICKSTART.md`, `handoff/board/STATE.md`, `handoff/board/inbox/<my-track>.md`, and `handoff/board/tracks/<my-track>/CURRENT_<my-track>.md`. Summarize: (a) what's in my CURRENT (if anything), (b) what's in my inbox, (c) what I plan to do for the user's ask. Wait for confirmation before editing.

The qa session-start ritual is the same with one addition -- qa audits always depend on prior implementation phases, so qa must also read the predecessor archive(s) named in `depends-on:`:

> Read `CLAUDE.md`, `handoff/README.md`, `docs/memos/2026-05-24-parallel-cowork-tracks.md`, `docs/OPERATOR-QUICKSTART.md`, `handoff/board/STATE.md`, `handoff/board/inbox/qa.md`, and `handoff/board/tracks/qa/CURRENT_qa.md`. If a multi-phase goal is dispatched, re-read the goal's `handoff/board/orchestrator/plans/*.md` plan file and the predecessor archive(s) named in `depends-on:` (qa audits always depend on prior implementation phases). Summarize: (a) what's in my CURRENT, (b) what's in my inbox, (c) what predecessor work I'm auditing, (d) my per-affordance audit plan. Wait for confirmation before editing.

Use the file tools (`Read`, `Glob`, `Write`, `Edit`) rather than bash (`ls`, `find`, `cat`) for any read or write under `handoff/board/**`. In this sandbox, bash and the file tools see different filesystem snapshots; bash views of board files can be stale or empty even when the disk has them. If a board file appears missing via bash, retry with `Read` before reporting it gone.

Tracks never read other tracks' CURRENT files, the orchestrator's plans, or other tracks' inboxes.

The session-start ritual reads the parallel-tracks memo on every conversation -- not because the model forgets between turns within a conversation, but because the memo is a living document owned by tracks-architect and may have changed since the project instructions were last updated. If the project instructions and the memo disagree, the memo wins.

**Dispatch-closure step (added third atomic amendment 2026-05-27 per proactive-discovery generalization).** Before closing a dispatch -- defined as the turn that writes Notes back to `CURRENT_<track>.md` section 5 and updates the STATE row to idle or to the next goal -- the track must produce one observation per its §4.9 observational lens. Post to `handoff/board/observations/<track>-YYYY-MM-DD-<slug>.md` with required frontmatter per §5.9. The "one observation per dispatch" rule is both floor and ceiling: if nothing meaningful surfaced this dispatch, post a one-line stub with `severity_guess: noted` and a sentence saying why no observation surfaced -- the floor is one entry even when the content is "nothing to observe." Quality over volume; low-signal observations get archived as noted by orchestrator triage. Orchestrator triages monthly per §5.9. Qa's cadence is per audit (not per turn); tracks-architect's cadence is monthly via the framework-drift scan (not per dispatch) -- see §4.9.

**Escalation-field requirement on open questions (added fifth atomic amendment 2026-05-28).** Every open question in the closure report must carry an inline `escalation:` field with one of two values: `default-accept` (the track is confident in its tentative recommendation; orchestrator may accept and proceed to next phase) or `route-to-steven` (the track is flagging architectural or material consequence; orchestrator must escalate before next phase dispatches). Format: numbered list, each item ending with `(escalation: default-accept, rec: <track's tentative recommendation>)` for accept candidates, or `(escalation: route-to-steven, reason: <one-clause reason>)` for escalations. Three framework-level always-escalate triggers floor the field regardless of track confidence (see §6.1). Closure reports that ship without the field on every open question fail the closure ritual -- orchestrator returns the dispatch to the track for re-format rather than guessing the field's value. **Relay shape on `default-accept` (Steven adjudication 2026-05-28, §9.1 Q1 of `docs/memos/2026-05-28-closure-report-escalation-field.md`):** when every open question in a closure report is `default-accept` (or the closure has no open questions), the orchestrator fires ONE consolidated status update so Steven sees the chain progressing, then auto-dispatches the next phase; NO permission round-trip back to Steven before next phase dispatches. The status update is a notification surface, not a gate. **Granularity (Steven adjudication 2026-05-28, §9.1 Q2):** the field is per-question, never per-phase -- a closure with three `default-accept` questions and one `route-to-steven` question pauses on the one and chains-with-context on the others. A sub-track or sub-phase is structurally a phase for closure-report purposes; per-question granularity applies the same way. Tracks split internally-divergent open questions into two top-level questions rather than collapsing them. **Recovery path when an auto-chained Phase N+1 produces a surprise (Steven adjudication 2026-05-28, §9.1 Q3):** when the orchestrator auto-chains to Phase N+1 on the strength of `default-accept` open questions in Phase N's closure, and Phase N+1 then surfaces a finding that would have required `route-to-steven` if it had been visible at closure, the surprise auto-escalates with the full chain context (Phase N's closure report + the auto-accept decision + Phase N+1's surprise) as the relay payload to Steven. The orchestrator pauses the chain at the point of surprise, not at the next phase boundary -- pausing at point-of-surprise preserves blast-radius containment.

### 6.1 Always-escalate triggers (framework floor on the `escalation:` field)

Three triggers force `route-to-steven` regardless of the track's confidence in its tentative recommendation. If any of the three fires on an open question, the track marks the question `route-to-steven` and records which trigger fired in the `reason:` field. Added fifth atomic amendment 2026-05-28 per `docs/memos/2026-05-28-closure-report-escalation-field.md` §4 / §8.

1. **Adversarial-review self-flag.** The track's own adversarial review (§10 in design-memo-author shape, or §10-equivalent in another memo shape -- "Risks named" / "Adversarial review" / any structural surface the memo uses to record self-critique) flagged the recommendation under this open question as a failure mode. A track that has named its own recommendation as the failure mode is not in a position to default-accept that recommendation on Steven's behalf. The §9.4 hiring-reader-test-administration override in the fourth atomic amendment is the worked example -- the architect was confident in pure self-administered, the source memo's §10 flagged self-administration as the failure mode, and Steven overruled to hybrid; without this trigger that override would not have surfaced.

2. **Public-artifact materiality.** The decision materially changes a public artifact: `README.md`, public memos under `docs/memos/`, the live app (any change visible at the live deployment URL, currently https://safeeval.vercel.app), or application materials (anything Steven would show a hiring reader). The hiring-reader frame in the design track's instruction file is the canonical example; this trigger generalizes the same criterion to any track touching a public surface. A change that a hiring reader sees ships only with Steven's explicit sign-off; the auto-chain bypass does not apply here.

3. **Project-boundary crossing.** The decision affects Project Arbiter (the second project Dispatch routes to), modifies the parallel-tracks framework outside an atomic amendment (framework amendments go through tracks-architect with Steven's adjudication; bypassing that path is out-of-band), or modifies pre-approved permissions (the permission surface is Steven's, not the orchestrator's or the tracks').

The triggers are auditable: the closure report records which trigger fired in the `reason:` field, and the orchestrator's chain-or-pause decision is logged in `dispatch-log.md`. The framework-drift scan (§4.4.6, monthly cadence) reviews the trigger-fire distribution as part of its meta-pattern surface. Trigger additions go through tracks-architect as atomic amendments with the standard alternatives-and-decision shape; they are not added inline by any single closure report (rate-limiter on trigger proliferation per the §6 risk-named R4 in the source memo).

### Orchestrator session

> Read `CLAUDE.md`, `handoff/README.md`, this memo, `handoff/board/STATE.md`, every file under `handoff/board/inbox/`, every `handoff/board/tracks/*/CURRENT_*.md`, `handoff/board/pending/`, my own `digest.md`, `dispatch-log.md`, `open-questions.md`, and all `plans/*.md` with active goals. Rewrite `digest.md` from current state. Summarize: what's in flight, what shipped since last turn, what's waiting on the user, what's ready to dispatch. Wait for the user's direction.

Use the file tools (`Read`, `Glob`, `Write`, `Edit`) rather than bash (`ls`, `find`, `cat`) for any read or write under `handoff/board/**`. In this sandbox, bash and the file tools see different filesystem snapshots; bash views of board files can be stale or empty even when the disk has them. If a board file appears missing via bash, retry with `Read` before reporting it gone.

**Monthly observations-triage step (added third atomic amendment 2026-05-27 per §5.9).** Once per calendar month, the orchestrator runs an observations-triage turn: read every file in `handoff/board/observations/` with `triage_status: untriaged`, decide for each one of three outcomes (`becomes-brief`, `becomes-memo`, `archived-as-noted`) per the §5.9 criteria, and update `triage_status` accordingly. Triage is a single dedicated turn; observations are not triaged inside goal-closure turns. Cadence may tighten to bi-weekly or per-goal-closure if queue routinely exceeds 15 untriaged observations; loosen if routinely under 3. See `docs/memos/2026-05-27-proactive-discovery-generalized.md` §5 for unblocker signals.

### VS Code session

Unchanged from `handoff/README.md`, plus: if `CURRENT.md` is empty, list `handoff/board/pending/` and promote the lowest-numbered (URGENT first) file. On completion, post a "shipped" message to the originating track's inbox AND append a line to `handoff/board/orchestrator/digest.md`.

## 7. Conflict and merge rules

Most files are single-writer by construction (per-track `CURRENT_<name>.md` written only by that track; orchestrator files written only by orchestrator; `pending/` files written once at creation, mutated only by VS Code). Real conflicts only happen on:

- **`STATE.md`** -- each row owned by one track; merge is line union; later writer reconciles if simultaneous.
- **`claims.md`** -- append-only; merge is concatenation.
- **`digest.md`** -- only orchestrator writes; not a conflict surface unless two orchestrator sessions run, which we don't do.

A track editing a file it doesn't own without a claim is a process violation -- the owner reverts and the orchestrator posts to `open-questions.md`. If it happens twice, ownership in section 4 is wrong and we re-split.

## 8. What gets gitignored vs committed

Everything under `handoff/` (including `board/`) stays gitignored -- it's internal scaffolding, not portfolio history. This memo lives at `docs/memos/...` and is committed because it's a design decision that should outlive any one session.

Implication: the board is local to one machine. If you ever run tracks across two machines, the board has to live in a shared substrate (private gist, sync'd folder, small private repo). Out of scope for now; flagged for later.

## 9. Honest limits

- **No cross-session triggering, by default.** Orchestrator dispatches by writing files. You nudge each track's window to start its turn. Window count does not decrease. **Exception:** Dispatch (when configured) can spawn or message track sessions on the user's behalf -- see `handoff/reference/07-dispatch-integration.md`. Dispatch is a remote-control layer over this workflow, not a replacement for the Cowork orchestrator; ownership and verification rules in this memo still apply.
- **Orchestrator state is regenerated each turn.** It re-reads everything on session start (per ritual). It does not trust conversation memory across turns for state -- the filesystem is canonical.
- **Verification's "quality opinion" risks orchestrator-as-author.** The bounce-bound and escalate-to-open-questions rule in 5.6 is the guardrail. If you notice the orchestrator's bounces starting to feel like rewrites in disguise, tell it to back off.
- **You will still wait on VS Code for builds.** Parallel Cowork tracks let coordination work continue during a build; they don't make builds faster.
- **Memory is per-session.** Each Cowork window still has its own memory dir. Cross-track shared "what we know about X" lives in `docs/memos/` (committed) or `digest.md` (orchestrator's view, ephemeral).
- **Delete-permission grants are session-scoped, not workspace-scoped.** Empirically observed across multiple goal closures (2026-05-26 and 2026-05-27): even when a session previously had delete-permission granted on `handoff/board/`, a fresh session may have to re-request the grant when it tries to delete a `CURRENT_<track>.md`. The stickiness boundary is one Cowork session, not the workspace. Expected workaround when a delete is denied: write a `status: idle` stub in the slot rather than leaving stale content behind, so the next session-start ritual still treats the track as idle (per §5.7 hygiene rule). The stub is the §5.7 hygiene workaround; the delete is the cleanup, which can happen on the next session that has the grant. Do NOT block goal closure on the delete -- the archive write is what makes the closure load-bearing. **Delete denial includes "VM-down preventing the delete attempt at all."** When the bash mount is unavailable, the orchestrator or track cannot even attempt a bash delete; the Cowork file-delete tool may also deny. Both failure modes lead to the same stub-and-mark-resolved fallback. The stub-fallback is the canonical pattern (per §5.7); do not retry the delete loop, do not block closure on tool availability.

## 10. Rollout

Phased on purpose. Each phase only ships once the prior phase is provably easier than today, not just different.

**Phase 1 -- three tracks, no orchestrator (1-2 weeks).**
1. Create the `handoff/board/` skeleton: empty `STATE.md` (table header only with policy/ops/ux/vscode rows), empty `claims.md`, empty `inbox/{policy,ops,ux}.md`, empty `pending/`, empty `tracks/{policy,ops,ux}/` with archive subdirs.
2. Create `docs/ux/` with the suggested subdirectory layout from section 4.1 and a one-paragraph `README.md` explaining what lives there.
3. Update `handoff/README.md` to link this memo and add the "if `CURRENT.md` is empty, check `pending/`" step.
4. Update `CLAUDE.md` to point new sessions at the board and to this memo, and to note that `docs/ux/` is owned by the ux track.
5. Open three Cowork projects pointed at the same folder: `safeeval-policy`, `safeeval-ops`, `safeeval-ux`.
6. Run a real cross-track task end to end without an orchestrator -- e.g., ux audits the live app, files a finding via policy's inbox, policy decides if it changes a typology, ux drafts a UI spec, VS Code ships. Capture what breaks.

**Phase 2 -- add orchestrator (1-2 weeks).**
1. Create `handoff/board/orchestrator/` with empty `digest.md`, `dispatch-log.md`, `open-questions.md`, `plans/`.
2. Open `safeeval-orchestrator` Cowork project.
3. Run a multi-phase goal end to end through the orchestrator -- ideally one that exercises all three tracks (e.g., new typology rollout: policy drafts spec, ux audits how it surfaces in the UI and writes copy, ops updates enforcement, VS Code ships).

**Phase 3 -- expand (when phase 2 is stable).**
1. Add `research` (owns `docs/threat-models/**`) per section 4.3 if the workload justifies it.
2. Update `STATE.md` rows and inboxes.

If at any phase the new layer feels like more overhead than benefit, stop adding. Three tracks is plausibly the natural ceiling for SafeEval as a portfolio project; four or five might be over-engineered.

If at any phase the new layer feels like more overhead than benefit, stop adding. The current single-CURRENT pattern works fine for low-volume periods.

## 11. Decisions needed

Sign-off on:

- [x] Three-track phase-1 split: `policy` + `ops` + `ux` (section 4), plus `tracks-architect` as a special-purpose fourth Cowork session per section 4.6 (active only on direct user invocation).
- [x] Strict single-writer ownership for every file -- no sequenced co-ownership, no `claims.md` exceptions for the three core artifact sets (section 4).
- [x] Complete file-by-file ownership map in section 4.4 -- every committed file has exactly one owner, verified against `git ls-files`.
- [x] Phase-1 transfers: `docs/02-faf-to-l1l2l3-mapping.md` and `docs/threat-models/**` owned by `policy` in phase 1, transfer to `research` in phase 2.
- [x] `agents/**` (all SafeEval agent definitions) owned by VS Code as infrastructure -- Cowork tracks request agent changes via `pending/` (section 4.4).
- [x] Meta-workflow files (`CLAUDE.md`, `handoff/README.md`, `.claude/commands/**`) owned by VS Code in phase 1, transfer to orchestrator in phase 2.
- [x] New memo creation rule: filename must include track tag, originator notifies other tracks via inbox (section 4.5).
- [x] `README.md` owned by `ux`; `docs/06-stakeholder-brief.md` owned by `policy` (section 4.0). Alternative -- all user-facing prose to ux -- noted for fast revisit if friction appears.
- [x] Ux scope: UI/IA review + design system / visual direction. Ux never edits hot JS files -- specs bounce to VS Code (sections 4 and 4.2).
- [x] New `docs/ux/` directory, committed to repo, owned by ux track (section 4.1).
- [x] Track sessions require user to state track identity in opening message; session stops and asks if unstated (section 6).
- [x] `handoff/board/` layout including per-track `CURRENT_<name>.md` files (section 5).
- [x] Orchestrator role limited to dispatch / verify / sequence / queue, never authoring content (section 5.5).
- [x] Verification scope: acceptance + quality opinion, bounce once then escalate (section 5.6).
- [x] Phase gating: user triggers (section 5.7).
- [x] Dependency model: frontmatter `depends-on:` in each handoff (section 5.8 #3).
- [x] Rollout: phase 1 (three tracks, no orchestrator) before phase 2 (add orchestrator) before phase 3 (consider expansion).

After sign-off, the skeleton creation in section 10 phase 1 is the only edit that needs to happen -- and per venue rules, it should be a `handoff/CURRENT.md` to VS Code to create the directory structure, create `docs/ux/`, and update `handoff/README.md` + `CLAUDE.md`.

## 13. Amendment log

This memo is a living document owned by `tracks-architect` (section 4.6). Material changes are logged here, newest first.

**Sequencing note (2026-05-28):** the third, fourth, fifth, and seventh atomic amendments are chronologically ordered as follows -- third (2026-05-27, tracks refinement + proactive discovery generalization) -> fourth (2026-05-28, design-track disclosure-debt prevention) -> fifth (2026-05-28, closure-report escalation-field convention) -> seventh (2026-05-28, sec/compl Phase 1 hygiene additions -- this entry). The sixth atomic amendment is scoped but not yet shipped (data-track registration concurrent with the data-track scoping memo at commit `be30894`); sequence numbers are content-keyed, not strictly chronological, so the seventh ships ahead of the sixth without renumbering. The third and fourth share authoring infrastructure (the per-track lens / per-track instruction mirror surfaces); the fourth and fifth share the same calendar day but address different framework gaps (fourth: missing proactive disclosure check before dispatch close; fifth: missing structural escalation signal at dispatch close so the Dispatch orchestrator can chain or pause cleanly); the seventh addresses three Phase 1 sec/compl hygiene gaps surfaced by the inaugural `compl:` exercise (commit `f62c34c`).

- 2026-05-28 -- **Seventh atomic amendment (sec/compl Phase 1 hygiene additions).** Three hygiene additions surfaced by the inaugural `/safeeval-arch compl:` exercise (commit `f62c34c`, `docs/memos/compl/2026-05-28-pii-access-posture.md` §8.1). None of the three block Phase 1 operation; all three are first-use friction items that compound if not codified. Edits to this memo: (1) §4.5 gains a "Sec/compl subdirectory filing convention" paragraph codifying that `docs/memos/sec/` and `docs/memos/compl/` are the architect's Phase 1 sec / compl memo filing surfaces, pre-created with `.gitkeep` files at amendment-authoring time so first-use friction is zero; asymmetric creation noted because `docs/memos/compl/` was created on first use as part of commit `f62c34c` and only `docs/memos/sec/` needs creation as a side-effect of this amendment; mitigates risk R4 in `docs/memos/2026-05-28-security-compliance-posture.md` §7. (2) New §4.5.1 codifying the shared 4-digit memo / brief ID namespace rule: memo-companion IDs (the `(NNNN)` tag in commit messages) and pending-brief filenames share one monotonically-increasing 4-digit namespace with one source of truth; the grep-before-assign protocol (`ls handoff/board/pending/ | grep -oE '^[0-9]{4}' | sort -n | tail -1` against pending IDs, `git log --oneline -50 | grep -oE '\(0[0-9]{3}\)' | sort -u | tail -5` against memo-companion IDs in commit messages) is mandatory before assignment to prevent concurrent-session races; race-resolution rule names the later commit as the renamer when collisions land. (3) New §4.5.2 codifying the deferred-question bundling guideline: bundle when decisions share threat model, ontology section, or implementation surface; ship separately when the decisions are independent or when bundling would force a single adjudication where two are warranted; three failure modes named (cancel-out bundling, argument-chain interleaving, forced-single-adjudication bundling) with the pii-access-posture memo as the worked example of unambiguously-right bundling. Header date bumped + this §13 entry + the §sequencing-note prefix updated to add the seventh and to note the sixth is scoped-but-not-shipped. Surfaces touched: this memo (§4.5 extension + new §4.5.1 + new §4.5.2 + §13 + sequencing-note prefix + header line 4); new `docs/memos/sec/.gitkeep` (empty file). No code surfaces; no skill bundles; no agent definitions; no paste-to-Cowork-UI step required (the §4.5 / §4.5.1 / §4.5.2 rules read from the canonical memo on every session-start ritual). The `docs/memos/compl/` directory already exists with the inaugural memo, so `.gitkeep` is not added there -- the directory has content, which carries the same effect as a tracking file. Bundled commit-bounce brief in `handoff/board/pending/0069-vscode-commit-seventh-atomic-amendment.md` (highest in-use ID was 0068 from commit `f62c34c`, verified via grep-before-assign protocol per the §4.5.1 rule this amendment codifies -- so the very first use of the new rule is on this amendment's own commit-bounce brief). The brief commits BOTH the memo edit AND the `docs/memos/sec/.gitkeep` creation as a single commit. Out of scope: re-litigating the pii-access-posture memo's §6 adjudications (locked 2026-05-28); creating `docs/memos/sec/`'s first sec memo (will fire on the next `sec:` exercise, whenever that arrives -- the subdirectory now sits ready); touching any other file beyond the memo, the `.gitkeep`, and the commit-bounce brief.

- 2026-05-28 -- **Fifth atomic amendment (closure-report escalation-field convention).** Adjudicates `docs/memos/2026-05-28-closure-report-escalation-field.md` (ADOPT alternative A: binary `escalation:` field per open question with three always-escalate triggers floor). Edits to this memo: (1) §6 dispatch-closure step extended with the escalation-field requirement, the numbered-list-with-inline-metadata format, the Q1-adjudicated relay shape (one consolidated status update on `default-accept`, no permission round-trip), the Q2-adjudicated per-question granularity, and the Q3-adjudicated point-of-surprise auto-escalate-with-full-chain-context recovery path; (2) new §6.1 subsection codifying the three framework-floor triggers (adversarial-review self-flag, public-artifact materiality, project-boundary crossing); (3) §4.9 design and qa lens rows annotated -- design row notes the hiring-reader frame maps to public-artifact materiality, qa row notes P0/P1/P2 audit severity maps structurally to the field; (4) header date bumped + this §13 entry. Steven adjudicated all three §9 open questions 2026-05-28 per §9.1 of `docs/memos/2026-05-28-closure-report-escalation-field.md`: §9.1 Q1 (relay shape on `default-accept`) -- ACCEPT architect rec (one consolidated status update, no permission round-trip); §9.1 Q2 (per-question vs per-phase granularity) -- ACCEPT architect rec (per-question, never per-phase); §9.1 Q3 (recovery path on auto-chain surprise) -- ACCEPT architect rec (surprise auto-escalates with full chain context as relay payload; orchestrator pauses at point of surprise). Triggered by Steven's adoption of low-escalation-bar + auto-chaining for the Dispatch orchestrator on 2026-05-28 (orchestrator-side procedure at `agent/memory/safeeval_dispatch_orchestration_procedure.md`); this amendment is the track-side complement. Compound value explicitly named in source memo §5: the convention is portable to any project using the parallel-tracks framework, not SafeEval-specific. Surfaces touched: this memo (§6 extension + new §6.1 + §4.9 design/qa row annotations + header date + this §13 entry). No new directories. No new skill bundles. No code surfaces. No paste-to-Cowork-UI step required for any track's instruction-file mirror -- the §6 ritual is read from the canonical memo on every conversation. Out of scope: re-litigating the §9 adjudications (locked 2026-05-28); running the amendment against any in-flight closure reports (those will be ratified retroactively); touching any file beyond this memo and `handoff/board/pending/0058-vscode-commit-fifth-atomic-amendment.md` (the commit-bounce brief).

- 2026-05-28 -- **Fourth atomic amendment (design-track disclosure-debt prevention).** Adjudicates `docs/memos/2026-05-27-design-track-disclosure-debt-prevention.md` (PARTIAL ADOPT alternative B with D-clauses folded in). Edits to the canonical memo: (1) §4.4-bis §4.4.3 design addendum gains a "Disclosure-affordance audit" clause requiring the five-question check-list at dispatch closure on result-card-touching dispatches, plus a "Hiring-reader frame clause" reference; (2) §4.9 design observational lens row extended to name **disclosure debt** explicitly (structured data rendered without sufficient affordance for an unfamiliar reader); (3) §4.10 skills-to-tracks mapping gains a row for `design:disclosure-audit` (new skill, to be authored via `handoff/board/pending/0055-skill-creator-design-disclosure-audit.md`). Edits to the canonical design instruction mirror at `handoff/reference/cowork-projects/design.md`: (a) new "Hiring-reader frame" section between Identity and Scope with the portfolio-aim acceptance criterion verbatim per memo §8.4; (b) new "Disclosure-affordance audit" section between Dispatch-closure step and What NOT to do with the trigger conditions verbatim per memo §8.2; (c) new "Hybrid hiring-reader test administration" subsection -- 2026-05-28 through 2026-06-10 self-administered with one-line attestation (calibration window), 2026-06-10 onward qa-administered as a gate on result-card-touching dispatches. Steven's adjudication of the seven §9 questions: §9.1 NEW skill `design:disclosure-audit` (architect rec accepted); §9.2 `design:` namespace not `safeeval-:` (architect rec accepted); §9.3 single dispatch shape, no audit-mode split (architect rec accepted); **§9.4 HYBRID (overrules architect rec of pure self-administered) -- first two weeks self-administered as calibration period, then qa-administered on result-card-touching dispatches; Steven explicitly cited the memo's own §10 adversarial review flagging self-administration as the failure mode that produced the seven instances; the calibration window exists to surface that mode, not to ratify it**; §9.5 per-dispatch cadence at first, no scheduled audit (architect rec accepted); §9.6 leave the not-yet-filed instances as filed by orchestrator (briefs 0050/0051/0052/0053 already in pending; architect rec accepted); §9.7 observation-file disposition unchanged (already exists at `handoff/board/observations/design-2026-05-27-result-card-disclosure-debt-pattern.md`). New skill `design:disclosure-audit` NOT created in this amendment -- brief 0055 filed for skill-creator to author the bundle. New `design:disclosure-audit` skill is recommends-only (findings route to `pending/` or `observations/`; never edits rendered surfaces; complements `design:design-system` / `design:design-critique` / `design:accessibility-review` / `anthropic-skills:safeeval-ui-review` per memo §7 integration sketch). Triggered by: a seven-instance disclosure-debt cluster on the v5 result card surfaced manually by Steven on 2026-05-27, none of which had been caught proactively by the design track's existing dispatch-closure lens. The originating observation is at `handoff/board/observations/design-2026-05-27-result-card-disclosure-debt-pattern.md`. Surfaces touched: this memo (§4.4.3 + §4.9 + §4.10 + §13), `handoff/reference/cowork-projects/design.md` (three new sections + new staleness anchor #7 + `last_synced_date: 2026-05-28`), new `handoff/board/pending/0055-skill-creator-design-disclosure-audit.md` brief. No code surfaces. No paste-to-Cowork-UI executed in this amendment -- that is Steven's post-ship manual step per the §6 sync ritual. No dispatch of brief 0055 -- that is the next operator dispatch when capacity allows. Post-ship action items for Steven: (a) paste the updated `handoff/reference/cowork-projects/design.md` body into the safeeval-design Cowork space's project-instructions UI; (b) dispatch brief 0055 to skill-creator when ready to author the `design:disclosure-audit` bundle.

- 2026-05-27 -- **Third atomic amendment (tracks-refinement + proactive-discovery generalization).** Bundled adjudication of two source memos: `docs/memos/2026-05-27-tracks-refinement-audit.md` (per-track instruction-file refreshes, skill-to-track mappings, qa instruction file gap) and `docs/memos/2026-05-27-proactive-discovery-generalized.md` (per-track observational lenses, `handoff/board/observations/` surface, per-dispatch ritual, monthly triage cadence). Edits: (1) §4 default-skills column enumerated explicitly per track -- `operations:*` wildcard dropped for ops, new orchestrator row added with `engineering:standup` + `operations:status-report`, tracks-architect skills enumerated as `engineering:architecture` + `operations:change-request` + `product-management:write-spec` + `safeeval-agents:design-memo-author`, policy gains `threat-intel-watcher` + `stakeholder-communicator` + `product-management:write-spec`, design gains `design:design-handoff` + `design:research-synthesis`. (2) New §4.4-bis with six per-track addenda refreshing identity / scope / "what NOT to do" against six staleness anchors (qa-design split, second atomic amendment, v4 sunset, conversation-eval, AI T&S language cleanup, Tier 1 ship). (3) New §4.4.4 qa role definition -- closes the 2026-05-27 gap where qa was operating without on-disk canonical instruction text. (4) New §4.9 per-track observational lens table + dispatch-closure prompts + strict-ownership invariant on observations. (5) New §4.10 skills-to-tracks mapping table (lockstep with §4 default-skills column). (6) New §5.9 observations surface mechanics (frontmatter, body shape, triage flow, monthly cadence, criteria, failure-mode mitigations). (7) New §4.4 ownership rows for `handoff/board/observations/*.md` and `handoff/reference/cowork-projects/<track>.md`. (8) §6 track session ritual gains a dispatch-closure step (one observation per dispatch, floor and ceiling, stub allowed). (9) §6 orchestrator session ritual gains a monthly observations-triage step. (10) §4.6 tracks-architect addendum (in §4.4.6) formalizes the hybrid HR + tech-process-author scope and elevates retrospective-monitoring to a monthly framework-drift scan cadence (default output: memo at `docs/memos/YYYY-MM-DD-tracks-architect-framework-drift.md`). Adjudicated open questions from both source memos: on-disk prompt mirror = YES (manual sync ritual at `handoff/reference/cowork-projects/<track>.md` with `last_synced_commit:` header, paste-to-UI at every architect amendment, monthly drift check by tracks-architect); one-observation-per-dispatch = strict floor and ceiling for first 30 days; triage cadence = monthly default; triage criteria = §5.9 draft (concreteness + bounded scope for `becomes-brief`); scope = SafeEval-only; framework-drift output shape = memo default. Skill rejects confirmed: `engineering:code-review` off qa (qa audits rendered artifacts, not diffs); `product-management:stakeholder-update` off orchestrator (audience is Steven, not external). `safeeval-agents:design-memo-author` on tracks-architect kept with explicit hybrid-framing note in §4.4.6 -- atomic amendments ARE design memos in shape. Conflict adjudication between the two source memos: the tracks-refinement audit's policy-only proactive-discovery recommendation (§4.1) is superseded by the proactive-discovery memo's generalized version; policy becomes the policy-track row in the §4.9 lens table. Surfaces touched: this memo (§4 table + new §4.4-bis with six subsections + new §4.9 + new §4.10 + new §5.9 + extended §6 + extended §13 + §4.4 ownership rows); new directory `handoff/board/observations/` with README; new directory `handoff/reference/cowork-projects/` with six canonical instruction files. Steven approved bundled adjudication 2026-05-27 ("delegated all open-question decisions to the architect track"). Post-ship action item for Steven: paste each `handoff/reference/cowork-projects/<track>.md` into its corresponding Cowork space's project-instructions UI (tracks-architect explicitly does NOT do this -- file-backed instructions are not supported by Cowork, so the sync ritual is manual).
- 2026-05-27 -- **Second atomic amendment (post-backfill empirical evidence).** Five §5.7 additions + one §9 extension, driven by the `backfill-complete` goal's Wave 1-3 evidence (`handoff/board/completed/2026-05/2026-05-27-backfill-complete.md` and `handoff/board/completed/2026-05/2026-05-27-backfill-wave-3.md`). (1) **Grep-before-template-inherit** added to §5.7: when a fixture/memo/spec field is inherited from a sibling template, the authoring track must grep the shipped producer to verify what the template asserts; grep result + any divergence recorded in `Notes back`. Driven by `backfill-wave-3` 0007 + 0008 (two cases of fixture/spec inherited by analogy without grep). (2) **Variance-pattern hint at promotion** added to §5.7: chained-brief waves (>=2 prior precedents) require a one-sentence variance-pattern hint in the promotion note. Driven by 0008 naming the orchestrator's hint as "the most useful single sentence in the brief." (3) **Delete-permission VM-down clause** added to §9 delete-permission bullet: delete denial includes "VM-down preventing the delete attempt"; both that and the Cowork file-delete tool denial lead to the same stub-fallback. Driven by Wave 1 ops session hitting bash-VM-down + tool-denial simultaneously. (4) **Session-scoped delete-grants clause** added to §5.7 (cross-reference to §9): grants do NOT carry across sessions; stub-fallback is canonical, not exceptional. Tightens the existing archive-first-delete-last rule with more empirical context. (5) **STATE-row-idle verification** added to §5.7: on idle reset, orchestrator must additionally verify no stale `CURRENT_<track>.md` exists from prior goals (`Read` for `status: idle` or stub marker). (6) **One-time stale-CURRENT sweep** added to §5.7: on adoption of the verification clause, the orchestrator sweeps every `CURRENT_<track>.md` and reconciles stale files. Driven by Wave 1 ops finding a stale `CURRENT_ops.md` from May-25 case-07 content despite STATE=idle. Also: companion update to `handoff/reference/07-dispatch-integration.md` §11.1 -- proposed trigger criterion for the canonical-memos gitignore + initial-commits implementation handoff (awaiting Steven's call). Repo-path migration verified complete: all live references in memo and quickstart point at `C:\Users\sayas\Projects\safeeval`; remaining OneDrive mentions are amendment-log history (§13) and generic sync-layer advice (quickstart §"When this quickstart needs updating"), both legitimate. Steven approved all seven items 2026-05-27.
- 2026-05-27 -- **qa-design split + 5 hygiene amendments (atomic).** Structural: ux track split into `design` (specs / system / copy / README) and `qa` (audits / acceptance / WCAG / fixture-runner side checks). §4 tracks table now lists policy/ops/design/qa as the four execution tracks. §4.0 adds qa ownership rationale (audits = recommends-only verification, distinct identity from design specs). §4.4 ownership table updated: `docs/ux/design-system/**` + `docs/ux/copy/**` -> design; `docs/ux/audits/**` + new `docs/qa/audits/**` -> qa; `README.md` -> design. New §4.8 "Why qa is a gate, not a peer" explaining the authority pattern. §5.6 codifies orchestrator defers to qa on rendered-artifact verification. §5.7 gains `qa-required: true|false` plan-file field (default true for visible-surface work), explicit archive-first-delete-last rule (archive write verified on disk before any CURRENT delete), STATE-row-idle-must-archive-CURRENT rule (resetting STATE row to idle without archiving the slot is a hygiene violation), pilot-tracking-docs-commit-before-fire rule, orchestrator scope-narrowing rule for bundled briefs. §6 adds qa session-start ritual (predecessor-archive read; per-affordance audit plan). §9 documents delete-permission stickiness as session-scoped, not workspace-scoped, with stub-fallback workaround. Driven by: `qa-design-split-pilot` VALIDATED 2026-05-27 (retro at `handoff/reference/08c-pilot-retro-classifier-display-p1c.md`); five hygiene gaps surfaced across `live-v5-app-audit` 2e closure (2026-05-26), `live-v5-classifier-display` closure (2026-05-27), and the pilot itself. Delta-doc applied: `handoff/reference/08d-proposed-memo-amendments.md`. Steven approved all amendments 2026-05-27.
- 2026-05-25 -- Added Dispatch exception to section 9 "Honest limits". Cross-session triggering is no longer absolute -- Dispatch can spawn/message track sessions on the user's behalf. Pointer to `handoff/reference/07-dispatch-integration.md` (tracks-architect-owned). Ownership and verification rules unchanged; this is a triggering-mechanism note only. Driven by Steven's introduction of Dispatch as a mobile-first routing layer; full integration rules and project-scoping guardrails live in the Dispatch doc.
- 2026-05-25 -- STATE.md lifecycle + completion archive + retrospective layer. Rewrote section 5.1 (added Goal column, defined closed Status vocabulary, made row reset explicit -- `done` is transient). Added section 5.1.1 (`handoff/board/completed/YYYY-MM/<goal-slug>.md` with inline retrospective: utilization, orchestration issues, per-track quality, improvement proposals). Added section 5.1.2 (`track-usage.md` rolling rollup). Amended 5.6 to make retro production part of the final-phase verification turn; amended 5.7 with explicit goal-closure steps (archive -> retro -> usage rollup -> reset rows). Added retrospective-monitoring secondary function to tracks-architect in section 4.6 (frequent call-outs across retros, reactive only). Updated 4.4 ownership table for `completed/**` and `track-usage.md`. Single-track-ask completion entries are optional, the originating track's call. Driven by STATE.md `done` rows persisting after work shipped with no archive surface holding deliverable links; user also wanted track-utilization visibility and an end-of-project retrospective.
- 2026-05-25 -- Added file-tools-over-bash rule to section 6 session-start rituals (both track and orchestrator). Companion gotcha added to OPERATOR-QUICKSTART. Driven by three logged incidents of stale bash filesystem views on `handoff/board/**` paths in the Cowork sandbox (ops twice, orchestrator once; full evidence in `handoff/board/orchestrator/open-questions.md`).
- 2026-05-25 -- Added section 5.5.1 enumerating orchestrator write authority (was implicit across sections 4.4 and 5.5; made explicit). Header date bumped.
- 2026-05-24 -- All section-11 sign-off items approved by user; phase-1 skeleton work in section 10 unblocked. Status line changed from "draft for sign-off" to "signed off 2026-05-24". (Edit made by VS Code venue at user direction during /handoff session for parallel-tracks-skeleton.)
- 2026-05-24 -- Added `tracks-architect` track (section 4.6). Memo became a living document; ownership of this file moved from "read-only history" to `tracks-architect`. Added this amendment log. (Authored by Cowork planning session at user direction.)
- 2026-05-24 -- Added `docs/OPERATOR-QUICKSTART.md` to section 4.4 ownership table, owned by `tracks-architect`. User decided to stand up orchestrator on day one (rather than phase 2); skeleton handoff updated to create orchestrator directory alongside the three execution tracks'.
- 2026-05-24 -- Removed the "user must declare track identity in opening message" ritual from section 6. Identity is now established by the Cowork project's persistent instructions field; prompts are pasted once as project setup, not per turn. Tracks-architect's hard guard (section 4.6) reworded to check message shape rather than identity declaration.
- 2026-05-24 -- Project moved off OneDrive. Environmental assumption changed: file reads/writes between Cowork sandbox and disk are now reliable, and the per-file null-byte risk on `src/app/page.js` no longer applies as an OneDrive-specific concern. Quickstart gotcha about `handoff/` sync flakiness was reframed -- file-creation-via-VS-Code is still the rule, but now justified by venue boundary rather than sync reliability. CLAUDE.md gotchas (null-byte check, lockfile retry) to be reworded by a separate VS Code handoff.
- 2026-05-24 -- Initial memo authored.
