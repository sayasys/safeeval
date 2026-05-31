// Public API surface for src/lib/data/.
//
// Phase 1 exposes the sanitizer and its types. Phase 2 adds persistEvaluation
// (write-path orchestrator) and the db-client wrapper. PII zero-storage Tier A
// (memo 2026-05-28) dropped the KMS branch entirely; the sanitized envelope is
// the single source of truth.

export { sanitize, SANITIZER_VERSION } from './sanitizer';

export {
  persistEvaluation,
  PersistError,
  pregenReportsEnabled,
} from './persistence';
export type {
  PersistOptions,
  PersistResult,
  PersistErrorCode,
} from './persistence';

export {
  maybePersistEvaluation,
  persistEvaluationsEnabled,
} from './wire-up';
export type { V5EnvelopeWithPersistedId } from './wire-up';

export {
  getClient,
  makeClient,
  setClientForTesting,
  resetClientForTesting,
  DbClientConfigError,
  DbClientError,
} from './db-client';
export type {
  DbClientSurface,
  InsertEvaluationRow,
  InsertEvaluationResult,
  PingResult,
  EvaluationRow,
  InsertReportRow,
  ReportRow,
  ReportListRow,
  ReportAudienceColumn,
} from './db-client';

export {
  listReports,
  getReport,
  scopeForOrg,
} from './reports';
export type { ReportScope } from './reports';

export type {
  V5Envelope,
  EnvelopeInput,
  Conversation,
  ConversationTurn,
  DispositionAction,
  PIIEntityType,
  RedactionEntry,
  RedactionLog,
  SanitizeResult,
  DetectedEntity,
} from './types';

export { REGEX_TIER_TYPES, PRESIDIO_ONLY_TYPES } from './types';
