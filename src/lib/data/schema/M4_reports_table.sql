-- M4: create reports table for the report-generator surface
--
-- Spec: docs/memos/2026-05-28-report-generator-implementation-spec.md section 5.
-- Companion to docs/memos/2026-05-28-data-track-implementation-spec.md.
--
-- The reports table holds one row per (evaluation_id, audience,
-- report_prompt_hash) tuple. Each row is the markdown output of the
-- report-generator dispatcher for a specific audience. The hash captures
-- the prompt-side state (defensive prefix + audience body + delimiter
-- declaration); the evaluation row owns the envelope-side state via the
-- FK. Together they form the cache key.
--
-- Cache invalidation story:
--   - Prompt revision (editing a prompts/<audience>.ts file or the shared
--     defensive-framing layer) produces a new report_prompt_hash. Lookup
--     against the old hash misses; the dispatcher regenerates and writes a
--     new row. Old rows age out via the 90-day cascade (the evaluation TTL
--     drags the report TTL behind it).
--   - Engine prompt revision changes the engine envelope's stage*_prompt_hash
--     but does NOT change the report_prompt_hash. Existing report rows for
--     evaluations classified under the old engine stay valid; new evaluations
--     under the new engine produce new envelopes that the dispatcher serves
--     against from scratch.
--   - Ontology amendment that affects a prompt skeleton lands as a prompt
--     revision (path 1). An ontology amendment that leaves the prompts
--     untouched leaves the cache valid, which is correct: the report content
--     does not depend on a typology the prompt does not mention.
--
-- TTL: 90 days inherited via ON DELETE CASCADE on evaluation_id. The
-- data-track's aging job (data-track spec section 7.2) deletes the
-- evaluation row; the cascade reaps the report rows. No separate report-TTL
-- job ships in Phase 2.
--
-- Apply order: requires M1 (evaluations table). M2 / M3 are not
-- dependencies but are applied earlier per numeric order.
-- Reversible via the -- DOWN section at the bottom of this file.

CREATE TABLE reports (
  id                    BIGSERIAL PRIMARY KEY,
  evaluation_id         BIGINT NOT NULL
                          REFERENCES evaluations(id) ON DELETE CASCADE,

  -- Closed-set audience vocabulary. Mirrors the IMPLEMENTED_AUDIENCES export
  -- from src/lib/report-generators/types.ts and docs/08-v5-ontology.md
  -- section 3.14. The end_user slot is reserved in the ontology but not
  -- listed here; the constraint is the DB-side enforcement of the implemented
  -- set. Adding end_user requires the disclosure-policy memo to land first
  -- per the scoping memo deferral.
  audience              TEXT NOT NULL
                          CHECK (audience IN (
                            'reviewer',
                            'trust_safety_lead',
                            'legal',
                            'exec_summary'
                          )),

  -- SHA-256 over the assembled prompt (defensive prefix + delimiter
  -- declaration + audience body). The envelope content is NOT folded into
  -- this hash; the envelope is per-evaluation content and is captured via
  -- the evaluation_id FK.
  report_prompt_hash    TEXT NOT NULL,

  -- Canonical stored form: markdown. PDF / HTML render layers are computed
  -- at request time and not cached separately (re-rendering is cheap).
  markdown              TEXT NOT NULL,

  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  cache_hit_count       INTEGER NOT NULL DEFAULT 0,

  -- Unique cache surface: (evaluation_id, audience, report_prompt_hash).
  -- A prompt revision produces a new hash; a re-generation under the old
  -- hash hits the existing row and increments cache_hit_count via the
  -- writeReportRecord conflict path.
  UNIQUE (evaluation_id, audience, report_prompt_hash)
);

-- Cache lookup hot path. The UNIQUE constraint above already covers
-- (evaluation_id, audience, report_prompt_hash); this composite index is
-- explicit-by-name so the query planner exhibits stable behavior and
-- EXPLAIN output is legible.
CREATE INDEX idx_reports_evaluation_audience_hash
  ON reports (evaluation_id, audience, report_prompt_hash);

-- TTL / aging scans walk generated_at; the descending order matches the
-- aging job's most-recent-first sweep pattern.
CREATE INDEX idx_reports_generated_at
  ON reports (generated_at DESC);

-- Per-audience analytics ("how many legal reports landed this week").
CREATE INDEX idx_reports_audience
  ON reports (audience);

-- DOWN (reversal):
-- DROP INDEX IF EXISTS idx_reports_audience;
-- DROP INDEX IF EXISTS idx_reports_generated_at;
-- DROP INDEX IF EXISTS idx_reports_evaluation_audience_hash;
-- DROP TABLE IF EXISTS reports;
