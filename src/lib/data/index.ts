// Public API surface for src/lib/data/.
//
// Phase 1 exposes only the sanitizer and its types. Phase 2 will add
// persistEvaluation (persistence write path) and the db-client wrapper;
// Phase 3 will add the KMS-encrypted unredacted-payload write path.

export { sanitize, SANITIZER_VERSION } from './sanitizer';

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
