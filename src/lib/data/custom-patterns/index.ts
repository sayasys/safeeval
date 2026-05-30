// Public surface for the custom patterns + custom L3 classifiers module
// (Phase 1). Persistence helpers, the agnostic-output composer, types, errors,
// and tunable constants.
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md.

export * from './types';
export * from './errors';
export * from './constants';

export {
  createPattern,
  getPattern,
  listPatterns,
  listPatternsWithComponents,
  archivePattern,
  resolveStore,
  type CustomPatternsOptions,
} from './patterns';

export {
  createCustomClassifier,
  getCustomClassifier,
  listCustomClassifiers,
  promoteToShadow,
  promoteToLive,
  retireClassifier,
} from './classifiers';

export {
  composeEvaluationEnvelope,
  missingAgnosticBaseKeys,
  AGNOSTIC_BASE_ENVELOPE_KEYS,
  OVERLAY_ENVELOPE_KEYS,
  type EvaluationEnvelope,
  type OverlayMatches,
  type PatternMatch,
  type CustomL3Match,
} from './envelope';

export {
  makeSupabaseCustomPatternsStore,
  makeInMemoryCustomPatternsStore,
  CustomPatternsStoreError,
  type CustomPatternsStore,
} from './store';
