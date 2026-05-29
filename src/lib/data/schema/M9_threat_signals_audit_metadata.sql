-- M9: extend threat_signals with audit-metadata columns from sec memo section 4.
--
-- Spec: docs/memos/sec/2026-05-28-osint-outbound-data-flow-posture.md section 4
-- "Audit-metadata extension -- new fields on threat_signals rows".
-- OSINT Phase 2 implementation: docs/memos/2026-05-28-osint-monitoring-scoping.md.
--
-- M7 (Phase 1) created threat_signals with the engine's basic columns. The
-- sec memo named three additional fields the implementation spec must land
-- "at the first commit that touches outbound traffic" -- which is OSINT
-- Phase 2 (the live source fetchers). M9 adds the three columns reversibly:
--
--   - fetcher_version (NOT NULL): SHA-256 of the source-module fetcher logic
--     at fetch time. Lets a forensic query answer "what fetcher logic produced
--     this row?" without reconstructing the historical source tree.
--
--   - classifier_prompt_hash (NULLable): SHA-256 of the full classifier prompt
--     (system + user + ontology context) at classification time. NULLable
--     because the column is populated only after classify.ts runs; rows in
--     pending_classification land with NULL here and pick up a hash when the
--     classifier processes them.
--
--   - source_response_hash (NOT NULL): SHA-256 of the raw_payload. Three uses:
--     (a) de-duplication of identical signals across cron cycles,
--     (b) replay -- re-classify without re-fetching, and
--     (c) forensic correlation of multiple signals from one upstream response.
--
-- Apply order: requires M7. The migration runner applies in numeric order so
-- M8 (classifier_edits, independent of threat_signals) does not gate this.
--
-- Default-value note: existing rows in threat_signals predate M9. The Phase 1
-- contract returned [] from every fetcher, so the production table is empty
-- at the time M9 lands. The migration adds the NOT NULL columns with literal
-- '' defaults so any latent test/dev rows accept the new shape; in production,
-- the column receives a real hash on every new write because index.ts
-- fetchAllSources() and normalize() both populate the field unconditionally.
-- The literal-empty-string default is a forensic placeholder, not a value the
-- application code can produce.
--
-- Reversible via the DOWN section at the bottom of this file.

ALTER TABLE threat_signals
  ADD COLUMN fetcher_version TEXT NOT NULL DEFAULT '';

ALTER TABLE threat_signals
  ADD COLUMN classifier_prompt_hash TEXT;

ALTER TABLE threat_signals
  ADD COLUMN source_response_hash TEXT NOT NULL DEFAULT '';

-- Index on source_response_hash for the de-dup use case (a). The ingest path
-- looks up "have we seen this response before?" before writing; a btree index
-- on the SHA-256 column carries that lookup.
CREATE INDEX idx_threat_signals_source_response_hash
  ON threat_signals (source_response_hash);

-- Reversal note: the DOWN block below drops the three columns and the de-dup
-- index. The application no longer reads or writes the columns after rollback;
-- OSINT Phase 2 code degrades to the M7-shape contract (which still works
-- because the TS layer treats the columns as application-layer fields, not
-- DB references).

-- DOWN (reversal):
-- DROP INDEX IF EXISTS idx_threat_signals_source_response_hash;
-- ALTER TABLE threat_signals DROP COLUMN IF EXISTS source_response_hash;
-- ALTER TABLE threat_signals DROP COLUMN IF EXISTS classifier_prompt_hash;
-- ALTER TABLE threat_signals DROP COLUMN IF EXISTS fetcher_version;
