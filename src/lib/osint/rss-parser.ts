// Shared RSS parser for the OSINT Tier 1 RSS-style sources.
//
// Wraps fast-xml-parser to expose a narrow RssItem surface that the per-
// source fetchers (ic3, ftc, krebs, bleeping-computer) consume. The parser
// accepts RSS 2.0 channels (item nodes) and Atom feeds (entry nodes); both
// surface mostly equivalent fields via the same extraction logic.
//
// Design discipline (scoping memo section 7):
//   - Pure: no I/O, no clock. Same XML in -> same items out.
//   - Defensive: malformed XML returns [] rather than throwing. The
//     per-source fetcher catches the network errors; the parser catches
//     the XML errors. Either way the source-level failure mode is "empty
//     result, log warning, do not poison the cycle".

import { XMLParser } from 'fast-xml-parser';

export interface RssItem {
  title: string | null;
  description: string | null;
  link: string | null;
  pubDate: string | null;
  author: string | null;
  categories: string[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true,
});

export function parseRssItems(xml: string): RssItem[] {
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    return [];
  }
  if (!isObject(parsed)) return [];

  // RSS 2.0: { rss: { channel: { item: [...] } } }
  // Atom:    { feed: { entry: [...] } }
  const rss = parsed['rss'];
  if (isObject(rss)) {
    const channel = (rss as Record<string, unknown>)['channel'];
    if (isObject(channel)) {
      return extractItems((channel as Record<string, unknown>)['item']).map(toRssItem);
    }
  }
  const feed = parsed['feed'];
  if (isObject(feed)) {
    return extractItems((feed as Record<string, unknown>)['entry']).map(toAtomItem);
  }
  return [];
}

function extractItems(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isObject) as Record<string, unknown>[];
  }
  if (isObject(value)) return [value as Record<string, unknown>];
  return [];
}

function toRssItem(node: Record<string, unknown>): RssItem {
  return {
    title: pickString(node['title']),
    description: pickString(node['description']),
    link: pickString(node['link']),
    pubDate: pickString(node['pubDate']),
    author: pickString(node['author']) ?? pickString(node['dc:creator']),
    categories: pickStringArray(node['category']),
  };
}

function toAtomItem(node: Record<string, unknown>): RssItem {
  // Atom's <link> is often an element with @href; <published>/<updated>
  // replace <pubDate>; <author> is nested as <author><name>...</name></author>.
  const link = node['link'];
  let linkValue: string | null = null;
  if (isObject(link)) {
    linkValue = pickString((link as Record<string, unknown>)['@_href']);
  } else {
    linkValue = pickString(link);
  }
  const author = node['author'];
  let authorValue: string | null = null;
  if (isObject(author)) {
    authorValue = pickString((author as Record<string, unknown>)['name']);
  } else {
    authorValue = pickString(author);
  }
  return {
    title: pickString(node['title']),
    description: pickString(node['summary']) ?? pickString(node['content']),
    link: linkValue,
    pubDate: pickString(node['published']) ?? pickString(node['updated']),
    author: authorValue,
    categories: pickStringArray(node['category']),
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickString(v: unknown): string | null {
  if (typeof v === 'string') {
    const trimmed = v.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  // RSS items occasionally surface { '#text': 'value', '@_attr': '...' } for
  // mixed-content fields; honor the text node if present.
  if (isObject(v)) {
    const text = v['#text'];
    if (typeof text === 'string') {
      const trimmed = text.trim();
      return trimmed.length === 0 ? null : trimmed;
    }
  }
  return null;
}

function pickStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      const s = pickString(item);
      if (s !== null) out.push(s);
    }
    return out;
  }
  const single = pickString(v);
  return single === null ? [] : [single];
}
