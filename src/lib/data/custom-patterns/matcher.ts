// Pattern matcher -- Subset semantics (Phase 4, Piece 1).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 4.1 (Subset match semantics) + section 9.5 (the post-classification
// pattern-match pass). This is the deterministic set-comparison pass that runs
// AFTER Stage 3 and the custom-L3 inference pass: it assembles no inference, it
// reads no model, it only compares the evaluation's tag set against each active
// pattern's named components.
//
// Subset (the Steven-locked default, the only mode Phase 4 implements):
//   A pattern matches iff (a) the pattern's typology is one of the evaluation's
//   typology values, AND (b) for every L3 group the pattern names components in,
//   every named tag is present in the evaluation's tags for that group. Groups
//   the pattern does not name are wildcards (not checked). The evaluation may
//   carry MORE tags than the pattern names -- that is fine; Subset only requires
//   that every named tag is present (memo 4.1).
//
// Weighted (memo 4.2) is Phase 5 and is intentionally NOT implemented here; a
// 'weighted' pattern reaching this pass is treated as a no-op (skipped) so the
// Phase 5 toggle can land without a Phase 4 regression. The weight column is
// ignored in Subset mode (memo 3.2 / 4.1).
//
// Performance: O(patterns x components). Pattern matching is sub-millisecond
// even for orgs with hundreds of patterns (memo 9.5), so this is synchronous --
// no async, no inference, no concurrency cap.
//
// The matcher consumes a normalized ClassificationTagSet rather than the raw v5
// envelope so it is decoupled from the envelope's internal shape: the engine
// integration (the caller) is responsible for assembling the union of closed-set
// L3 tags (from Stage 3) and org-custom L3 tags whose inference verdict was
// `matches` (memo 9.5) into this shape. The matcher does not distinguish
// closed-set from org-custom tags -- a present tag is a present tag.

import type { PatternWithComponents, L3GroupName } from './types';
import type { PatternMatch } from './envelope';

// The evaluation's classification reduced to the surface the matcher compares
// against. `typologies` is the set of typology values the evaluation carries
// (typically [l1, l2]); a pattern's single closed-set typology must be one of
// them (memo 4.1 matched the pattern's `investment_fraud` against the
// evaluation's L2). `groups` maps each L3 group to the tags present in that
// group; an absent group key is equivalent to an empty array (no tags present).
export interface ClassificationTagSet {
  typologies: string[];
  groups: Partial<Record<L3GroupName, readonly string[]>>;
}

// The full per-pattern evaluation -- exposed (alongside the matched-only
// matchPatterns) so the marketing side-by-side (Phase 6) and tests can inspect
// near-misses (which named component was missing) without re-deriving them.
export interface PatternEvaluation {
  pattern_id: string;
  name: string;
  typology: string;
  matched: boolean;
  typology_matched: boolean;
  components_present: string[];
  components_missing: string[];
}

function tagsForGroup(cls: ClassificationTagSet, group: L3GroupName): readonly string[] {
  return cls.groups[group] ?? [];
}

// Evaluate a single pattern against the classification under Subset semantics.
// Returns the full evaluation (matched or not); matchPatterns filters to matches.
export function evaluatePattern(
  cls: ClassificationTagSet,
  pattern: PatternWithComponents,
): PatternEvaluation {
  const typology_matched = cls.typologies.includes(pattern.typology);

  const components_present: string[] = [];
  const components_missing: string[] = [];
  for (const component of pattern.components) {
    const present = tagsForGroup(cls, component.group_name).includes(component.tag_id);
    if (present) {
      components_present.push(component.tag_id);
    } else {
      components_missing.push(component.tag_id);
    }
  }

  // Subset: matched iff the typology matches AND no named component is missing.
  const matched = typology_matched && components_missing.length === 0;

  return {
    pattern_id: pattern.id,
    name: pattern.name,
    typology: pattern.typology,
    matched,
    typology_matched,
    components_present,
    components_missing,
  };
}

// Match every active pattern against the classification and return the overlay
// entries for the patterns that matched (memo section 8 envelope shape). Only
// `active`-status, `subset`-mode patterns participate: archived patterns are not
// evaluated, and weighted-mode patterns are deferred to Phase 5 (skipped here).
//
// The caller is expected to pass the org's active patterns (the persistence
// layer filters status='active'); this function additionally guards on status
// and match_mode so a mis-scoped caller cannot leak an archived or weighted
// pattern into the overlay.
export function matchPatterns(
  cls: ClassificationTagSet,
  patterns: readonly PatternWithComponents[],
): PatternMatch[] {
  const matches: PatternMatch[] = [];
  for (const pattern of patterns) {
    if (pattern.status !== 'active') continue;
    // Weighted is Phase 5; a weighted pattern is not matched by the Subset pass.
    if (pattern.match_mode !== 'subset') continue;

    const evaluation = evaluatePattern(cls, pattern);
    if (!evaluation.matched) continue;

    matches.push({
      pattern_id: evaluation.pattern_id,
      name: evaluation.name,
      typology: evaluation.typology,
      match_mode: pattern.match_mode,
      components_present: evaluation.components_present,
      // Subset matches have no missing components by definition; carried for the
      // memo-8 envelope shape (and to keep the overlay entry uniform with the
      // Phase 5 weighted entry, which may report partial composition).
      components_missing: evaluation.components_missing,
    });
  }
  return matches;
}
