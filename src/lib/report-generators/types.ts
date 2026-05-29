// Report-generator surface, Phase 1 type definitions.
//
// The implementation spec is at
//   docs/memos/2026-05-28-report-generator-implementation-spec.md
// and the upstream scoping memo is at
//   docs/memos/2026-05-28-report-generator-scoping.md
//
// Phase 1 lands the closed-set audience vocabulary, the per-audience prompt
// templates, and the lockstep verifier (checkAudienceLockstep in
// scripts/check-lockstep.js). The dispatcher, audit-metadata-keyed cache,
// auth-gate, HTTP route, and reports-table DDL are out of scope for Phase 1
// per the implementation spec section 13 deferral list.
//
// The Audience literal type below mirrors docs/08-v5-ontology.md section
// 3.14 byte-for-byte. The lockstep verifier asserts set equality between
// the doc table and this literal, plus presence/absence of corresponding
// prompts/<audience>.ts files per implementation status (IMPLEMENTED or
// DEFERRED). Reason this surface is module-local rather than baked into
// the engine ontology_version: the audience vocabulary is a downstream
// consumer concept, not an envelope-emitted field, and the engine surface
// stays pure per the scoping memo section 8 architectural invariant.

// Closed-set audience vocabulary. Five entries match docs/08-v5-ontology.md
// section 3.14 exactly. Adding or removing a value requires a doc+code
// update in lockstep; the verifier rejects either-side drift.
export type Audience =
  | 'reviewer'
  | 'trust_safety_lead'
  | 'legal'
  | 'exec_summary'
  | 'end_user';

// Audiences whose implementation is deferred per the scoping memo Standard
// tier. end_user is gated on a separate disclosure-policy memo (scoping
// memo section 5); the closed-set discipline reserves the slot now so the
// future disclosure-policy work lands cleanly.
export const DEFERRED_AUDIENCES = ['end_user'] as const;
export type DeferredAudience = (typeof DEFERRED_AUDIENCES)[number];

// Audiences with a Phase 1 prompt template. The Phase 2 dispatcher accepts
// only these names; the Phase 1 surface exports the type for downstream
// callers to lock against once Phase 2 lands generateReport().
export type ImplementedAudience = Exclude<Audience, DeferredAudience>;

export const IMPLEMENTED_AUDIENCES: readonly ImplementedAudience[] = [
  'reviewer',
  'trust_safety_lead',
  'legal',
  'exec_summary',
] as const;

// Persisted report record. Matches the reports DDL drafted in the
// implementation spec section 5. The DDL itself, the migration, and the
// persistence write path are Phase 2 work; this shape is the contract the
// Phase 2 dispatcher will write against.
export interface ReportRecord {
  id: number;
  evaluation_id: string;
  audience: ImplementedAudience;
  report_prompt_hash: string;
  markdown: string;
  generated_at: string; // ISO-8601 timestamp
  cache_hit_count: number;
  generation_source: 'pre_gen' | 'on_demand';
}

// Options accepted by the Phase 2 generateReport() dispatcher. Phase 1
// does not consume these, but the shape is fixed here so prompt-template
// authors see the eventual call shape.
export interface GenerationOptions {
  source: 'pre_gen' | 'on_demand';
  // Temperature is pinned to zero at the API call site for replayability;
  // overrides are reserved for adversarial-fixture testing in Phase 2.
  temperature?: number;
  // Model override. Defaults to claude-sonnet-4-6 per the cost model in
  // scoping memo section 7.
  model?: string;
}

// Cache lookup key per spec section 6. The (evaluation_id, audience,
// report_prompt_hash) tuple is the UNIQUE-constrained cache surface in
// the Phase 2 reports table.
export interface CacheKey {
  evaluation_id: string;
  audience: ImplementedAudience;
  report_prompt_hash: string;
}

// Per-audience prompt template shape. Each prompts/<audience>.ts module
// exports a value of this shape. Phase 2 will:
//   1. Concatenate system + user (substituting the envelope JSON in place
//      of the {{ENVELOPE_JSON}} marker in the user block),
//   2. SHA-256 the assembled prompt to produce report_prompt_hash,
//   3. Call the Anthropic API with system + user at temperature 0.
// Phase 1 only authors the templates; the assembler lives in Phase 2.
export interface PromptTemplate {
  // Defensive-framing prefix concatenated with the audience-specific body.
  // The defensive prefix layer (the trust-boundary declaration about the
  // envelope being DATA not instructions) lives in prompts/defensive-
  // framing.ts and is shared across all audience modules.
  system: string;
  // User-turn template containing the envelope-wrapping markers around a
  // {{ENVELOPE_JSON}} placeholder. Phase 2 substitutes the placeholder
  // with the sanitized envelope JSON at generation time.
  user: string;
  // Prompt-version identifier for the per-audience prompt-hash story.
  // Format: '<audience>@vMAJOR.MINOR.PATCH'. The semver-shape allows
  // downstream telemetry and changelogs to group prompt revisions by
  // audience; the SHA-256 of the assembled prompt is the actual cache
  // key, while prompt_version is the human-readable tag.
  prompt_version: string;
}
