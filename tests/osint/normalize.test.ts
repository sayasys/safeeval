// Tests for the OSINT normalization layer.
//
// Coverage: at least three source-specific fixtures asserting field
// extraction, observed_at fallback to fetched_at, and the never-invents-
// values discipline (nullable extracts stay null).

import { describe, expect, it } from 'vitest';
import { normalize } from '../../src/lib/osint/normalize';
import { RawSignal } from '../../src/lib/osint/types';

const FIXED_FETCHED_AT = '2026-05-28T15:00:00.000Z';

describe('normalize -- IC3 bulletin', () => {
  it('extracts title, summary, url, and geographic_scope', () => {
    const raw: RawSignal = {
      source: 'ic3',
      signal_type: 'bulletin',
      observed_at_source: '2026-05-15T09:00:00.000Z',
      fetched_at: FIXED_FETCHED_AT,
      payload: {
        title: 'Romance scam variant targeting recent widows',
        summary: 'IC3 has observed a sustained pattern of romance scams ...',
        url: 'https://www.ic3.gov/Media/Y2026/PSA260515',
        geographic_scope: 'United States',
        techniques: ['romance_scam', 'crypto_off_ramp'],
      },
    };
    const result = normalize(raw);
    expect(result.source).toBe('ic3');
    expect(result.signal_type).toBe('bulletin');
    expect(result.observed_at).toBe('2026-05-15T09:00:00.000Z');
    expect(result.fetched_at).toBe(FIXED_FETCHED_AT);
    expect(result.normalized.title).toBe('Romance scam variant targeting recent widows');
    expect(result.normalized.summary).toMatch(/^IC3 has observed/);
    expect(result.normalized.url).toBe('https://www.ic3.gov/Media/Y2026/PSA260515');
    expect(result.normalized.geographic_scope).toBe('United States');
    expect(result.normalized.mentioned_techniques).toEqual(['romance_scam', 'crypto_off_ramp']);
    expect(result.normalized.claimed_actor).toBeNull();
    expect(result.normalized.target_audience).toBeNull();
  });

  it('falls back to fetched_at when source has no published timestamp', () => {
    const raw: RawSignal = {
      source: 'ic3',
      signal_type: 'bulletin',
      observed_at_source: null,
      fetched_at: FIXED_FETCHED_AT,
      payload: { title: 'Untitled bulletin' },
    };
    const result = normalize(raw);
    expect(result.observed_at).toBe(FIXED_FETCHED_AT);
  });
});

describe('normalize -- CISA KEV entry', () => {
  it('extracts vulnerability name and derives the NVD URL from cveID', () => {
    const raw: RawSignal = {
      source: 'cisa_kev',
      signal_type: 'vendor_advisory',
      observed_at_source: '2026-05-20T12:00:00.000Z',
      fetched_at: FIXED_FETCHED_AT,
      payload: {
        cveID: 'CVE-2026-12345',
        vulnerabilityName: 'Acme Widget remote code execution',
        shortDescription: 'A flaw in Acme Widget v3.x allows unauthenticated RCE ...',
        knownRansomwareCampaignUse: 'BlackCat',
      },
    };
    const result = normalize(raw);
    expect(result.normalized.title).toBe('Acme Widget remote code execution');
    expect(result.normalized.url).toBe('https://nvd.nist.gov/vuln/detail/CVE-2026-12345');
    expect(result.normalized.claimed_actor).toBe('BlackCat');
    expect(result.normalized.mentioned_indicators).toEqual(['CVE-2026-12345']);
  });

  it('leaves url null and indicators empty when cveID is absent', () => {
    const raw: RawSignal = {
      source: 'cisa_kev',
      signal_type: 'vendor_advisory',
      observed_at_source: null,
      fetched_at: FIXED_FETCHED_AT,
      payload: { vulnerabilityName: 'Unknown vuln' },
    };
    const result = normalize(raw);
    expect(result.normalized.url).toBeNull();
    expect(result.normalized.mentioned_indicators).toEqual([]);
  });
});

describe('normalize -- Reddit thread', () => {
  it('extracts title, body, author from the nested .data shape', () => {
    const raw: RawSignal = {
      source: 'reddit_scams',
      signal_type: 'forum_thread',
      observed_at_source: '2026-05-27T18:42:11.000Z',
      fetched_at: FIXED_FETCHED_AT,
      payload: {
        data: {
          title: 'New pretext: fake debt collector with my actual SSN last four',
          selftext: 'Got a call today from someone claiming to be from ...',
          url: 'https://www.reddit.com/r/scams/comments/abc123/',
          author: 'throwaway_alarmed',
          subreddit: 'scams',
          link_flair_text: 'Help Needed',
        },
      },
    };
    const result = normalize(raw);
    expect(result.normalized.title).toMatch(/^New pretext/);
    expect(result.normalized.summary).toMatch(/^Got a call/);
    expect(result.normalized.url).toBe('https://www.reddit.com/r/scams/comments/abc123/');
    expect(result.normalized.claimed_actor).toBe('throwaway_alarmed');
    expect(result.normalized.target_audience).toBe('Help Needed');
  });
});

describe('normalize -- never-invents-values discipline', () => {
  it('returns null for all extractable fields when payload is not an object', () => {
    const raw: RawSignal = {
      source: 'ftc',
      signal_type: 'bulletin',
      observed_at_source: null,
      fetched_at: FIXED_FETCHED_AT,
      payload: 'not-an-object',
    };
    const result = normalize(raw);
    expect(result.normalized.title).toBeNull();
    expect(result.normalized.summary).toBeNull();
    expect(result.normalized.url).toBeNull();
    expect(result.normalized.mentioned_techniques).toEqual([]);
    expect(result.normalized.mentioned_indicators).toEqual([]);
  });

  it('preserves the raw payload byte-for-byte in raw_payload', () => {
    const payload = { custom: 'shape', nested: { a: 1 } };
    const raw: RawSignal = {
      source: 'krebs',
      signal_type: 'blog_post',
      observed_at_source: null,
      fetched_at: FIXED_FETCHED_AT,
      payload,
    };
    const result = normalize(raw);
    expect(result.raw_payload).toBe(payload);
  });
});
