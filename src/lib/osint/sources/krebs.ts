// Krebs on Security blog source stub.
//
// Public RSS: daily-or-less cadence. Phase 2 wires the actual RSS parser;
// Phase 1 ships the source-module shape so the index + tests can iterate
// the full closed-set source vocabulary.

import { Source, RawSignal } from '../types';

export const krebs: Source = {
  id: 'krebs',
  name: 'Krebs on Security',
  config: {
    allowedDomains: ['krebsonsecurity.com', 'www.krebsonsecurity.com'],
  },
  async fetch(): Promise<RawSignal[]> {
    return [];
  },
};
