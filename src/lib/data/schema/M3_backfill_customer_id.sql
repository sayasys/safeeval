-- M3: backfill customer_id='self' for any rows missing it
--
-- Spec: docs/memos/2026-05-28-data-track-implementation-spec.md section 9.
-- No-op against the empty portfolio table; lands the convention so any
-- future tenant migration starts from a known-clean state. M1 already
-- declares customer_id NOT NULL DEFAULT 'self', so this is belt-and-
-- suspenders.
--
-- Apply order: requires M1 + M2.
-- Reversible via the DOWN section at the bottom of this file.

UPDATE evaluations
   SET customer_id = 'self'
 WHERE customer_id IS NULL;

-- Defensive: re-assert NOT NULL. Already in place from M1; this is a
-- no-op safeguard against partial reapplications.
ALTER TABLE evaluations
  ALTER COLUMN customer_id SET NOT NULL;

-- DOWN (reversal):
-- No reversal needed. The UPDATE was idempotent and the NOT NULL constraint
-- was already established in M1.
