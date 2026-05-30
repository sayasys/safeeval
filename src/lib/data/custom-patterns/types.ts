// Types for the custom patterns + custom L3 classifiers overlay (Phase 1).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 3 (schema) + section 8 (agnostic-output envelope).
//
// These shapes mirror the M13 migration tables one-for-one. The SQL is the
// source of truth for the closed sets; this file re-declares them in TypeScript
// and the checkCustomPatternGroupsLockstep verifier (scripts/check-lockstep.js)
// keeps the L3_GROUP_NAMES constant in lockstep with the SQL group_name CHECK.

// ---------------------------------------------------------------------------
// Closed sets (mirror the M13 CHECK constraints).
// ---------------------------------------------------------------------------

// The L3 group vocabulary. Six architect-owned groups per docs/08-v5-ontology.md
// (method 3.1, tactic 3.2, target 3.3, context_marker 3.4, overlap 3.5,
// risk_marker 3.8). The scoping memo's prose foregrounds five "primary" groups
// (METHOD/TACTIC/TARGET/OVERLAP/RISK_MARKER) but its DDL group_name CHECK -- the
// canonical schema -- includes context_marker as the sixth (conditionally
// surfaced in the UI). This constant matches the DDL, and the lockstep verifier
// asserts set equality between the two so they can never silently drift.
export const L3_GROUP_NAMES = [
  'method',
  'tactic',
  'target',
  'context_marker',
  'overlap',
  'risk_marker',
] as const;
export type L3GroupName = (typeof L3_GROUP_NAMES)[number];

export const MATCH_MODES = ['subset', 'weighted'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export const TAG_SOURCES = ['closed_set', 'org_custom'] as const;
export type TagSource = (typeof TAG_SOURCES)[number];

export const PATTERN_STATUSES = ['active', 'archived'] as const;
export type PatternStatus = (typeof PATTERN_STATUSES)[number];

export const CLASSIFIER_STATUSES = ['proposed', 'shadow', 'live', 'retired'] as const;
export type ClassifierStatus = (typeof CLASSIFIER_STATUSES)[number];

export const EXAMPLE_KINDS = ['positive', 'negative'] as const;
export type ExampleKind = (typeof EXAMPLE_KINDS)[number];

// ---------------------------------------------------------------------------
// Row shapes (persisted records).
// ---------------------------------------------------------------------------

export interface Pattern {
  id: string;
  organization_id: string;
  name: string;
  typology: string;
  match_mode: MatchMode;
  status: PatternStatus;
  created_at: string;
}

export interface PatternComponent {
  id: number;
  pattern_id: string;
  group_name: L3GroupName;
  tag_id: string;
  tag_source: TagSource;
  weight: number;
  created_at: string;
}

export interface PatternWithComponents extends Pattern {
  components: PatternComponent[];
}

export interface CustomL3Classifier {
  id: string;
  organization_id: string;
  group_name: L3GroupName;
  tag_name: string;
  definition: string;
  status: ClassifierStatus;
  shadow_started_at: string | null;
  promoted_at: string | null;
  retired_at: string | null;
  created_by_user_id: string;
  created_at: string;
}

export interface CustomL3Example {
  id: number;
  classifier_id: string;
  kind: ExampleKind;
  text: string;
  created_at: string;
}

export interface CustomL3ClassifierWithExamples extends CustomL3Classifier {
  examples: CustomL3Example[];
}

// ---------------------------------------------------------------------------
// Input shapes (caller-supplied; ids / timestamps / status are assigned by the
// persistence layer, not the caller).
// ---------------------------------------------------------------------------

export interface NewPatternComponent {
  group_name: L3GroupName;
  tag_id: string;
  tag_source: TagSource;
  // Optional; defaults to 1.0. Only consulted in weighted mode (Phase 5).
  weight?: number;
}

export interface NewPattern {
  name: string;
  typology: string;
  // Optional; defaults to 'subset' (the Steven-locked default match mode).
  match_mode?: MatchMode;
  components: NewPatternComponent[];
}

export interface NewCustomL3Example {
  kind: ExampleKind;
  text: string;
}

export interface NewCustomL3Classifier {
  group_name: L3GroupName;
  tag_name: string;
  definition: string;
  created_by_user_id: string;
}
