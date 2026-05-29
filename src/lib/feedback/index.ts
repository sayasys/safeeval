// Public surface of the classifier-edits feedback module.
//
// Spec: docs/memos/2026-05-28-classifier-feedback-loop-scoping.md
//
// Phase 1 exports the closed-set vocabularies, the recordEdit() entry
// point, the permission matrix, and the two error types. Phase 2 adds the
// daily aggregation loop, the fine-tuning corpus export, the LLM-assisted
// free-text clustering, the cron entry point, and the feedback store
// surface. The qa_proposed_edits flow and reviewer UI remain out of scope
// (Phase 3+).

export {
  EDITOR_ROLES,
  FIELD_PATHS,
  RATIONALE_TAGS,
  PROPAGATION_STATUSES,
  CHANGE_TYPES,
  isFieldPath,
  isRationaleTag,
  isEditorRole,
  normalizeFieldPath,
  type EditorRole,
  type FieldPath,
  type RationaleTag,
  type PropagationStatus,
  type ChangeType,
  type EditorContext,
  type RecordEditInput,
  type RecordEditResult,
  type ClassifierEdit,
} from './types';

export {
  EDITOR_ROLE_PERMISSIONS,
  canEdit,
} from './permissions';

export {
  recordEdit,
  MalformedNotationError,
  EditorRoleGateError,
  type NotationViolation,
} from './recordEdit';

// --- Phase 2 ---------------------------------------------------------------

export {
  aggregateEdits,
  surfaceProposals,
  notifyArchitect,
  surfaceCoverageGapEdit,
  aggregationEnabled,
  priorityForTag,
  computeClusterSignature,
  DEFAULT_WINDOW_DAYS,
  DEFAULT_CLUSTER_THRESHOLD,
  DEFAULT_MIN_DISTINCT_EDITORS,
  type EditCluster,
  type AggregationOptions,
  type ArchitectProposal,
  type NotifyOptions,
  type SurfaceResult,
} from './aggregation';

export {
  exportFineTuningCorpus,
  corpusExportEnabled,
  applyEdit,
  ExportGatedError,
  DEFAULT_PAGE_SIZE,
  type ExportOptions,
  type ExportResult,
  type CorpusRecord,
} from './corpus-export';

export {
  clusterRationaleText,
  clusteringEnabled,
  CLUSTERABLE_TAGS,
  CLUSTER_MODEL,
  type ClusterResult,
  type ThemeCluster,
  type ProposedTag,
  type ClusterOptions,
  type CallModelFn,
} from './cluster';

export {
  runFeedbackAggregationCron,
  type CronExecutionSummary,
  type CronResponse,
  type CronOptions,
} from './cron';

export {
  getFeedbackStore,
  makeSupabaseFeedbackStore,
  setFeedbackStoreForTesting,
  corpusFieldPaths,
  STAGE2_FIELD_PATHS,
  STAGE4_FIELD_PATHS,
  type FeedbackStore,
  type PendingEditRow,
  type AggregatedProposalInsert,
  type ArchitectInboxInsert,
  type CorpusRecordRow,
  type CorpusTarget,
  type InboxPriority,
} from './store';
