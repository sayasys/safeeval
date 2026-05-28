# PII access posture -- encryption-at-rest scheme and legal-audience access pattern

**Status:** draft, recommends-only (two compliance-posture decisions deferred from upstream memos; both adopted recommendations are pending Steven's adjudication per §6).
**Date:** 2026-05-28
**Author:** `safeeval-tracks-architect` (Cowork), via `safeeval-agents:design-memo-author` (mode B -- adjudicating an inbound proposal -- plus mode C self-applied at §7).
**Companion to:** `docs/memos/2026-05-28-security-compliance-posture.md` (Phase 1 framework for sec/compl asks within the architect track; this memo is the first production exercise of the `compl:` lens), `docs/memos/2026-05-28-data-track-scoping.md` §4.5 (two-key access tier for unredacted data; §10 Q5 deferred to this adjudication), `docs/memos/2026-05-28-report-generator-scoping.md` §4.3 (legal audience definition; §14 Q4 deferred to this adjudication).
**Filing convention:** first artifact under `docs/memos/compl/` per the sec/compl posture memo §6 ("Memos: `docs/memos/compl/YYYY-MM-DD-{topic}.md`"). The subdirectory is created with this memo.
**Scope:** adjudicate two compliance-posture decisions left open by today's data-track and report-generator bundled ship (commits `be30894` and `760a4df`). Both decisions touch unredacted-PII access patterns; bundling them in one memo because they share a single threat model. The memo recommends one option for each decision and names the conditions under which a future amendment would revisit.

## 1. Background

Today's bundled ship (commits `be30894`, `45c2caa`, `760a4df`) landed three scoping memos plus the Phase 1 security/compliance posture framework. Steven adjudicated all open questions across the three memos under the "accept all" directive, except two: data-track §10 Q5 (encryption-at-rest scheme for the unredacted PII column) and report-generator §14 Q4 (legal-audience unredacted envelope access pattern). Both upstream memos declined to pick a single default; both carried `escalation: route-to-steven` precisely because the recommendation was non-obvious and the choice signals a compliance-posture commitment rather than a cost or ergonomics tradeoff.

This memo adjudicates both as a single architect-track artifact. The bundling is justified by §2's shared threat model: both decisions are about who can decrypt unredacted PII and under what conditions, and both decisions interact with each other (the encryption-at-rest scheme determines what "decrypt" costs at the access-pattern layer; the legal-audience access pattern determines how often decryption fires under normal operation). Adjudicating them jointly avoids the failure mode where a strong Decision 1 (e.g. AWS KMS) is paired with a weak Decision 2 (e.g. always-permitted within audience) and the combination cancels out the safety property either choice was designed to provide.

This is the inaugural Phase 1 `/safeeval-arch compl:` exercise. Framework friction observations are surfaced in §8 (closure) so the seventh atomic amendment authoring -- when Steven dispatches it -- has empirical evidence to draw from.

## 2. Threat model (shared)

Five threat actors / decryption paths considered. Each has an asymmetric blast radius depending on which encryption scheme and access pattern are in place; the asymmetry is what makes the two decisions interact.

- **Compromised reviewer credential (`analyst` role).** An attacker with valid `analyst` credentials can SELECT from `evaluations` and read sanitized envelopes. They should NOT be able to read unredacted PII. This is the baseline data-track promise from §4.5 of the data-track memo and is unaffected by either decision in this memo -- the `analyst` role lacks the decryption key under all three Decision 1 options and lacks the `pii_reviewer` role required for Decision 2.

- **Compromised application server (process memory or environment).** An attacker with code-execution on the app server can read whatever the app process can read. Under Decision 1, this varies sharply:
  - **AWS KMS (envelope encryption):** the app holds an IAM role, not a key. Decryption requires a per-call KMS request. The attacker can issue decryption requests for the duration of the compromise, but each request is logged in CloudTrail; sustained exfiltration is detectable. The attacker cannot extract the key itself -- it stays inside AWS KMS.
  - **Supabase Vault:** the app server holds the Vault decryption surface as a database connection; transparent to the app layer. The attacker can decrypt any row they can SELECT for the duration of the compromise. No per-call audit trail beyond Postgres query logs (which are not granular by default).
  - **pgcrypto with app-managed keys:** the app holds the keys directly in environment or config. The attacker reads the keys and can decrypt the entire encrypted column, plus any future writes encrypted under the same key, plus any historical backups encrypted under the same key. Single point of failure.

- **Compromised Postgres host (database server compromise).** An attacker who has root on the database server reads the data files directly:
  - **AWS KMS:** the ciphertext is on disk; the key is not. The attacker exfiltrates ciphertext and would need a separate compromise of the app's IAM role to decrypt. The breach is two-step.
  - **Supabase Vault:** the Vault keys live inside Supabase's infrastructure; the boundary between Vault and the rest of the Supabase plane is opaque to the customer. In the worst case, a Supabase-host compromise is also a Vault-key compromise. Single point of failure at the host boundary.
  - **pgcrypto:** the keys live in the app, not in Postgres. A Postgres-only compromise yields ciphertext without keys; the attacker would need a separate app-side compromise to decrypt. The breach is two-step, similar to KMS, but with the caveat that the app-side key surface is weaker.

- **Insider threat at hosting provider.** This is the axis where the three options diverge most:
  - **AWS KMS:** an AWS insider with key-access permission could potentially decrypt. AWS's internal controls are documented and audited (SOC 2, ISO 27001, FedRAMP); the auditor-visible posture is strong.
  - **Supabase Vault:** a Supabase insider with Vault-access permission could potentially decrypt. Supabase's internal controls are less mature than AWS's (Supabase is SOC 2 Type II certified, but the surface area is smaller and the auditor-visible posture is correspondingly thinner). The "your host can decrypt your data" criticism lands here.
  - **pgcrypto:** the hosting provider does not hold keys, so this axis is N/A. The pgcrypto threat model substitutes the app's key-handling discipline for the host's.

- **Compelled legal disclosure (subpoena, regulatory inquiry).** Separate axis from breach. Relevant primarily for Decision 2, not Decision 1. The legal audience is the consumer of unredacted envelopes for chain-of-custody under compelled disclosure. The access pattern (Decision 2) determines whether every legal report counts as a PII access event (auditable) or whether legal-audience access is silently elevated.

The interaction between Decision 1 and Decision 2 is the load-bearing observation: a strong Decision 1 (KMS) with a weak Decision 2 (always-permitted) produces frequent decryption events that drain the KMS audit trail's value; a weak Decision 1 (pgcrypto) with a strong Decision 2 (explicit role check) preserves the access-pattern safety property but leaves the at-rest property weak. The decisions must be made jointly.

## 3. Decision 1 analysis -- encryption-at-rest scheme

Three options carried from data-track §10 Q5. Each evaluated against the §2 threat model and the regulatory framing (GDPR Article 32 "security of processing," SOC 2 CC6.1 "logical and physical access controls," and -- speculatively, if SafeEval ever lands payment-adjacent data -- PCI-DSS Req 3.4 "rendering PAN unreadable").

### 3.1 AWS KMS (envelope encryption via app layer)

**Threat model score.** Strongest separation of key from data. Compromised app: per-decrypt CloudTrail audit; key cannot be extracted. Compromised Postgres host: two-step breach required. Insider threat at hosting provider: AWS's audited posture is the strongest of the three. Compelled disclosure: KMS access events are logged independent of database queries, providing a parallel audit trail.

**Regulatory framing.** Cleanest GDPR Article 32 story (state of the art, separation of duties); aligns with SOC 2 CC6.1 by making logical access to keys distinct from logical access to data; satisfies PCI-DSS Req 3.4 (cryptographic key management) under the AWS KMS managed-key approach if SafeEval ever touches payment data.

**Operational burden.** Requires AWS account commitment; introduces a hard dependency on AWS for the data layer even if SafeEval stays on Supabase for the database. Per-decrypt latency is real but small (single-digit milliseconds typical); the legal audience's report generation will fire it on demand, not at high volume. Key rotation is automated by AWS.

**Portability.** Mixed. AWS KMS is portable in the sense that the customer-VPC commercial path Steven raised earlier would want a customer-managed KMS surface, and KMS-managed envelopes generalize cleanly to any KMS provider (AWS, GCP, Azure, HashiCorp Vault). The portability score is high *across* KMS providers; the cost is the AWS account dependency for the portfolio deployment itself.

**Best at:** key-separation defense, audit-trail granularity, regulatory posture against a hostile auditor, future-proofing against the customer-VPC commercial path.

### 3.2 Supabase Vault

**Threat model score.** Compromised app: vulnerable to sustained exfiltration without per-call audit (only Postgres query logs, not granular by default). Compromised Postgres host: high blast radius -- Vault keys live inside Supabase's infrastructure and the boundary is opaque to the customer. Insider threat at hosting provider: meaningful exposure -- Supabase's audited controls exist but the surface is smaller and the "your host can decrypt your data" criticism is auditor-visible. Compelled disclosure: Vault audit trail is integrated with Supabase's auth surface, not independently controlled.

**Regulatory framing.** GDPR Article 32 is satisfiable but the "state of the art" argument is weaker than KMS (your data host holds your keys). SOC 2 CC6.1 is satisfiable but a sophisticated auditor will flag the lack of key-separation from data host as a control weakness. PCI-DSS Req 3.4 is harder to satisfy -- the standard implicitly assumes the key management surface is separate from the data store, which Vault explicitly is not.

**Operational burden.** Lowest of the three. Vault is transparent at the application layer; the app sees plaintext-on-read and ciphertext-at-rest with no per-call latency overhead. Key rotation is Supabase's responsibility.

**Portability.** Low. If SafeEval ever migrates off Supabase (commercial path, customer-VPC deployment, or simply a host change), the Vault-encrypted columns require re-encryption under a different scheme. The migration cost is real but bounded (a one-time re-encryption pass).

**Best at:** operational alignment with the chosen host, lowest engineering burden, fastest implementation path.

### 3.3 pgcrypto (Postgres extension, app-managed keys)

**Threat model score.** Weakest of the three. Compromised app: total compromise -- keys live in env or config; attacker decrypts everything plus historical backups under the same key. Compromised Postgres host: two-step breach required (ciphertext on host, keys on app), which is better than Vault. Insider threat at hosting provider: N/A in the host-doesn't-hold-keys sense, but the app-side key surface is the substitute attack vector and is operationally weaker than an AWS-managed surface.

**Regulatory framing.** GDPR Article 32 satisfiable in principle but the "app holds the keys in env" pattern is fragile against auditor scrutiny. SOC 2 CC6.1 is satisfiable but the control narrative is "we handle keys carefully" rather than "keys are managed by an audited KMS"; the latter is what a hostile auditor expects. PCI-DSS Req 3.4 is difficult -- key management responsibilities fall on the app, which is exactly the surface PCI-DSS Req 3.4 was written to avoid.

**Operational burden.** Lowest dependency footprint (no AWS account, no Supabase Vault tier). Highest engineering burden -- the app owns key generation, key storage, key rotation, and the rotation procedure. The runbook for key rotation is a real artifact that has to be written and tested; failure to rotate is a residual-risk surface that auditors will flag.

**Portability.** Highest. pgcrypto runs on any Postgres host; no AWS or Supabase dependency. The portability advantage is the strongest part of this option's argument.

**Best at:** portability, dependency minimization, fastest spin-up if SafeEval ever wants to be self-hosted on commodity Postgres.

### 3.4 Recommendation

**AWS KMS** (envelope encryption via app layer), conditional on the explicit recognition that this commits SafeEval to an AWS account dependency for the data layer.

The reasoning is three-fold:

First, the threat model favors KMS most strongly on the axis that matters most for SafeEval's posture: compromised-app blast radius. SafeEval is a Next.js app on Vercel; the app server is the most exposed surface in the deployment. Under pgcrypto, an app compromise yields the entire encrypted corpus; under Vault, it yields whatever the attacker can SELECT during the compromise window; under KMS, it yields whatever the attacker decrypts during the compromise window AND leaves a per-call CloudTrail audit trail that makes sustained exfiltration detectable. The audit trail is what distinguishes "a breach happened" from "a breach happened and we caught it within the first N decryption events."

Second, the regulatory framing favors KMS most cleanly. The GDPR Article 32 "state of the art" language and the SOC 2 CC6.1 "separation of duties" framing both push toward managed-KMS as the default; the auditor-visible posture is the strongest the three options offer. SafeEval is a portfolio AI Trust & Safety system; the posture demonstrated to a hiring reader is part of the artifact's value, and "audited managed-KMS at rest" reads as a stronger compliance-posture commitment than "keys live in env vars" or "Supabase Vault transparently."

Third, the customer-VPC commercial path makes KMS the dominant choice anyway. If SafeEval ever ships into a customer's environment, the customer will want their own KMS -- it is the standard expectation for any B2B Trust & Safety system. Building against KMS now means the customer-VPC variant is a swap of the KMS surface, not a re-architecture of the encryption layer. Building against Vault or pgcrypto now means a re-architecture is required when the commercial path lands.

The cost of this recommendation is the AWS account dependency. SafeEval is on Vercel and (per the data-track memo's likely Q1 adjudication) Supabase, neither of which require AWS. KMS adds a third infrastructure dependency. The cost is acknowledged; the recommendation stands because the threat model and regulatory framing favor KMS strongly enough to justify the extra dependency.

### 3.5 Conditions under which this recommendation revisits

A future `/safeeval-arch compl:` memo should revisit Decision 1 under any of:

- SafeEval's hosting choice changes (e.g. migration off Vercel/Supabase to a non-AWS stack where KMS becomes operationally awkward).
- The customer-VPC commercial path is explicitly ruled out (e.g. SafeEval stays portfolio-only forever), in which case the operational simplicity of Supabase Vault becomes competitive again.
- A new managed-KMS option from the Supabase ecosystem matures (Supabase has hinted at deeper KMS integration; if it ships, the "host doesn't hold keys" argument flips back in Vault's favor without the AWS dependency).
- pgcrypto with HSM-backed key storage (e.g. via a managed Vault-like service that is not Supabase's) becomes feasible. This is the speculative future where pgcrypto recovers its portability advantage without the env-var key-storage weakness.

In all four cases, the revisit is a new memo, not a silent migration. The current decision and its reasoning stay on the record; the future memo names the trigger and supersedes.

## 4. Decision 2 analysis -- legal-audience unredacted envelope access

Two options carried from report-generator §14 Q4. Both evaluated against the §2 threat model and principle of least privilege.

### 4.1 Explicit role check on every legal-audience report

**Mechanism.** Every legal-audience report generation is gated on the caller having the `pii_reviewer` role at request time. If the caller lacks the role, the report generation either fails or generates a redacted-envelope variant; default is fail. Each access is logged to the `pii_access_log` table per the data-track §4.5 spec.

**Principle of least privilege.** Strongly aligned. The role check is the access-control surface; bypassing it for an entire audience class would weaken the safety property that the data-track memo's §4.5 spec is built around. The legal audience is the audience most likely to need unredacted access, but "most likely" is not "every time" -- a legal-audience report for a low-stakes case may not need the unredacted envelope, and the role check is what lets the report generator make that distinction request-by-request.

**Operational cost.** Negligible for SafeEval. Legal reports are episodic (regulatory inquiry, subpoena response, dispute resolution); the per-request gating overhead is a single auth check and a log write. The "operational cost is too high" argument that sometimes justifies always-permitted-within-audience does not apply at SafeEval's traffic volume.

**Auditability.** Strongest. Every legal-audience unredacted access generates a `pii_access_log` entry. Under compelled disclosure (subpoena), the access log is itself a chain-of-custody artifact; under regulatory inquiry, it demonstrates that PII access was gated and audited.

**Failure mode.** A legitimate legal request that arrives without the role provisioned in time produces a degraded report (redacted-envelope variant) rather than the unredacted version the requestor expected. The mitigation is provisioning discipline -- the role is provisioned through the runbook the ops track owns -- and the failure mode is recoverable (re-request after role provisioning).

### 4.2 Always permitted within legal audience

**Mechanism.** Any code path that generates a legal-audience report can decrypt the unredacted envelope; the audience classification IS the access control. Access is logged via the report record itself (which captures the audience plus the timestamp plus the report-prompt hash).

**Principle of least privilege.** Weakly aligned. The argument is that the legal audience is by definition the audience that needs unredacted access, so the role check adds no signal. The counter-argument is that "legal audience" is a coarse-grained classification -- a legal audience report for a routine documentation request is different from a legal audience report for a subpoena response, and the role check is what makes the distinction visible.

**Operational cost.** Lowest. No per-request role check; the report generator's path is unconditional within the legal audience.

**Auditability.** Weaker. The report record captures that a legal-audience report was generated, but the unredacted decryption event is implicit in the report's existence rather than independently logged. Under compelled disclosure, this is still auditable (the report records are the audit trail); under regulatory inquiry, the absence of a separate access-control surface is what an auditor will flag.

**Failure mode.** A compromised report-generator path (e.g. a bug in the audience classification that elevates a non-legal report to legal) yields unredacted access without an additional access-control gate. The blast radius is bounded by the report generator's correctness, which is a thinner safety boundary than an explicit role check provides.

### 4.3 Recommendation

**Explicit role check on every legal-audience report.**

The reasoning is principle-of-least-privilege at negligible operational cost. The "always permitted within audience" option is almost entirely a code-simplicity argument -- it removes one line of auth-check code per report generation -- and the simplicity does not pay for itself when the audience is episodic and the safety property the role check provides is meaningful.

Three specific reasons:

First, the role check is the access-control surface; collapsing it into the audience classification means the audience classification becomes the access-control surface. The audience classification is a routing decision (made by the report generator based on the report request's audience field), not a security boundary; conflating the two means a routing bug becomes a security incident. The role check decouples the routing from the security decision.

Second, the audit trail is materially stronger. The `pii_access_log` table per data-track §4.5 is the artifact a regulator or auditor will request under compelled disclosure or inquiry; collapsing the access into the report record itself makes the auditor's job harder and the system's defensibility weaker. The same observation applies to internal incident response -- if a breach is suspected and the question is "did the attacker pull unredacted envelopes?", the `pii_access_log` is the table that answers the question.

Third, the operational cost is negligible. Legal reports are episodic; the per-request role check adds a single auth lookup and a single log-write. The "operational cost is too high" framing that sometimes justifies always-permitted-within-audience -- valid for high-volume always-on consumer paths -- does not apply here.

The recommendation stands on principle-of-least-privilege grounds and is reinforced by the audit-trail and routing-vs-security-decoupling arguments above.

### 4.4 Conditions under which this recommendation revisits

A future `/safeeval-arch compl:` memo should revisit Decision 2 if:

- Legal-audience report volume becomes high enough that per-request role checks become a real operational burden (e.g. SafeEval ships into a regulated environment with daily legal-audience reports). At that point, the role-check pattern can be replaced by a session-bound elevation pattern (the user elevates once per session, then generates many legal reports under the elevated session) rather than collapsed into always-permitted.
- An auditor or counsel specifically requests a different access pattern (e.g. a contracted regulator requires their own audit trail format that supersedes `pii_access_log`).
- The data-track's two-key access tier changes shape (e.g. the `pii_reviewer` role is split into sub-roles or the per-access logging cadence changes).

## 5. Implementation implications

The two implementation briefs are not yet filed. Both will inherit the Decision 1 and Decision 2 adoptions from this memo when authored.

### 5.1 Data track implementation brief -- inherits from Decision 1

If Decision 1 = AWS KMS (the recommendation), the data-track implementation brief must include:

- AWS account setup and IAM role provisioning. SafeEval does not currently have an AWS account; the brief must include account creation (or specify which existing account is in scope), the IAM role for the Vercel-deployed app, and the KMS key policy that grants the role decrypt-only access (not key-management access).
- The KMS-encrypted-column schema: `raw_input_encrypted` stores the ciphertext envelope (data key wrapped under the KMS key + ciphertext under the data key); the app decrypts via the AWS SDK at access time.
- Key rotation cadence: KMS-managed key rotation (AWS rotates the backing key annually by default; the wrapped data keys do not rotate automatically -- the brief should specify whether re-wrapping is in scope at MVP).
- CloudTrail logging configuration: KMS decrypt events must be captured and either retained in CloudTrail or piped to a longer-term audit log. The brief specifies the retention and access pattern for the audit log.
- Failure mode handling: KMS service unavailability is rare but real; the brief specifies whether unredacted access fails open, fails closed, or has a fallback path. Recommend fail closed.

If Steven adjudicates Decision 1 to a different option (Vault or pgcrypto), the brief inherits the corresponding setup requirements (Supabase project tier for Vault; key storage and rotation procedure for pgcrypto).

### 5.2 Report generator implementation brief -- inherits from Decision 2

If Decision 2 = explicit role check on every legal-audience report (the recommendation), the report generator implementation brief must include:

- An authentication and authorization surface for the report generator. SafeEval does not currently have an auth surface -- the app is portfolio-deployed and has no user accounts. The brief must specify how the `pii_reviewer` role is authenticated at report-generation time. Options: a manual approval gate in the ops runbook (lowest fidelity, defensible for portfolio scale); a session-bound role-elevation surface (medium fidelity, requires an auth layer); a full RBAC system (high fidelity, gates on full user accounts). The brief picks one and names the trade-off.
- The integration with the `pii_access_log` table from the data-track spec. Every legal-audience report generation that triggers unredacted decryption writes a `pii_access_log` entry; the brief specifies the schema fields and the write path.
- The degraded-report-when-role-missing behavior. When a legal-audience report is requested without the `pii_reviewer` role provisioned, the report generator returns either an error or a redacted-envelope variant; the brief picks one (recommend error) and specifies the error contract.

The auth surface question is the load-bearing dependency this recommendation introduces. Open question 6.3 below routes this to Steven.

## 6. Open questions back to Steven

Per the closure-report convention codified as the fifth atomic amendment in `docs/memos/2026-05-24-parallel-cowork-tracks.md` §6, each open question carries an inline `escalation:` field marking the question for routine auto-accept (`default-accept`) or for Steven's adjudication (`route-to-steven`). The three framework-level always-escalate triggers (adversarial-review self-flag, public-artifact materiality, project-boundary crossing) floor the field regardless of architect confidence.

### 6.1 Decision 1 -- adopt AWS KMS for the unredacted-PII column at rest?

`escalation: route-to-steven, reason: encryption-at-rest scheme is a compliance-posture and project-boundary-crossing decision -- the choice commits SafeEval to an AWS account dependency that affects the deployment surface, and signals which regulatory posture SafeEval aspires to demonstrate; the original data-track memo's Q5 carried the same routing for the same reason`.

Recommendation: adopt AWS KMS per §3.4. The threat model favors KMS most strongly on the compromised-app blast radius axis; the regulatory framing favors KMS most cleanly on GDPR Article 32 and SOC 2 CC6.1; the customer-VPC commercial path makes KMS the dominant choice for future-proofing.

### 6.2 Decision 2 -- adopt explicit role check on every legal-audience report?

`escalation: route-to-steven, reason: legal-audience access pattern is a compliance-posture decision -- the choice signals whether access control is the audience classification or a separate surface, which the auditor's framing depends on; the original report-generator memo's Q4 carried the same routing for the same reason`.

Recommendation: adopt explicit role check per §4.3. Principle of least privilege at negligible operational cost; audit-trail materially stronger; routing-vs-security decoupling preserves the safety property the data-track §4.5 spec was built around.

### 6.3 Does SafeEval need a generalized auth surface as a prerequisite for Decision 2 work?

`escalation: route-to-steven, reason: architectural prerequisite question -- if Decision 2 is adopted, the report generator gains a hard dependency on an auth surface SafeEval does not currently have; building that surface is a multi-track scoping decision that affects engineering, ops, and design`.

Recommendation: yes, but at the lightest tier that satisfies Decision 2. The §5.2 implementation implications name three options: a manual ops-runbook approval gate (lowest fidelity), a session-bound role-elevation surface (medium), a full RBAC system (high). Recommend the manual ops-runbook gate at MVP -- it is defensible for portfolio scale, it satisfies the access-control surface requirement, and it does not commit SafeEval to building a full RBAC system before there is a user volume that justifies one. The recommendation is to file a follow-on scoping memo for the auth surface at MVP scope; the report-generator implementation brief depends on that memo's adoption.

### 6.4 Should this memo's adoption block the data-track and report-generator implementation briefs?

`escalation: default-accept, rec: yes -- block both briefs on this memo's adoption`.

Reason: the data-track implementation brief inherits Decision 1 directly (the brief's schema and infrastructure setup differ across the three options); the report-generator implementation brief inherits Decision 2 directly (the brief's auth surface and access-control gate differ across the two options). Filing either brief before this memo adopts produces churn -- the brief is rewritten when the decision lands. Hold both briefs on this memo's adoption.

## 7. Adversarial review (self-applied at draft time per mode C)

### 7.1 Strongest case against Decision 1 (AWS KMS)

The strongest counterargument is that AWS KMS introduces a dependency SafeEval does not need to take on at portfolio scale, and the dependency has a real ongoing cost: the AWS account itself, the IAM role configuration discipline, the CloudTrail retention budget, and the operational mental model the app now requires (the data layer is "Vercel + Supabase + KMS" instead of "Vercel + Supabase"). The threat-model improvement KMS buys over Vault is marginal at portfolio scale -- there are no live customers whose PII is at risk, the corpus is synthetic-fixture-heavy, and the unredacted column is rarely populated. Spending the dependency budget on a regulatory posture for a system that does not have regulated workloads is the textbook over-engineering failure mode.

A second adversarial framing: the customer-VPC commercial path is speculative. The customer-VPC argument carries a lot of weight in §3.4's reasoning, but no commercial customer is named, no customer-VPC deployment is in scope, and no contract requires KMS today. Optimizing for the speculative commercial path mortgages the portfolio deployment to a future that may never arrive. Supabase Vault's operational simplicity is the dominant value at portfolio scale; the migration cost when (if) commercialization happens is bounded and acceptable.

**Refutation.** Both framings are real costs and the memo does not deny them. The refutation is on the audit-trail axis specifically: the compromised-app blast radius under Vault is "everything the attacker can SELECT during the compromise window with no per-call audit." Under KMS, it is "everything the attacker can SELECT and decrypt during the compromise window with a per-call CloudTrail entry." The difference is the audit trail. At portfolio scale, the blast radius difference is small in absolute terms (because the corpus is small); the audit-trail difference is the value KMS buys regardless of scale. The recommendation stands at HOLD with the explicit recognition that the AWS dependency is the cost paid for the audit-trail property.

If the recommendation were overconfident, the right mode-C move would be to downgrade Decision 1 from ACCEPT to PARTIAL ADOPT: adopt KMS as the target state but allow Vault as a transitional state for the portfolio deployment, with a named trigger (commercial path adoption, real customer signing) to migrate. This memo declines to do that -- the migration cost (a one-time re-encryption pass) is real and the cleaner answer is to start at the target state -- but the partial-adopt path is named here for completeness in case Steven prefers the staged migration.

### 7.2 Strongest case against Decision 2 (explicit role check)

The strongest counterargument is that the role check is ceremony without throughput: the legal audience IS the audience that needs unredacted access, and gating on a role that legal-audience reports always require makes the role check a redundant ornament. The operational cost is low, but so is the safety property -- a routing bug in the audience classification (legal vs. T&S vs. reviewer) is the only realistic failure mode the role check protects against, and that bug is better caught by tests on the audience classifier than by a runtime gate on the report generator.

A second adversarial framing: the role check creates a failure mode the always-permitted-within-audience option does not have -- a legitimate legal request without the role provisioned in time produces a degraded report. The failure mode is recoverable (re-request after provisioning), but it is a new failure mode the system pays for, and the cost falls on the legal-audience consumer who is exactly the consumer the system should be optimizing for.

**Refutation.** The "redundant ornament" framing underestimates the audit-trail value. The `pii_access_log` entry per access is the artifact an auditor or regulator will request under compelled disclosure or inquiry; rolling the access into the report record itself makes the audit trail less granular and the system's defensibility weaker. The audit-trail value is not "what does the role check prevent today" -- it is "what does the audit trail let SafeEval prove under a regulatory inquiry or breach investigation." That value persists regardless of whether the role check ever prevents a bad access.

The "failure mode" framing is real and the §4.3 recommendation acknowledges it. The mitigation is provisioning discipline -- the role is provisioned through the ops-track runbook -- and the failure mode is recoverable. The cost is borne by the legal-audience consumer in the rare case where role provisioning is not in place; the value is borne by the system's compliance posture in every case. The trade favors the explicit role check.

If the recommendation were overconfident, the mode-C move would be to downgrade Decision 2 from ACCEPT to PARTIAL ADOPT: adopt the role check, but allow a session-bound elevation pattern (the user elevates once per session, then generates many legal reports under the elevated session) instead of per-request elevation. This memo declines to do that -- the per-request pattern is structurally cleaner and the elevation pattern can be added later without re-architecting -- but the partial-adopt path is named here for completeness.

### 7.3 What mode C can and cannot do here

Per the design-memo-author mode C rule, adversarial review can only downgrade confidence -- ACCEPT -> PARTIAL ADOPT -> DEFER. The adversarial review above does not flip either recommendation; it surfaces the partial-adopt paths for each decision and notes that the memo declines to take them. The recommendations stand at ACCEPT for both Decision 1 and Decision 2, with the conditions-for-revisit in §3.5 and §4.4 as the explicit unblockers for a future amendment.

## 8. Closure

Both decisions are ready for Steven's adjudication; both inherited implementation briefs are blocked on adoption. Implementation gated on Decision 1 and Decision 2 adoption; if Decision 2 is adopted, an auth-surface scoping memo is the prerequisite for the report-generator implementation brief.

### 8.1 Framework friction observations (for the seventh atomic amendment)

This is the first Phase 1 `/safeeval-arch compl:` exercise. Three friction points surfaced during authoring; surfacing them here so the seventh atomic amendment authoring -- when Steven dispatches it -- has empirical evidence:

1. **`docs/memos/compl/` did not exist.** The sec/compl posture memo §6 names the convention but the directory had not been created. The convention was created together with this memo's filing. Recommendation for the seventh amendment: explicitly authorize the architect to create the subdirectory on first use without a separate amendment, OR pre-create both `docs/memos/sec/` and `docs/memos/compl/` as empty directories with a `.gitkeep` at amendment-authoring time so first-use friction is zero. (Recommendation: pre-create; one-line addition to the seventh amendment.)

2. **Pending-brief IDs and memo IDs share a numbering namespace, but the namespace is fragile.** This memo is brief 0068; the upstream memos were assigned IDs 0065, 0066, 0067 at commit time. The shared namespace works today because no two artifacts are claiming the same ID concurrently, but if a pending brief is filed at 0068 while a memo is being authored that also expects 0068, there is a collision risk. The framework does not document how memo IDs are assigned (apparently the next free ID in the shared sequence; the sec/compl posture memo and the data-track and report-generator memos confirm this by claiming 0065/0066/0067 in order). Recommendation for the seventh amendment: codify the shared-namespace rule explicitly ("memo IDs and pending-brief IDs share a single 4-digit sequence; both increment from `find handoff/board -name '*.md' | grep -oE '/0[0-9]{3}' | sort -u | tail -1`"), OR split the namespaces (e.g. memo IDs use 1000-series). (Recommendation: codify the shared-namespace rule; lower-cost than splitting.)

3. **The Q5 / Q4 bundling decision was operator-side, not framework-side.** Steven's brief named the bundling rationale ("they share the same underlying threat model -- unredacted PII access patterns") and the framework supported it without resistance. But the framework does not document when bundling deferred questions into a single follow-on memo is the right move vs. authoring two separate memos. The bundling rationale matters: bundling is justified when decisions share a threat model or a regulatory framing such that an answer to one constrains the answer to the other (as is the case here); bundling is wrong when the decisions are independent and bundling them obscures the reasoning by interleaving two unrelated argument chains. Recommendation for the seventh amendment: add a one-paragraph convention naming when deferred questions bundle into one memo vs. ship as separate memos. The convention is small and lives naturally next to the sec/compl posture memo §6 filing convention.

These three friction points are minor and the Phase 1 framework absorbed them without breaking. The seventh atomic amendment should include them as small hygiene additions; none of them rises to the bar of "Phase 1 doesn't work."

## 9. Decisions-log entry (for docs/policy-spec-v5.0.md section 9)

Not applicable. This memo is compliance-posture scope (architectural decisions about encryption-at-rest scheme and access-control gate), not a FAF-policy decision in the §9 sense (typology / sub-typology / bright-line / threshold / L1/L2/L3 enum / disposition-rule change). The decisions this memo enumerates sit in the compliance-posture layer and do not promote to §9. The data-track and report-generator implementation briefs that inherit these decisions will themselves not promote to §9 either; the §9 surface is FAF policy, not infrastructure choices.

**Open questions enumerated:** 4 (questions 6.1, 6.2, 6.3, 6.4).
**Of which `route-to-steven`:** 3 (Decision 1 adoption, Decision 2 adoption, auth-surface prerequisite).
**Of which `default-accept`:** 1 (block both inherited implementation briefs on this memo's adoption).
