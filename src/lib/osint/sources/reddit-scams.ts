// Reddit r/scams source fetcher.
//
// Official JSON listing endpoint (.json suffix) per sec memo section 4.6 ToS
// posture: SafeEval uses the documented research-grade JSON API, NOT the
// HTML layer that Reddit's ToS restricts. The endpoint is paginated; Phase 2
// fetches the first listing only (no deep crawling per sec memo section 4.5).

import { Source, RawSignal } from '../types';
import { osintFetch } from '../http-client';
import { parseRedditListing } from '../reddit-parser';

const REDDIT_SCAMS_URL = 'https://www.reddit.com/r/scams/new.json?limit=25';

export const redditScams: Source = {
  id: 'reddit_scams',
  name: 'Reddit r/scams',
  config: {
    allowedDomains: ['www.reddit.com', 'reddit.com'],
  },
  async fetch(): Promise<RawSignal[]> {
    try {
      const result = await osintFetch(REDDIT_SCAMS_URL, { sourceConfig: redditScams.config });
      const entries = parseRedditListing(result.body);
      const fetched_at = new Date().toISOString();
      return entries.map((entry) => ({
        source: 'reddit_scams' as const,
        signal_type: 'forum_thread' as const,
        observed_at_source: entry.created_utc
          ? new Date(entry.created_utc * 1000).toISOString()
          : null,
        fetched_at,
        payload: { data: entry },
      }));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[osint:reddit_scams] fetch failed: ${reason}`);
      return [];
    }
  },
};
