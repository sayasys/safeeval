-- M14: backfill bright_line_indicators + conflicts_with on org_custom_l3_classifiers.
--
-- Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
-- section 5.5 (bright-line indicators) and section 5.6 (conflicts-with).
--
-- WHY THIS IS A BACKFILL, NOT A FEATURE ADDITION.
-- The memo's section 5 enumerates seven definition-flow fields. Fields 1--5
-- (group placement, tag name, definition prose, positive/negative examples) were
-- schematized in M13 (M13_custom_patterns_and_classifiers.sql). Fields 6 and 7 --
-- the two OPTIONAL fields described in prose at memo 5.5 and 5.6 -- were never
-- given columns in M13. The Phase 2 form-implementation session caught the gap
-- and deliberately OMITTED the two form sections rather than build UI that would
-- silently drop the input (there was nowhere to persist it). This migration
-- closes that gap so the deferred fields have a home; the Phase 2 form sections
-- and the persistence-layer validators land alongside it. No new typology, tag,
-- threshold, or bright-line vocabulary is introduced -- those remain
-- architect-owned. This is purely the structural slot the memo always intended.
--
-- WHAT THIS LANDS (memo 5.5 + 5.6):
--   * bright_line_indicators TEXT[] -- phrases that deterministically trigger the
--     tag when present in the input, without invoking the model (memo 5.5). The
--     per-entry shape (length / character set) is validated at the application
--     layer (src/lib/data/custom-patterns/classifiers.ts), not by a column CHECK:
--     a CHECK cannot bound each array element cleanly, and the persistence layer
--     is already the validation source of truth for this table (it validates
--     BEFORE the write so callers get a typed error, per the M13 design note).
--   * conflicts_with TEXT[] -- tag NAMES this classifier is mutually exclusive
--     with (memo 5.6). These are name references, NOT foreign keys: an entry may
--     name a closed-set L3 tag (e.g. 'pig_butchering') OR another org-custom
--     classifier tag, and the closed-set vocabulary is not a table the FK system
--     can reference. The same-group mutual-exclusivity semantics (memo 5.6) are a
--     Phase 4 matching-path concern; this migration only provides storage.
--
-- DEFAULTS ARE EMPTY ARRAYS, so every existing org_custom_l3_classifiers row is
-- unaffected: the NOT NULL DEFAULT '{}' backfills each pre-existing row with an
-- empty array, and no application code path is forced to supply the new fields
-- (the persistence layer defaults them to [] when a caller omits them).
--
-- Apply order: requires M13 (org_custom_l3_classifiers). The migration runner
-- (scripts/run-migrations.js) applies files in numeric prefix order, so M14
-- applies AFTER M13 in every environment.
--
-- Reversible via the trailing DOWN section: dropping the two columns restores the
-- M13 table shape exactly. Any values stored post-apply are lost on DOWN.

ALTER TABLE org_custom_l3_classifiers
  ADD COLUMN bright_line_indicators TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE org_custom_l3_classifiers
  ADD COLUMN conflicts_with TEXT[] NOT NULL DEFAULT '{}';

-- DOWN (reversal):
-- -- Drops the two backfilled columns in reverse add-order, returning
-- -- org_custom_l3_classifiers to its M13 shape. The DOWN path is reserved for
-- -- emergency rollback of an in-progress release, not routine operation.
--
-- ALTER TABLE org_custom_l3_classifiers DROP COLUMN bright_line_indicators;
-- ALTER TABLE org_custom_l3_classifiers DROP COLUMN conflicts_with;
