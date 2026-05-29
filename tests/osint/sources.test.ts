// Tests for the OSINT source registry.
//
// Coverage: every wired source module exports the Source contract shape;
// the closed-set source IDs match the SourceId type union; getSources()
// returns the full Tier 1 set; per-source allow-list domains are present;
// Phase 1 fetcher stubs return empty RawSignal arrays.

import { describe, expect, it } from 'vitest';
import { fetchAllSources, getSources } from '../../src/lib/osint/index';
import { Source, SourceId } from '../../src/lib/osint/types';

const TIER_1_IDS: readonly SourceId[] = [
  'ic3',
  'ftc',
  'cisa_kev',
  'krebs',
  'bleeping_computer',
  'reddit_scams',
  'reddit_phishing',
];

describe('source registry shape', () => {
  it('returns exactly the Tier 1 closed-set source IDs', () => {
    const ids = getSources().map((s) => s.id).sort();
    expect(ids).toEqual([...TIER_1_IDS].sort());
  });

  it.each(TIER_1_IDS)('source %s exports the Source contract', (sourceId) => {
    const source = getSources().find((s) => s.id === sourceId);
    expect(source).toBeDefined();
    if (!source) return; // narrowing for TS
    expect(typeof source.name).toBe('string');
    expect(source.name.length).toBeGreaterThan(0);
    expect(typeof source.fetch).toBe('function');
    expect(source.config).toBeDefined();
    expect(Array.isArray(source.config.allowedDomains)).toBe(true);
    expect(source.config.allowedDomains.length).toBeGreaterThan(0);
  });

  it.each(TIER_1_IDS)('source %s fetch() returns an array (Phase 1 stubs empty)', async (sourceId) => {
    const source = getSources().find((s) => s.id === sourceId) as Source;
    const signals = await source.fetch();
    expect(Array.isArray(signals)).toBe(true);
    expect(signals.length).toBe(0);
  });
});

describe('fetchAllSources aggregation', () => {
  it('returns an empty array when every source is a Phase 1 stub', async () => {
    const all = await fetchAllSources();
    expect(all).toEqual([]);
  });
});

describe('per-source allow-list smoke', () => {
  it('IC3 allow-list covers ic3.gov and the canonical www subdomain', () => {
    const ic3 = getSources().find((s) => s.id === 'ic3') as Source;
    expect(ic3.config.allowedDomains).toContain('www.ic3.gov');
  });

  it('Reddit sources share the reddit.com allow-list', () => {
    const scams = getSources().find((s) => s.id === 'reddit_scams') as Source;
    const phishing = getSources().find((s) => s.id === 'reddit_phishing') as Source;
    expect(scams.config.allowedDomains).toContain('www.reddit.com');
    expect(phishing.config.allowedDomains).toContain('www.reddit.com');
  });

  it('CISA KEV has an explicit response-size override above the 1MB default', () => {
    const cisa = getSources().find((s) => s.id === 'cisa_kev') as Source;
    expect(cisa.config.maxResponseBytes).toBeDefined();
    expect(cisa.config.maxResponseBytes!).toBeGreaterThan(1_048_576);
  });
});
