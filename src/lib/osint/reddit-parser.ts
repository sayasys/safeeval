// Shared Reddit JSON listing parser for r/scams and r/phishing.
//
// Reddit listing endpoints return:
//   { kind: 'Listing', data: { children: [ { kind: 't3', data: {...} }, ... ] } }
// We extract the .data of each t3 child (Reddit's "link" kind, i.e. posts).
//
// Discipline (scoping memo section 7): malformed JSON returns []; the per-
// source fetcher catches the network error, this parser catches the shape
// error. Both fail empty, never throw.

export interface RedditEntry {
  title: string | null;
  selftext: string | null;
  url: string | null;
  author: string | null;
  subreddit: string | null;
  link_flair_text: string | null;
  permalink: string | null;
  created_utc: number | null;
}

export function parseRedditListing(json: string): RedditEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!isObject(parsed)) return [];
  const data = parsed['data'];
  if (!isObject(data)) return [];
  const children = (data as Record<string, unknown>)['children'];
  if (!Array.isArray(children)) return [];

  const out: RedditEntry[] = [];
  for (const child of children) {
    if (!isObject(child)) continue;
    const inner = (child as Record<string, unknown>)['data'];
    if (!isObject(inner)) continue;
    out.push({
      title: pickString(inner['title']),
      selftext: pickString(inner['selftext']),
      url: pickString(inner['url']),
      author: pickString(inner['author']),
      subreddit: pickString(inner['subreddit']),
      link_flair_text: pickString(inner['link_flair_text']),
      permalink: pickString(inner['permalink']),
      created_utc: typeof inner['created_utc'] === 'number' ? inner['created_utc'] : null,
    });
  }
  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  return v.length === 0 ? null : v;
}
