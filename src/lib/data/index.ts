// Public API surface for src/lib/data/.
//
// Phase 1 exposes the sanitizer and its types. Phase 2 adds persistEvaluation
// (write-path orchestrator) and the db-client wrapper. Phase 3 will replace
// the stub KMS branch in persistence.ts with a real call to a KMS module.

export { sanitize, SANITIZER_VERSION } from './sanitizer';

export {
  persistEvaluation,
  PersistError,
  KMSNotImplementedError,
} from './persistence';
export type {
  PersistOptions,
  PersistResult,
  PersistErrorCode,
} from './persistence';

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
} from './db-client';

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
