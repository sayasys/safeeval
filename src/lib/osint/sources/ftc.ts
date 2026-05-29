// FTC consumer-alerts source fetcher.
//
// Public RSS at consumer.ftc.gov/blog/rss. Weekly cadence. The fetcher
// routes through osintFetch() (sec memo section 3.1) and returns [] on
// failure (scoping memo section 7 parse-failure discipline).

import { Source, RawSignal } from '../types';
import { osintFetch } from '../http-client';
import { parseRssItems } from '../rss-parser';

const FTC_URL = 'https://consumer.ftc.gov/blog/rss';

export const ftc: Source = {
  id: 'ftc',
  name: 'FTC consumer alerts',
  config: {
    allowedDomains: ['consumer.ftc.gov', 'www.ftc.gov', 'ftc.gov'],
  },
  async fetch(): Promise<RawSignal[]> {
    try {
      const result = await osintFetch(FTC_URL, { sourceConfig: ftc.config });
      const items = parseRssItems(result.body);
      const fetched_at = new Date().toISOString();
      return items.map((item) => ({
        source: 'ftc' as const,
        signal_type: 'bulletin' as const,
        observed_at_source: item.pubDate ?? null,
        fetched_at,
        payload: {
          title: item.title,
          description: item.description,
          link: item.link,
          published: item.pubDate,
        },
      }));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[osint:ftc] fetch failed: ${reason}`);
      return [];
    }
  },
};
