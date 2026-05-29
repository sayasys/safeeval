# OSINT-driven TTP monitoring -- scoping memo

**Status:** draft, recommends-only (memo proposes; no schema applied, no engine code, no source enumeration committed to the L3 vocabulary, no bright-line additions applied).
**Date:** 2026-05-28
**Author:** `safeeval-policy` (Cowork), via `safeeval-agents:design-memo-author` (mode A).
**Companion to:** `docs/memos/2026-05-24-parallel-cowork-tracks.md` (parallel-tracks framework; §4 track inventory; §6 dispatch ritual; fifth atomic amendment escalation-field convention; seventh atomic amendment sec/compl Phase 1 filing surfaces), `docs/memos/2026-05-28-synthetic-media-detection-scoping.md` (sibling scoping memo -- structure and §-numbering mirrored here), `docs/memos/2026-05-28-data-track-scoping.md` (data track scope and storage-pattern precedent the `threat_signals` table reuses), `docs/memos/2026-05-28-data-track-implementation-spec.md` (Compliance-ready data-track implementation spec the M5 migration joins), `docs/memos/2026-05-28-security-compliance-posture.md` (Phase 1 sec/compl framing the parallel `/safeeval-arch sec:` ask reuses for outbound-data-flow review), `docs/08-v5-ontology.md` (current L1/L2/L3 vocabularies that new TTPs would propose extending), `src/lib/safeeval-v5.js` (engine that produces no OSINT signal today; this memo proposes a separate ingest pipeline that never touches the engine code path), `agents/safeeval-agents/threat-intel-watcher/` (skill the operationalization layer activates as scheduled cadence rather than ad-hoc).
**Scope:** define the OSINT (open-source intelligence) ingest pipeline that closes SafeEval's outer loop -- the threat landscape feeding the L3 vocabulary -- by operationalizing `safeeval-agents:threat-intel-watcher` as a scheduled background system. Source layer (one module per source under `src/lib/osint/sources/`), normalization layer (`src/lib/osint/normalize.ts`), classification layer (`src/lib/osint/classify.ts`), storage (`threat_signals` table as M5 migration on the data track), scraping discipline, three scope tiers, and the commercial-path framing for Tier 3 paid feeds. Steven has locked the framing (option 2 -- operationalize threat-intel-watcher; NOT per-evaluation enrichment or reviewer-decision-support), the source tier composition (Tier 1 + Tier 2 in scope; Tier 3 deferred as commercial path), and the daily cron cadence. Those three are settled; this memo does not re-open them.

## 1. Problem statement

SafeEval today operates entirely reactively on user-submitted prompts. The classifier sees what users type; nothing else. The FAF's L3 vocabulary -- six prompt-mode categories (`method`, `tactic`, `target`, `context_marker`, `overlap`, `risk_marker`) and two conversation-mode categories (`arc`, `cadence`) per `docs/08-v5-ontology.md` -- grows when a human authors an amendment, never when the threat landscape moves. The policy loop is closed within the engine (Stage 1 through Stage 4 cascade, four-verb disposition vocabulary, lockstep validator) but it is open to the outside world. The signal that should keep the L3 vocabulary current -- IC3 monthly bulletins, FTC consumer-alerts, security-vendor blogs, fraud-forum chatter, CISA advisories, breach-corpus signals -- arrives at SafeEval only when someone reads it on their own time and decides to file an amendment brief.

The cost of the gap is concrete:

- **L3 vocabulary lags the threat landscape.** A new pretext that surfaces in IC3's monthly bulletin in May does not enter the `method:` vocabulary until a human writer notices it, reads enough of the bulletin to characterize it, files a brief, and ships an amendment. By the time the L3 entry lands, the pretext has been in the wild for weeks or months; SafeEval's classification of a same-shape user prompt during that gap is structurally weaker than it should be.
- **The policy loop has no outer half.** The inner loop (engine -> evaluation -> ontology) is well-defined and instrumented. The outer loop (threat landscape -> ontology -> engine) does not exist. Policy revisions happen on the back of case-study analyses and reviewer overrides -- closed samples derived from past evaluations rather than the live threat surface. The case-study work (e.g. `docs/policy-reviews/2026-06-case-study-analysis.md`) is excellent at deepening the existing vocabulary; it does not surface new vocabulary the way live intel does.
- **No defensible answer to "how do you know your taxonomy is current?"** A hiring reader at an AI Trust & Safety org expects a portfolio fraud-analysis framework to have an OSINT discipline behind it. The discipline is the answer to that question. The OpenAI threat-intel job description Steven flagged names this discipline explicitly. SafeEval's current answer -- "I check IC3 and FTC manually when I remember" -- is not a discipline.
- **Threat intel becomes a labor-intensive memory task rather than a scheduled system.** Manual threat intel scales linearly with operator attention; scheduled OSINT scales linearly with cron cycles. The framework's `safeeval-agents:threat-intel-watcher` skill exists already as an on-demand invocation; operationalizing it as a scheduled cadence converts the skill from "available if I think to invoke it" to "running by default."

This memo proposes operationalizing the threat-intel-watcher skill as the OSINT ingest layer behind SafeEval. The pipeline pulls daily from public sources, normalizes heterogeneous signals into a uniform `ThreatSignal` shape, runs LLM-assisted classification answering "does this signal indicate a NEW TTP for the L3 vocabulary or one SafeEval already covers," and surfaces new-TTP candidates to the architect track as `route-to-steven` proposals per the fifth amendment escalation-field convention. The classifier never auto-merges into the vocabulary; the architect adjudicates every proposed addition. The portfolio value is the closed-loop policy framework -- inner loop (engine) plus outer loop (OSINT) -- not the cleverness of any single classifier prompt.

The framing line, mirrored from the synthetic-media scoping memo's §6 discipline:

> SafeEval consumes OSINT signal as evidence for L3 vocabulary evolution. SafeEval does not autonomously expand its taxonomy; it surfaces proposals to a human adjudicator and applies new vocabulary only after explicit approval.

## 2. Architecture proposal -- three layers

The pipeline lives in a new directory `src/lib/osint/`, separate from `src/lib/safeeval*.js` (the engine) and `src/lib/data/` (the persistence layer). The OSINT directory is the sole-writer artifact set for the OSINT operationalization work and does not import from the engine or be imported by it -- the only coupling is at the storage layer, where `threat_signals` is a sibling table to `evaluations` per the data-track implementation spec.

```
src/lib/osint/
  sources/
    ic3.ts                 -- FBI IC3 monthly bulletins
    ftc.ts                 -- FTC consumer-alerts RSS
    fbi-cybercrime.ts      -- FBI cybercrime advisories
    cisa-kev.ts            -- CISA Known Exploited Vulnerabilities catalog
    krebs.ts               -- Krebs on Security blog RSS
    bleeping-computer.ts   -- Bleeping Computer blog RSS
    threatpost.ts          -- Threatpost blog RSS
    reddit-scams.ts        -- Reddit r/scams + r/phishing JSON API
    hackernews.ts          -- HackerNews security-tagged stories
    hibp.ts                -- Have I Been Pwned API (Tier 2; breach intel)
    urlscan.ts             -- URLScan.io API (Tier 2; phishing URL analysis)
    abuseipdb.ts           -- AbuseIPDB API (Tier 2; IP reputation)
  normalize.ts             -- heterogeneous source outputs -> uniform ThreatSignal
  classify.ts              -- LLM-assisted "new TTP or known TTP?" classifier
  types.ts                 -- shared types (RawSignal, ThreatSignal, Classification)
  schedule.ts              -- daily-cron orchestrator (calls sources, normalize, classify, write)
  schema/
    005_create_threat_signals.sql   -- M5: threat_signals table + indexes + RLS
    README.md                       -- migration ordering against M1-M4
```

The directory mirrors the data track's layout convention (one module per concern, TypeScript, schema/ subdirectory for SQL migrations). The choice is intentional -- the OSINT pipeline and the data layer share an operational personality (continuous throughput, structured records, schema-bound) and benefit from the same shape.

### 2.1 Source layer (`src/lib/osint/sources/`)

One module per source. Each exports a single function:

```typescript
export async function fetch(): Promise<RawSignal[]>;
```

`RawSignal` carries the source-native payload (HTML, RSS XML, JSON response, scraped-text), the source identifier, and the observation timestamp from the source where available. Sources that publish observation dates (IC3 bulletins, FTC alerts, vendor blog posts) populate `observed_at` from the source's published-at field; sources without explicit timestamps (Reddit threads, HackerNews stories) fall back to the fetch time and flag the timestamp as approximate.

The source-layer modules are intentionally one-file-per-source -- the closed-set discipline of the FAF vocabulary applies here too. A `sources/index.ts` enumerates the active sources at module-export time; adding a source is a code change that goes through the standard amendment workflow. The closed-set property prevents the source list from drifting silently.

Tier 1 sources (no auth) are wired at MVP. Tier 2 sources (free with API key) are wired at the Standard tier. Tier 3 sources (paid commercial) are not wired -- the source-layer modules for Tier 3 do not exist; the commercial-path framing in §6 names which providers would unlock at which customer tier without implying a code path.

### 2.2 Normalization layer (`src/lib/osint/normalize.ts`)

Converts heterogeneous source outputs into a uniform `ThreatSignal` shape:

```typescript
export interface ThreatSignal {
  source: string;              // closed-set source id, see §3
  signal_type: string;         // closed-set: bulletin | blog_post | forum_thread |
                               //   vendor_advisory | breach_record | phishing_url | abuse_ip
  observed_at: string;         // ISO 8601 timestamp (from source; or fetch_time if absent)
  fetched_at: string;          // ISO 8601 timestamp (always present)
  raw_payload: object;         // source-specific native shape, JSONB
  normalized: {                // uniform extracted fields
    title: string | null;
    summary: string | null;
    url: string | null;
    claimed_actor: string | null;        // attacker, ransomware family, etc.
    target_audience: string | null;      // who the source identifies as the target
    mentioned_techniques: string[];      // free-text technique mentions
    mentioned_indicators: string[];      // domains, hashes, IPs, account-handles
    geographic_scope: string | null;     // region or country if named
  };
}
```

The normalized shape is intentionally narrow. The source-specific richness lives in `raw_payload`; the normalized fields are the minimum surface the classification layer needs to answer "is this a new TTP?" and the minimum surface dashboards / queries can run against. Fields that cannot be extracted from a source are nullable; the normalize layer never invents values.

Normalization is pure -- no external calls, no LLM use, no network. Sources -> normalize is deterministic so the same source response produces the same normalized signal on every run. The determinism is load-bearing for cache behavior and for replay-during-debug.

### 2.3 Classification layer (`src/lib/osint/classify.ts`)

LLM-assisted analysis answering the central question: "Does this signal indicate a NEW TTP for the L3 vocabulary, or does it match an existing entry?" The classifier reads `08-v5-ontology.md` as context (the current closed vocabularies for `method`, `tactic`, `target`, `context_marker`, `overlap`, `risk_marker`) and emits a structured proposal record:

```typescript
export interface Classification {
  verdict: 'new_ttp_proposed' | 'known_ttp' | 'low_signal_dismissed';
  confidence: number;                // 0.0 - 1.0
  rationale: string;                 // 1-3 sentences for the architect to read
  proposed_l3: {                     // populated only when verdict = new_ttp_proposed
    category: 'method' | 'tactic' | 'target' |
              'context_marker' | 'overlap' | 'risk_marker';
    value: string;                   // proposed snake_case enum value
    definition: string;              // one-sentence definition matching ontology style
    discriminator: string;           // when it fires vs. similar existing values
    source_evidence: string;         // direct quote / paraphrase from the source
  } | null;
  matched_existing_l3: string[];     // populated when verdict = known_ttp, e.g.
                                     //   ['method:advance_fee_lottery',
                                     //    'context_marker:victim_list_purchased']
}
```

The classifier prompt instructs the model to:

1. Read the ontology context (8-v5-ontology.md §1-§3) so the closed-set vocabulary is in context.
2. Read the normalized signal (title, summary, mentioned_techniques, etc.).
3. Decide whether the signal describes a TTP that already maps cleanly to existing L3 values (one or more), or whether it describes a TTP that is not adequately captured by any existing value. The "adequately captured" judgment is the classifier's central call; the prompt names the bias direction (when in doubt, prefer `known_ttp` over `new_ttp_proposed` -- false positives flood the architect's queue; false negatives are recoverable via the next cycle).
4. If new, propose a specific L3 category + value + definition + discriminator + source evidence. The proposal shape is the same shape an architect amendment would land into the ontology, so the architect can adjudicate without translation cost.
5. Emit `low_signal_dismissed` for signals that are not about TTPs at all (vendor product news, conference announcements, generic security commentary).

The classifier never writes to the L3 vocabulary. The classifier writes to the `threat_signals.classification` JSONB column; `proposal_status` then moves to `new_ttp_proposed`; the architect adjudicates per §7's track-ownership flow. Auto-merge is structurally impossible because there is no code path from the classifier to `08-v5-ontology.md`.

Model choice for the classifier is `claude-haiku-4-5-20251001` (the current Haiku) per §11 open question 2. Haiku is sufficient for the structural classification task (does the signal map to an existing closed-set value or not?); Sonnet is reserved for fallback if Haiku's false-positive rate exceeds the dismissed-rate health threshold named in §12. The cost difference (Haiku is roughly 10x cheaper per token than Sonnet) is load-bearing at OSINT's expected daily ingest volume; running Sonnet by default would burn cost budget on a task Haiku handles adequately.

## 3. Storage -- `threat_signals` table (M5 migration)

A new migration M5 in the data-track schema directory (`src/lib/data/schema/005_create_threat_signals.sql` or `src/lib/osint/schema/005_create_threat_signals.sql`; the colocation question is named at §11 open question 6). The table sits next to `evaluations` and follows the same RLS / role / 90-day-TTL conventions per the data-track implementation spec.

```sql
-- M5: create threat_signals table + indexes + RLS
-- Reversible via the DOWN section at the bottom of this file.

CREATE TABLE threat_signals (
  id                    SERIAL PRIMARY KEY,
  source                TEXT NOT NULL
    CHECK (source IN (
      -- Tier 1
      'ic3', 'ftc', 'fbi_cybercrime', 'cisa_kev',
      'krebs', 'bleeping_computer', 'threatpost',
      'reddit_scams', 'reddit_phishing', 'hackernews',
      -- Tier 2
      'hibp', 'urlscan', 'abuseipdb'
    )),
  signal_type           TEXT NOT NULL
    CHECK (signal_type IN (
      'bulletin', 'blog_post', 'forum_thread',
      'vendor_advisory', 'breach_record',
      'phishing_url', 'abuse_ip'
    )),
  observed_at           TIMESTAMPTZ NOT NULL,
  fetched_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload           JSONB NOT NULL,
  normalized            JSONB NOT NULL,
  classification        JSONB,                              -- NULL until classify.ts runs
  proposal_status       TEXT NOT NULL
    DEFAULT 'pending_classification'
    CHECK (proposal_status IN (
      'pending_classification',
      'known_ttp',
      'new_ttp_proposed',
      'escalated_to_architect',
      'dismissed'
    ))
);

-- Indexes per the four most-frequent query shapes the OSINT operator hits.
CREATE INDEX idx_threat_signals_source_observed_at
  ON threat_signals (source, observed_at DESC);

CREATE INDEX idx_threat_signals_observed_at
  ON threat_signals (observed_at DESC);

CREATE INDEX idx_threat_signals_proposal_status
  ON threat_signals (proposal_status, observed_at DESC);

-- Row-level security inheriting from the data-track convention.
ALTER TABLE threat_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY threat_signals_tenant_isolation ON threat_signals
  USING (true);   -- single-tenant for the portfolio; multi-tenant hook deferred

-- Grants mirror the data-track reviewer / pii_reviewer split: reviewer can read
-- normalized + classification; raw_payload may carry source-side PII (forum
-- handles, breach-record identifiers) so reviewer access excludes it by default.
GRANT SELECT (
  id, source, signal_type, observed_at, fetched_at,
  normalized, classification, proposal_status
) ON threat_signals TO reviewer;

-- pii_reviewer gets the raw_payload column. The two-key escape valve mirrors
-- the data-track Compliance-ready posture; raw_payload contains the source
-- response which may include user-handle PII (reddit usernames, breach-list
-- emails). This is defense-in-depth, not a primary safety property -- public
-- OSINT sources are not GDPR-personal-data in the regulated sense, but the
-- separation preserves the discipline.
GRANT SELECT (raw_payload) ON threat_signals TO pii_reviewer;

-- DOWN (reversal):
-- REVOKE ALL ON threat_signals FROM pii_reviewer;
-- REVOKE ALL ON threat_signals FROM reviewer;
-- DROP POLICY IF EXISTS threat_signals_tenant_isolation ON threat_signals;
-- ALTER TABLE threat_signals DISABLE ROW LEVEL SECURITY;
-- DROP INDEX IF EXISTS idx_threat_signals_proposal_status;
-- DROP INDEX IF EXISTS idx_threat_signals_observed_at;
-- DROP INDEX IF EXISTS idx_threat_signals_source_observed_at;
-- DROP TABLE IF EXISTS threat_signals;
```

A 90-day TTL is applied via a daily `DELETE FROM threat_signals WHERE observed_at < now() - INTERVAL '90 days'` job, matching the data-track convention. The TTL is load-bearing -- threat_signals is a working surface, not an archive; new-TTP proposals that the architect accepts land in `08-v5-ontology.md` (the canonical record) and are no longer dependent on the source row. Signals that age out without being escalated are by construction not load-bearing; the dismissed state captures them before they age out.

The schema fields map directly to the §2.3 `Classification` shape (`classification` column) and §2.2 `ThreatSignal` shape (`source`, `signal_type`, `observed_at`, `fetched_at`, `raw_payload`, `normalized` columns). The `proposal_status` field is the workflow state column; transitions are:

- `pending_classification` (default at insert) -- normalize.ts wrote the row; classify.ts has not run yet (e.g. classify.ts is rate-limited, the row will pick up in the next cron cycle).
- `known_ttp` (terminal) -- classify.ts ran; verdict matches existing L3 vocabulary; the signal is captured for OSINT throughput tracking but is not a candidate for an amendment.
- `new_ttp_proposed` (intermediate) -- classify.ts ran; verdict proposes a new L3 entry; the row is waiting for architect adjudication.
- `escalated_to_architect` (intermediate) -- the operator has surfaced the proposal to the architect track via `route-to-steven`; the architect's adjudication is in flight.
- `dismissed` (terminal) -- classify.ts ran with `low_signal_dismissed`, or the architect adjudicated the proposal as not warranting an amendment.

## 4. Scraping discipline

Critical for the parallel `/safeeval-arch sec:` ask (outbound-data-flow review) and load-bearing for this memo's defensibility. The discipline encodes how SafeEval interacts with the public web in a way that does not damage the third-party sources the pipeline depends on. Six rules:

### 4.1 User-Agent

Every outbound HTTP request carries a descriptive User-Agent string:

```
SafeEval-OSINT-Bot/1.0 (research; contact: <maintainer-email>)
```

The User-Agent is configurable via `OSINT_USER_AGENT` env var so the production deployment can substitute the maintainer email. The User-Agent IS load-bearing -- many sources block undeclared scrapers; declaring identity and providing a contact path is the minimum civility.

### 4.2 robots.txt

The fetcher respects `robots.txt`. Use a robots-aware library (e.g. `robots-parser` for Node) and check `robots.txt` for the source domain before fetching any path. If `robots.txt` disallows the path the source module wants to fetch, the source's `fetch()` function returns an empty array and logs a robots-blocked warning. Sources that disallow scraping in `robots.txt` are NOT in the active source set (see §4.6 ToS posture). The check is at request time, not module-author time -- a source that adds a `robots.txt` disallow after launch must be respected on the next cron cycle.

### 4.3 Rate limits

Per-source rate limit policy:

- **Tier 1 RSS/HTML sources:** max 1 request per source per cron cycle (one cycle per day). The daily cron is sufficient for the signal volume of these sources (IC3 publishes monthly, FTC publishes weekly, blog RSS is daily-or-less). Rate-limiting at 1 request per cycle gives source owners visible-budget headroom against any short-window-burst behavior.
- **Tier 1 forum sources (Reddit JSON API, HackerNews):** Reddit's documented rate limit is 60 requests per minute for OAuth tokens, 10 per minute for anonymous; SafeEval uses authenticated requests scoped to the OSINT bot account and stays well below the limit by fetching one r/scams listing + one r/phishing listing + one HackerNews security-tag listing per cron cycle (3 requests total per cycle).
- **Tier 2 API sources (HIBP, URLScan, AbuseIPDB):** respect each API's documented limits and back off on `429` responses. HIBP's free tier is one request per 1.5 seconds; URLScan's free tier is 60 per minute; AbuseIPDB's free tier is 1000 per day. The OSINT cron uses well under each ceiling per cycle (single-digit requests per source).
- **Burst behavior:** the cron runs once per 24h; the rate-limit budget resets daily. There is no burst surface unless a manual `npm run osint:fetch` invocation is made from a developer workstation. That invocation is documented as developer-only and is rate-limited at the same per-source quota as the cron.

### 4.4 Response caching

Never re-fetch within the same cron window. The source-layer modules cache responses in-memory for the duration of the cron run; sources that publish daily summaries (IC3, FTC) are not re-fetched even if the same module is invoked multiple times within one cycle. Cache invalidation is the start-of-next-cron-cycle event; no time-based expiry within a cycle.

The cache is in-memory only -- no disk persistence, no Redis. The cron run is short (single-digit minutes for the full source set); persistent caching would be overengineered.

### 4.5 No deep crawling

The pipeline fetches the indexed feed surfaces only -- RSS feeds, JSON API endpoints, the front page of bulletin indexes. The pipeline does not follow links into the source's site graph, does not page beyond the first page of any listing, and does not extract subordinate URLs from a fetched page to recursively fetch. The "no deep crawling" rule is enforced by the source-module discipline (each module fetches one well-defined endpoint and stops); a future contributor adding deep-crawl logic must go through the architect amendment flow to do so, which is the same gating bar a new source would have.

### 4.6 ToS posture per source

Enumerated explicitly so the parallel `/safeeval-arch sec:` ask has a starting point:

- **IC3, FTC, FBI cybercrime, CISA KEV:** US government sources. Public-domain content; research use is the intended consumption pattern; no ToS issue.
- **Krebs on Security, Bleeping Computer, Threatpost:** security-vendor blogs. ToS for each permits RSS consumption with attribution; the source modules emit attribution in `normalized.url` so derived artifacts (architect proposals, threat-modeler memos) can credit the source. No ToS issue at the documented consumption pattern.
- **Reddit r/scams + r/phishing:** Reddit's official JSON API. Permitted for research with the documented rate limits per §4.3; SafeEval does NOT scrape the HTML layer of Reddit (which the ToS does restrict). The JSON API is the discriminator -- the source module fetches `https://www.reddit.com/r/scams/new.json?limit=25` (an officially-documented endpoint), not the HTML listing page. The JSON API is consistent with Reddit's API ToS.
- **HackerNews:** Algolia-backed HN Search API or the official HN Firebase API; both are documented research APIs with no ToS restriction at the documented consumption pattern.
- **HIBP, URLScan, AbuseIPDB (Tier 2):** all three publish ToS for their free-tier APIs; each requires API-key registration. SafeEval registers a project-scoped API key per source; the ToS terms are accepted at registration time. No ToS issue at the documented consumption pattern.
- **Sources flagged as off-limits (named for completeness):** any source whose `robots.txt` disallows scraping (none in the current Tier 1 + Tier 2 set, but the rule is enforced per §4.2); any source whose ToS prohibits research use or programmatic access without commercial agreement (none in Tier 1 + Tier 2; relevant for Tier 3 where ToS is part of the commercial path).

The §4 discipline is the load-bearing answer to "is this scraping responsible?" and the input for the parallel sec/compl ask's outbound-data-flow review.

## 5. Three scope tiers

Three tiers, each with a dispatch-count estimate so the work is sized against the existing roadmap. The recommendation is Standard (§5.2).

### 5.1 MVP tier -- 3-5 dispatches

- Tier 1 sources only (~7-10 sources, no API keys needed): IC3, FTC, FBI cybercrime, CISA KEV, Krebs, Bleeping Computer, Threatpost, Reddit r/scams + r/phishing, HackerNews.
- Source layer (~10 modules), normalization layer, storage table (M5 migration).
- MANUAL classification -- no LLM yet; the operator reviews each row in `threat_signals` and toggles `proposal_status` by hand.
- No `classify.ts`; the field stays NULL in the `classification` column.
- No surfacing to architect; the operator runs a manual SELECT to find candidate `new_ttp_proposed` rows.

This tier establishes the loop without the AI surface. The portfolio value is the discipline (scheduled, source-attributed, normalized) without the cleverness (LLM classification, automated proposal routing). MVP is the right tier if the AI Trust & Safety hiring reader cares more about "did you build the OSINT discipline" than "did you build the LLM-augmented investigation surface." Both are defensible portfolio choices; MVP is the cheaper path.

### 5.2 Standard tier (recommended) -- 6-9 dispatches

Everything in MVP, plus:

- Tier 2 sources wired (HIBP, URLScan, AbuseIPDB). API keys provisioned per §4.6 ToS posture.
- `classify.ts` with Haiku-as-default LLM classifier and the structured `Classification` output shape (§2.3).
- Proposal routing: when `proposal_status = new_ttp_proposed` and `classification.confidence > 0.7`, the OSINT cron writes a handoff brief to `handoff/board/pending/NNNN-architect-osint-proposal-<slug>.md` containing the proposal shape and the source evidence; the architect adjudicates via the standard `route-to-steven` flow per the fifth atomic amendment.
- Sanitizer-quality-style observability: dashboard query / scheduled-task surfaces `dismissed_rate_30d` (the fraction of classified signals that the architect dismisses or that classify.ts dismisses outright as low-signal); when `dismissed_rate_30d > 0.6` sustained over two weeks, the OSINT cron pauses classification and the architect's queue receives a "classifier health degraded" notice. See §8 R2 / §9 M2 for the rationale.

This tier is the "AI-augmented investigation" surface. A hiring reader sees scheduled OSINT ingest, LLM-assisted classification with explicit confidence and rationale, structured proposals routed through architect adjudication, and a feedback loop on classifier health. The portfolio value is the closed-loop policy framework end-to-end. The recommendation is this tier because the marginal cost over MVP is concentrated in the classification surface -- which is also the surface that most directly demonstrates the JD signal.

### 5.3 Full tier -- 11-15 dispatches

Everything in Standard, plus:

- Continuous-not-daily cadence: cron cycles run hourly for the high-volume sources (Reddit, HackerNews, blog RSS) and remain daily for the low-volume sources (IC3, FTC, CISA KEV). The continuous cadence is gated on rate-limit headroom (§4.3) and the API-key tier of each source.
- Dedicated reviewer UI for triaging proposals: a web surface at `/osint/triage` listing pending `new_ttp_proposed` rows with side-by-side display of source evidence, classifier rationale, and proposed L3 shape; the reviewer accepts / dismisses / requests-more-context with one click; the action triggers the handoff-brief write or the dismissal write.
- Architect-track dashboard widget surfacing OSINT proposal queue depth in the weekly digest.

The Full tier ships a complete operational system. The cost objection -- the reviewer UI is its own design surface, the continuous cadence is its own ops burden, the dashboard widget is its own design / engineering pair of dispatches -- is real. The Full tier is the right shape only if SafeEval grows to a deployment posture with a dedicated operator (the data-track scoping memo's §3.C operator-gap argument applies symmetrically here). For the portfolio deployment, Standard is the recommended ceiling.

**Recommendation:** Standard (§5.2). The marginal value of Full over Standard is concentrated in the reviewer UI, which is a separable downstream dispatch that can land after Standard ships if the OSINT cadence sustains. Standard is the sweet spot between portfolio visibility and dispatch budget.

## 6. Commercial path -- Tier 3 paid feeds

Tier 3 sources are not implemented in any tier of this memo. They are named here as the commercial path -- the feeds that an Enterprise customer of SafeEval would unlock as part of their tier. The framing is symmetric with the synthetic-media scoping memo's §6 framing: portfolio value is the policy framework around the feed, not the feed itself.

### 6.1 Provider price ranges

Public reporting on these providers' enterprise pricing is approximate; exact pricing is negotiated:

- **RecordedFuture** -- approximately $50K-$150K per year for enterprise threat intelligence access. Strong on financial-crime indicators, dark-web monitoring, and threat-actor attribution. Pricing scales with seat count and feed depth.
- **Flashpoint** -- approximately $30K-$80K per year for the standard enterprise tier. Strong on fraud-forum and dark-marketplace coverage. Pricing tiers depend on coverage breadth (cybercrime-only vs. cybercrime + physical security + risk intelligence).
- **Intel471** -- approximately $50K-$100K per year for enterprise threat intelligence. Particularly strong on financial-crime threat-actor profiles and underground-economy intel. Pricing scales with the number of monitored entities.
- **Mandiant Advantage** -- approximately $40K-$100K per year for the enterprise tier. Strong on nation-state and advanced-persistent-threat coverage; less specialized on financial-crime than the three above but excellent for cross-vector context. Pricing scales with module subscriptions.

The ranges are wide because each provider negotiates per-deployment; the published numbers in security-industry reporting cluster within the bands above. A SafeEval Enterprise customer pricing decision would surface the actual negotiated number; the bands are for memo-time scoping.

### 6.2 Customer tier that unlocks

Per the commercial-path framing in the data-track scoping memo and the broader portfolio narrative, the SafeEval product tier ladder is SaaS -> VPC -> Enterprise. Tier 3 OSINT feeds belong in Enterprise tier alongside fine-tuned models, custom L3 vocabulary extensions, and dedicated reviewer integration. The reasoning:

- **SaaS tier customers** consume SafeEval's default OSINT signal -- Tier 1 + Tier 2 sources via the Standard-tier classification surface. The shared OSINT pipeline serves all SaaS customers from a single ingest cadence.
- **VPC tier customers** get the same OSINT pipeline deployed within their VPC boundary, including the option to add their own private Tier 2 feeds (e.g. customer-internal fraud-team intel) that the classifier consumes alongside the public sources.
- **Enterprise tier customers** unlock Tier 3 paid feeds as a managed integration -- SafeEval handles the feed-vendor relationship, normalizes the Tier 3 signal into the same `ThreatSignal` shape, and routes the higher-confidence proposals to the customer's own architect equivalent. The economics work because the Tier 3 feed cost is amortized across multiple Enterprise customers per provider, and the value the customer extracts is the LLM-augmented investigation surface around the feed rather than the raw feed itself.

The Enterprise-tier framing IS the answer to "would the OSINT pipeline scale?" -- the scaling story is via the customer-tier ladder, not via the portfolio deployment growing its own paid-feed bill.

## 7. Track ownership

The work is cross-cutting; multiple tracks contribute. The ownership map mirrors the parallel-tracks memo §4.4 strict-single-writer convention:

- **Policy** owns the source-tier vocabulary additions (`source`, `signal_type`, `proposal_status` closed sets) as L3-style closed-enum additions in their own SQL/code surface. These are lockstep-verifiable against the M5 migration's CHECK constraints -- if the policy doc enumerates a `source` value that the migration does not allow, the lockstep validator catches the divergence. Policy also owns the documentation in `docs/osint/README.md` (or similar) describing the source set, the ToS posture per source, and the classifier prompt rationale. Policy does NOT own the classifier prompt itself (that's engineering's surface, see below) or the classification verdicts (those land in `threat_signals.classification` as engine-emitted JSONB).
- **Engineering** (via VS Code per the venue boundary) implements the source layer (`src/lib/osint/sources/**`), the normalization layer (`src/lib/osint/normalize.ts`), and the classification layer (`src/lib/osint/classify.ts`). Engineering owns the classifier prompt text as code (not as policy text); changes to the prompt go through the standard VS Code dispatch with lockstep verification against the policy-owned closed-set vocabularies. Engineering also wires the cron platform (§11 open question 3).
- **Data track** stores `threat_signals` via the M5 migration in the data-track schema directory. The data track is the sole writer of the migration; the OSINT operationalization work supplies the DDL via this memo, but the actual migration file and its `schema_migrations` record live in the data track's owned directory per the data-track implementation spec. RLS policies inherit from the data-track convention -- reviewer can read normalized + classification; pii_reviewer can read raw_payload.
- **Architect** adjudicates new-TTP proposals via the `route-to-steven` mechanism per the fifth atomic amendment. The architect track is the single adjudicator for any vocabulary addition; no auto-merge from classifier to ontology is structurally possible (per §2.3). The architect's queue capacity is a real concern (§8 R1); the §9 M1 mitigation surfaces queue depth in the digest.
- **Sec/compl** (in Phase 1 per the seventh atomic amendment, as `/safeeval-arch sec:` and `/safeeval-arch compl:` lenses against the architect track) reviews the outbound-data-flow posture. The parallel `/safeeval-arch sec:` ask firing alongside this memo files under `docs/memos/sec/` per the seventh amendment subdirectory convention; the compl lens may file under `docs/memos/compl/` if a regulatory framing emerges (e.g. if any source's ToS turns out to be jurisdiction-specific in a way that affects EU-resident deployment). The two reviews are recommends-only per §4.8 of the parallel-tracks memo; findings route back to engineering / policy / data via the standard inbox-notification mechanism.

The strict-single-writer property is preserved -- no single file has multiple owners. The OSINT pipeline crosses tracks at the workflow layer (each track's contribution feeds the next), but never at the artifact-ownership layer.

## 8. Risks

Five named risks, each material enough that the §9 mitigations are load-bearing:

**R1: LLM classifier false positives (proposes a "new TTP" that's actually an existing entry).** The classifier reads the closed-set ontology as context, but ontology entries have nuance (the `method:advance_fee_lawyer_fee` vs. `L2:recovery_fraud` discriminator in §3.1's prose-to-label tables is the canonical example of how subtle the boundary can be). The classifier may propose a "new" entry that an architect immediately dismisses as covered by existing values. False-positive load on the architect queue erodes system credibility -- if the architect spends most adjudication time dismissing classifier mistakes, the OSINT surface becomes net-negative value.

**R2: LLM classifier false negatives (misses a genuinely emerging TTP).** The classifier reads each signal in isolation. A new TTP that requires cross-signal pattern recognition (three different sources mentioning the same novel pretext across two weeks) may be classified as `known_ttp` or `low_signal_dismissed` on each individual occurrence. The failure is silent -- the architect's queue stays clean, the threat surface drifts unobserved.

**R3: Source ToS violations or rate-limit breaches.** A misconfigured source module that fetches too frequently, ignores a rate-limit header, or scrapes a path that `robots.txt` disallows could result in an IP ban for the SafeEval deployment, a takedown letter to the maintainer, or a legal-exposure surface that the portfolio deployment is not equipped to handle. The §4 discipline mitigates but does not eliminate -- a future source addition that bypasses the discipline (e.g. a contributor who adds a source without reading the ToS) is the failure mode.

**R4: Source-source divergence (different sources describe the same TTP differently).** FTC and IC3 may describe the same emerging-fraud pretext in different language, with different victim demographics named, and at different reporting cadences. The classifier reading each signal in isolation may emit two different proposals for what is structurally the same TTP, doubling the architect's adjudication load and risking inconsistent vocabulary additions if the architect doesn't catch the duplication. The discriminator question -- "is this a new TTP, or is it the same one I already proposed three rows ago?" -- is harder than the per-signal classification question and is not addressed by the Standard-tier classifier surface.

**R5: Cost creep on Tier 2 API quotas.** HIBP, URLScan, and AbuseIPDB free tiers have documented limits but those limits can change without notice (a free tier may be deprecated, a paid tier may be required for the same volume after a vendor policy change). The pipeline's per-cron usage is well under each ceiling today, but a sustained increase in signal volume (e.g. URLScan results growing as the phishing-URL space grows) could push usage into a paid tier without the operator noticing until the bill arrives.

## 9. Mitigations

Each mitigation is concrete and implementable:

**M1 (against R1, classifier false positives):** The Standard tier explicitly requires architect adjudication on every proposed addition -- no auto-merge, structurally. The `proposal_status` field tracks `dismissed` rate as a signal for classifier health; when `dismissed_rate_30d > 0.6` sustained over two weeks, the OSINT cron pauses classification and the architect's queue receives a "classifier health degraded" notice. The pause is the load-bearing mitigation -- a bad classifier does not silently degrade the architect queue indefinitely. The retuning step (revise the classifier prompt, swap from Haiku to Sonnet, narrow the proposal threshold) lives in the OSINT operator's runbook; the classifier resumes when the operator commits a fix.

**M2 (against R2, classifier false negatives):** Quarterly architect-track audit -- a sampled review of `proposal_status = known_ttp` and `proposal_status = dismissed` rows for the prior quarter to catch missed-new-TTP signals. The audit is scheduled in the architect's recurring cadence (analogous to the proactive compliance posture check per the seventh atomic amendment §3 / §8 M2). False-negative recovery is one cycle delayed but not silent. The audit's threshold for flagging is qualitative (architect reads ~50 dismissed rows, asks "did I miss a pattern?"); a structural metric (e.g. cross-signal-similarity detection) is deferred to Full tier.

**M3 (against R3, ToS / rate-limit breaches):** §4 discipline codified as test fixtures; the source-layer modules carry unit tests that assert User-Agent format, robots.txt respect, and per-source rate-limit ceiling. A future source addition that fails these tests does not pass code review. Additionally, the source-layer index (`sources/index.ts`) requires a one-line ToS-posture comment per source pointing at the §4.6 entry; future contributors must update §4.6 (architect amendment) before adding the source. The two-layer gate (test fixture + architect amendment) makes ToS slippage hard to introduce silently.

**M4 (against R4, source-source divergence):** The Standard tier's classifier prompt instructs the model to check `proposal_status = new_ttp_proposed` rows from the last 30 days as part of its context window (not just the static ontology) -- so a duplicate proposal can self-flag as "matches my prior proposal at row N." The architect adjudication step also includes a recent-proposals review per dispatch (one bullet in the architect's session-start ritual). Cross-signal pattern recognition is not solved at Standard tier; the partial mitigation is to make duplicates visible at the dispatch layer rather than letting them slip silently into the queue.

**M5 (against R5, Tier 2 API cost creep):** Per-source monthly usage is logged to the `threat_signals` table (count of fetches per source per cron cycle); a weekly digest line surfaces the usage trend. When per-source monthly usage exceeds 75% of the documented free-tier ceiling, the OSINT operator's runbook surfaces a "tier-upgrade evaluation" task. The trend monitoring is automatable; the tier-upgrade decision is the operator's. Vendor-policy changes (a free tier being deprecated) are caught by the same trend monitoring -- if the API starts returning `429` at a usage level that was previously fine, the digest surfaces the regression.

## 10. Alternatives evaluated

Four alternatives evaluated. Three rejected for this scope (named with one-line reasoning each); one (option 2) is the chosen path per Steven's locked framing.

- **Manual TTP monitoring (status quo).** Rejected. The operator reads IC3 / FTC / blog RSS on whatever cadence their attention allows, files briefs when something catches their eye, and ships amendments through the standard architect flow. This is the current SafeEval posture. It does not scale: it depends on operator-attention, it is not auditable (no record of what was reviewed and dismissed), and it provides no defensible answer to "how do you keep the L3 vocabulary current?" The cost is permanent under-investment; the recovery path is exactly the proposal this memo makes. Status quo is the do-nothing baseline; rejected for completeness.

- **Per-evaluation OSINT enrichment (option 1).** Rejected for THIS scope; reserved as future feature. The shape: every user evaluation triggers a downstream OSINT lookup (e.g. URLScan against any URL in the prompt, AbuseIPDB against any IP, HIBP against any email). The classifier reads the OSINT enrichment as additional context for the per-evaluation classification. This is a fundamentally different problem -- it is enrichment of user-facing classifications rather than evolution of the L3 vocabulary -- and answers a different question ("does this specific prompt match known-bad indicators?" vs "does the L3 vocabulary need to grow?"). Rejected for THIS scope because: (a) Steven explicitly locked option 2 as the chosen path; (b) per-evaluation enrichment has materially higher cost per evaluation (each evaluation incurs OSINT API calls), which conflicts with the portfolio deployment's free-tier economics; (c) the policy-loop closure (option 2) is the higher-leverage portfolio play because it demonstrates the framework discipline, not just the wrapped-API surface. Reserved for a future scope as a sibling memo; the §11 open question 7 names the sibling-memo trigger.

- **Reviewer-decision-support OSINT (option 3).** Rejected for THIS scope; reserved as future feature. The shape: when a user evaluation lands in `human_review`, the reviewer's UI surfaces OSINT-enriched context (the source's reputation, prior similar evaluations, related ongoing investigations) to inform the reviewer's resolution. Rejected for THIS scope because: (a) Steven explicitly locked option 2; (b) the reviewer surface doesn't exist (SafeEval's current portfolio has no dedicated reviewer UI; reviewer escalation is a future surface itself per the data-track scoping memo's §4.5 two-key access tier discussion); (c) standing up the OSINT layer without a consumer for the reviewer-facing enrichment would produce a half-built integration. Reserved for a future scope; depends on the reviewer-UI surface materializing first.

- **Vendor-only intel feed (skip free tier entirely; start at Tier 3).** Rejected. The shape: skip Tier 1 + Tier 2 sources; pay for one Tier 3 provider (e.g. Flashpoint at ~$30K/yr) and build only the ingest pipeline around the commercial feed. Rejected because: (a) too expensive at MVP scale -- $30K/yr is roughly 1000x the portfolio deployment's hosting cost and does not amortize across any customer base; (b) locks out the portfolio demo -- a hiring reader who clones the repo cannot run the OSINT pipeline because they don't have the vendor credentials; (c) misses the Tier 1 + Tier 2 sources that are precisely the freely-available evidence base a fraud analyst is expected to monitor (the JD signal is "demonstrated discipline against public sources," not "wrote integration against an enterprise feed").

## 11. Open questions for Steven -- escalation field per fifth atomic amendment

Per the closure-report convention codified as the fifth atomic amendment in `docs/memos/2026-05-24-parallel-cowork-tracks.md` §6, each open question carries an inline `escalation:` field marking the question for routine auto-accept (`default-accept`) or for Steven's adjudication (`route-to-steven`). The three framework-level always-escalate triggers (adversarial-review self-flag, public-artifact materiality, project-boundary crossing) floor the field regardless of track confidence.

1. **Source vocabulary final list.** `escalation: default-accept, rec: the 13-source Tier 1 + Tier 2 set named in §3 (ic3, ftc, fbi_cybercrime, cisa_kev, krebs, bleeping_computer, threatpost, reddit_scams, reddit_phishing, hackernews, hibp, urlscan, abuseipdb)`. The list is the obvious-free-source set; additions or removals are downstream operator decisions and do not need pre-implementation adjudication. The closed-set property of the CHECK constraint means future additions go through the standard policy / architect flow regardless of what Steven adjudicates here.

2. **LLM model for classification.** `escalation: default-accept, rec: Claude Haiku (claude-haiku-4-5-20251001) by default; Sonnet as fallback if Haiku's dismissed_rate exceeds 0.6 sustained over two weeks per §9 M1`. Haiku is sufficient for the structural closed-set-matching classification task and roughly 10x cheaper per token than Sonnet at the expected daily ingest volume. The fallback path is structural; the decision does not need to be re-adjudicated to swap.

3. **Daily cron platform.** `escalation: default-accept, rec: Vercel cron (the portfolio deployment already runs on Vercel; cron is a one-line vercel.json addition; no new platform to provision)`. Alternative GitHub Actions cron is equally workable but adds a second-deployment-target surface. The CLAUDE.md notes the project has no `vercel.json` today -- adding one for the cron config is a single-file additive change that does not regress existing deploy posture. The choice is reversible at low cost.

4. **Per-source rate-limit policy.** `escalation: default-accept, rec: the 1-request-per-source-per-cron-cycle rule for RSS/HTML sources (§4.3) and the documented-API-limits-with-back-off rule for API sources`. The rule is the §4 discipline's load-bearing rate-limit clause; the rec is the conservative default. Future adjustments (e.g. allowing higher per-cycle counts for sources with explicit research-friendly API access) are operator decisions per the §9 M3 ToS-posture gate.

5. **Should new-TTP proposals auto-create handoff briefs in `pending/`, or accumulate in the architect's queue for batched review?** `escalation: route-to-steven, reason: affects the architect track's cadence and queue management -- auto-create-brief produces architect work at the rate of OSINT-detection of new TTPs (potentially weekly); batched-review produces architect work at a cadence the architect controls. Two valid choices with materially different effects on the architect's bandwidth.` Recommendation: auto-create-brief with confidence threshold (`classification.confidence > 0.7`) so high-confidence proposals reach the architect with low latency and lower-confidence proposals accumulate in `threat_signals` for batched review on the architect's own cadence. The threshold (0.7) is a starting point; the §9 M1 dismissed-rate metric drives recalibration.

6. **`threat_signals` migration colocation -- under `src/lib/data/schema/` or `src/lib/osint/schema/`?** `escalation: default-accept, rec: under src/lib/osint/schema/ (the OSINT pipeline owns the migration as its first artifact, mirroring how data-track owns the evaluations table; the data track's schema runner picks up M5 from the OSINT directory via the schema/README.md migration-ordering index)`. The data track owns the runner; the OSINT track owns the migration file. Either colocation is workable; the §11 open question 6 confirms the convention.

7. **When does the sibling memo for per-evaluation OSINT enrichment (option 1) become unblocked?** `escalation: default-accept, rec: when the reviewer-UI surface materializes from a separate downstream dispatch (option 3's prerequisite) OR when the SafeEval product moves from portfolio to SaaS posture (which makes per-evaluation enrichment economically defensible)`. The two unblock paths are independent; either is sufficient. Named here so the deferred work in §12 has an explicit trigger rather than being left as "someday."

**One `route-to-steven` (Q5: auto-create-brief vs. batched-review for architect proposals) pauses auto-chaining; six `default-accept` proceed with tentative recommendations.**

## 12. Adversarial review (per design-memo-author mode C)

Required by the design-memo-author skill. The adversarial review can only downgrade confidence; it does not flip the decision.

### 12.1 Strongest case against shipping this

"OSINT signal noise will overwhelm the architect, the LLM classifier will hallucinate new TTPs that don't exist, and SafeEval's L3 vocabulary will become a churning collection of one-off scraper artifacts rather than a thoughtful closed-set ontology."

This is the strongest single argument against the proposal. The L3 vocabulary's value derives from its closed-set discipline; the discriminator tables in `docs/08-v5-ontology.md` (e.g. `method:advance_fee_lawyer_fee` vs `L2:recovery_fraud`, `overlap:secondary_victimization` vs `target:elderly_individual`) work because each closed-set entry is the result of deliberate authorial work to find the right discrimination. An OSINT pipeline that proposes one-off TTPs whenever a fraud forum thread mentions a new pretext threatens to substitute reactive scraping for deliberate authorship. The framework's policy-author skill exists precisely because vocabulary additions are hard; outsourcing the proposal step to a Haiku-class classifier and the dismissal step to architect-queue triage risks shifting authorship from policy-author quality to LLM-classifier quality.

**Refutation:**

- (a) Standard tier explicitly requires architect adjudication on every proposed addition; no auto-merge from classifier to ontology is structurally possible (§2.3 and §7). The architect retains the discrimination-quality bar; the classifier's role is candidate-surfacing, not adjudication.
- (b) The `proposal_status` field tracks `dismissed` rate as a classifier-health signal per §9 M1. When dismissed_rate exceeds 60% sustained over two weeks, classification halts and the operator retunes. The pause is the structural answer to "what if the classifier is bad?" -- a bad classifier does not silently degrade the architect queue indefinitely.
- (c) The alternative (manual monitoring per §10's status-quo alternative) does not scale and is the failure mode the proposal exists to address. The choice is not "perfect OSINT vs imperfect closed-set vocabulary" -- it is "scheduled imperfect OSINT with architect adjudication vs sporadic manual monitoring with no audit trail." The former is auditable and improves with classifier-tuning; the latter is unauditable and depends entirely on operator-attention.

The refutation does not eliminate the risk; it bounds it. The risk decays as the architect's dismissed-rate metric stabilizes and as the classifier prompt is refined against the architect's adjudication corpus.

### 12.2 Strongest case FOR including option (1) or (3) in this scope

"Shipping just option (2) leaves the user-facing OSINT story incomplete -- per-evaluation enrichment (option 1) is what reviewers actually want to see, and reviewer-decision-support (option 3) is what makes OSINT visible at the surface where it matters."

This argues that the policy-loop closure (option 2) is the wrong primary because it is invisible to the user-facing SafeEval surface. A hiring reader visiting `https://safeeval.vercel.app` sees no OSINT signal anywhere; the OSINT pipeline is a background process that affects the L3 vocabulary on a weeks-to-months cadence. The visible surface of the policy framework is reactive on user prompts; OSINT's contribution to it is structural (vocabulary additions over time) rather than per-evaluation.

**Refutation:**

- (a) Reviewer surface doesn't exist. SafeEval has no dedicated reviewer UI; reviewer escalation is a future surface (`human_review` rows accumulate but there is no triage UI). Option 3 (reviewer-decision-support OSINT) requires the reviewer UI as a prerequisite; standing up option 3 in this scope would produce a half-built integration with no consumer.
- (b) Per-evaluation OSINT (option 1) has materially higher per-evaluation cost. Every user evaluation triggers downstream API calls to URLScan, AbuseIPDB, HIBP; the cost-per-evaluation roughly doubles or triples at the portfolio's expected free-tier scale. The portfolio deployment cannot absorb the cost; the SaaS tier could but the SaaS tier doesn't exist yet. The economics work against option 1 at this stage.
- (c) The policy-loop closure (option 2) is the higher-leverage portfolio play -- it demonstrates the framework discipline (the JD signal) end-to-end rather than just the LLM-wrapper surface. A hiring reader who reads the closed-loop architecture in this memo sees the OSINT discipline; a hiring reader who clicks through the live app and sees per-evaluation enrichment sees only the wrapper. The framework discipline IS the differentiator.

Both options (1) and (3) are reserved as future scope per §10's deferred-feature framing. The §11 open question 7 names the unblock triggers explicitly; neither is foreclosed.

### 12.3 Recommended adjustment

The adversarial review **HOLDs** the proposal at Standard scope (§5.2) with the recommended additions:

- The §9 M1 dismissed-rate metric IS the load-bearing protection against the classifier-quality concern. The metric must be in the M5 migration's instrumentation layer from day one (a `dismissed_count` rolling counter per source per 30-day window); the architect amendment that lands the OSINT pipeline must include this metric as part of the dashboard surface, not as a Phase 2 add-on.
- The §9 M4 cross-signal-divergence mitigation (classifier reads recent proposals as context) is acknowledged-imperfect. The Standard tier ships with the partial mitigation; a Full-tier improvement (structural cross-signal-similarity detection) is the right follow-on if the architect's adjudication time on duplicates becomes a measurable cost. The adversarial review does not require structural cross-signal detection at Standard tier; it requires the partial mitigation to be visible.

Neither adjustment changes the §11 decision. The proposal stands at Standard scope with classifier-health observability and recent-proposals context in the classifier prompt as load-bearing components.

## 13. Sequencing dependency

The implementation is gated on three upstream dependencies, two already resolved and one in flight:

- **Data track Phase 2 shipped (already done -- commit `33a6075`).** The M5 migration runs against the data-track schema-migrations runner; the runner exists because the data track has shipped its Phase 2 work. This dependency is satisfied at memo-authoring time.
- **Sec/compl ask resolved (parallel dispatch firing now).** The outbound-data-flow review under `/safeeval-arch sec:` is firing alongside this memo per the seventh atomic amendment Phase 1 framing. Implementation cannot land until that review's findings inform the User-Agent / rate-limit / ToS-posture surface in §4. The sec/compl review's filing target is `docs/memos/sec/<date>-osint-outbound-data-flow.md` (or similar slug); the implementation dispatch consumes its findings before wiring goes to production.
- **Architect track's queue capacity to absorb proposals.** Not a blocker (architect track is currently below capacity) but worth flagging -- the §9 M1 dismissed-rate metric needs to be in the dashboard from day one so the architect's bandwidth is visible. If architect queue depth becomes a sustained concern post-launch, the §11 open question 5 batched-review choice becomes load-bearing.

The third dependency is not gating; the first two are. With both gating dependencies satisfied or in-flight, the OSINT implementation dispatch can land on the data track's next available capacity window.

**Cover-letter angle.** Even at scoping-memo-only stage, this work is concrete evidence of the OSINT discipline gap Steven flagged for the OpenAI threat-intel role. The memo's existence -- structured proposal, named risks with explicit mitigations, closed-loop policy framework framing, scope tiers with dispatch-budget estimates, source-tier discipline, architect adjudication gate -- is the artifact a hiring reader can point at and say "this person operates with the OSINT discipline this role requires." The framing in the cover letter should be "shipping next" rather than "considering" -- the memo is the first dispatch toward the operational system, not a thought experiment about whether to build one.

## 14. Closure

Scoping memo ready. Sec/compl review parallel (firing under `/safeeval-arch sec:` per the seventh atomic amendment Phase 1 framing). Implementation blocked on both landing.

## 15. Decisions-log entry (for docs/policy-spec-v5.0.md section 9)

**Not applicable.** This memo is OSINT-architecture scope, not a FAF-policy decision in the §9 sense (typology / sub-typology / bright-line / threshold / L1/L2/L3 enum / disposition-rule change). The §9 entries will be generated downstream of the OSINT pipeline's operation -- each new-TTP proposal that the architect accepts produces an L3 vocabulary addition that lands in `docs/08-v5-ontology.md` AND a §9 entry via `policy-author`. The decisions this memo enumerates are architecture-shape decisions (scope tier, classifier model, cron platform, queue routing) which sit in the design-memo layer and do not promote to §9.

**Open questions enumerated:** 7 (questions 1 through 7 in §11).
**Of which `route-to-steven`:** 1 (Q5 auto-create-brief vs. batched-review for architect proposals).
**Of which `default-accept`:** 6 (Q1 source list, Q2 classifier model, Q3 cron platform, Q4 rate-limit policy, Q6 migration colocation, Q7 sibling-memo unblock triggers).
