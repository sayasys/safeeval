// Reddit r/phishing source stub.
//
// Official JSON API endpoint per sec memo section 4.6 ToS posture (same
// pattern as r/scams). Phase 2 wires the actual JSON parser; Phase 1 ships
// the source-module shape so the index + tests can iterate the full
// closed-set source vocabulary.

import { Source, RawSignal } from '../types';

export const redditPhishing: Source = {
  id: 'reddit_phishing',
  name: 'Reddit r/phishing',
  config: {
    allowedDomains: ['www.reddit.com', 'reddit.com'],
  },
  async fetch(): Promise<RawSignal[]> {
    return [];
  },
};
