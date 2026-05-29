// Data-layer types for SafeEval persistence (Phase 1: types + sanitizer).
//
// Source of truth for the envelope shape is tests/schema/v5-envelope.schema.json.
// The implementation spec at docs/memos/2026-05-28-data-track-implementation-spec.md
// describes a nested `envelope.audit_metadata.*` accessor that does not match the
// JSON Schema (where these fields are top-level). This file follows the JSON
// Schema; the SQL hoists use the same top-level field names.

export type DispositionAction =
  | 'allow'
  | 'safe_completion'
  | 'human_review'
  | 'block';

export interface ConversationTurn {
  sender: string;
  text: string;
  timestamp?: string | null;
}

export interface Conversation {
  modality: 'text' | 'image';
  turns: ConversationTurn[];
  parse_confidence: number;
  parse_warnings: string[];
}

export type EnvelopeInput =
  | { kind: 'prompt'; text: string }
  | { kind: 'conversation'; conversation: Conversation };

// V5 envelope -- minimal Phase 1 surface. Only the fields the sanitizer reads
// or that the persistence write path will hoist into columns are typed
// explicitly. Other JSON-schema fields are tolerated via index signature so
// passthrough preserves engine output byte-for-byte.
export interface V5Envelope {
  schema_version: string;
  ontology_version: string;
  evaluated_at: string;
  model_pipeline: string[];
  prompt_length: number;
  input?: EnvelopeInput;
  disposition: {
    action: DispositionAction;
    confidence: number;
    [key: string]: unknown;
  };
  evidence: {
    aggregate_score: number;
    [key: string]: unknown;
  };
  stage1_prompt_hash?: string;
  stage2_prompt_hash?: string;
  stage3_prompt_hash?: string;
  stage4_prompt_hash?: string;
  cache_key?: string;
  [key: string]: unknown;
}

// Closed-set PII vocabulary per implementation spec section 3.
// `person` and `location` are Presidio-only; the regex tier returns the
// non-Presidio subset. PRESIDIO_ONLY_TYPES enumerates those for documentation.
export type PIIEntityType =
  | 'EMAIL'
  | 'PHONE'
  | 'SSN'
  | 'CREDIT_CARD'
  | 'IBAN'
  | 'OTP'
  | 'PERSON'
  | 'LOCATION';

export const REGEX_TIER_TYPES: readonly PIIEntityType[] = [
  'EMAIL',
  'PHONE',
  'SSN',
  'CREDIT_CARD',
  'IBAN',
  'OTP',
] as const;

export const PRESIDIO_ONLY_TYPES: readonly PIIEntityType[] = [
  'PERSON',
  'LOCATION',
] as const;

// A single redaction record. Offsets index the original (raw) field text.
export interface RedactionEntry {
  type: PIIEntityType;
  field_path: string;        // e.g. "input.text" or "input.conversation.turns[2].text"
  original_offset: number;   // start index into the raw field text
  original_length: number;   // length of the raw match in the field text
  placeholder: string;       // e.g. "<EMAIL_1>"
  confidence: number | null; // 1.0 for explicit-format regex; null otherwise; Presidio score when applicable
  source: 'regex' | 'presidio';
}

// Sanitization audit trail attached to each persisted row (column:
// pii_redaction_log JSONB). Shape per implementation spec section 4.4
// (referenced by the scoping memo).
export interface RedactionLog {
  version: '1';
  sanitizer_version: string;     // semver of the sanitizer module
  total_redactions: number;
  redactions: RedactionEntry[];
}

export interface SanitizeResult {
  sanitized_envelope: V5Envelope;
  redaction_log: RedactionLog;
}

// Internal sanitizer types (exported for testing; not part of the public
// persistence API).
export interface DetectedEntity {
  type: PIIEntityType;
  field_path: string;
  start: number;          // start offset into the raw field text
  end: number;            // exclusive end offset
  raw_value: string;      // the matched substring
  canonical_value: string; // lowercased/normalized; the placeholder key
  confidence: number | null;
  source: 'regex' | 'presidio';
}
