# GitHub-facing documentation staleness audit

**Date:** 2026-05-30
**Scope:** Tracked (committed) documentation a hiring reviewer sees at https://github.com/sayasys/safeeval -- `README.md`, `package.json`, `.github/`, and tracked `docs/**` non-memo files. Memos were grepped for retired-API references only (per audit brief, memos are dated historical artifacts and are not audited for current-state accuracy). Untracked files (`docs/OPERATOR-QUICKSTART.md`, `docs/ux/sop-conversation-evaluation-user-guide.md`, the `docs/qa/audits/2026-05-28-*` files, etc.) are out of scope -- they are not pushed and a GitHub reviewer never sees them.
**Method:** Read `README.md` and `package.json` cover to cover; verified every README internal link resolves; verified README technical claims (stage count, schema/ontology version, bright-line count, disposition vocabulary, model IDs, threat-model count, cited engine SHA) against `src/lib/safeeval-v5.js` and `src/lib/media-detection/*`; `git grep` for stale endpoints / model IDs / routes / name typos / emails across tracked files only.
**Baseline (pre-audit):** lockstep GREEN, `tsc --noEmit` GREEN, vitest 908/908 GREEN, local == origin/main @ `24c114f`.

## Summary

README's **technical core is accurate**: five-stage pipeline, schema v5.1 + ontology v5.2, fifteen bright-line indicators, four-verb disposition vocabulary, Haiku-triage / Sonnet-deep model split, nine threat models, the cited engine commit `8d59762`, and the disclosed v4-language-in-policy-docs caveat all check out against the code. Every README internal link resolves. The name-typo scrub (Sayas -> Sayasy) and the HF endpoint migration sweep both held -- no residue in tracked files.

The staleness that exists is concentrated in: (1) one **corrupted flagship doc** (duplicated tail content in the case-study index, which is the README's "Start here" link); (2) **API-surface drift** in the README "Running locally" section; (3) a **design-system spec doc that still points at the pre-IA-reorg file path and route**; (4) a couple of **version / count cross-references** that lagged a ship.

**Findings: 1 CRITICAL, 4 MEDIUM, 5 LOW.**

**No trivial fixes were applied this session.** The one purely-mechanical fix (CRITICAL-1) is CRITICAL-severity, which the brief excludes from auto-application. Every other trivial-effort item lands in a Cowork-governed surface (the `README.md` portfolio front door is design-track-owned; `docs/07-v5-schema.md` is policy-track-owned; version fields are governed) or requires framing/scope adjudication only Steven can make (the "seven amendments" count, the "Cursor" tooling claim, the missing `package.json` description copy). Per `CLAUDE.md`, VS Code does not edit `docs/` policy text or the README without an authorizing `CURRENT.md`. The name-typo and dead-URL sweeps that would normally fill the trivial bucket were already completed in prior sessions. So the trivial-fix bucket is legitimately empty.

---

## CRITICAL

### CRITICAL-1 -- Flagship case-study index has duplicated, garbled tail content
- **File:** `docs/policy-reviews/index.md:140-155`
- **What:** The document ends correctly at line 139 (closing footer). Lines 140-155 then repeat content: line 140 is an **orphaned sentence fragment** ("over-claims if it presents the corpus as exhaustive."), followed by a verbatim re-paste of the entire "## Documents in this case study" section and the closing footer a second time. On GitHub's rendered view this shows as a dangling fragment plus a duplicated closing block.
- **Why it matters:** This is the document the README links as **"Start here"** (`README.md:7`) -- the single most likely first click for a hiring reviewer. Garbled duplication on the flagship artifact is exactly the kind of defect a careful reviewer notices in the first 30 seconds. The two sibling case-study docs (`2026-06-case-study-analysis.md`, `2026-06-corpus-selection.md`) were checked and are clean.
- **Suggested fix:** Delete lines 140-155; the document should end at line 139's footer.
- **Effort:** trivial (pure mechanical dedup -- no tone/framing/scope judgment). Safe to apply on Steven's say-so in one edit; flagged rather than auto-applied only because the brief excludes CRITICAL-severity items from the auto-sweep and because `docs/policy-reviews/` is a Cowork-governed surface.

---

## MEDIUM

### MEDIUM-1 -- README "Running locally" API description is stale (single route + prompt-only)
- **File:** `README.md:40`
- **What:** Reads "The single API route is `POST /api/evaluate` and takes `{ prompt: string }`." Both halves are now stale: (a) there are **two** routes -- `POST /api/evaluate` and `GET /api/evaluations` (paginated evaluation history, `src/app/api/evaluations/route.js`); (b) `/api/evaluate` no longer just takes `{ prompt }` -- it branches on `multipart/form-data` for image/audio media uploads, legacy `{ prompt }`, and `{ input: { kind: "prompt" | "conversation", ... } }` envelopes (`src/app/api/evaluate/route.js:222-261`).
- **Why it matters:** A reviewer inspecting the API from the README gets an inaccurate, under-scoped picture of a system that actually handles three input modalities.
- **Suggested fix:** Rewrite the sentence to name both routes and the three input shapes (prompt / conversation envelope / multipart media).
- **Effort:** small (sentence rewrite; design-track / Steven framing call -- not a single-token swap).

### MEDIUM-2 -- Design-system spec points at the pre-IA-reorg file path and route
- **File:** `docs/ux/design-system/v5-result-card.md` (34 occurrences of `src/app/page.js` and/or root `/?mode=`)
- **What:** The spec repeatedly cites "File: `src/app/page.js`", specific line numbers (e.g. "`TargetAttributesStrip` line ~2093"), and root-relative URLs (`/?mode=conversation`, `/?mode=prompt`). After the IA reorg the evaluator UI moved to `src/app/evaluator/page.js` (196 KB; root `src/app/page.js` is now landing-only and contains zero of the named components) and the route is `/evaluator?mode=...`. Verified: `TargetAttributesStrip` / `PromptSummaryRow` / `ProcessFlagRow` resolve in `src/app/evaluator/page.js` (6 matches) and not at all in `src/app/page.js`.
- **Why it matters:** A reviewer (or future maintainer) following the spec's file/line/route pointers lands on the wrong file and a route that serves the marketing page. Lower visibility than the README, but factually wrong throughout.
- **Suggested fix:** Bulk-update `src/app/page.js` -> `src/app/evaluator/page.js`, root `/?mode=` -> `/evaluator?mode=`, and re-derive the cited line numbers (or replace line numbers with symbol names, which don't rot).
- **Effort:** medium (34 occurrences across a source-of-truth spec; line-number re-derivation; design-track-owned -- needs the design track, not a mechanical swap).

### MEDIUM-3 -- Schema doc's ontology cross-reference lags the 5.2 bump
- **File:** `docs/07-v5-schema.md` (header, "**Ontology version:** 5.1")
- **What:** The schema doc header lists "Ontology version: 5.1" while the ontology is **5.2** everywhere else -- `src/lib/safeeval-v5.js` (`ONTOLOGY_VERSION = '5.2'`), `docs/08-v5-ontology.md`, and `README.md:48`. The doc's *schema* version (5.1) is correct and intentionally decoupled (schema stays 5.1 under the additive-amendment rule); only the ontology cross-reference line drifted.
- **Why it matters:** A reviewer comparing the schema doc against the ontology doc / README sees an internal version contradiction.
- **Suggested fix:** Change the ontology cross-reference 5.1 -> 5.2.
- **Effort:** trivial (single-token swap) -- BUT `docs/07-v5-schema.md` is the policy track's canonical owned spec and version fields are governed (the schema-vs-ontology decoupling is deliberate). Flagged for the policy track / Steven; VS Code should not edit a governed version field unprompted per `CLAUDE.md`.

### MEDIUM-4 -- Synthetic-media impl-spec memo references the superseded Gemini model
- **File:** `docs/memos/2026-05-28-synthetic-media-detection-implementation-spec.md:55,157,311,336,456`
- **What:** Five references to `gemini-1.5-flash`, including a live `generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent` endpoint URL (line 311). The shipped reasoning layer uses `gemini-2.5-flash` (`src/lib/media-detection/reasoning-layer.ts:35`; the 1.5 -> 2.5 bump fixed a 404). This is the only retired-external reference found in any tracked memo.
- **Why it matters:** Although memos are historical, the brief specifically calls for sweeping memos for retired-API references, and a reviewer reading this impl-spec would believe the system calls a now-superseded model at a stale endpoint.
- **Suggested fix:** Swap `gemini-1.5-flash` -> `gemini-2.5-flash` in all five spots (or add a one-line "superseded by 2.5-flash, see `reasoning-layer.ts`" note at the top if historical fidelity is preferred).
- **Effort:** small -- NOT applied because the brief permits only **trivial URL sweeps** inside `docs/memos/`, and four of the five references are non-URL prose/code/mockup; a URL-only partial fix (URL says 2.5, body says 1.5) would be worse than flagging. Needs a deliberate memo edit.

---

## LOW

### LOW-1 -- README amendment count vs the memo's latest ordinal
- **File:** `README.md:15` and `README.md:22` ("seven shipped ... atomic amendments")
- **What:** The parallel-tracks memo's header now describes the **"eighth atomic amendment"** (2026-05-29, plain-language-reviewer SOP) as its latest. README says "seven shipped." This is *probably* correct by shipped-count -- the memo documents the sixth amendment as scoped-but-not-yet-shipped (sequence numbers are content-keyed, not chronological), so 1-8 minus the unshipped 6th = seven shipped. But a reviewer who opens the memo sees "eighth" and may read the README as undercounting.
- **Suggested fix:** Clarify phrasing, e.g. "seven shipped of eight numbered amendments," or confirm the intended count semantics.
- **Effort:** trivial -- needs Steven to confirm the intended count before wording. Framing/scope call; README is design-owned.

### LOW-2 -- README tooling claim may be stale ("Cursor")
- **File:** `README.md:15` ("done end-to-end with Claude and Cursor as the engineering surface")
- **What:** The current engineering venue per `CLAUDE.md` is "Claude Code in VS Code." If Cursor is no longer the engineering surface, "Cursor" is a stale tooling reference (audit brief item 10).
- **Suggested fix:** Confirm and update to the accurate tool(s) if Cursor was retired.
- **Effort:** trivial -- but it is a factual claim about Steven's own workflow only he can confirm; framing call. Not auto-applied.

### LOW-3 -- package.json has no description / keywords
- **File:** `package.json`
- **What:** No `description` or `keywords` top-level fields. (The GitHub repo "About" description is set separately in GitHub settings, so this is cosmetic for npm/tooling metadata, not the GitHub sidebar.)
- **Suggested fix:** Add a one-line `description` and a few `keywords` if desired.
- **Effort:** trivial -- but this is adding new positioning copy, not sweeping a stale reference; what it should *say* is a framing call. Flagged, not authored.

### LOW-4 -- No LICENSE file (intentional, informational)
- **File:** repo root (no `LICENSE`)
- **What:** No `LICENSE` file. README's "License" section (`README.md:54-56`) explicitly states the code is portfolio work and "not currently published under an open-source license," so the absence is by design. GitHub will show "no license" / "all rights reserved by default."
- **Suggested fix:** None required. Optionally add an explicit "All rights reserved" `LICENSE` if Steven wants the stance machine-readable. Note only.
- **Effort:** n/a.

### LOW-5 -- Design-system spec references a screenshot path not in the repo
- **File:** `docs/ux/design-system/v5-result-card.md` (multiple "Screenshot evidence: `uploads/71b138e9-image.png`")
- **What:** Several changelog notes cite `uploads/71b138e9-image.png`; `uploads/` does not exist in the repo (it was a Cowork-side authoring path). These are descriptive "screenshot evidence" notes, not rendered `![](...)` markdown images, so nothing renders broken -- but the path is a dead reference.
- **Suggested fix:** Drop the path references or commit the referenced images under a tracked path. Best folded into the MEDIUM-2 sweep of this same file.
- **Effort:** trivial -- design-track-owned; bundle with MEDIUM-2.

---

## README freshness verdict

**Mostly accurate.** The technical substance -- the part a policy/safety reviewer scrutinizes -- is correct and verifiable against the code. The staleness is confined to one operational sentence (the API description, MEDIUM-1) and two soft cross-references (amendment count, tooling claim -- both LOW). The README is not misleading about what the system *is* or *does*; it is slightly behind on one mechanical detail and a couple of count/tooling phrasings.

## Hiring-reviewer first-impression assessment

**Largely yes, with one sharp exception.** A reviewer landing on the repo gets an accurate, substantive README that holds up against the code, links that all resolve, and a green CI gate. The one thing that would dent the impression is **CRITICAL-1**: the README sends them to "Start here," and that flagship doc currently has a garbled duplicated tail. Fixing that single defect is the highest-leverage move for first-impression quality; everything else is polish a reviewer is unlikely to catch.

---

*Filed for `tracks-architect` / Steven adjudication. No code or doc edits were made in the producing session; baseline (lockstep / tsc / vitest 908) was GREEN before and after.*
