# PII zero-storage scoping -- drop the KMS-encrypted unredacted column from the data track

**Status:** draft, recommends-only (scoping memo proposes a Tier A architectural simplification; implementation gates on Steven's adjudication of the scope tier in section 7).
**Date:** 2026-05-28
**Author:** `safeeval-policy` (Cowork), via `safeeval-agents:design-memo-author` (mode A).
**Companion to:** `docs/memos/2026-05-28-data-track-scoping.md` (section 4.5 two-key access tier; section 10 Q5 deferred encryption-at-rest scheme), `docs/memos/2026-05-28-data-track-implementation-spec.md` (Phase 1-4 implementation including the KMS column definition; Phase 3 KMS module never implemented), `docs/memos/compl/2026-05-28-pii-access-posture.md` (the compliance posture memo adopting AWS KMS for the unredacted column in commit `f62c34c`; this memo argues for reversing part of that decision), `src/lib/data/schema/M1_evaluations_table.sql` (current schema carrying the three KMS columns), `src/lib/data/schema/M2_rls_policies.sql` (`pii_reviewer` role + view granting unredacted access), `src/lib/data/sanitizer.ts` (current redaction surface: regex tier shipped; Presidio sidecar deferred).
**Scope:** scope the architectural simplification of dropping the KMS-encrypted unredacted PII column from the data track entirely. Recommends Tier A (drop now, before Phase 3 implementation lands). Does NOT implement the change in this commit; implementation is a small follow-on VS Code commit that gates on Steven's adjudication. Does NOT amend the compliance posture memo in this commit; the parallel architect dispatch handles the compl amendment after adoption.

## 1. Problem statement

Phase 1 of the data track shipped in commit `c301f79`: regex-tier PII sanitization wired to the persistence write path, with the sanitized envelope landing in `evaluations.envelope` (JSONB) and a structured `pii_redaction_log` recording what was caught. The schema reserves three additional columns -- `unredacted_payload_kms_ciphertext`, `unredacted_payload_encrypted_dek`, `unredacted_payload_kms_key_id` -- for the reviewer-escalation flow: when a `human_review` disposition needs the original input, the `pii_reviewer` role decrypts the BYTEA bundle via AWS KMS.

Steven's directive: "After we get a database running I want to ensure we do not store PII." The current design is defensible -- the unredacted backup is encrypted at rest under AWS KMS, the two-key access tier requires both a Postgres role and an IAM-permissioned KMS Decrypt call, and the access pattern produces a CloudTrail audit trail per access. But it is not zero-storage. The encrypted ciphertext is still SafeEval's data on SafeEval's disk; it is recoverable; it is exfiltrable under the right combination of credential compromises; it is, in the colloquial sense Steven's directive uses, PII that SafeEval stores.

The proposal is to drop the unredacted column entirely. Sanitization becomes the single source of truth. The compliance posture shifts from "we encrypt PII with KMS behind a role-based access tier" to "we don't store PII." The architectural simplification is real -- removing the KMS dependency removes an AWS account requirement, removes the two-key access pattern from the future reviewer UI, removes the compl memo's load-bearing decision, and removes the Phase 3 KMS module from the implementation plan. The cost is concrete and bounded -- reviewer escalation can no longer reach back through the store; forensic investigation of a sanitizer bug cannot recover the original; the commercial-path customer-managed-keys story is foreclosed at the data layer.

This memo scopes the simplification, names the three tiers, evaluates each on the threat model and operational axes the original data-track and compl memos used, and recommends Tier A (drop now, before Phase 3 implementation). Implementation is a small commit gated on Steven's adjudication.

## 2. What changes architecturally

Concrete delta against the current state (Phase 1 shipped; Phases 2-4 not yet implemented):

- **Schema (M5 migration, new).** Drop the three KMS columns from `evaluations`:
  - `unredacted_payload_kms_ciphertext` (BYTEA)
  - `unredacted_payload_encrypted_dek` (BYTEA)
  - `unredacted_payload_kms_key_id` (TEXT)
  - The drop is reversible via a DOWN section that re-adds the columns as NULLable (the columns are NULL on every row in the live table today; the drop loses no data).

- **RLS (M5 migration, same file).** Drop the `pii_reviewer` role and the `evaluations_reviewer_view` view's `pii_reviewer` branches. The `reviewer` role and the tenant-isolation policy stay; they govern sanitized access and are unaffected by the change.

- **Code -- `src/lib/data/kms.ts` (Phase 3).** Never implemented; the file does not exist in the current tree. The Phase 3 plan deletes from the implementation roadmap. The persistence path in `persistence.ts` already throws `KMSNotImplementedError` when a non-null `raw_input` is passed; that branch and the error type go away.

- **Persistence (`src/lib/data/persistence.ts`).** The `persistEvaluation` function signature simplifies: `raw_input` is removed from the parameter list, and the orchestration drops Step 2 (encrypt raw input). The function becomes `sanitize -> insert`, single sequence, no KMS branch. Callers in the API route layer drop the `raw_input` argument.

- **`.env.example`.** The Phase 3 additions never landed in `.env.example` (KMS was the Phase 3 surface; Phase 3 was deferred). The `AWS_REGION`, `AWS_KMS_KEY_ID`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `SAFEEVAL_REVIEWER_MODE` env vars from the implementation spec section 8 are dropped from the Phase 3 plan. The current `.env.example` is unchanged by this memo; the diff is in what does NOT get added.

- **Migrations.** New M5 (`schema/M5_drop_unredacted_columns.sql`) drops the three columns + the `pii_reviewer` role + the view's pii_reviewer branches. Reversible via DOWN section. Apply order: M1 -> M2 -> M3 -> M4 (if exists) -> M5.

The implementation work is small: one migration file, a function signature change in `persistence.ts`, a caller-side change in the API route, the deferred Phase 3 plan deleted from the docs roadmap. ASCII-safe, lockstep-validator-neutral (the data layer does not lockstep with the engine), no docs/ policy text changes beyond the compl memo amendment (which is the architect's job downstream).

## 3. What's gained

Concrete operational and posture gains:

- **Zero AWS dependency.** SafeEval runs on Vercel (compute) + Supabase (Postgres). Full stop. No AWS account creation, no IAM role provisioning, no KMS key policy, no CloudFormation template (`scripts/kms-key-setup.yaml` per implementation spec section 4 is never written), no CloudTrail retention budget, no AWS SDK in the dependency tree. The data layer's infrastructure mental model shrinks by one provider.

- **One less compliance memo to maintain.** The PII access posture memo (commit `f62c34c`) becomes partially superseded: the encryption-at-rest decision (Decision 1, AWS KMS) is reversed; the legal-audience role-check decision (Decision 2) remains but is gating a sanitized envelope rather than an unredacted one. The compl posture surface simplifies because the underlying data being gated changes shape.

- **No two-key access pattern to design UI around.** When the reviewer UI eventually exists (a downstream data-track surface for browsing evaluations), the design problem is one role (`reviewer`) reading one set of columns (sanitized). The two-key elevation flow that would have required a separate session, a separate auth surface, and a separate audit-log integration is foreclosed. The reviewer UI scoping memo, when it comes, gets simpler.

- **Cleaner portfolio story.** "We don't store PII" is one sentence. "We encrypt PII with AWS KMS behind a Postgres role-based access tier with CloudTrail audit logging on every decrypt and an IAM role separation between the app and the reviewer" requires several sentences of explanation, and the explanation invites follow-up questions about key rotation cadence, CloudTrail retention, IAM role drift, and the difference between the KMS-managed-key and customer-managed-key variants. Both are defensible architectures; only one is a single-sentence portfolio claim.

- **Sanitization becomes the single source of truth.** Auditing the data layer's PII posture reduces to auditing the sanitizer. Sanitizer correctness, sanitizer false-negative rate, and sanitizer regression-test coverage become the load-bearing artifacts. The two-key access tier's safety property -- which depended on the KMS configuration AND the IAM role AND the Postgres GRANT all being correct simultaneously -- collapses into the sanitizer's correctness. Fewer moving parts, fewer surfaces to audit, fewer ways to be subtly wrong.

## 4. What's lost

Concrete capabilities and stories foreclosed:

- **Reviewer escalation paths that need the original input cannot retrieve it from SafeEval's store.** A `human_review` case where the determining signal was a specific name, email, or account number -- the sanitization hides exactly the signal the reviewer needs -- becomes structurally harder. The reviewer must re-evaluate from the original source (the user's session, the upstream system that captured the prompt) if that source still exists. SafeEval cannot serve as the system of record for the original input.

- **Regulatory inquiries that require the original input verbatim cannot be answered from SafeEval's store.** Subpoena response, chain-of-custody under compelled disclosure, and audit-trail responses that require the verbatim prompt are foreclosed. The compl memo's section 4 legal-audience access pattern becomes a sanitized-envelope-only path; the legal-audience report cannot include the original unredacted content because the original is not stored anywhere SafeEval controls.

- **The KMS commercial-path story is foreclosed at the data layer.** The compl memo's section 3.4 reasoning included "customer-VPC commercial path makes KMS the dominant choice anyway" -- customers in regulated industries want their own KMS keys. With zero-storage, there is nothing to encrypt at the customer's key, because there is no unredacted column. If SafeEval ever ships into a regulated customer environment that requires customer-managed keys for unredacted PII, the data layer needs re-architecting: re-introducing the column, re-introducing the KMS module, re-introducing the two-key access tier. The escape hatch in section 9 below names a deployment-config-level path for this, but the main repo's data layer would not carry the surface.

- **The failsafe against sanitizer bugs disappears.** Today, if the sanitizer has a bug and over-redacts (e.g. a regex false-positive that strips a legitimate non-PII token), the original is recoverable through the `pii_reviewer` role. After Tier A, the original is gone forever -- the sanitized envelope is the only record. Sanitizer regressions become unrecoverable in the same sense that the rejected scope-tier MVP (no sanitization at all) was unrecoverable in the original data-track memo's section 3.A reasoning: the corpus is permanently shaped by whichever sanitizer version wrote each row.

## 5. What this implies for the compliance posture

The PII access posture memo (commit `f62c34c`) adopted AWS KMS for the unredacted column at rest (Decision 1) and an explicit `pii_reviewer` role check for legal-audience access to unredacted envelopes (Decision 2). Zero-storage interacts with both:

- **Decision 1 (AWS KMS) is REVERSED.** There is no encrypted column to gate at rest; the encryption-at-rest scheme decision becomes moot. The compl memo's section 3 threat-model analysis remains valid as historical reasoning (and as the record of why KMS was the right choice IF the column existed), but the decision itself is superseded by this memo's Tier A adoption.

- **Decision 2 (explicit role check on legal-audience reports) STILL APPLIES.** The role check governs the report generator's legal audience for OTHER reasons beyond unredacted access: principle of least privilege (the audit-trail value the compl memo section 4.3 named), routing-vs-security decoupling (the audience classification stays a routing decision rather than becoming the security boundary), and operational hygiene (legal-audience reports remain episodic enough that the role check costs nothing). What changes is the underlying data being gated: the role check now gates sanitized envelopes rather than unredacted ones. The safety property is weaker in absolute terms (the unredacted access was the higher-stakes access; gating sanitized access is gating something already-safe), but the role check still serves the audit-trail and decoupling purposes. The compl memo Decision 2 reasoning is partially preserved.

- **The compl memo needs an amendment OR a successor memo.** Two options for how to record the reversal:
  - **Amendment.** Edit the compl memo in place, marking Decision 1 as superseded by this memo with a date and commit reference. Compact, but mutates a memo that other artifacts already reference.
  - **Successor memo.** File a new compl memo at `docs/memos/compl/2026-05-XX-pii-access-posture-zero-storage-amendment.md` that supersedes Decision 1, leaves Decision 2 in place, and points readers at this memo for the upstream architectural reasoning. Cleaner audit trail; both memos remain readable in isolation.

The recommendation per section 10 below is the successor-memo path. It is the architect's job downstream of this memo's adoption; this memo names the requirement and the recommended shape, but does not author the compl-side artifact.

## 6. What this implies for OSINT

The OSINT memos firing in parallel (`0075-vscode-commit-bounce-osint-outbound-data-flow-posture-memo.md` and `0076-vscode-commit-osint-monitoring-scoping-memo.md`) adopted "extract TTPs not identities" as the OSINT-side PII policy. The OSINT track ingests fraud-landscape signal from public sources and extracts technique/tactic/procedure vocabulary; it explicitly does NOT store the identities (handles, account numbers, named individuals) from the source material.

Zero-storage in the main data track makes the two surfaces trivially consistent. Both the OSINT pipeline and the evaluations corpus now hold the same posture: sanitized signal only; no identities at rest. The cross-surface story tightens -- a reader auditing SafeEval's overall PII posture sees a single rule (no identities stored, anywhere) rather than two surface-specific rules ("OSINT extracts TTPs not identities" + "evaluations store identities encrypted under KMS"). The consistency is a small portfolio gain on top of the per-surface reasoning.

This memo does not modify the OSINT memos; it names the consistency for the record so a future reader sees that the two architectural choices were made in alignment and not by accident.

## 7. Three scope tiers

Three concrete tiers. The recommended tier is Tier A (drop now).

### 7.1 Tier A (recommended) -- Drop now, before Phase 3 implementation

Land the M5 migration that drops the three KMS columns + the `pii_reviewer` role + the view's pii_reviewer branches. Simplify `persistence.ts` to drop the `raw_input` parameter and the KMS branch. Delete the Phase 3 plan from the data-track implementation roadmap. File the compl memo amendment in parallel.

**Why this is the recommendation:**

This is the cheapest moment to make the change. Phase 3 (the KMS module in `src/lib/data/kms.ts`) was never implemented; deleting a plan costs nothing. The three KMS columns are NULL on every row in the live table today (Phase 1 wired up sanitization but did not populate the unredacted columns -- `persistence.ts` throws `KMSNotImplementedError` if `raw_input` is non-null). Dropping the columns loses zero data. The implementation work is small (one migration, a function signature change, a caller-side change, a docs roadmap edit).

The portfolio claim ("we don't store PII") becomes available immediately. The compl memo amendment is the only follow-on artifact required, and it is the architect's job downstream of this scoping memo. The Phase 2 work (db-client.ts and the API route wiring) does not need to be re-done -- it was always sanitization-aware; the KMS branch was the never-implemented part.

**Dispatch budget:** ~$30 - $50 (M5 migration + persistence simplification + roadmap doc edits + verification dispatch). Lands in roughly one day of dispatch work.

### 7.2 Tier B -- Drop later, after Phase 3 implements KMS

Allow Phase 3 to land KMS as planned. Persist unredacted ciphertext to the three columns. Then, in a later commit, drop the columns and reverse the work.

**Why this is named but not recommended:**

Tier B wastes the Phase 3 implementation effort. The KMS module would be written, tested, integrated, deployed, and then removed. The CloudFormation template would be authored, the AWS account would be created, the IAM roles would be provisioned, the CloudTrail would be configured, and then all of it would be torn down. The reversibility argument is real -- the M5 migration is the same in both tiers, and dropping the column after the fact loses no more capability than dropping it now -- but the cost paid for the round trip is concrete and recoverable only by not having done it.

The case for Tier B is "we discover during Phase 3 implementation that we actually need the unredacted column for a reason Steven hasn't named yet." If such a reason exists, naming it now (and either accepting it as a Tier C compromise or rejecting it as a sanitizer-hardening problem) is cheaper than discovering it after Phase 3 lands. Recommended only if Steven has a concrete near-term need for the unredacted column that this memo has not surfaced.

**Dispatch budget:** ~$150 - $200 (Phase 3 implementation per the original spec PLUS the Tier A simplification work after). Roughly five to seven days of dispatch work.

### 7.3 Tier C -- Keep the column, change the policy

Compromise: keep the three KMS columns in the schema and the `pii_reviewer` role in M2, but document them as "reserved for future use only, NOT populated in MVP." Phase 3 KMS module never lands; the columns stay NULL forever; the role exists but is never granted to a user.

**Why this is named but not recommended:**

Tier C is the worst of both worlds. The portfolio claim "we don't store PII" is unavailable because the columns exist (a reviewer of the schema would reasonably ask what they are for); the compliance-posture simplification is unavailable because the two-key access tier remains in the design documents even if it is dormant; the operational simplification is unavailable because the `pii_reviewer` role exists in the database and the RLS view branches on it. The surface area is preserved without the corresponding capability.

The case for Tier C is "preserve optionality cheaply." But the columns are not cheap optionality -- they are a load-bearing architectural commitment that a future maintainer reading the schema and the RLS view would reasonably try to use. Dormant infrastructure is worse than absent infrastructure for the maintenance-cost reason; it invites the next person to wire it up without understanding why it was paused.

**Dispatch budget:** ~$0 (no schema or code changes; only a docs roadmap edit naming the columns as deferred). Lands in zero dispatch work, but pays the surface-area cost ongoing.

## 8. Risks of dropping now (Tier A)

Five concrete risks. Each is mitigated by section 9 below or flagged as a residual concern.

**R1. Sanitizer false-negatives become irrecoverable.** The current sanitizer is regex-tier only; Presidio is deferred. Names, free-form addresses, obfuscated identifiers, and non-Western PII patterns can slip past the regex layer. With Tier A, every false-negative produces a permanent PII leak in the `evaluations.envelope` JSONB -- the sanitized envelope is the only record, so a missed name stays in the sanitized envelope forever. Today, the unredacted column would carry the same content (so the leak is not made worse), but the option to retroactively re-sanitize using the original input disappears with the unredacted column.

The asymmetry to name: today the JSONB envelope already contains the sanitizer's output, including any false-negatives; the unredacted column carries the same content under encryption. Tier A does not introduce false-negatives -- they exist either way. What Tier A forecloses is the retroactive re-sanitization path: under the current design, a future sanitizer that catches more PII could re-process the unredacted column and update the sanitized envelope; under Tier A, the original is gone and the false-negatives stay.

**R2. Reviewer ability to spot-check sanitizer accuracy degrades.** The compl memo's audit-trail reasoning was partly that a reviewer could compare the sanitized envelope against the unredacted original to confirm the sanitizer did not over-redact (false-positive) or under-redact (false-negative). With Tier A, the ground truth is no longer in the store; the reviewer can only see the sanitized output and the redaction log. Audit becomes "do the redaction-log statistics look reasonable" rather than "did the sanitizer get this specific row right."

**R3. Future commercial-path customers wanting customer-managed keys would need re-architecting.** The compl memo's section 3.4 reasoning was partly that KMS was the right choice for the future customer-VPC commercial path. Tier A forecloses that path at the data layer: re-introducing customer-managed-key encryption later would require re-adding the column, re-adding the KMS module, and re-adding the two-key access tier. The work is bounded (it is reversing this memo's implementation) but real.

**R4. The PII access posture memo becomes partially superseded; readers of the repo may follow stale guidance.** The compl memo is referenced by other artifacts (the original data-track memo, the report-generator memo). Without an explicit amendment or successor, a reader reaching the compl memo from a back-reference may believe AWS KMS is the live encryption-at-rest scheme when it is not.

**R5. Forensic investigation of an actual sanitizer bug cannot reach back through the store to confirm scope.** If a sanitizer bug is discovered tomorrow (e.g. a regex misses a common email format), the question "how many rows in the live table were affected" cannot be answered by re-running the sanitizer against the unredacted column (because the unredacted column does not exist). The answer becomes "we cannot know from the store alone; the redaction-log entries that the buggy sanitizer wrote are the only record, and they are by definition missing the entities the bug missed."

## 9. Mitigations

For each risk:

**R1 (sanitizer false-negatives).** Bump the Presidio sidecar integration forward from "Phase 3+" to "next implementation phase after this scoping lands." The Presidio tier catches PERSON and LOCATION (the highest-value false-negative classes for fine-tuning safety) and provides confidence scores per detection (useful for the redaction-log statistics audit in R2). Additionally, add a regression-test corpus to `src/lib/data/__tests__/` covering known PII patterns -- a frozen test set that exercises the sanitizer against deliberately tricky inputs and asserts the redactions. The corpus grows over time as new false-negative patterns are discovered; the test surface becomes the audit trail for sanitizer evolution.

**R2 (sanitizer-accuracy spot-check).** Implement at source, not storage. The redaction-log JSONB already carries `redactions[].offsets`, `redactions[].source`, and `redactions[].confidence` per entity. Add a sanitizer dev-tool (`scripts/audit-sanitizer.js`, or a Vitest harness) that consumes raw input + the redaction log and reports "the sanitizer flagged N entities at offsets [...]; here are the spans it identified." The reviewer audits at write-time (during development, against a fixture corpus) rather than at read-time (against the live table). The audit surface moves earlier in the lifecycle; the audit capability is preserved without storing the raw input.

**R3 (commercial-path).** Document an escape hatch at the deployment-config layer. VPC-tier or regulated-customer deployments that require unredacted-at-rest under customer-managed keys can elect to re-introduce the KMS column via a deployment-config flag. The main repo carries the zero-storage default; a deployment-overlay (e.g. a branch, a fork, or a feature-flag-gated migration) carries the re-introduced column for customers who need it. The escape hatch lives in the deployment surface, not in the main repo's data layer. This preserves the future option without paying the surface-area cost in the main artifact.

**R4 (stale-memo risk).** This memo references and partially supersedes the compl memo explicitly. Landing the commit that adopts Tier A AMENDS the compl memo's status -- either through an in-place amendment marker (the compl memo gets a header note: "Decision 1 superseded by `docs/memos/2026-05-28-pii-zero-storage-scoping.md`, commit XXXX, on 2026-05-XX") or through a successor compl memo that points back. The successor-memo approach is the recommendation per section 5; the amendment-in-place approach is the fallback if the architect prefers the lighter touch. Either way, the staleness is addressed; the only failure mode is forgetting to do it, which the parallel architect dispatch in section 12 below catches.

**R5 (forensic gap).** Document as a known limitation. The data-track docs (the eventual `docs/data/README.md`, or the existing scoping memo's section on non-goals) gain a section: "SafeEval does not retain the original input verbatim. Sanitizer-bug forensic investigation can establish which rows were processed by a given sanitizer version (via `sanitizer_version` in the redaction log) but cannot recover the specific entities a buggy sanitizer missed." The limitation is acceptable because the alternative is shipping with the surface area Steven explicitly wants to avoid; the limitation is named so future maintainers do not believe a forensic capability exists that does not.

Add a "what SafeEval doesn't do" section to the README if one does not exist. This is itself a portfolio signal -- explicitly naming limitations is a stronger artifact than implying none exist. The architect's compl-amendment dispatch can include this README update as part of the same commit; it does not need a separate dispatch.

## 10. Open questions for Steven (escalation field per fifth atomic amendment)

Four open questions, each carrying the inline `escalation:` field per the closure-report convention in `docs/memos/2026-05-24-parallel-cowork-tracks.md` section 6 (fifth atomic amendment 2026-05-28). One is `route-to-steven`; three are `default-accept`.

1. *(escalation: route-to-steven, reason: scope-tier decision is a project-boundary-crossing and public-artifact-materiality trigger -- the choice reverses a previously-adjudicated compl memo decision and reshapes the data layer's portfolio claim from "encrypted PII behind a role gate" to "no PII stored")* **Tier adoption -- A, B, or C?** Section 7. Memo recommends Tier A (drop now, before Phase 3 implementation). Tier B (drop later, after Phase 3 lands) wastes effort and is recommended only if Steven names a concrete near-term need for the unredacted column. Tier C (keep the column dormant) is the worst-of-both compromise and not recommended. The choice is reviewer-escalation-capacity material and compliance-posture material; routing for adjudication.

2. *(escalation: default-accept, rec: bump Presidio sidecar forward to "next implementation phase after this scoping lands")* **Sanitizer hardening priority.** The R1 mitigation depends on Presidio landing sooner rather than later. Recommend bumping the Presidio sidecar integration forward from "Phase 3+" (where the implementation spec section 11 deferred it) to "next implementation phase after this Tier A scoping lands." The dispatch budget is moderate (a Python sidecar + the JS-side integration + tests + the sanitizer-version bump); the value is the regression-test corpus and the PERSON / LOCATION recall the regex tier cannot reach. Default-accept unless Steven prefers to defer.

3. *(escalation: default-accept, rec: document as known limitation in the data-track README and add a "what SafeEval doesn't do" section to the main README if it does not exist)* **Forensic-gap acknowledgment.** The R5 risk needs a documented home. Recommend the data-track README (when authored) for the sanitizer-version-specific forensic-gap language, and the main README's "what SafeEval doesn't do" section (creating that section if it does not exist) for the portfolio-visible "we do not retain original input" claim. Default-accept; the documentation work is the architect's parallel dispatch.

4. *(escalation: default-accept, rec: file as parallel architect dispatch once this scoping is adopted; recommended shape is a successor compl memo rather than an amendment-in-place to the existing posture memo)* **Compl memo amendment dispatch.** The compl posture amendment is the architect's job, not policy's. Recommend filing it as a parallel architect-track dispatch immediately after Steven adjudicates Tier A. Recommended shape: a successor compl memo at `docs/memos/compl/2026-05-XX-pii-access-posture-zero-storage-amendment.md` that supersedes Decision 1 (AWS KMS), preserves Decision 2 (explicit role check on legal-audience reports), and points back to this memo for the upstream architectural reasoning. The successor-memo approach is cleaner for the audit trail than an in-place amendment; both memos remain readable in isolation. Default-accept on the dispatch routing; the architect picks the final shape.

**One `route-to-steven` (Q1 tier adoption) pauses auto-chaining; three `default-accept` (Q2 sanitizer hardening, Q3 forensic-gap doc, Q4 compl memo amendment) proceed with tentative recommendations.**

## 11. Adversarial review -- strongest case against this memo's conclusion

Per the design-memo-author skill's mode-C affordance and section 6.1 #1's adversarial-review-self-flag trigger, this memo records its own two strongest counter-arguments. The counters are named; they do not flip the recommendation; they sharpen what Steven is asked to confirm.

### 11.1 Strongest case AGAINST dropping the column

"You're giving up an insurance policy for marginal architectural simplification."

The argument: the KMS-encrypted unredacted column is cheap insurance against three failure modes the system will eventually face. (a) A sanitizer bug ships; the unredacted column lets engineers reach back and audit the scope of the leak. (b) A reviewer hits a `human_review` case where the determining signal was a redacted entity; the unredacted column lets them resolve the case rather than punting. (c) A regulator or counsel asks for the original input verbatim under compelled disclosure; the unredacted column lets SafeEval respond rather than failing closed. The architectural simplification gained by dropping the column -- one fewer AWS dependency, one less compl memo, one less role -- is small compared to the optionality lost. The implementation cost of the KMS path was already absorbed in the Phase 1 scoping (the column is in the schema; only the Phase 3 KMS module is deferred); dropping the column now wastes the scoping work and forecloses the failure-mode insurance.

**Refutation.** Three points:

(a) Steven's directive is explicit and the insurance policy is exactly what he doesn't want. "After we get a database running I want to ensure we do not store PII" is unambiguous -- the failure modes the insurance protects against are the failure modes Steven is willing to accept in exchange for not storing PII at all. The "cheap insurance" framing assumes Steven would value the insurance over the simplification; the directive is direct evidence that he does not.

(b) Presidio sidecar integration + redaction-summary spot-check at write-time recover most of the lost capability without storing PII. The R2 mitigation (write-time audit of sanitizer accuracy against a fixture corpus) covers the sanitizer-quality observability axis. The R1 mitigation (Presidio + regression-test corpus) covers the false-negative axis. The forensic-gap (R5) is real and is documented as a known limitation. The "insurance policy" framing implies the unredacted column is the only way to recover these capabilities; it is not. Most of the capability is recoverable through better sanitization and better write-time tooling, neither of which requires storing PII.

(c) The AWS dependency is a real ongoing operational cost and compliance burden that wasn't earned. The compl memo's section 3.4 reasoning included the AWS account dependency as a cost paid for the KMS audit trail; that cost is paid every day Phase 3 exists, not just at implementation time. Account provisioning, IAM role drift, CloudTrail retention budget, the operational mental model of "Vercel + Supabase + AWS" -- all real, all ongoing, all paid in exchange for an insurance policy that Steven's directive says he does not value. The simplification is not marginal; it is removing a third infrastructure dependency that the system never had a clear product reason to take on.

### 11.2 Strongest case FOR keeping the column for portfolio-piece reasons

"The KMS work demonstrates depth; deleting the implementation column deletes the demonstrated work."

The argument: SafeEval is a portfolio artifact. The KMS scoping memo, the compl posture memo, the Phase 3 implementation plan, the CloudFormation template, and the two-key access tier together demonstrate that the engineer who built SafeEval understands envelope encryption, IAM role separation, KMS audit trails, GDPR Article 32, SOC 2 CC6.1, and the difference between transparent encryption (Vault) and key-separated encryption (KMS). Dropping the column erases the demonstration. A hiring reader looking at the data layer after Tier A sees sanitization and stops; before Tier A they would have seen sanitization + KMS + two-key access + IAM separation + CloudTrail audit trail -- a deeper demonstration of compliance-posture reasoning.

**Refutation.** Three points:

(a) The KMS scoping memo + the compl posture memo already document the depth in the repo. The artifacts that demonstrate the reasoning ARE the scoping memo and the compl memo, not the column in the schema. A hiring reader who wants to see whether the engineer understood envelope encryption reads `docs/memos/compl/2026-05-28-pii-access-posture.md` and finds a full threat-model analysis, regulatory framing, alternative comparison, and adversarial review. Deleting the implementation column does not delete those memos. The demonstrated depth lives in the architectural decision records; the implementation column was the consequence of those decisions, not the demonstration itself.

(b) "We don't store PII" is a stronger portfolio sentence than "we store encrypted PII behind a role gate." The one-sentence portfolio claim matters. A hiring reader scanning the README in 30 seconds reads one sentence about the PII posture; "we don't store PII" is unambiguous and aligned with the directive a security-conscious reviewer would themselves write. "We store encrypted PII behind a role gate" is correct but invites follow-up questions about exactly which decisions were made and why -- the depth is there but the claim is weaker as a single sentence. The strongest portfolio sentence is the one that is both true and tightly aligned with the reviewer's priors.

(c) Future readers of the repo will see both the original decision AND the conscious reversal, which itself is a portfolio signal of iterative judgment. The data-track scoping memo, the compl posture memo, this memo, and the successor compl memo together form a record: the engineer scoped the column, adopted KMS as the encryption-at-rest scheme, then reversed the decision when the product directive shifted. That is exactly the iterative-judgment signal a senior reviewer reads for -- it shows that the engineer can adopt a position, defend it adversarially, and then revise it when the input changes. Deleting the implementation does not delete the record of the reversal; it sharpens it.

### 11.3 What mode C can and cannot do here

Per the design-memo-author mode C rule, adversarial review can only downgrade confidence -- ACCEPT -> PARTIAL ADOPT -> DEFER. The adversarial review above does not flip the recommendation; it surfaces the strongest counters and refutes them on grounds specific to Steven's directive, the available mitigations, and the portfolio-artifact framing. The recommendation stands at Tier A (drop now) ACCEPT, with the conditions-for-revisit in section 9 R3 (commercial-path escape hatch) as the explicit unblocker for a future amendment if SafeEval ever ships into a regulated customer environment that requires customer-managed unredacted-at-rest.

If the recommendation were overconfident, the mode-C move would be to downgrade Tier A from ACCEPT to PARTIAL ADOPT: adopt the column drop, but keep the `pii_reviewer` role in M2 for future use against other tables (e.g. if a future table holds PII for a different reason). This memo declines to do that -- the role exists today only because the unredacted column exists, and a dormant role is the Tier C compromise this memo already rejected. The role goes with the column; the partial-adopt path is named for completeness but not adopted.

## 12. Sequencing dependency

Implementation gates on the following sequence:

1. **Adoption decision (Tier A / B / C).** `route-to-steven` per section 10 Q1. Pauses auto-chaining until Steven adjudicates.

2. **If Tier A adopted:** small VS Code commit covering the M5 migration (`schema/M5_drop_unredacted_columns.sql`), the `persistence.ts` simplification (drop `raw_input` parameter, drop KMS branch), the API route caller-side change (drop `raw_input` argument), and the docs roadmap edit (delete Phase 3 KMS plan from `docs/memos/2026-05-28-data-track-implementation-spec.md` section 11 deferred-work list). The commit is small, lockstep-validator-neutral, and ASCII-safe. Dispatch budget: ~$30 - $50.

3. **Architect-track compl memo amendment fires in parallel after adoption.** The successor compl memo recommended in section 10 Q4 + the README "what SafeEval doesn't do" section recommended in section 10 Q3. The dispatch is the architect's job; it can run concurrently with the VS Code implementation commit because the two surfaces (docs vs. code/schema) are independent.

If Tier B adopted: Phase 3 lands per the original implementation spec; the Tier A simplification work is filed as a follow-on memo for after Phase 3 ships. Dispatch budget grows to ~$150 - $200 total.

If Tier C adopted: zero implementation work; only a docs roadmap edit naming the KMS columns as deferred. The compl memo amendment is lighter (Decision 1 status changes from "adopted" to "adopted-but-not-implemented" rather than "superseded"). Dispatch budget: ~$10.

## 13. Closure

This scoping memo recommends Tier A (drop the KMS-encrypted unredacted column now, before Phase 3 implementation) per Steven's directive that SafeEval not store PII; implementation is a small VS Code commit (M5 migration + persistence simplification + roadmap edit); the compl posture amendment is a parallel architect-track dispatch that supersedes Decision 1 of the existing PII access posture memo while preserving Decision 2.
