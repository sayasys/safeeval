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
  computePromotionReadiness,
  recordMatchCheck,
  recordInferencePass,
  recordMatchFeedback,
  getFeedbackReviewerIds,
  type PromotionReadiness,
} from './promotion';

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
  matchPatterns,
  evaluatePattern,
  type ClassificationTagSet,
  type PatternEvaluation,
} from './matcher';

export {
  runCustomL3InferencePass,
  matchBrightLine,
  parseVerdict,
  detectInstructionLeakage,
  SYSTEM_PROMPT_PREFIX as CUSTOM_L3_SYSTEM_PROMPT_PREFIX,
  CUSTOM_L3_MODEL,
  type CallModelFn,
  type InferenceOptions,
  type InferenceInput,
  type InferencePassResult,
  type ClassifierCheckResult,
} from './inference';

export {
  makeSupabaseCustomPatternsStore,
  makeInMemoryCustomPatternsStore,
  CustomPatternsStoreError,
  type CustomPatternsStore,
} from './store';
