# Data track scoping -- evaluation persistence + PII sanitization spec

**Status:** draft, recommends-only (memo proposes a new parallel-tracks track and its first artifact; no schema changes, no engine code, no track-framework amendment applied in this commit).
**Date:** 2026-05-28
**Author:** `safeeval-policy` (Cowork), via `safeeval-agents:design-memo-author` (mode A).
**Companion to:** `docs/memos/2026-05-24-parallel-cowork-tracks.md` (parallel-tracks framework; §4 track inventory; §6 dispatch ritual; fifth atomic amendment escalation-field convention), `docs/03-master-policy.md` (FAF policy surface that the persisted evaluations encode), `docs/05-classifier-guidance.md` (reviewer-override surface the persistence story closes the loop on), `docs/07-v5-schema.md` (envelope shape that the persisted row wraps), `src/lib/safeeval-v5.js` (engine that emits the audit-metadata fields the persistence layer indexes on).
**Scope:** scope the addition of a sixth execution track (`data`) to the parallel-tracks framework, and author the data track's first artifact -- a PII sanitization spec -- as the substantive content of this memo. Hosting recommendation, two-tier storage decision, redaction vocabulary, audit trail, two-key access tier, and schema sketch are all in scope. The sixth atomic amendment to the parallel-tracks memo registering the track is NOT in scope -- that is the architect track's job downstream of this memo. The security / compliance track-vs-architect-prefix decision is filed in a separate parallel memo.

## 1. Problem statement

SafeEval's v5 engine emits four audit-metadata fields on every classification -- `stage1_prompt_hash`, `stage2_prompt_hash`, `stage3_prompt_hash`, `stage4_prompt_hash`, plus `cache_key`, `ontology_version`, and `schema_version` -- but the evaluations themselves are not persisted. The audit-metadata fields are shaped exactly like database columns; their presence in the envelope is a long-standing implicit claim that a store would land. No store exists today.

The cost of the gap is concrete and cross-track:

- **Policy track cannot close its loop.** Bright-line firing rates, reviewer-override patterns, and discriminator-boundary success / failure metrics are the empirical signal policy needs to revise the FAF. Today policy revises FAF text against fixtures and case studies -- a closed sample. Without persisted production evaluations, the FAF revision loop is open at the right-hand side: policy ships a change and never sees the population-level effect.
- **Ops track cannot build a reviewer-override loop.** The v5 disposition cascade leaves `human_review` as the most informative disposition for policy learning, but there is no persistence layer to log the reviewer's resolution against the engine's pre-review state. Ops's runbooks describe a reviewer workflow that has no telemetry surface.
- **Fine-tuning corpus does not exist.** The longer-horizon ambition Steven approved is stage-specialized fine-tuning -- a Stage 2 discriminator trained on its own production traffic, a Stage 4 cascade tuned to the reviewer-override distribution. None of that is possible without a persistence layer that has been collecting structured evaluations against a stable schema for months.
- **Hiring-reader artifact is incomplete.** A reader evaluating SafeEval as a portfolio artifact looks at the audit-metadata fields, infers that there's a database somewhere, and finds nothing. The story the audit-metadata fields tell is half-finished.

The proposal is to land a persistence layer behind the existing engine -- a Postgres database that ingests every classification the engine produces, with PII sanitization at the write boundary so the persisted corpus is safe to query, share, and eventually train against. The data track is the carrier for this work: it owns the schema, the migrations, the queries, the dashboards, and the sanitization spec; it is the continuous-throughput counterpart to policy's bursty doc-authoring rhythm.

## 2. Alternatives considered

- **A. MVP (Postgres only, no PII sanitization, no Parquet archive).** Land the persistence story for the portfolio: insertion path stubbed against raw evaluation rows, no redaction layer, no archive tier. Closest to a one-dispatch "land the table" change.
- **B. Compliance-ready (Postgres + PII sanitization spec implemented + redaction log + two-key access tier; no S3 / Parquet archive yet).** The recommended tier. Builds the foundation as if SafeEval were a real product without paying the operational cost of the analytical archive layer until there's a reason for it.
- **C. Full (Compliance-ready + S3 / Parquet archive + analytical queries against archived data + retention / aging job).** The full data lifecycle. Two-tier hot / cold storage; live Postgres ~90 days; archive on S3 + Parquet queried via DuckDB or Athena. Higher ceiling, higher dispatch budget.
- **D. Mongo / Firestore document store.** Schemaless document store keyed on `cache_key`, envelope persisted as a single document. Rejected -- see §3.D.
- **E. No persistence at all (status quo + structured logging only).** Status quo: emit evaluations to stdout / Vercel runtime logs and rely on log retention. Rejected -- see §3.E.
- **F. Skip PII sanitization (persist raw input alongside sanitized envelope).** Rejected -- see §3.F. Persisting raw user input is a compliance non-starter and PII in training data is unrecoverable damage.

## 3. Evaluation

### 3.A MVP (Postgres only, no sanitization)

Cost: low engineering ($25 - $50 dispatch budget for table-creation + insertion-path); high downstream cost when sanitization is bolted on after the corpus exists (every retained row would need to be re-processed, and any row that escaped sanitization before the fix landed is permanent damage to the corpus). Buys: a working persistence demonstration for portfolio purposes within one or two dispatches.

What this costs in FAF terms: nothing immediately; the engine surface is untouched and the persistence layer is a downstream consumer. What it costs in lockstep terms: a new schema surface (`evaluations` table DDL) becomes a sole-writer artifact for the data track, but no existing surface needs lockstep with it on day one -- the table is additive against the engine, not coupled to it.

The fatal objection is compliance-naive shipping. Once a row containing raw user input is on disk, the recovery story is "drop the table and start over." There is no equivalent of `safe_completion` for a corpus that was contaminated at write-time; remediation is destructive. For a portfolio artifact, the demonstration that the team understood this and built the right thing the first time is more valuable than the demonstration that there's a table.

### 3.B Compliance-ready (Postgres + PII sanitization + redaction log + two-key access)

Cost: medium engineering ($75 - $125 dispatch budget; sanitization spec is the heart of the data track's first artifact, plus the insertion-path wiring, plus the access-control split). Buys: a corpus that is safe to query, share with a hiring reader, train against, and -- if SafeEval ever becomes a real product -- ship into a regulated environment.

The key property is that the sanitization spec sits in front of the persistence write, not behind it. Raw input never lands in the persistence layer; reviewers see redacted envelopes by default; raw input is recoverable only through a two-key access tier requiring a `pii_reviewer` role. The threat model is explicit: a compromised analyst credential can read sanitized envelopes (the working corpus) but cannot exfiltrate raw PII (the unredacted column or table). This is the property a hiring reader recognizes as production-grade.

Where this sits in FAF terms: the sanitization layer is in the same architectural position as the engine's `safe_completion` disposition -- a defense-in-depth response to a class of risk that policy cannot fully eliminate by classification alone. The FAF says CONTEXT signals (PII, account-takeover markers, claimed-identity) are part of fraud detection; the sanitization layer says CONTEXT signals are also part of corpus hygiene, and the persisted form differs from the in-flight form by design.

Where this sits in lockstep terms: the sanitization spec is a new surface owned solely by the data track. It does NOT lockstep with `src/lib/safeeval.js` or `src/lib/safeeval-v5.js` -- the engine continues to process raw input; only the persistence write path applies sanitization. This is critical: the engine's correctness depends on seeing the actual input the user submitted; the persistence layer's safety depends on seeing only the sanitized version. The two surfaces are coupled in workflow ordering (engine first, sanitize-and-persist second) but not in schema lockstep.

### 3.C Full (Compliance-ready + S3 / Parquet archive + retention / aging)

Cost: high engineering ($150 - $225 dispatch budget; adds an aging job, an archive schema, a query layer over the archive, and operational concerns about archive retention windows). Buys: a real-product data lifecycle. Live Postgres stays small (only ~90 days of hot evaluations); cold archive is queryable for long-horizon analytics; retention policy is auditable.

The marginal value of Full over Compliance-ready is concentrated in two things: (1) live-DB scale ceiling protection (managed-service free tiers cap row counts; an aging job pushes the ceiling out indefinitely), and (2) the long-horizon fine-tuning corpus (the Parquet archive is the substrate fine-tuning queries against). Both are real, but both are deferrable -- the live DB at expected portfolio traffic (low single-digit evaluations per day at peak) will not approach the free-tier ceiling for years, and the fine-tuning ambition is a separable downstream project that can read from the live DB or a snapshot when it lands.

The cost objection is operational burden before there's an operator. SafeEval has no on-call rotation, no operator, no incident-response pager. An aging job that runs nightly and decides which rows leave Postgres and land in S3 is a piece of infrastructure that fails silently when it fails. For a portfolio project, that is more risk than the marginal value justifies. Compliance-ready is the floor; Full is the ceiling once there's an operator to absorb the burden.

### 3.D Mongo / Firestore document store

Cost: low engineering for the initial land; medium-high cost for everything downstream. Buys: ability to insert without schema constraints, which sounds like a feature but is a defect for SafeEval specifically.

The objection is structural. The v5 envelope is closed-set: `disposition` is one of four verbs, `ontology_version` is a semver string drawn from a small set, `schema_version` is the same, the L1 / L2 / L3 vocabularies are enumerated, the audit-metadata hashes are SHA-256 strings of known length. The envelope is not "documents of unknown shape"; it is structured data with a known schema, exactly the data shape Postgres is designed to handle and exactly the shape document stores incur unnecessary indirection on. Indexing on `(ontology_version, stage2_prompt_hash)` for replay queries is a one-line Postgres composite index; the same query against a Firestore document store requires denormalizing those fields into top-level fields and accepting Firestore's secondary-index limits. Row-level security on a `customer_id` column is a Postgres RLS one-liner; the equivalent in Firestore is application-layer enforcement with no database-side guarantee.

Beyond schema fit, the access-control story is worse. Mongo's role model is coarser than Postgres's; Firestore's is tied to GCP IAM and pushes the two-key access tier from a database concept (a separate column with its own GRANT) into an application-layer concern. The two-key access tier is the load-bearing safety property of the PII sanitization spec; weakening its enforcement surface is exactly the wrong tradeoff.

### 3.E No persistence at all (status quo + structured logging)

Cost: zero immediate engineering. Buys: nothing the policy / ops / fine-tuning ambitions need.

Vercel runtime logs are not a corpus. They have retention limits the project does not control, they are not indexable on the audit-metadata fields, they cannot be queried for "all evaluations where Stage 2's score exceeded 0.6 and Stage 4 dispositioned `human_review`," and they cannot serve as input to a fine-tuning pipeline. Structured logging is observability; it is not persistence in the sense the policy loop and the fine-tuning ambition require. Rejected as a meaningful alternative -- it is the do-nothing option, named for completeness.

### 3.F Skip PII sanitization (persist raw input alongside sanitized envelope)

Cost: zero sanitization-layer engineering. Buys: reviewer ability to see raw input by default. Compliance damage: catastrophic.

The compliance posture matters even for a portfolio project. A hiring reader at a regulated employer (financial services, healthcare, anything covered by GDPR / CCPA / HIPAA) sees a project that persists raw user PII as a red flag, not a feature. The fine-tuning ambition makes the damage permanent: PII that lands in training data is not removable; the model trained on contaminated data is contaminated. The portfolio narrative inverts -- "the team built a fraud-detection system that stored every victim's name and account number in plaintext" is the opposite of the JD signal SafeEval is trying to demonstrate.

Reviewer ability to see raw input is preserved through the two-key access tier (§4.5), not by skipping sanitization. The default query path returns sanitized envelopes; the `pii_reviewer` role returns raw input on a per-row basis with an audit trail. The functionality is preserved; the safety property is preserved; the compliance damage is averted. Rejected.

## 4. PII sanitization spec (the data track's first artifact)

The substantive content of this memo. The spec is a design, not an implementation -- the data track owns the implementation in a downstream dispatch; this memo names the surfaces, the vocabulary, and the safety properties the implementation must respect.

### 4.1 Vocabulary -- what gets redacted

Closed-set vocabulary of PII types the sanitizer recognizes. Each type is named, has a rationale, and has a default detection mechanism. The list is intentionally bounded: types not on the list are not redacted by default; additions go through the data track via the standard atomic-amendment shape (per §6 below).

| Type | Rationale | Default detection |
|------|-----------|-------------------|
| `EMAIL` | Direct PII; appears in nearly every BEC / phishing / romance fraud evaluation. Trivially regex-detectable. | Regex (`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`), high precision. |
| `PHONE` | Direct PII; common in vishing / smishing / elder-fraud evaluations. Multiple formats require regex flexibility (NANP, E.164, common variants). | Regex with per-locale variants; precision lower than email but acceptable. |
| `SSN` | Sensitive identifier; appears in tax-fraud / identity-fraud evaluations. Format-specific regex (`\d{3}-\d{2}-\d{4}` plus unformatted nine-digit). | Regex with format validation; sufficient for explicitly-formatted SSNs, blind to obfuscated variants (acceptable -- the redaction is a corpus-hygiene control, not a detection layer). |
| `CREDIT_CARD` | Sensitive identifier; appears in card-not-present fraud, refund-fraud, account-takeover evaluations. Luhn-checksum-validated regex catches most legitimate card numbers and reduces false positives on long numeric strings that happen to fit the format. | Regex + Luhn checksum. |
| `IBAN` | Sensitive identifier; appears in cross-border BEC / business-account-takeover evaluations. Country-code-prefixed format with checksum. | Regex + IBAN checksum (`mod-97`). |
| `NAME` | Inferential PII; the highest-value redaction for fine-tuning safety (raw names in training data are the canonical contamination case). Detectable only via NER -- regex is structurally inadequate. | NER (Presidio default; see §4.7 for the NER-source escalation). |
| `STREET_ADDRESS` | Sensitive identifier; appears in elder-fraud / package-redirect / utility-fraud evaluations. Detectable via regex on house-number-plus-street-suffix patterns plus NER for structured variants. | Regex + NER (Presidio). |
| `ACCOUNT_NUMBER` | Sensitive identifier; bank account / brokerage account / utility account numbers in fraud evaluations. Format varies by institution and locale; regex covers a narrow subset, NER fills the gap when context labels it (e.g. "account number 12345678"). | Regex + NER (context-based). |
| `OTP_CODE` | Operational risk -- a persisted OTP code from a real evaluation is a credential, not just PII; if the evaluation captured an in-flight 2FA flow, persisting the code is worse than persisting a name. Always redact. | Regex on six-to-eight-digit numeric strings appearing near OTP / 2FA / verification keywords. |

Out-of-scope (named for explicitness): payment-network tokens (PCI-DSS tokenized PANs are not raw PII and do not require redaction; the upstream tokenizer is the safety boundary), browser fingerprints (treated as behavioral signals, not PII, in this scope), IP addresses (operational telemetry, redacted at a separate layer not in this spec).

### 4.2 Where redaction happens -- the PrePersistSanitizer stage

The sanitizer sits between Stage 4 output and the persistence write. It is NOT a new engine stage and does NOT change the engine's classification output. The engine's view of the input is unchanged; the persistence layer's view of the input is sanitized.

The architectural placement matters for two reasons:

1. **The engine's correctness depends on seeing the actual input.** A Stage 2 discriminator that classifies BEC fraud needs to see the actual claimed-identity text, not `<NAME_1> from <EMAIL_1>`; redacting before classification would degrade classifier precision (the discriminator's signal IS in the named entities). The sanitizer must be downstream of all engine stages, not upstream.
2. **The persistence layer's safety depends on never seeing the raw input.** Raw input must never reach the write boundary. The PrePersistSanitizer is the architectural enforcement of this: the persistence-write API accepts only sanitized envelopes; the sanitizer is the sole producer of sanitized envelopes; bypassing the sanitizer means failing to call the persistence-write API.

The flow:

```
user input
    -> Stage 1 (always-on intent screen, sees raw)
    -> Stage 2 (typology discriminator, sees raw)
    -> Stage 3 (sub-typology refinement, sees raw)
    -> Stage 4 (rule cascade + disposition, sees raw)
    -> PrePersistSanitizer (sees raw input + Stage 4 output envelope, emits sanitized envelope + redaction log)
    -> persistence write (writes sanitized envelope + redaction log; raw input lands in two-key column ONLY if §4.5 access tier is enabled)
```

The sanitizer is stateless across evaluations -- it does not accumulate redactions across evaluations or maintain a cross-evaluation entity registry. Co-reference preservation is per-evaluation only (§4.3 below).

### 4.3 Placeholder convention -- deterministic, per-evaluation co-reference

Each redacted entity is replaced with a placeholder of the form `<TYPE_N>`, where:

- `TYPE` is one of the entries in §4.1's vocabulary (`EMAIL`, `PHONE`, `SSN`, etc.).
- `N` is a per-evaluation, per-type sequence number starting at 1, assigned in left-to-right order of first appearance in the evaluation input.

Co-reference is preserved within an evaluation: if the same email address appears three times, all three are replaced with `<EMAIL_1>`. If two distinct emails appear, the first becomes `<EMAIL_1>` and the second becomes `<EMAIL_2>`. The map from raw entity to placeholder is local to one evaluation and is discarded after the sanitized envelope is written.

Why deterministic-with-co-reference matters for downstream review:

- **Reviewers can read the redacted text.** "Please send the wire to <EMAIL_1>. I'll call you at <PHONE_1>. Once you receive, forward to <EMAIL_1>." is readable; "Please send the wire to <REDACTED>. I'll call you at <REDACTED>. Once you receive, forward to <REDACTED>." is not. The co-reference preserves the relational structure (the recipient and the later-mentioned recipient are the same entity), which is exactly the structure a fraud reviewer needs to triage.
- **Fine-tuning data preserves entity structure without exposing entities.** A discriminator trained on sanitized evaluations sees `<EMAIL_1>` as a token; it learns "the entity mentioned here is the same entity mentioned later in the message," which is real signal, without learning any specific email address.
- **Determinism aids replay.** Two identical evaluations produce identical sanitized envelopes, including identical placeholder indices. This means `cache_key` continues to identify identical evaluations after sanitization, which preserves the dedup property that audit-metadata fields encode.

Determinism is bounded: across evaluations, the same raw email maps to different placeholder indices in different evaluations (since the per-evaluation sequence resets). This is intentional -- it prevents an attacker who recovers a sanitized corpus from cross-referencing `<EMAIL_1>` across evaluations to recover an entity identifier. Cross-evaluation entity linkage requires the two-key access tier and is not available from the default query path.

### 4.4 Audit trail -- the `pii_redaction_log` column

Every persisted row carries a `pii_redaction_log` JSONB column with the following shape:

```
{
  "version": "1.0",
  "redactions": [
    { "type": "EMAIL",  "count": 2, "offsets": [12, 89] },
    { "type": "PHONE",  "count": 1, "offsets": [45] },
    { "type": "NAME",   "count": 1, "offsets": [134], "detector": "presidio" },
    { "type": "OTP",    "count": 1, "offsets": [201], "confidence": 0.92 }
  ],
  "total_redactions": 5,
  "sanitizer_version": "1.0"
}
```

Fields:

- `version` -- log schema version, independent of `ontology_version` and `schema_version`. Allows the log shape to evolve without forcing engine-side migrations.
- `redactions[].type` -- type from the §4.1 vocabulary.
- `redactions[].count` -- distinct entities of that type in the evaluation (NOT total occurrences -- co-references collapse to a single entity count).
- `redactions[].offsets` -- character offsets into the original input where the first occurrence of each entity began. Offsets are into the raw input, not the sanitized output; this is the only structurally-necessary leakage of position information and is acceptable because offsets without values are not PII.
- `redactions[].detector` -- optional, names the detector that produced this redaction (`regex`, `presidio`, `regex+luhn`, etc.). Useful for sanitizer-version postmortems.
- `redactions[].confidence` -- optional, NER-only. Records the detector's reported confidence for the redaction, which lets the data track later audit false-positive / false-negative rates without re-processing raw input.

What the log does NOT carry: the redacted content itself. A reviewer who reads the `pii_redaction_log` can see "this evaluation contained 3 emails, 1 phone, and 1 name, at offsets [12, 45, 89, 134, 201]." They cannot recover any of the values from the log alone. The values are recoverable ONLY through the two-key access tier (§4.5).

The log is the load-bearing artifact for sanitizer-quality observability. Without it, the data track has no way to answer "how often does Presidio miss a name?" or "is the email regex producing false positives on URL-like strings?" -- both of which the fine-tuning ambition will eventually require answering.

### 4.5 Two-key access tier for unredacted data

If reviewer escalation ever needs raw input (a `human_review` case where the redactions hide the signal that determines disposition), the raw input must be accessible -- but only behind an access-control boundary that is operationally distinct from the default query path.

Design:

- Raw input lives in a separate column (`raw_input_encrypted` -- BYTEA in the `evaluations` table) OR a separate table (`evaluations_raw` keyed by evaluation id). Either is acceptable; the separate-column shape is operationally simpler and is the recommended default. The two options trade off as follows: separate column is easier to keep in sync with the sanitized row (single insert) but means every row carries the encrypted blob; separate table allows the raw rows to be aggressively pruned without touching the sanitized rows but requires a join on the rare access path.
- The raw column / table is encrypted at rest using a key Postgres does not hold (KMS-managed or equivalent; §10 escalation Q5). The default database role cannot decrypt; only the `pii_reviewer` role can.
- Postgres role-level security policy: `evaluations` is queryable by the `analyst` role with `raw_input_encrypted` excluded (or, in the separate-table shape, `evaluations_raw` is not granted to `analyst`). The `pii_reviewer` role is granted SELECT on the raw column / table, and every access through that role is logged to a separate `pii_access_log` table.
- Access to the `pii_reviewer` role requires a second factor beyond Postgres credentials (in a production deployment, this would be MFA + manager approval; in the portfolio deployment, it is a documented manual-approval step in the runbook the ops track owns).

Threat model:

- *Compromised analyst credential.* An attacker with valid `analyst` credentials can SELECT from `evaluations` and read sanitized envelopes. They cannot decrypt `raw_input_encrypted` because the `analyst` role does not have the decryption key. The blast radius is the sanitized corpus -- which is, by design, not PII.
- *Compromised `pii_reviewer` credential.* An attacker with valid `pii_reviewer` credentials can decrypt and read raw input. The blast radius is the raw input volume that fits in their query window before the audit log triggers an alert; the per-access entry in `pii_access_log` is the detection surface.
- *Compromised Postgres administrator credential.* Out of scope of this spec; the encryption-at-rest scheme is the boundary. If the attacker holds the Postgres admin credential AND the KMS-managed decryption key, they can read raw input; this is a known limitation of any application-layer encryption scheme against a sufficiently-privileged adversary and is acceptable for the portfolio deployment. The §10 Q5 escalation surfaces whether the production-grade variant of this spec should use a TEE or HSM-backed scheme.

The two-key access tier is the architectural promise this spec makes the hiring reader: the sanitizer protects the default query path, AND there is a controlled escape valve for the rare case the default path is insufficient, AND the escape valve does not weaken the default path's safety properties.

### 4.6 What this is NOT -- non-goals

Named for explicitness so the spec's scope is not silently expanded in implementation:

- **NOT a real-time PII firewall in front of the engine.** The engine sees raw input. The sanitizer protects the persistence layer only.
- **NOT a tokenization layer.** Sanitized placeholders are not stable across evaluations. A downstream consumer cannot use `<EMAIL_1>` from evaluation A and `<EMAIL_1>` from evaluation B as the same entity; they are not.
- **NOT a content-moderation layer.** Sanitization redacts PII; it does not redact slurs, threats, or other unsafe-content categories. Those are upstream concerns (Stage 1 / Stage 4 disposition) and downstream concerns (corpus-curation policy for fine-tuning), not sanitizer-layer concerns.
- **NOT a sanitizer of model outputs.** The sanitizer operates on the input side of the evaluation and on the envelope produced by the engine. Stage 4's `safe_completion` response text, if present, follows separate rules under the existing master-policy surface (`docs/03-master-policy.md`); the sanitizer does not modify completion text.

### 4.7 Open question (escalated) -- canonical NER source for name detection

Recommend Presidio (Microsoft, open-source) as the default NER source for `NAME` and `STREET_ADDRESS` detection, with a regex fallback layer for the explicitly-formatted variants the NER may miss. Rationale: Presidio is the de-facto open-source standard for PII detection, ships with reasonable English-language defaults, has a documented confidence-score surface (useful for §4.4's `confidence` field), and avoids the cloud-NER dependency that would surface a data-residency open question (the cloud-NER service sees the raw input before redaction; whether that crossing is acceptable depends on the residency posture, which is out of scope here).

Tradeoff named: Presidio pulls a Python dependency into the persistence-write path. The sanitizer is the only consumer of Presidio; the rest of the project is JavaScript. Two paths handle this: (a) wrap Presidio in a sidecar service the persistence-write path calls; (b) call Presidio via subprocess from the Node persistence-write code. The sidecar is operationally cleaner; the subprocess is simpler for the portfolio deployment. The choice between the two is an implementation detail for the downstream dispatch and is not adjudicated here.

Regex-only fallback is the answer if Presidio is rejected: misses everything not explicitly formatted, accepts the false-negative rate as the price of a JavaScript-only sanitizer. Acceptable for the portfolio deployment if Steven rejects the Python dependency; not acceptable for a production deployment where missed-name fine-tuning contamination is a real concern.

The full escalation entry is in §10.

## 5. Schema sketch -- `evaluations` table DDL

A sketch, not the final DDL. The data track owns the migrations and will refine this through the standard amendment-and-migration workflow downstream of this memo. The sketch is here so the persistence-write shape is concrete enough to evaluate against the sanitization spec.

```sql
CREATE TABLE evaluations (
  id                    BIGSERIAL PRIMARY KEY,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Multi-tenancy placeholder (§10 Q4; recommend day-one inclusion).
  customer_id           TEXT NOT NULL DEFAULT 'safeeval-portfolio',

  -- Sanitized envelope (the engine's output, with PII placeholders applied to
  -- any text fields that may carry raw user input).
  envelope              JSONB NOT NULL,

  -- Audit-metadata fields hoisted out for indexing. These come from the
  -- v5 engine envelope; persistence layer does not compute them.
  cache_key             TEXT NOT NULL,
  ontology_version      TEXT NOT NULL,
  schema_version        TEXT NOT NULL,
  stage1_prompt_hash    TEXT,
  stage2_prompt_hash    TEXT,
  stage3_prompt_hash    TEXT,
  stage4_prompt_hash    TEXT,

  -- Disposition + aggregate score hoisted out for query / dashboard use.
  disposition           TEXT NOT NULL
                          CHECK (disposition IN ('allow','safe_completion','human_review','block')),
  aggregate_score       NUMERIC(4,3),

  -- Sanitization audit trail (§4.4).
  pii_redaction_log     JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Optional raw-input column for the two-key access tier (§4.5).
  -- Encrypted at rest; only the pii_reviewer role can decrypt.
  raw_input_encrypted   BYTEA
);

CREATE INDEX idx_evaluations_created_at
  ON evaluations (created_at DESC);

CREATE INDEX idx_evaluations_disposition_created_at
  ON evaluations (disposition, created_at DESC);

CREATE INDEX idx_evaluations_replay
  ON evaluations (ontology_version, stage2_prompt_hash);

CREATE INDEX idx_evaluations_customer_created_at
  ON evaluations (customer_id, created_at DESC);

-- pg_trgm full-text on the sanitized envelope's text fields, scoped to
-- avoid the raw column (which the analyst role cannot see anyway).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_evaluations_envelope_trgm
  ON evaluations USING gin ((envelope->>'prompt_sanitized') gin_trgm_ops);

-- Row-level security on customer_id (multi-tenancy hook).
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY evaluations_tenant_isolation ON evaluations
  USING (customer_id = current_setting('app.current_customer_id', true));

-- Access-control split: analyst can SELECT but not the encrypted column.
GRANT SELECT (
  id, created_at, customer_id, envelope,
  cache_key, ontology_version, schema_version,
  stage1_prompt_hash, stage2_prompt_hash, stage3_prompt_hash, stage4_prompt_hash,
  disposition, aggregate_score, pii_redaction_log
) ON evaluations TO analyst;

-- pii_reviewer is granted SELECT on the raw column ONLY.
GRANT SELECT (raw_input_encrypted) ON evaluations TO pii_reviewer;

-- Every pii_reviewer SELECT is logged via a trigger to pii_access_log
-- (definition omitted from this sketch; the access-log surface is part of
-- the §4.5 two-key tier and lands with the implementation dispatch).
```

Indexes are chosen to answer the four queries the data track will hit hardest:

- *Recent evaluations dashboard* -- `idx_evaluations_created_at`.
- *Disposition-by-time analysis* -- `idx_evaluations_disposition_created_at`.
- *Prompt-hash replay* (reproduce all evaluations against a specific Stage 2 prompt across a specific ontology version) -- `idx_evaluations_replay`.
- *Per-customer slice* (multi-tenancy hook; not exercised in the portfolio deployment but cheap to add now) -- `idx_evaluations_customer_created_at`.

The schema is intentionally under-normalized: `envelope` carries the full v5 envelope as JSONB, AND the load-bearing fields are hoisted out as columns. Duplication is fine -- the JSONB envelope is the canonical record (and the shape that survives schema migrations of the surrounding columns); the hoisted columns are query-acceleration surface. If the v5 envelope schema changes, the JSONB column captures the new shape automatically; the hoisted columns may need migration but the underlying data is not lost.

## 6. Track ceremony additions -- framework change required

This memo flags the need for the sixth atomic amendment to the parallel-tracks memo. **The amendment itself is NOT authored here -- that is the tracks-architect's job downstream of this memo.** What the amendment needs to cover:

1. **Register the `data` track in §4.** New row in the §4 track inventory with owned artifacts (initial set: `docs/data/**` for spec / schema / migration docs, `db/migrations/**` for migration files, dashboards / query libraries downstream), default skills (initial set: TBD per architect adjudication; `data-schema-author` is a plausible first skill, mirroring `policy-author` for SQL / migrations), and the brief / dispatch flow the track follows.
2. **Add the `data:` prefix to the dispatch-help cheat sheet.** The `safeeval-dispatch:dispatch-help` command's documented prefixes today are `policy:`, `ops:`, `design:`, `qa:`, `orchestrator:`, `arch:`. Adding `data:` extends the shorthand surface.
3. **Add a data-track observational lens to §4.9.** A first sketch (the architect refines): query / dashboard / corpus-hygiene drift -- recurring slow queries, dashboard-widget drift against schema changes, redaction-log statistics shifts that suggest a sanitizer-quality regression, free-tier-ceiling approach warnings. Cadence is per dispatch.
4. **Create the Cowork space "Safeguard Evaluation: Data".** Steven creates the space; the architect's amendment-bounce brief includes the create-space request in its leading-edge content. The first message to the new space is a brief that says "your owned artifact set is the data track scope; your first dispatch is the PII sanitization implementation per the spec in `docs/memos/2026-05-28-data-track-scoping.md`."
5. **Provide a data-track CURRENT file template.** Mirrors the existing per-track CURRENT templates but adapted for data work (migration steps, query-validation steps, dashboard-deployment steps replace doc-edit steps).
6. **Name the first data-track skill candidate.** Recommend `data-schema-author` as the first skill the architect commissions: mirrors `policy-author` for the SQL / migration surface (writes DDL, writes migration files, writes index / constraint reasoning), distinct from the existing `data:*` skills which target query authorship and analysis (`data:write-query`, `data:analyze`) but do not target schema authorship.

The skill naming question is partially adjudicated by the existing `data:*` skill set under `plugin_01VTbvGZYaCVU2CNSvhDCnkg/skills/`: those skills target the *analyst* role (query writing, dashboard building, statistical analysis), and they assume a schema exists. The data *track* needs a complementary skill targeting the *schema-author* role -- the one who writes the migrations and decides what the columns are. That skill does not exist in the existing plugin and is the architect's first scoping job after the amendment.

## 7. Scope tiers

Three concrete tiers. The recommended tier is §7.2 (Compliance-ready).

### 7.1 MVP (not recommended)

Postgres only, no Parquet tier, no PII sanitization (insertion path stubbed against raw input). Lands the persistence story for the portfolio but ships a corpus that is compliance-naive and unrecoverable if the project ever needs to mature.

Dispatch budget: ~$25 - $50 (table creation + insertion-path wiring + a smoke-test dispatch). Lands in roughly one day of dispatch work.

Why this is named at all: completeness, and the off-chance Steven wants the persistence layer landed quickly for a portfolio review and is willing to accept the corpus damage on the theory that the volume in the portfolio window is too low for compliance to matter. The memo's recommendation is to reject this tier on the corpus-hygiene grounds in §3.A even at portfolio scale, but the option is named.

### 7.2 Compliance-ready (recommended)

Postgres + PII sanitization spec implemented per §4 + redaction log per §4.4 + two-key access tier per §4.5. No S3 / Parquet archive yet; the live DB is the only persistence surface, and the data track watches the free-tier ceiling and flags when an archive layer becomes necessary.

Dispatch budget: ~$75 - $125 (table creation + sanitizer implementation including Presidio integration + access-control split + initial dashboard / query library + a verification dispatch). Lands in roughly three to five days of dispatch work.

Why this is the recommendation: it is the "real product foundation" tier. A hiring reader looking at the persistence layer sees a sanitization spec, an access-control split, and an audit trail -- the three properties that distinguish production data infrastructure from a graduate-school project. The marginal cost over MVP is concentrated in the sanitizer implementation, which is also the most portfolio-visible part of the work -- the spec itself (§4 of this memo) is a portfolio artifact independent of whether the implementation lands.

### 7.3 Full

Compliance-ready + S3 / Parquet archive + analytical queries against archived data + retention / aging job. The full data lifecycle.

Dispatch budget: ~$150 - $225 (compliance-ready + aging job + Parquet archive schema + query layer + retention policy documentation + operator runbook). Lands in roughly seven to ten days of dispatch work.

Why this is named but not recommended for adoption now: see §3.C. The marginal value is real (live-DB scale ceiling protection + long-horizon fine-tuning corpus) but is deferrable. The operational burden of an aging job before there's an operator is the cost objection. Adopt Full when (a) SafeEval grows past free-tier limits, or (b) the fine-tuning ambition crystallizes into a dispatch and needs the Parquet substrate, whichever comes first.

## 8. Risks

Five named risks. Each is mitigated by the spec or flagged as a residual concern the data track manages going forward.

**R1. PII detection false negatives.** NER (Presidio) misses entities; regex catches only explicitly-formatted variants. A name written without capitalization, an email obfuscated with `[at]` instead of `@`, a phone number written in words, a non-Western address format -- all can slip through. The corpus accumulates contamination at the false-negative rate of the sanitizer.

Mitigation: §4.4's redaction-log statistics give the data track an observability surface for false-negative rate; periodic sampling audits sanitized rows against raw input (under the two-key access tier) and surfaces missed redactions; the regex layer catches what NER misses on the format-specific entities and vice versa. Residual risk: non-zero false-negative rate is unavoidable; the spec accepts this and treats sanitization as defense-in-depth rather than a complete control.

**R2. Postgres free-tier scale ceiling.** Managed services (Supabase, Neon) cap row counts and database size on their free tiers. Portfolio-scale traffic is low (single-digit evaluations per day at peak) and will not approach the ceiling for years, but the ceiling is not infinite.

Mitigation: monitoring is the data track's responsibility once the table exists; the §6 amendment surfaces this as part of the data-track observational lens. Tier upgrade is one-line on both Supabase and Neon if usage grows. The Full scope tier (§7.3) provides a structural answer to the ceiling via the archive layer.

**R3. Sanitization breaks reviewer ability to triage edge cases.** A reviewer working through a `human_review` disposition needs the signal that determined the disposition; if the determining signal was a specific name or email address, redaction hides it.

Mitigation: §4.5's two-key access tier is the design answer -- reviewers escalate to `pii_reviewer` for the rare case the sanitized view is insufficient. The expected frequency is low (most fraud signal is structural rather than entity-specific), but the escape valve exists.

**R4. Two-tier complexity adds operational burden before there's an operator.** Even Compliance-ready (§7.2) adds operational concerns: the sanitizer needs to be running, Presidio needs to be installed, the encryption keys need to be managed, the access logs need to be reviewed. SafeEval has no on-call rotation today.

Mitigation: most of this is set-and-forget infrastructure in the portfolio context. The encryption-key management is the highest-burden item and is the §10 Q5 escalation. The ops track owns the runbook for sanitizer-quality audits and access-log review; in the absence of a real operator, the cadence is "when the data track surfaces an observation about sanitizer-quality drift," not a scheduled cadence.

**R5. Data track promoted prematurely.** The framework adds a sixth track on the strength of one piece of in-flight work (the persistence layer + sanitization spec). If the persistence layer ships and there is no continuous follow-on work, the track will sit idle -- the framework's §4 covenant is that each track has continuous throughput.

Mitigation: continuous throughput is plausible after the initial land -- query / dashboard authorship, sanitizer-quality audits, fine-tuning corpus curation, archive-tier-readiness watch, migration management as the schema evolves with FAF revisions. The track has more work in front of it than the policy track did at its founding. If the track does sit idle, the framework supports de-promotion (the architect can fold the track's owned artifacts into an adjacent track via a future atomic amendment), which is cheaper than refusing to stand up the track now and discovering six months later that it should have existed.

## 9. Alternatives evaluated -- summary table

For the reviewer reading sections 2-3 quickly: the rejected alternatives, named with one-line reasoning each, indexed against the §3 evaluation.

| # | Alternative | Resolution | Reason |
|---|-------------|------------|--------|
| A | MVP -- Postgres only, no sanitization | Rejected | Compliance-naive corpus is unrecoverable damage; sanitization-after-the-fact does not remediate contaminated training data. See §3.A. |
| B | Compliance-ready -- Postgres + sanitization + two-key tier | **Recommended** | Real-product foundation; marginal cost over MVP is the portfolio-visible part. See §3.B. |
| C | Full -- Compliance-ready + Parquet archive + aging | Deferred | Operational burden before there's an operator; the marginal value is real but the operator gap is the blocker. See §3.C. |
| D | Mongo / Firestore document store | Rejected | Envelope is structured, not document-shaped; access-control story is weaker. See §3.D. |
| E | No persistence + structured logging only | Rejected | Logs are not a corpus; closes neither the policy loop nor the fine-tuning ambition. See §3.E. |
| F | Skip PII sanitization, persist raw input | Rejected | Compliance non-starter; fine-tuning contamination is unrecoverable; the two-key tier preserves reviewer access without skipping sanitization. See §3.F. |

## 10. Open questions for Steven -- escalation field per fifth atomic amendment

Five open questions, each carrying the inline `escalation:` field per the closure-report convention in `docs/memos/2026-05-24-parallel-cowork-tracks.md` §6 (fifth atomic amendment 2026-05-28). Two are `route-to-steven`; three are `default-accept`.

1. *(escalation: default-accept, rec: Supabase)* **Hosting -- Supabase vs. Neon.** Both have free tiers that scale to real usage; both are PostgreSQL. Recommend Supabase because the auth surface + row-level-security integration is tighter than Neon's (Supabase ships RLS-aware client libraries; Neon delegates auth to the application layer). Either choice is reversible (the underlying DB is Postgres in both cases); the choice affects the auth integration but not the schema.

2. *(escalation: route-to-steven, reason: scope-tier decision is a public-artifact materiality trigger per §6.1 #2 -- the persistence layer is hiring-reader-visible once it exists; tier choice determines what the hiring reader sees)* **Scope tier -- Compliance-ready vs. Full.** §7.2 vs. §7.3. The memo recommends Compliance-ready, but Full is a defensible choice if Steven wants the full lifecycle landed in one work plan. The choice affects dispatch budget by ~$75 - $100 and timeline by 4 - 5 days; it does not affect the §4 sanitization spec.

3. *(escalation: default-accept, rec: Presidio + regex fallback)* **NER source -- Presidio vs. regex-only vs. cloud NER.** Recommend Presidio with regex fallback per §4.7. Alternative defenses if Steven rejects: regex-only (lighter dependency, worse false-negative rate; acceptable only for portfolio scale); cloud NER (e.g. AWS Comprehend; lower-dependency but adds a data-residency open question that is out of scope here). The choice affects implementation but not the spec.

4. *(escalation: default-accept, rec: include `customer_id` from day one)* **`customer_id` column from day one or add later.** Recommend day one. Additive at table-creation time is free; retrofitting `customer_id` after the table is in production requires backfilling existing rows and risks introducing a NULL state the RLS policy has to handle. The portfolio deployment uses a single placeholder value (`safeeval-portfolio`) and the multi-tenancy hook lies dormant until a real second tenant exists, at which point the column is already there.

5. *(escalation: route-to-steven, reason: encryption-at-rest scheme touches compliance posture and is a project-boundary-crossing decision per §6.1 #3 -- the choice affects what Steven is willing to demonstrate to a hiring reader as the security-posture artifact)* **Encryption-at-rest scheme for the two-key unredacted column.** §4.5 names KMS-managed encryption as the default but does not specify which KMS. Options: AWS KMS (cheap, ubiquitous, requires AWS account integration); Supabase Vault (if Supabase is chosen in Q1; tightest integration, weakest portability); pgcrypto with application-managed keys (simplest, weakest posture -- keys live in environment variables, which is a step down from the others). Recommendation deferred to Steven because the choice signals which compliance posture SafeEval is aspiring to demonstrate; the spec's safety properties hold under all three but the production-grade variant differs.

**Two `route-to-steven` open questions pause auto-chaining; three `default-accept` proceed with tentative recommendations.**

## 11. Decision

**PARTIAL ADOPT.** Accept the persistence proposal at Compliance-ready scope (§7.2 -- Postgres + PII sanitization spec + redaction log + two-key access tier). Accept the data-track framework addition pending the architect's sixth atomic amendment. Defer Full-tier adoption (§7.3) pending operator availability or fine-tuning-pipeline crystallization, whichever surfaces first.

Specific reasoning:

- *Why Compliance-ready and not MVP.* §3.A's corpus-contamination objection is the load-bearing reason. MVP ships a corpus that cannot be remediated if sanitization is bolted on later; the contamination is permanent. The marginal cost of Compliance-ready over MVP is concentrated in the sanitizer implementation -- which is also the highest-portfolio-value part of the work. Spending the marginal dispatch budget on sanitization is better-leveraged than spending it on a Parquet archive that lies dormant.
- *Why Compliance-ready and not Full.* §3.C's operator-burden objection is the load-bearing reason. The aging job is the operational risk; it fails silently when it fails; SafeEval has no operator to catch a silent failure. Full is a clean follow-on dispatch once there's a reason for it.
- *Why the data track and not architect-prefix asks against an existing track.* The work has its own cadence (continuous throughput once the store exists, vs. policy's bursty doc-authoring rhythm), its own output shape (migrations / queries / dashboards, vs. doc edits), and its own owned-artifact set (the `docs/data/**` + `db/migrations/**` surfaces, neither of which any existing track owns). Standing up a new track is a one-time framework cost ($30 - $50 dispatch budget for the architect's amendment + the Cowork space creation + the first dispatch); the alternative -- forcing the work through architect-prefix asks against an unrelated track -- would distort whichever track absorbed it and would not give the work an artifact-ownership home in §4. The framework's §4 covenant is single-writer ownership; a track is the right shape when there are owned artifacts to assign.
- *Why the architect lands the amendment, not policy.* The amendment is a framework change, which is the architect track's scope per §4.4.6. Policy authors design memos for typology decisions; the architect authors atomic amendments to the parallel-tracks framework. This memo is the design-memo input to the architect; the architect's downstream amendment is a separate artifact.

## 12. Deferred work

- **Sixth atomic amendment to the parallel-tracks memo.** Owned by `tracks-architect`. Inputs: this memo (§6 lists what the amendment must cover). Unblocker signal: Steven accepts §11 decision OR adjudicates §10 questions and confirms the data-track addition.
- **First data-track skill -- `data-schema-author`.** Owned by `skill-creator` (commissioned by the architect). Inputs: the §4 sanitization spec, the §5 schema sketch, the existing `data:*` skill set (to define complementary scope). Unblocker signal: the sixth amendment lands and the data track is stood up.
- **PII sanitization implementation dispatch.** Owned by the new `data` track once stood up. Inputs: this memo's §4 spec, the architect's amendment, the Cowork space creation. Unblocker signal: data track exists and has a CURRENT file.
- **Hosting decision execution (Supabase or Neon).** Owned by the `data` track (the choice is partly Cowork-side per §10 Q1; the execution -- account setup, project creation, database provisioning -- runs in VS Code or the relevant deployment surface). Unblocker signal: §10 Q1 adjudicated.
- **Encryption-at-rest scheme execution.** Owned by the `data` track. Inputs: §10 Q5 adjudication, the hosting decision (the KMS surface depends partly on the host). Unblocker signal: §10 Q5 adjudicated and Q1 executed.
- **Fine-tuning corpus design.** Owned by the `data` track once the persistence layer has accumulated enough volume to make corpus-design questions concrete. This is a much longer-horizon piece of work and is named here to scope it out of the current memo: not in scope, surfaces only after the persistence layer has been running long enough to inform the corpus design choices.
- **Sibling memo on security / compliance track-vs-architect-prefix decision.** Owned by `tracks-architect` (filed in parallel with this memo per Steven's instruction). Not in scope for this memo; named here to mark the parallel work.

## 13. Decisions-log entry (for docs/policy-spec-v5.0.md section 9)

This memo proposes a framework addition (data track) and a data-track artifact (PII sanitization spec), neither of which is a FAF-policy decision in the section 9 sense. **Not applicable** -- no section 9 entry generated by this memo. The data track's first FAF-relevant decision (when one surfaces, e.g. a corpus-curation policy for fine-tuning) would generate a section 9 entry at that time.

## 14. Adversarial review -- strongest case against this memo's conclusion

Per the design-memo-author skill's mode-c affordance and §6.1 #1's adversarial-review-self-flag trigger, this memo records its own strongest counter-argument. The counter is named; it does not flip the decision; it does sharpen what Steven is asked to confirm.

The strongest case against Compliance-ready as the recommended tier is **deferred-operator overconfidence**. The §3.C cost objection rests on the claim that the operator gap blocks Full. But Compliance-ready also has an operator gap -- the sanitizer needs to be running, Presidio needs to be installed, the key-management surface needs to be alive. Compliance-ready has *less* of an operator burden than Full, but it does not have *no* operator burden. The memo's recommendation underweights this by characterizing the residual burden as "set-and-forget."

The honest sharpening: if Steven cannot commit to even the Compliance-ready operator surface (key rotation, sanitizer-version updates, access-log review on the cadence the data track surfaces), the right tier is MVP-with-deferred-sanitization-spec -- not MVP-without-sanitization-spec, but MVP that ships the table with sanitization stubbed out and a documented blocker on the sanitizer dispatch until the operator surface is real. This is a fourth tier the memo did not name and which the adversarial review now does. It is not the recommendation; it is the answer if Steven says "no operator at all, even for the sanitizer."

The §11 decision stands at Compliance-ready, conditional on Steven accepting the residual operator burden. If §10 Q5 (encryption-at-rest scheme) adjudication reveals Steven is not willing to manage the key surface at all, the recovery path is the fourth tier this adversarial review just named, not a silent demotion of Compliance-ready to MVP.
