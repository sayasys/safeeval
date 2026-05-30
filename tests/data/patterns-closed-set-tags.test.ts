// Drift guard for the pattern composer's closed-set tag vocabulary (Phase 3 UI).
//
// src/app/app/patterns/closed-set-tags.ts hardcodes the six prompt-mode L3 tag
// lists the composer offers as built-in options. The source of truth is the
// engine constant L3_VALUES_BY_CATEGORY in src/lib/safeeval-v5.js (itself in
// lockstep with docs/08-v5-ontology.md sections 3.1-3.8 via scripts/
// check-lockstep.js). This test keeps the hardcoded copy honest by reading BOTH
// files as text and asserting per-group set equality -- the same mechanism
// check-lockstep.js uses for the other engine/doc closed sets. It deliberately
// does NOT import the engine module (tsconfig allowJs is false, and the engine
// is excluded from the TS project); reading source text sidesteps both.
//
// If the engine vocabulary changes, this test fails until closed-set-tags.ts is
// brought back into lockstep -- which is exactly the signal a future Phase 4
// pattern matcher (which reads the engine's emitted tags) needs.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const ENGINE = resolve(ROOT, 'src', 'lib', 'safeeval-v5.js');
const COMPOSER_TAGS = resolve(ROOT, 'src', 'app', 'app', 'patterns', 'closed-set-tags.ts');

// The six prompt-mode L3 groups (method/tactic/target/context_marker/overlap/
// risk_marker). arc + cadence are conversation-mode and intentionally excluded
// from the pattern-composition vocabulary, so they are not checked here.
const GROUPS = ['method', 'tactic', 'target', 'context_marker', 'overlap', 'risk_marker'];

// Pull the inner text of `<container> = {` ... matching `\n};` so a group key
// regex cannot stray into unrelated source (e.g. prose mentioning `method:`).
function objectBlock(source: string, declaration: string): string {
  const start = source.indexOf(declaration);
  if (start === -1) throw new Error(`could not find "${declaration}"`);
  const end = source.indexOf('\n};', start);
  if (end === -1) throw new Error(`could not find end of block for "${declaration}"`);
  return source.slice(start, end);
}

// Extract the quoted string members of `<group>: [ ... ]` within a block.
function extractGroup(block: string, group: string): string[] {
  const m = block.match(new RegExp(`(?:^|[^\\w])${group}\\s*:\\s*\\[([\\s\\S]*?)\\]`));
  if (!m) throw new Error(`could not find array for group "${group}"`);
  const inner = m[1] ?? '';
  return Array.from(inner.matchAll(/'([^']+)'/g), (q) => q[1] as string);
}

const engineBlock = objectBlock(readFileSync(ENGINE, 'utf8'), 'L3_VALUES_BY_CATEGORY = {');
const composerBlock = objectBlock(
  readFileSync(COMPOSER_TAGS, 'utf8'),
  'CLOSED_SET_TAGS_BY_GROUP',
);

describe('closed-set-tags.ts is in lockstep with the engine L3 vocabulary', () => {
  for (const group of GROUPS) {
    it(`${group}: composer copy equals the engine set`, () => {
      const engineTags = extractGroup(engineBlock, group);
      const composerTags = extractGroup(composerBlock, group);
      // Both non-empty (a regex miss must not pass as a trivially-equal empty set).
      expect(engineTags.length).toBeGreaterThan(0);
      expect(composerTags.length).toBeGreaterThan(0);
      // Set equality, order-independent.
      expect([...composerTags].sort()).toEqual([...engineTags].sort());
    });

    it(`${group}: composer copy has no duplicates`, () => {
      const composerTags = extractGroup(composerBlock, group);
      expect(new Set(composerTags).size).toBe(composerTags.length);
    });
  }

  it('covers exactly the six prompt-mode groups', () => {
    // arc + cadence must NOT appear in the composer vocabulary.
    expect(composerBlock).not.toMatch(/(?:^|[^\w])arc\s*:\s*\[/);
    expect(composerBlock).not.toMatch(/(?:^|[^\w])cadence\s*:\s*\[/);
  });
});
