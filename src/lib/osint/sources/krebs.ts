// Krebs on Security blog source fetcher.
//
// Public RSS at krebsonsecurity.com/feed/. Daily-or-less cadence. Routes
// through osintFetch() (sec memo section 3.1).

import { Source, RawSignal } from '../types';
import { osintFetch } from '../http-client';
import { parseRssItems } from '../rss-parser';

const KREBS_URL = 'https://krebsonsecurity.com/feed/';

export const krebs: Source = {
  id: 'krebs',
  name: 'Krebs on Security',
  config: {
    allowedDomains: ['krebsonsecurity.com', 'www.krebsonsecurity.com'],
  },
  async fetch(): Promise<RawSignal[]> {
    try {
      const result = await osintFetch(KREBS_URL, { sourceConfig: krebs.config });
      const items = parseRssItems(result.body);
      const fetched_at = new Date().toISOString();
      return items.map((item) => ({
        source: 'krebs' as const,
        signal_type: 'blog_post' as const,
        observed_at_source: item.pubDate ?? null,
        fetched_at,
        payload: {
          title: item.title,
          description: item.description,
          link: item.link,
          author: item.author,
          categories: item.categories,
        },
      }));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[osint:krebs] fetch failed: ${reason}`);
      return [];
    }
  },
};
