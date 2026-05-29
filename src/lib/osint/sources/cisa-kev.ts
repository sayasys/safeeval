// CISA Known Exploited Vulnerabilities catalog source stub.
//
// Public JSON feed: continuously updated. Phase 2 wires the actual JSON
// fetcher; Phase 1 ships the source-module shape so the index + tests can
// iterate the full closed-set source vocabulary.
//
// CISA bulletins occasionally exceed the default 1MB response cap (the annual
// review bulletins are the canonical case per sec memo open question 7.2).
// The override slot is configured here as a per-source maxResponseBytes;
// Phase 2 can tune the value when the real fetcher is wired.

import { Source, RawSignal } from '../types';

export const cisaKev: Source = {
  id: 'cisa_kev',
  name: 'CISA Known Exploited Vulnerabilities catalog',
  config: {
    allowedDomains: ['www.cisa.gov', 'cisa.gov'],
    maxResponseBytes: 2_097_152, // 2MB -- CISA KEV JSON exceeds 1MB default
  },
  async fetch(): Promise<RawSignal[]> {
    return [];
  },
};
