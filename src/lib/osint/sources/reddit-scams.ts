// Reddit r/scams source stub.
//
// Official JSON API endpoint per sec memo section 4.6 ToS posture: SafeEval
// uses the documented JSON listing endpoint (.json suffix on the subreddit
// URL), NOT the HTML layer, which Reddit's ToS restricts. Phase 2 wires the
// actual JSON parser; Phase 1 ships the source-module shape so the index +
// tests can iterate the full closed-set source vocabulary.

import { Source, RawSignal } from '../types';

export const redditScams: Source = {
  id: 'reddit_scams',
  name: 'Reddit r/scams',
  config: {
    allowedDomains: ['www.reddit.com', 'reddit.com'],
  },
  async fetch(): Promise<RawSignal[]> {
    return [];
  },
};
