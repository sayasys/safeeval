// OSINT monitoring subsystem -- Phase 1 type definitions.
//
// Spec: docs/memos/2026-05-28-osint-monitoring-scoping.md
// Sec controls: docs/memos/sec/2026-05-28-osint-outbound-data-flow-posture.md
//
// Phase 1 lands the source-layer scaffolding (one module per Tier 1 source),
// the normalization layer, the LLM-classifier stub, the M7 storage migration,
// and the hardened HTTP fetcher. Real RSS/JSON parsing, the real classifier,
// the daily cron, and Tier 2 API integrations are deferred (Phase 2+).
//
// The type surface below is the contract Phase 2 will fill in -- the source
// modules currently return empty RawSignal arrays but their shape is fixed
// here so Phase 2 wiring lands cleanly. classify.ts likewise returns the
// pending_classification placeholder under the ClassificationResult shape
// the real classifier will emit.

// --- Closed-set vocabularies ----------------------------------------------

// Source identifiers, mirrors the CHECK constraint in M7_threat_signals.sql.
// Phase 1 wires Tier 1 only; Tier 2 entries (hibp, urlscan, abuseipdb) are
// reserved in the migration but not wired here. Adding a source is a code
// change that must pass through the architect amendment workflow per the
// scoping memo section 2.1 closed-set discipline.
export type SourceId =
  | 'ic3'
  | 'ftc'
  | 'cisa_kev'
  | 'krebs'
  | 'bleeping_computer'
  | 'reddit_scams'
  | 'reddit_phishing';

// Signal-type vocabulary per scoping memo section 2.2 ThreatSignal shape.
// CHECK-mirrored in the M7 migration.
export type SignalType =
  | 'bulletin'
  | 'blog_post'
  | 'forum_thread'
  | 'vendor_advisory'
  | 'breach_record'
  | 'phishing_url'
  | 'abuse_ip';

// Workflow state machine column on threat_signals. The five-value vocabulary
// is named in the scoping memo section 3; the closed-set discipline mirrors
// the four-verb disposition vocabulary in the engine. CHECK-mirrored in M7.
export type ProposalStatus =
  | 'pending_classification'
  | 'known_ttp'
  | 'new_ttp_proposed'
  | 'escalated_to_architect'
  | 'dismissed';

// Classifier confidence is a normalized 0.0 - 1.0 score. The Phase 1 stub
// emits 0; the Phase 2 classifier emits a model-derived value.
export type Confidence = number;

// --- Source registry shapes ------------------------------------------------

// Per-source registry entry. Encodes the source identity, the allow-list
// domain(s), and per-source rate-limit / size-cap overrides that the
// http-client wrapper consults at request time. The Source interface is
// the source-module export contract.
export interface SourceConfig {
  // Allow-listed canonical domain(s) for outbound requests from this source.
  // The http-client refuses requests to any host not in this list (per the
  // sec memo section 3.1 default-deny posture).
  allowedDomains: readonly string[];

  // Per-source response-size cap override. Defaults to 1MB (1_048_576) at
  // the http-client layer if undefined. Some bulletin sources (CISA annual
  // reviews) may legitimately exceed 1MB and warrant an explicit override.
  maxResponseBytes?: number;

  // Per-source request-timeout override in milliseconds. Defaults to 10_000
  // (10 seconds) at the http-client layer.
  timeoutMs?: number;
}

// One module per source. Each source-module file exports a Source with id,
// human-readable name, optional config overrides, and a fetch() function
// returning an array of RawSignal records.
export interface Source {
  id: SourceId;
  name: string;
  config: SourceConfig;
  fetch: () => Promise<RawSignal[]>;
}

// --- Signal shapes ---------------------------------------------------------

// Source-native payload before normalization. Carries the raw response body
// (parsed where the source returns JSON; opaque string for HTML/RSS) plus
// the source identifier and the observation timestamp where available.
// observed_at_source is null for sources that do not publish a timestamp;
// normalize.ts then falls back to fetched_at and marks the timestamp
// approximate in the normalized record.
export interface RawSignal {
  source: SourceId;
  signal_type: SignalType;
  observed_at_source: string | null; // ISO 8601 if present in source response
  fetched_at: string;                // ISO 8601, always populated
  payload: unknown;                  // source-native shape
}

// Uniform downstream shape after normalize.ts runs. The normalized.* fields
// are the minimum surface the classifier and the dashboard queries read; the
// raw response stays in raw_payload for analyst replay per the sec memo
// section 4 source_response_hash de-duplication story (deferred to Phase 2).
export interface ThreatSignal {
  source: SourceId;
  signal_type: SignalType;
  observed_at: string;         // ISO 8601 -- from source if present, else fetched_at
  fetched_at: string;          // ISO 8601, always populated
  raw_payload: unknown;        // source-native shape, stored as JSONB
  normalized: NormalizedFields;
}

// The narrow extracted-field surface defined in scoping memo section 2.2.
// Fields the source does not expose are null; the normalize layer never
// invents values.
export interface NormalizedFields {
  title: string | null;
  summary: string | null;
  url: string | null;
  claimed_actor: string | null;        // attacker, ransomware family, etc.
  target_audience: string | null;      // who the source identifies as the target
  mentioned_techniques: string[];      // free-text technique mentions
  mentioned_indicators: string[];      // domains, hashes, IPs, account-handles
  geographic_scope: string | null;     // region or country if named
}

// --- Classification shape --------------------------------------------------

// Phase 1 stub returns:
//   { classification: 'pending_classification', confidence: 0,
//     reasoning: 'Phase 1 stub -- real classifier deferred' }
//
// Phase 2 emits the full classifier output:
//   classification in {'known_ttp','new_ttp_proposed','low_signal_dismissed'},
//   confidence in [0.0, 1.0], reasoning is a 1-3 sentence string.
//
// The Phase 1 placeholder 'pending_classification' aligns with the M7
// proposal_status default; rows written without classify.ts running land
// in pending_classification and stay there until a real classifier runs.
export type ClassificationVerdict =
  | 'pending_classification'    // Phase 1 stub state
  | 'known_ttp'
  | 'new_ttp_proposed'
  | 'low_signal_dismissed';

export interface ClassificationResult {
  classification: ClassificationVerdict;
  confidence: Confidence;
  reasoning: string;
}
