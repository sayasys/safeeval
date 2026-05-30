// Display vocabulary for the pattern composer surface (Phase 3 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 3.1 (org_patterns: status active|archived, match_mode subset|weighted)
// + 3.2 (pattern_components: group_name closed set, tag_source closed_set|
// org_custom) + 4 (match semantics) + 12.3 (Phase 3 scope). Presentation-only
// maps; the closed sets themselves live in the Phase 1 persistence layer
// (src/lib/data/custom-patterns/types.ts) and are the source of truth. Keyed off
// those same closed-set literals so a drift surfaces as a TypeScript error here
// rather than a wrong label at runtime.

import type {
  L3GroupName,
  PatternStatus,
  MatchMode,
  TagSource,
} from '@/lib/data/custom-patterns';
import { L3_GROUP_NAMES } from '@/lib/data/custom-patterns';

// Human-readable L3 group headers. These six closed-set groups are the section
// organizers in the composer and on the detail view; the labels mirror the
// uppercase framing used on the evaluation card.
export const GROUP_LABELS: Record<L3GroupName, string> = {
  method: 'Method',
  tactic: 'Tactic',
  target: 'Target',
  context_marker: 'Context marker',
  overlap: 'Overlap',
  risk_marker: 'Risk marker',
};

// One short sentence per group, surfaced as helper text under each composer
// section so an org owner understands what a tag in that group means.
export const GROUP_HINTS: Record<L3GroupName, string> = {
  method: 'How the fraud is carried out (e.g. a sock-puppet account).',
  tactic: 'The persuasion lever applied (e.g. trust, greed, urgency).',
  target: 'Who the fraud is aimed at (e.g. a crypto holder).',
  context_marker: 'A domain-specific framing that disambiguates intent.',
  overlap: 'A cross-cutting harm that co-occurs with the primary fraud.',
  risk_marker: 'A concrete signal that raises the severity of the input.',
};

// Stable ordering of the group sections in the composer / detail view. Derived
// from the closed set so a new group added to the schema appears automatically.
export const GROUP_ORDER: readonly L3GroupName[] = L3_GROUP_NAMES;

export interface StatusMeta {
  label: string;
  // Tailwind classes for the status badge. Restricted to the cream / sage /
  // slate palette; coral is reserved for destructive actions.
  badgeClass: string;
  // One-line description shown on the detail view next to the lifecycle action.
  description: string;
}

// Pattern status is the M13 closed set: active | archived (memo 3.1). Unlike a
// custom classifier, a Pattern needs no calibration period -- it is a pure
// composition rule, so it is usable the moment it is created (status 'active').
// The only lifecycle transition is archival.
export const STATUS_META: Record<PatternStatus, StatusMeta> = {
  active: {
    label: 'Active',
    badgeClass: 'bg-sage-100 text-sage-700 border border-sage-400',
    description:
      'Live. This pattern is matched against every evaluation in your organization once the pattern-match pass ships.',
  },
  archived: {
    label: 'Archived',
    badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200',
    description:
      'No longer matched against new evaluations. The composition is preserved so historical references still resolve.',
  },
};

// The order statuses are grouped in the list view: active first, archived last.
// Typed against the closed set so a renamed status is a compile error here.
export const STATUS_DISPLAY_ORDER: readonly PatternStatus[] = ['active', 'archived'];

// Match mode (memo 4). Phase 3 ships Subset only; Weighted is the Phase 5
// opt-in. The map covers both so the badge renders correctly if a weighted
// pattern is ever read, but the composer only ever writes 'subset'.
export const MATCH_MODE_LABELS: Record<MatchMode, string> = {
  subset: 'Subset',
  weighted: 'Weighted',
};

// Tag origin badge (memo 3.2). Distinguishes architect-owned closed-set tags
// from the org's own custom L3 classifiers in the composer and on the detail
// view's component list.
export const TAG_SOURCE_LABELS: Record<TagSource, string> = {
  closed_set: 'Built-in',
  org_custom: 'Custom',
};

export const TAG_SOURCE_BADGE_CLASS: Record<TagSource, string> = {
  closed_set: 'bg-cream-100 text-slate-600 border border-sage-200',
  org_custom: 'bg-sage-50 text-sage-700 border border-sage-300',
};
