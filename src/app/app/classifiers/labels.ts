// Display vocabulary for the custom L3 classifier surface (Phase 2 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 5 (definition flow) + 6 (shadow -> live lifecycle). These are
// presentation-only maps; the closed sets themselves live in the Phase 1
// persistence layer (src/lib/data/custom-patterns/types.ts) and are the source
// of truth. Keyed off those same closed-set literals so a drift surfaces as a
// TypeScript error here rather than a wrong label at runtime.

import type {
  L3GroupName,
  ClassifierStatus,
} from '@/lib/data/custom-patterns';
import { L3_GROUP_NAMES } from '@/lib/data/custom-patterns';

// Human-readable group headers. The six closed-set L3 groups render as the row
// organizers on the evaluation card; the labels mirror that uppercase framing.
export const GROUP_LABELS: Record<L3GroupName, string> = {
  method: 'Method',
  tactic: 'Tactic',
  target: 'Target',
  context_marker: 'Context marker',
  overlap: 'Overlap',
  risk_marker: 'Risk marker',
};

// One short sentence per group, surfaced as helper text under the group
// dropdown so a customer picks the right L3 dimension for their tag.
export const GROUP_HINTS: Record<L3GroupName, string> = {
  method: 'How the fraud is carried out (e.g. a sock-puppet account).',
  tactic: 'The persuasion lever applied (e.g. trust, greed, urgency).',
  target: 'Who the fraud is aimed at (e.g. a crypto holder).',
  context_marker: 'A domain-specific framing that disambiguates intent.',
  overlap: 'A cross-cutting harm that co-occurs with the primary fraud.',
  risk_marker: 'A concrete signal that raises the severity of the input.',
};

export interface GroupOption {
  value: L3GroupName;
  label: string;
  hint: string;
}

// Ordered options for the group-placement dropdown. Derived from the closed set
// so a new group added to the schema appears here automatically.
export const GROUP_OPTIONS: GroupOption[] = L3_GROUP_NAMES.map((value) => ({
  value,
  label: GROUP_LABELS[value],
  hint: GROUP_HINTS[value],
}));

export interface StatusMeta {
  label: string;
  // Tailwind classes for the status badge. Restricted to the cream / sage /
  // slate palette; coral is reserved for destructive actions.
  badgeClass: string;
  // One-line description shown on the detail view next to the lifecycle action.
  description: string;
}

export const STATUS_META: Record<ClassifierStatus, StatusMeta> = {
  proposed: {
    label: 'Proposed',
    badgeClass: 'bg-cream-100 text-slate-700 border border-sage-200',
    description:
      'Draft. Add at least two positive and two negative examples, then move it to shadow.',
  },
  shadow: {
    label: 'Shadow',
    badgeClass: 'bg-sage-50 text-sage-700 border border-sage-300',
    description:
      'Collecting calibration data. Verdicts are visible to reviewers but not in member-facing evaluation cards. Promote to live once the calibration gate is met.',
  },
  live: {
    label: 'Live',
    badgeClass: 'bg-sage-100 text-sage-700 border border-sage-400',
    description:
      'Appearing in this organization\'s evaluation cards alongside the base envelope.',
  },
  retired: {
    label: 'Retired',
    badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200',
    description:
      'No longer evaluated against new inputs. The definition is preserved so historical evaluations still render.',
  },
};

// The order statuses are grouped in the list view: active lifecycle first,
// terminal state last. Typed against the closed set so a renamed status is a
// compile error here.
export const STATUS_DISPLAY_ORDER: readonly ClassifierStatus[] = [
  'proposed',
  'shadow',
  'live',
  'retired',
];
