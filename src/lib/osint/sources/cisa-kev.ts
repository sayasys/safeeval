// CISA Known Exploited Vulnerabilities catalog source fetcher.
//
// Public JSON catalog at /sites/default/files/feeds/known_exploited_vulnerabilities.json.
// Continuously updated. The full payload exceeds the default 1MB cap (canonical
// case per sec memo open question 7.2); the source config sets maxResponseBytes
// to 2MB so the response is not truncated.
//
// Phase 2: emit one RawSignal per vulnerability in the catalog rather than one
// signal for the whole catalog. The classifier reasons per-vuln; one-per-vuln
// gives the architect a per-row adjudication unit. The catalog publishes
// dateAdded per vuln; that becomes observed_at_source.

import { Source, RawSignal } from '../types';
import { osintFetch } from '../http-client';

const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

export const cisaKev: Source = {
  id: 'cisa_kev',
  name: 'CISA Known Exploited Vulnerabilities catalog',
  config: {
    allowedDomains: ['www.cisa.gov', 'cisa.gov'],
    maxResponseBytes: 2_097_152,
  },
  async fetch(): Promise<RawSignal[]> {
    try {
      const result = await osintFetch(CISA_KEV_URL, { sourceConfig: cisaKev.config });
      const parsed: unknown = JSON.parse(result.body);
      if (!isObject(parsed)) return [];
      const vulns = parsed['vulnerabilities'];
      if (!Array.isArray(vulns)) return [];
      const fetched_at = new Date().toISOString();
      const out: RawSignal[] = [];
      for (const v of vulns) {
        if (!isObject(v)) continue;
        out.push({
          source: 'cisa_kev' as const,
          signal_type: 'vendor_advisory' as const,
          observed_at_source: pickString(v['dateAdded']),
          fetched_at,
          payload: v,
        });
      }
      return out;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[osint:cisa_kev] fetch failed: ${reason}`);
      return [];
    }
  },
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
