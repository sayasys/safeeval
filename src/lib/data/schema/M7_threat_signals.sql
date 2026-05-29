-- M7: create threat_signals table for the OSINT monitoring subsystem.
--
-- Spec: docs/memos/2026-05-28-osint-monitoring-scoping.md section 3.
-- Sec controls: docs/memos/sec/2026-05-28-osint-outbound-data-flow-posture.md
-- (the audit-metadata extension in sec memo section 4 -- fetcher_version,
--  classifier_prompt_hash, source_response_hash -- is deferred to Phase 2
--  along with the live source fetchers; Phase 1 ships the table shape so
--  the OSINT module's storage contract is locked).
--
-- The threat_signals table sits next to the evaluations table and follows
-- the same 90-day TTL convention. The customer_id column mirrors the
-- evaluations.customer_id pattern: NOT NULL with default 'self' so the
-- single-tenant portfolio deployment is no-op tenant-scoped. M6 (the
-- multi-tenant organization_id FK) has not shipped at the time of this
-- migration, so the column is TEXT rather than UUID FK; a follow-on
-- migration can promote it when M6 lands.
--
-- TTL: 90 days. The aging job (data-track spec section 7.2) deletes rows
-- WHERE observed_at < now() - INTERVAL '90 days'. The threat_signals table
-- is a working surface, not an archive; new-TTP proposals that the
-- architect accepts land in docs/08-v5-ontology.md (the canonical record)
-- and are no longer dependent on the source row. Dismissed and known_ttp
-- rows are by construction not load-bearing and age out cleanly.
--
-- Apply order: standalone; does not depend on M1-M5. The migration runner
-- applies in numeric order.
-- Reversible via the DOWN section at the bottom of this file.

CREATE TABLE threat_signals (
  id                    BIGSERIAL PRIMARY KEY,

  -- Multi-tenancy placeholder; mirrors evaluations.customer_id pattern.
  -- TEXT rather than UUID FK because M6 (organization_id surface) has not
  -- shipped. Default 'self' keeps the single-tenant portfolio deployment
  -- tenant-scoped without a separate insert path. Promote to UUID FK when
  -- M6 lands.
  customer_id           TEXT NOT NULL DEFAULT 'self',

  -- Closed-set source vocabulary mirrors src/lib/osint/types.ts SourceId.
  -- Tier 1 (no auth): the 7 wired sources for Phase 1. Tier 2 entries
  -- (hibp, urlscan, abuseipdb) are reserved in the CHECK so Phase 2's API-
  -- key-required fetchers can write without a follow-on migration. Adding
  -- a new value to either tier is an architect amendment + lockstep gate
  -- per scoping memo section 7 track ownership.
  source                TEXT NOT NULL
    CHECK (source IN (
      -- Tier 1 (wired in Phase 1)
      'ic3', 'ftc', 'cisa_kev',
      'krebs', 'bleeping_computer',
      'reddit_scams', 'reddit_phishing',
      -- Tier 2 (reserved; Phase 2 wires the fetchers)
      'hibp', 'urlscan', 'abuseipdb'
    )),

  -- Closed-set signal-type vocabulary mirrors src/lib/osint/types.ts
  -- SignalType. Each source emits one or more of these; the constraint is
  -- per-row not per-source so a future source can emit multiple types.
  signal_type           TEXT NOT NULL
    CHECK (signal_type IN (
      'bulletin', 'blog_post', 'forum_thread',
      'vendor_advisory', 'breach_record',
      'phishing_url', 'abuse_ip'
    )),

  -- Observation timestamp from the source where available; falls back to
  -- fetched_at when the source does not publish a timestamp (per normalize.ts
  -- logic). Indexed for the dashboard's reverse-chronological listings.
  observed_at           TIMESTAMPTZ NOT NULL,
  fetched_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Source-native payload. JSONB rather than TEXT so the analyst SQL surface
  -- can extract sub-fields without re-parsing. Stored at rest per sec memo
  -- section 3.5 (storage-at-rest is safe; the sanitization requirement
  -- applies at the UI-rendering boundary which is deferred to Phase 3+).
  raw_payload           JSONB NOT NULL,

  -- Normalized fields per src/lib/osint/types.ts NormalizedFields. The
  -- structure mirrors the TS interface byte-for-byte; the database does not
  -- enforce sub-field presence because nullable extraction is by design.
  normalized            JSONB NOT NULL,

  -- Classifier output per src/lib/osint/types.ts ClassificationResult.
  -- NULL until classify.ts runs; the Phase 1 stub writes the
  -- {classification: 'pending_classification', confidence: 0, ...} record
  -- but the column itself is nullable so dormant rows are legible.
  classification        JSONB,

  -- Workflow state machine. Default 'pending_classification' aligns with
  -- the Phase 1 stub's classification verdict; the state machine transitions
  -- per scoping memo section 3 are:
  --   pending_classification -> known_ttp | new_ttp_proposed | dismissed
  --   new_ttp_proposed -> escalated_to_architect -> (dismissed | -- terminal accept --)
  proposal_status       TEXT NOT NULL DEFAULT 'pending_classification'
    CHECK (proposal_status IN (
      'pending_classification',
      'known_ttp',
      'new_ttp_proposed',
      'escalated_to_architect',
      'dismissed'
    ))
);

-- Indexes per the four most-frequent query shapes the OSINT operator hits.

-- Per-source reverse-chronological listings ("show me the latest IC3 signals").
CREATE INDEX idx_threat_signals_source
  ON threat_signals (source);

-- Global reverse-chronological listings ("show me the last 24h of signal").
CREATE INDEX idx_threat_signals_observed_at
  ON threat_signals (observed_at DESC);

-- Proposal-queue scan ("show me everything pending architect adjudication").
CREATE INDEX idx_threat_signals_proposal_status
  ON threat_signals (proposal_status);

-- TTL / aging sweep ("delete WHERE fetched_at < now() - INTERVAL '90 days'").
CREATE INDEX idx_threat_signals_fetched_at
  ON threat_signals (fetched_at);

-- DOWN (reversal):
-- DROP INDEX IF EXISTS idx_threat_signals_fetched_at;
-- DROP INDEX IF EXISTS idx_threat_signals_proposal_status;
-- DROP INDEX IF EXISTS idx_threat_signals_observed_at;
-- DROP INDEX IF EXISTS idx_threat_signals_source;
-- DROP TABLE IF EXISTS threat_signals;
