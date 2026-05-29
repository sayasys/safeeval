// Bleeping Computer blog source fetcher.
//
// Public RSS at www.bleepingcomputer.com/feed/. Daily cadence. Routes
// through osintFetch() (sec memo section 3.1).

import { Source, RawSignal } from '../types';
import { osintFetch } from '../http-client';
import { parseRssItems } from '../rss-parser';

const BLEEPING_URL = 'https://www.bleepingcomputer.com/feed/';

export const bleepingComputer: Source = {
  id: 'bleeping_computer',
  name: 'Bleeping Computer',
  config: {
    allowedDomains: ['www.bleepingcomputer.com', 'bleepingcomputer.com'],
  },
  async fetch(): Promise<RawSignal[]> {
    try {
      const result = await osintFetch(BLEEPING_URL, { sourceConfig: bleepingComputer.config });
      const items = parseRssItems(result.body);
      const fetched_at = new Date().toISOString();
      return items.map((item) => ({
        source: 'bleeping_computer' as const,
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
      console.warn(`[osint:bleeping_computer] fetch failed: ${reason}`);
      return [];
    }
  },
};
