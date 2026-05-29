// Normalization layer -- heterogeneous source outputs -> uniform ThreatSignal.
//
// Spec: docs/memos/2026-05-28-osint-monitoring-scoping.md section 2.2.
//
// The normalize function is pure: no network, no LLM calls, no clock other
// than the fetched_at value already on the RawSignal. Same input produces
// the same output (per the scoping memo's determinism property for cache
// behavior and replay).
//
// Field-extraction logic is intentionally per-source because each source's
// native payload shape differs. The shared output shape (NormalizedFields)
// is the minimum surface the classifier reads and dashboards query against.
// Source-specific richness stays in raw_payload; nullable fields stay null
// when the source does not expose them (the normalize layer never invents
// values, per scoping memo section 2.2).
//
// Phase 1 implements deterministic extraction logic for known payload
// shapes (the RawSignal.payload is `unknown`; we defensively narrow). The
// source-stub fetchers in Phase 1 return empty arrays, so the production
// hot path through normalize() is dormant until Phase 2 wires real
// fetchers -- but the extraction logic is tested against fixture payloads
// at Phase 1 so the contract is locked.

import {
  NormalizedFields,
  RawSignal,
  SourceId,
  ThreatSignal,
} from './types';

const EMPTY_NORMALIZED: NormalizedFields = {
  title: null,
  summary: null,
  url: null,
  claimed_actor: null,
  target_audience: null,
  mentioned_techniques: [],
  mentioned_indicators: [],
  geographic_scope: null,
};

// Public entry point. Source-specific extraction lives in the per-source
// helpers below; this dispatcher routes on raw.source.
export function normalize(raw: RawSignal): ThreatSignal {
  const observed_at = raw.observed_at_source ?? raw.fetched_at;
  return {
    source: raw.source,
    signal_type: raw.signal_type,
    observed_at,
    fetched_at: raw.fetched_at,
    raw_payload: raw.payload,
    normalized: extractFields(raw.source, raw.payload),
  };
}

function extractFields(source: SourceId, payload: unknown): NormalizedFields {
  switch (source) {
    case 'ic3':
      return extractIc3(payload);
    case 'ftc':
      return extractFtc(payload);
    case 'cisa_kev':
      return extractCisaKev(payload);
    case 'krebs':
    case 'bleeping_computer':
      return extractBlogPost(payload);
    case 'reddit_scams':
    case 'reddit_phishing':
      return extractRedditThread(payload);
  }
}

// --- IC3 ------------------------------------------------------------------
// Expected payload shape (Phase 2 fetcher; here for fixture-driven tests):
//   { title, summary, url, published, geographic_scope?, techniques?[] }
function extractIc3(payload: unknown): NormalizedFields {
  if (!isObject(payload)) return EMPTY_NORMALIZED;
  return {
    ...EMPTY_NORMALIZED,
    title: pickString(payload['title']),
    summary: pickString(payload['summary']),
    url: pickString(payload['url']),
    geographic_scope: pickString(payload['geographic_scope']),
    mentioned_techniques: pickStringArray(payload['techniques']),
  };
}

// --- FTC ------------------------------------------------------------------
// Expected payload shape:
//   { title, description, link, target_audience?, techniques?[] }
function extractFtc(payload: unknown): NormalizedFields {
  if (!isObject(payload)) return EMPTY_NORMALIZED;
  return {
    ...EMPTY_NORMALIZED,
    title: pickString(payload['title']),
    summary: pickString(payload['description']),
    url: pickString(payload['link']),
    target_audience: pickString(payload['target_audience']),
    mentioned_techniques: pickStringArray(payload['techniques']),
  };
}

// --- CISA KEV --------------------------------------------------------------
// Expected payload shape (per the CISA KEV catalog JSON):
//   { vulnerabilityName, shortDescription, cveID, vendorProject, knownRansomwareCampaignUse? }
function extractCisaKev(payload: unknown): NormalizedFields {
  if (!isObject(payload)) return EMPTY_NORMALIZED;
  const cveId = pickString(payload['cveID']);
  const cveUrl = cveId ? `https://nvd.nist.gov/vuln/detail/${cveId}` : null;
  return {
    ...EMPTY_NORMALIZED,
    title: pickString(payload['vulnerabilityName']),
    summary: pickString(payload['shortDescription']),
    url: cveUrl,
    claimed_actor: pickString(payload['knownRansomwareCampaignUse']),
    mentioned_indicators: cveId ? [cveId] : [],
  };
}

// --- Generic blog post (Krebs, Bleeping Computer) -------------------------
// Expected payload shape (RSS-derived):
//   { title, description, link, author?, categories?[] }
function extractBlogPost(payload: unknown): NormalizedFields {
  if (!isObject(payload)) return EMPTY_NORMALIZED;
  return {
    ...EMPTY_NORMALIZED,
    title: pickString(payload['title']),
    summary: pickString(payload['description']),
    url: pickString(payload['link']),
    claimed_actor: pickString(payload['author']),
    mentioned_techniques: pickStringArray(payload['categories']),
  };
}

// --- Reddit thread --------------------------------------------------------
// Expected payload shape (Reddit JSON listing entry):
//   { data: { title, selftext, url, author, subreddit, link_flair_text? } }
function extractRedditThread(payload: unknown): NormalizedFields {
  if (!isObject(payload)) return EMPTY_NORMALIZED;
  // Reddit JSON nests fields under .data; accept either shape.
  const data = isObject(payload['data']) ? payload['data'] : payload;
  return {
    ...EMPTY_NORMALIZED,
    title: pickString(data['title']),
    summary: pickString(data['selftext']),
    url: pickString(data['url']),
    claimed_actor: pickString(data['author']),
    target_audience: pickString(data['link_flair_text']),
  };
}

// --- Narrowing helpers ----------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function pickStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed.length > 0) out.push(trimmed);
    }
  }
  return out;
}
