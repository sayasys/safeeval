// IC3 (FBI Internet Crime Complaint Center) source fetcher.
//
// Public bulletins: monthly cadence. RSS feed at /Media/RSS. The fetcher
// routes through osintFetch() (sec memo section 3.1 hardened wrapper),
// parses the RSS XML into RawSignal records, and returns [] on any
// network/parse failure rather than throwing (per scoping memo section 7
// "On parse failure: return [] and log warning, never throw").

import { Source, RawSignal } from '../types';
import { osintFetch } from '../http-client';
import { parseRssItems } from '../rss-parser';

const IC3_URL = 'https://www.ic3.gov/Media/RSS';

export const ic3: Source = {
  id: 'ic3',
  name: 'FBI Internet Crime Complaint Center (IC3) bulletins',
  config: {
    allowedDomains: ['www.ic3.gov', 'ic3.gov'],
  },
  async fetch(): Promise<RawSignal[]> {
    try {
      const result = await osintFetch(IC3_URL, { sourceConfig: ic3.config });
      const items = parseRssItems(result.body);
      const fetched_at = new Date().toISOString();
      return items.map((item) => ({
        source: 'ic3' as const,
        signal_type: 'bulletin' as const,
        observed_at_source: item.pubDate ?? null,
        fetched_at,
        payload: {
          title: item.title,
          summary: item.description,
          url: item.link,
          published: item.pubDate,
        },
      }));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[osint:ic3] fetch failed: ${reason}`);
      return [];
    }
  },
};
