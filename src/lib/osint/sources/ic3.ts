// IC3 (FBI Internet Crime Complaint Center) source stub.
//
// Public bulletins: monthly cadence. Phase 2 wires the actual HTML/RSS
// fetcher; Phase 1 ships the source-module shape so the index + tests
// can iterate the full closed-set source vocabulary.

import { Source, RawSignal } from '../types';

export const ic3: Source = {
  id: 'ic3',
  name: 'FBI Internet Crime Complaint Center (IC3) bulletins',
  config: {
    allowedDomains: ['www.ic3.gov', 'ic3.gov'],
  },
  async fetch(): Promise<RawSignal[]> {
    return [];
  },
};
