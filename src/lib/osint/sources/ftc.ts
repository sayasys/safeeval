// FTC consumer-alerts source stub.
//
// Public RSS: weekly cadence. Phase 2 wires the actual RSS parser; Phase 1
// ships the source-module shape so the index + tests can iterate the full
// closed-set source vocabulary.

import { Source, RawSignal } from '../types';

export const ftc: Source = {
  id: 'ftc',
  name: 'FTC consumer alerts',
  config: {
    allowedDomains: ['consumer.ftc.gov', 'www.ftc.gov', 'ftc.gov'],
  },
  async fetch(): Promise<RawSignal[]> {
    return [];
  },
};
