// Threat-intelligence page coverage. The page and its layout are server React
// surfaces the node test environment cannot render, so -- following the
// evaluator-polish.test.ts convention -- these assertions read the source and
// check the structural and copy decisions, plus import the sample-signals data
// module to validate its shape against the real closed-set vocabularies.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SAMPLE_SIGNALS } from '../../src/app/intelligence/sample-signals';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

const LAYOUT_SRC = read('src/app/intelligence/layout.js');
const PAGE_SRC = read('src/app/intelligence/page.js');

const VERDICTS = new Set(['known_ttp', 'new_ttp_proposed', 'low_signal_dismissed']);
const SOURCES = new Set([
  'CISA KEV', 'IC3', 'FTC', 'Krebs on Security',
  'Bleeping Computer', 'Reddit r/scams', 'Reddit r/phishing',
]);

// The engine is plain .js with no type declarations (allowJs is false), so we
// read the real L3 method closed set out of the source rather than importing
// it -- the same readFileSync convention these app tests already use. This
// keeps ttp_type validation tied to the actual L3_VALUES_BY_CATEGORY.method
// array in safeeval-v5.js.
function readMethodClosedSet(): Set<string> {
  const src = read('src/lib/safeeval-v5.js');
  const block = src.match(/method:\s*\[([\s\S]*?)\]/);
  if (!block) throw new Error('could not locate L3 method block in safeeval-v5.js');
  const tokens = [...(block[1] ?? '').matchAll(/'([a-z_]+)'/g)]
    .map((m) => m[1])
    .filter((t): t is string => typeof t === 'string');
  return new Set(tokens);
}
const METHOD_VALUES = readMethodClosedSet();

describe('intelligence layout: portfolio-cut chrome', () => {
  // Public portfolio cut: the signed-in product nav (AppNav) is a SaaS-side
  // surface that ships only in the private safeeval-saas repo. This layout
  // renders the landing Nav for everyone -- no auth-state branch.
  it('renders the landing Nav and carries no signed-in product nav', () => {
    expect(LAYOUT_SRC).toContain('<Nav current="/intelligence" />');
    expect(LAYOUT_SRC).not.toContain('AppNav');
    expect(LAYOUT_SRC).not.toContain('getCurrentUser');
  });

  it('frames the page with the shared Footer', () => {
    expect(LAYOUT_SRC).toContain('<Footer />');
  });
});

describe('intelligence page: hero + pipeline + feed copy', () => {
  it('leads with a "Threat intelligence" H1 at hero scale', () => {
    expect(PAGE_SRC).toMatch(/<h1[^>]*>\s*Threat intelligence\s*<\/h1>/);
    expect(PAGE_SRC).toContain('text-4xl md:text-5xl');
  });

  it('explains the pipeline scope in plain language', () => {
    expect(PAGE_SRC).toContain('SafeEval monitors public fraud-and-scams reporting');
    expect(PAGE_SRC).toContain('not identities or');
  });

  it('describes the three pipeline steps including defensive prompting', () => {
    expect(PAGE_SRC).toContain('Sources');
    expect(PAGE_SRC).toContain('Classifier');
    expect(PAGE_SRC).toContain('Closed-set vocabulary');
    expect(PAGE_SRC).toContain('three layers of defensive prompting');
    expect(PAGE_SRC).toContain('cannot hijack the pipeline');
  });

  it('renders the sample feed and an honest footer note', () => {
    expect(PAGE_SRC).toContain('SAMPLE_SIGNALS.map');
    expect(PAGE_SRC).toContain('Daily aggregation pipeline coming in a future release');
    expect(PAGE_SRC).toContain('captured during integration testing');
  });

  it('uses the cool-institutional design language', () => {
    expect(PAGE_SRC).toContain('bg-white border border-slate-200 rounded-xl');
    expect(PAGE_SRC).toContain('text-xs font-semibold text-slate-700 uppercase tracking-wider');
  });

  it('keeps internal build vocabulary out of the served page', () => {
    for (const banned of ['Phase 1', 'Phase 2', 'Phase 3', 'scoping memo', 'stub']) {
      // Only the comment header may not contain these; the rendered JSX/string
      // literals below the imports must be clean. Check the whole file is free
      // of them inside JSX by asserting they do not appear in the page body at
      // all (the page header comment is deliberately written without them).
      expect(PAGE_SRC).not.toContain(banned);
    }
  });
});

describe('intelligence sample signals: shape + closed-set vocabulary', () => {
  it('provides a feed of representative signals (>= 15)', () => {
    expect(SAMPLE_SIGNALS.length).toBeGreaterThanOrEqual(15);
  });

  it('every signal has the required fields populated', () => {
    for (const s of SAMPLE_SIGNALS) {
      expect(typeof s.source).toBe('string');
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.reasoning.length).toBeGreaterThan(0);
      expect(SOURCES.has(s.source)).toBe(true);
    }
  });

  it('ttp_type values are drawn from the real L3 method closed set', () => {
    for (const s of SAMPLE_SIGNALS) {
      expect(METHOD_VALUES.has(s.ttp_type)).toBe(true);
    }
  });

  it('classification values are within the verdict closed set', () => {
    for (const s of SAMPLE_SIGNALS) {
      expect(VERDICTS.has(s.classification)).toBe(true);
    }
  });

  it('timestamps are valid ISO 8601 dates', () => {
    for (const s of SAMPLE_SIGNALS) {
      expect(Number.isNaN(Date.parse(s.timestamp))).toBe(false);
    }
  });

  it('covers the full source mix and exercises every verdict', () => {
    const usedSources = new Set(SAMPLE_SIGNALS.map((s) => s.source));
    expect(usedSources.size).toBe(SOURCES.size);
    const usedVerdicts = new Set(SAMPLE_SIGNALS.map((s) => s.classification));
    expect(usedVerdicts.size).toBe(VERDICTS.size);
  });

  it('no served data field leaks internal build vocabulary', () => {
    for (const s of SAMPLE_SIGNALS) {
      const blob = `${s.title} ${s.reasoning}`;
      for (const banned of ['Phase 1', 'Phase 2', 'scoping memo', 'stub']) {
        expect(blob).not.toContain(banned);
      }
    }
  });
});
