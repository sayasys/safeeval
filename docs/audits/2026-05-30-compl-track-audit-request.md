# Compliance Track audit request — VS Code shipment sweep (2026-05-30)

**Requested by:** Steven (via Dispatch orchestrator)
**Audit window:** commits `4e073d5..5f54937` (live on safeeval.vercel.app)
**Severity required:** CRITICAL / MEDIUM / LOW per finding
**Verdict required:** PASS / CONDITIONAL / FAIL

## Context

Over the past day ~30+ VS Code sessions shipped substantial work directly to `origin/main`, bypassing the normal Cowork track-architect dispatch flow. Several new surfaces touch data-handling and PII-exposure boundaries: synthetic-media uploads (images/audio), OSINT outbound fetches, Supabase multi-tenancy, and an Anthropic-backed report generator. SafeEval's standing compliance posture is PII zero-storage (see `docs/memos/compl/2026-05-28-pii-access-posture-zero-storage-amendment.md`). This memo requests a compliance-lens audit of whether that posture survived the new surfaces.

## What to audit (track-specific scope)

1. **Synthetic media upload PII risk.** The evaluator now accepts image + audio uploads (`a59274d`/`ee73700` and the media evaluator). Images and audio may contain PII (faces, voices, embedded metadata/EXIF). Audit the upload path (`src/app/api/.../evaluate`, media-detection lib): are uploads transient or persisted? Is anything written to disk/DB/object storage? Is EXIF/metadata stripped or forwarded? Confirm the zero-storage guarantee holds for binary uploads, not just text.
2. **OSINT outbound data flow.** An earlier sec/compl session produced `docs/memos/sec/2026-05-28-osint-outbound-data-flow-posture.md`. Audit whether the shipped OSINT Phase 2 implementation (source fetchers, `/intelligence` page) matches that memo's posture — what is sent outbound, to whom, and whether any user/tenant data leaves the boundary in the fetch requests.
3. **Supabase multi-tenancy RLS.** The M12 migration (`src/lib/data/schema/M12_organizations_and_memberships.sql`) plus M2 RLS policies (`M2_rls_policies.sql`) and the auth provider abstraction (`src/lib/auth/`) implement org isolation. Audit whether tenant isolation is actually enforced at the *database* level (RLS policies on every tenant-scoped table) and not merely in application code — a missing RLS policy on a new table is a cross-tenant leak. Cross-check that M13/M14/M15 custom-pattern tables and M4 reports table carry correct RLS.
4. **Report generator data handling.** The report generator makes an Anthropic LLM call (`src/lib/report-generators/`). Audit what is sent in the prompt — does it include raw evaluation content that could carry PII? Are generated reports stored (`src/lib/data/reports.ts`, M4 reports table), and if so, does that storage conflict with zero-storage, or is it scoped to non-PII derived content?
5. **PII zero-storage guarantee end-to-end.** Holistically: after all new surfaces (uploads, OSINT, reports, multi-tenant tables), does the zero-storage guarantee in `docs/memos/compl/2026-05-28-pii-access-posture.md` still hold? Identify any new write path that persists user-supplied content.

## What NOT to audit

- Functional correctness of the detectors / RLS query performance — QA + Engineering scope.
- Whether the compliance posture *policy* should change — that is a Cowork/Compliance decision; this audit checks whether implementation matches the existing posture.
- Threat-model authoring for the new typologies — Policy track's scope.
- Remediating any leak found — this audit identifies and severity-rates; the fix is a follow-up dispatch (CRITICAL findings should be flagged for immediate escalation).

## Verification baseline

- All CI green: lockstep, tsc, vitest 908/908, next build
- Live on https://safeeval.vercel.app
- HEAD: `5f54937` (verify with `git log --oneline -1`)

## Deliverable shape

A response memo at `docs/audits/2026-05-30-compl-track-audit-findings.md` containing:
- Top-line verdict: PASS / CONDITIONAL / FAIL
- Findings table: severity / file:line / description / suggested fix / effort
- Explicit statement of whether the PII zero-storage guarantee holds (yes / no / qualified)
- Recommended next step if not PASS — and immediate escalation note for any CRITICAL data-leak finding

## Authorizing context

Steven approved a cross-track audit cycle on 2026-05-30. This is a regular hygiene sweep after a high-velocity VS Code shipment week, not an emergency response — though any CRITICAL PII or cross-tenant finding should be escalated immediately rather than queued. Posture changes remain Cowork/Compliance decisions; this memo authorizes the *audit*, not posture edits.
