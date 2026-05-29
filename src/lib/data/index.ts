// Public API surface for src/lib/data/.
//
// Phase 1 exposes the sanitizer and its types. Phase 2 (this commit) adds the
// Supabase db-client wrapper. The persistence orchestrator that composes
// sanitizer + db-client lands in a follow-on commit on this same branch.

export { sanitize, SANITIZER_VERSION } from './sanitizer';

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
