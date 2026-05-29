// Reddit r/phishing source fetcher.
//
// Same JSON-API pattern as r/scams; see reddit-scams.ts for the ToS posture.

import { Source, RawSignal } from '../types';
import { osintFetch } from '../http-client';
import { parseRedditListing } from '../reddit-parser';

const REDDIT_PHISHING_URL = 'https://www.reddit.com/r/phishing/new.json?limit=25';

export const redditPhishing: Source = {
  id: 'reddit_phishing',
  name: 'Reddit r/phishing',
  config: {
    allowedDomains: ['www.reddit.com', 'reddit.com'],
  },
  async fetch(): Promise<RawSignal[]> {
    try {
      const result = await osintFetch(REDDIT_PHISHING_URL, { sourceConfig: redditPhishing.config });
      const entries = parseRedditListing(result.body);
      const fetched_at = new Date().toISOString();
      return entries.map((entry) => ({
        source: 'reddit_phishing' as const,
        signal_type: 'forum_thread' as const,
        observed_at_source: entry.created_utc
          ? new Date(entry.created_utc * 1000).toISOString()
          : null,
        fetched_at,
        payload: { data: entry },
      }));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[osint:reddit_phishing] fetch failed: ${reason}`);
      return [];
    }
  },
};
