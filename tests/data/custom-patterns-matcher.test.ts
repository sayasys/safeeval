// Pattern matcher -- Subset semantics coverage (Phase 4, Piece 1).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 4.1. Exercises matchPatterns / evaluatePattern against the screenshot
// walkthrough (section 4.1) plus the wildcard / single-group / multi-group /
// missing-tag / multi-pattern cases the Phase 4 brief enumerates.

import { describe, it, expect } from 'vitest';
import {
  matchPatterns,
  evaluatePattern,
  type ClassificationTagSet,
} from '../../src/lib/data/custom-patterns/matcher';
import type {
  PatternWithComponents,
  PatternComponent,
  L3GroupName,
  MatchMode,
  PatternStatus,
} from '../../src/lib/data/custom-patterns/types';

let compSeq = 0;
function comp(group: L3GroupName, tag: string): PatternComponent {
  compSeq += 1;
  return {
    id: compSeq,
    pattern_id: 'pattern-1',
    group_name: group,
    tag_id: tag,
    tag_source: 'closed_set',
    weight: 1.0,
    created_at: '2023-11-14T00:00:00.000Z',
  };
}

function pattern(overrides: Partial<PatternWithComponents> = {}): PatternWithComponents {
  return {
    id: 'pattern-1',
    organization_id: 'org-a',
    name: 'Romance-Crypto Cross Pollination',
    typology: 'investment_fraud',
    match_mode: 'subset' as MatchMode,
    status: 'active' as PatternStatus,
    created_at: '2023-11-14T00:00:00.000Z',
    components: [],
    ...overrides,
  };
}

// The section 4.1 screenshot evaluation: L1 deceptive_fraud, L2 investment_fraud,
// plus the grouped L3 tags.
const SCREENSHOT: ClassificationTagSet = {
  typologies: ['deceptive_fraud', 'investment_fraud'],
  groups: {
    method: ['sock_puppet'],
    tactic: ['trust_love', 'greed', 'reciprocity', 'isolation'],
    target: ['lonely_individual', 'crypto_holder'],
    overlap: ['secondary_victimization', 'payment_fraud_enablement'],
    risk_marker: ['specific_victim_targeted', 'payment_instruction_embedded'],
  },
};

describe('matchPatterns -- Subset semantics', () => {
  it('matches a pattern whose every named component is present (section 4.1 walkthrough)', () => {
    const p = pattern({
      typology: 'investment_fraud',
      components: [
        comp('tactic', 'trust_love'),
        comp('target', 'crypto_holder'),
        comp('overlap', 'payment_fraud_enablement'),
        comp('risk_marker', 'payment_instruction_embedded'),
      ],
    });
    const matches = matchPatterns(SCREENSHOT, [p]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.pattern_id).toBe('pattern-1');
    expect(matches[0]?.match_mode).toBe('subset');
    expect(matches[0]?.components_missing).toEqual([]);
    expect(matches[0]?.components_present).toEqual(
      expect.arrayContaining(['trust_love', 'crypto_holder', 'payment_fraud_enablement', 'payment_instruction_embedded']),
    );
  });

  it('all groups wildcard (no components) -> matches any classification whose typology matches', () => {
    const p = pattern({ typology: 'investment_fraud', components: [] });
    expect(matchPatterns(SCREENSHOT, [p])).toHaveLength(1);
  });

  it('single-group exact match', () => {
    const p = pattern({ components: [comp('tactic', 'trust_love')] });
    expect(matchPatterns(SCREENSHOT, [p])).toHaveLength(1);
  });

  it('multi-group exact match (every named group satisfied)', () => {
    const p = pattern({
      components: [comp('method', 'sock_puppet'), comp('target', 'crypto_holder')],
    });
    expect(matchPatterns(SCREENSHOT, [p])).toHaveLength(1);
  });

  it('a tag missing from one named group -> no match', () => {
    const p = pattern({
      components: [comp('tactic', 'trust_love'), comp('target', 'business_executive')],
    });
    expect(matchPatterns(SCREENSHOT, [p])).toHaveLength(0);

    const ev = evaluatePattern(SCREENSHOT, p);
    expect(ev.matched).toBe(false);
    expect(ev.components_present).toEqual(['trust_love']);
    expect(ev.components_missing).toEqual(['business_executive']);
  });

  it('typology mismatch alone -> no match even when every component is present', () => {
    const p = pattern({
      typology: 'romance_fraud',
      components: [comp('tactic', 'trust_love')],
    });
    const ev = evaluatePattern(SCREENSHOT, p);
    expect(ev.typology_matched).toBe(false);
    expect(ev.components_missing).toEqual([]); // the component IS present...
    expect(ev.matched).toBe(false); // ...but the typology gates it out
    expect(matchPatterns(SCREENSHOT, [p])).toHaveLength(0);
  });

  it('extra tags in the classification do not prevent a Subset match', () => {
    // The classification has many tags the pattern does not name; Subset only
    // requires that the NAMED tags are present.
    const p = pattern({ components: [comp('tactic', 'greed')] });
    expect(matchPatterns(SCREENSHOT, [p])).toHaveLength(1);
  });

  it('multiple patterns -> only the matching subset is returned', () => {
    const matching = pattern({
      id: 'p-match',
      name: 'Matches',
      components: [comp('tactic', 'trust_love')],
    });
    const notMatching = pattern({
      id: 'p-miss',
      name: 'Misses',
      components: [comp('method', 'impersonation')], // not present
    });
    const wrongTypology = pattern({
      id: 'p-typ',
      name: 'WrongTypology',
      typology: 'deceptive_fraud', // present in typologies -> still eligible
      components: [comp('target', 'crypto_holder')],
    });

    const matches = matchPatterns(SCREENSHOT, [matching, notMatching, wrongTypology]);
    const ids = matches.map((m) => m.pattern_id).sort();
    expect(ids).toEqual(['p-match', 'p-typ']);
  });

  it('skips archived patterns and weighted-mode patterns (Phase 5 deferral)', () => {
    const archived = pattern({ id: 'p-arch', status: 'archived', components: [comp('tactic', 'trust_love')] });
    const weighted = pattern({ id: 'p-wt', match_mode: 'weighted', components: [comp('tactic', 'trust_love')] });
    expect(matchPatterns(SCREENSHOT, [archived, weighted])).toHaveLength(0);
  });

  it('treats an absent group key as no tags present', () => {
    const cls: ClassificationTagSet = { typologies: ['investment_fraud'], groups: {} };
    const p = pattern({ components: [comp('tactic', 'trust_love')] });
    expect(matchPatterns(cls, [p])).toHaveLength(0);
  });
});
