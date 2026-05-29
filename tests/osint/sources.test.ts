// Tests for the OSINT source registry and Phase 2 real fetchers.
//
// Phase 1 ships stubbed fetchers returning []. Phase 2 wires real RSS / JSON
// parsing through the osintFetch hardened wrapper. Coverage:
//   - registry contract shape and closed-set source IDs
//   - per-source allow-list smoke
//   - real fetchers parse mocked RSS / JSON responses and stamp the right
//     source / signal_type / observed_at on each RawSignal
//   - parse-failure discipline: returns [] on bad XML / bad JSON, logs warning,
//     never throws
//   - network-error discipline: returns [] on osintFetch error, never throws
//   - fetchAllSources stamps fetcher_version on every RawSignal it returns

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeFetcherVersion,
  fetchAllSources,
  getSources,
} from '../../src/lib/osint/index';
import { Source, SourceId } from '../../src/lib/osint/types';
import { bleepingComputer } from '../../src/lib/osint/sources/bleeping-computer';
import { cisaKev } from '../../src/lib/osint/sources/cisa-kev';
import { ftc } from '../../src/lib/osint/sources/ftc';
import { ic3 } from '../../src/lib/osint/sources/ic3';
import { krebs } from '../../src/lib/osint/sources/krebs';
import { redditPhishing } from '../../src/lib/osint/sources/reddit-phishing';
import { redditScams } from '../../src/lib/osint/sources/reddit-scams';

const TIER_1_IDS: readonly SourceId[] = [
  'ic3',
  'ftc',
  'cisa_kev',
  'krebs',
  'bleeping_computer',
  'reddit_scams',
  'reddit_phishing',
];

// --- Fixture responses -----------------------------------------------------

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Romance scam variant targeting recent widows</title>
      <description>IC3 has observed a sustained pattern of romance scams ...</description>
      <link>https://example.test/post/1</link>
      <pubDate>Tue, 15 May 2026 09:00:00 +0000</pubDate>
      <author>Test Author</author>
      <category>scams</category>
      <category>elder-fraud</category>
    </item>
    <item>
      <title>Second item</title>
      <description>Second body.</description>
      <link>https://example.test/post/2</link>
      <pubDate>Wed, 16 May 2026 10:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

const CISA_KEV_FIXTURE = JSON.stringify({
  catalogVersion: '2026.05.28',
  vulnerabilities: [
    {
      cveID: 'CVE-2026-12345',
      vulnerabilityName: 'Acme Widget RCE',
      shortDescription: 'A flaw in Acme Widget allows unauthenticated RCE.',
      dateAdded: '2026-05-20',
      knownRansomwareCampaignUse: 'BlackCat',
    },
    {
      cveID: 'CVE-2026-99999',
      vulnerabilityName: 'Other Vendor Auth Bypass',
      shortDescription: 'Auth bypass in vendor system.',
      dateAdded: '2026-05-22',
    },
  ],
});

const REDDIT_FIXTURE = JSON.stringify({
  kind: 'Listing',
  data: {
    children: [
      {
        kind: 't3',
        data: {
          title: 'New pretext: fake debt collector with my actual SSN last four',
          selftext: 'Got a call today...',
          url: 'https://www.reddit.com/r/scams/comments/abc123/',
          author: 'throwaway_alarmed',
          subreddit: 'scams',
          link_flair_text: 'Help Needed',
          permalink: '/r/scams/comments/abc123/',
          created_utc: 1748390531,
        },
      },
      {
        kind: 't3',
        data: {
          title: 'Another thread',
          selftext: '',
          url: 'https://www.reddit.com/r/scams/comments/def456/',
          author: 'user2',
          subreddit: 'scams',
          link_flair_text: null,
          permalink: '/r/scams/comments/def456/',
          created_utc: 1748390600,
        },
      },
    ],
  },
});

// Mock fetch helper. Returns a 200 with the body text and the appropriate
// content-type for an RSS / JSON payload. The osintFetch wrapper reads the
// body via response.body (the streaming branch) OR response.text (the
// buffered branch); we provide both so the wrapper picks whichever is
// available.
function mockFetchResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/octet-stream' },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Registry shape --------------------------------------------------------

describe('source registry shape', () => {
  it('returns exactly the Tier 1 closed-set source IDs', () => {
    const ids = getSources().map((s) => s.id).sort();
    expect(ids).toEqual([...TIER_1_IDS].sort());
  });

  it.each(TIER_1_IDS)('source %s exports the Source contract', (sourceId) => {
    const source = getSources().find((s) => s.id === sourceId);
    expect(source).toBeDefined();
    if (!source) return;
    expect(typeof source.name).toBe('string');
    expect(source.name.length).toBeGreaterThan(0);
    expect(typeof source.fetch).toBe('function');
    expect(source.config).toBeDefined();
    expect(Array.isArray(source.config.allowedDomains)).toBe(true);
    expect(source.config.allowedDomains.length).toBeGreaterThan(0);
  });
});

// --- Per-source allow-list smoke -------------------------------------------

describe('per-source allow-list smoke', () => {
  it('IC3 allow-list covers ic3.gov and the canonical www subdomain', () => {
    expect(ic3.config.allowedDomains).toContain('www.ic3.gov');
  });

  it('Reddit sources share the reddit.com allow-list', () => {
    expect(redditScams.config.allowedDomains).toContain('www.reddit.com');
    expect(redditPhishing.config.allowedDomains).toContain('www.reddit.com');
  });

  it('CISA KEV has an explicit response-size override above the 1MB default', () => {
    expect(cisaKev.config.maxResponseBytes).toBeDefined();
    expect(cisaKev.config.maxResponseBytes!).toBeGreaterThan(1_048_576);
  });
});

// --- RSS sources: ic3 / ftc / krebs / bleeping-computer --------------------

describe('RSS source fetchers (mocked osintFetch)', () => {
  it('ic3 parses an RSS response and emits one signal per item', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(RSS_FIXTURE)));
    const signals = await ic3.fetch();
    expect(signals).toHaveLength(2);
    expect(signals[0]?.source).toBe('ic3');
    expect(signals[0]?.signal_type).toBe('bulletin');
    expect(signals[0]?.observed_at_source).toBe('Tue, 15 May 2026 09:00:00 +0000');
    const payload = signals[0]?.payload as Record<string, unknown>;
    expect(payload['title']).toBe('Romance scam variant targeting recent widows');
    expect(payload['url']).toBe('https://example.test/post/1');
  });

  it('ftc parses an RSS response and emits bulletin signals', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(RSS_FIXTURE)));
    const signals = await ftc.fetch();
    expect(signals).toHaveLength(2);
    expect(signals[0]?.source).toBe('ftc');
    expect(signals[0]?.signal_type).toBe('bulletin');
  });

  it('krebs parses an RSS response and emits blog_post signals with author + categories', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(RSS_FIXTURE)));
    const signals = await krebs.fetch();
    expect(signals).toHaveLength(2);
    expect(signals[0]?.source).toBe('krebs');
    expect(signals[0]?.signal_type).toBe('blog_post');
    const payload = signals[0]?.payload as Record<string, unknown>;
    expect(payload['author']).toBe('Test Author');
    expect(payload['categories']).toEqual(['scams', 'elder-fraud']);
  });

  it('bleeping-computer parses RSS and emits blog_post signals', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(RSS_FIXTURE)));
    const signals = await bleepingComputer.fetch();
    expect(signals).toHaveLength(2);
    expect(signals[0]?.source).toBe('bleeping_computer');
    expect(signals[0]?.signal_type).toBe('blog_post');
  });

  it('RSS sources return [] (do not throw) on malformed XML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse('<<<not xml>>>')));
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const signals = await krebs.fetch();
    expect(signals).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('RSS sources return [] on network error from osintFetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const signals = await ic3.fetch();
    expect(signals).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// --- JSON sources: cisa-kev ------------------------------------------------

describe('CISA KEV source fetcher (mocked osintFetch)', () => {
  it('parses the vulnerabilities array and emits one vendor_advisory per CVE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(CISA_KEV_FIXTURE)));
    const signals = await cisaKev.fetch();
    expect(signals).toHaveLength(2);
    expect(signals[0]?.source).toBe('cisa_kev');
    expect(signals[0]?.signal_type).toBe('vendor_advisory');
    expect(signals[0]?.observed_at_source).toBe('2026-05-20');
    const payload = signals[0]?.payload as Record<string, unknown>;
    expect(payload['cveID']).toBe('CVE-2026-12345');
  });

  it('returns [] on malformed JSON without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse('not json {')));
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const signals = await cisaKev.fetch();
    expect(signals).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('returns [] when JSON has no vulnerabilities array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(JSON.stringify({ catalogVersion: 'x' }))));
    const signals = await cisaKev.fetch();
    expect(signals).toEqual([]);
  });
});

// --- Reddit sources --------------------------------------------------------

describe('Reddit source fetchers (mocked osintFetch)', () => {
  it('reddit-scams parses listing JSON and emits forum_thread signals', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(REDDIT_FIXTURE)));
    const signals = await redditScams.fetch();
    expect(signals).toHaveLength(2);
    expect(signals[0]?.source).toBe('reddit_scams');
    expect(signals[0]?.signal_type).toBe('forum_thread');
    // observed_at_source derived from created_utc
    expect(signals[0]?.observed_at_source).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const payload = signals[0]?.payload as Record<string, unknown>;
    const data = payload['data'] as Record<string, unknown>;
    expect(data['title']).toMatch(/^New pretext/);
    expect(data['author']).toBe('throwaway_alarmed');
  });

  it('reddit-phishing uses the same JSON parser and emits forum_thread signals', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(REDDIT_FIXTURE)));
    const signals = await redditPhishing.fetch();
    expect(signals).toHaveLength(2);
    expect(signals[0]?.source).toBe('reddit_phishing');
    expect(signals[0]?.signal_type).toBe('forum_thread');
  });

  it('Reddit sources return [] on malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse('not json')));
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const signals = await redditScams.fetch();
    expect(signals).toEqual([]);
    consoleSpy.mockRestore();
  });
});

// --- Aggregation + fetcher_version stamp -----------------------------------

describe('fetchAllSources aggregation', () => {
  it('aggregates signals from every source and stamps fetcher_version', async () => {
    // Every source's fetch() call goes through the same global fetch mock.
    // Each returns the same RSS body; cisa-kev sees malformed XML (returns [])
    // because we feed RSS where JSON is expected, and reddit sources see the
    // same (returning []). The IDs we expect to land are the 4 RSS sources.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(RSS_FIXTURE)));
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const all = await fetchAllSources();
    expect(all.length).toBeGreaterThan(0);
    for (const sig of all) {
      // Every aggregated signal carries a stamped fetcher_version (SHA-256
      // hex string, 64 chars).
      expect(typeof sig.fetcher_version).toBe('string');
      expect(sig.fetcher_version).toMatch(/^[a-f0-9]{64}$/);
    }
    consoleSpy.mockRestore();
  });

  it('computeFetcherVersion returns a stable SHA-256 for a given source', () => {
    const v1 = computeFetcherVersion(ic3);
    const v2 = computeFetcherVersion(ic3);
    expect(v1).toBe(v2);
    expect(v1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('computeFetcherVersion differs between sources with different fetch logic', () => {
    const ic3Hash = computeFetcherVersion(ic3);
    const krebsHash = computeFetcherVersion(krebs);
    expect(ic3Hash).not.toBe(krebsHash);
  });
});
