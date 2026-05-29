// Bleeping Computer blog source stub.
//
// Public RSS: daily cadence. Phase 2 wires the actual RSS parser; Phase 1
// ships the source-module shape so the index + tests can iterate the full
// closed-set source vocabulary.

import { Source, RawSignal } from '../types';

export const bleepingComputer: Source = {
  id: 'bleeping_computer',
  name: 'Bleeping Computer',
  config: {
    allowedDomains: ['www.bleepingcomputer.com', 'bleepingcomputer.com'],
  },
  async fetch(): Promise<RawSignal[]> {
    return [];
  },
};
