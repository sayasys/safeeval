// Report-generator public API.
//
// Phase 1 exports type definitions and constants.
// Phase 2 adds generateReport(): the dispatcher that looks up an evaluation,
// assembles the per-audience prompt, hashes it, consults the cache,
// generates on miss via the Anthropic API, validates the output, and
// writes the report record.
//
// Phase 3 will wire the on-demand HTTP route and replace the auth-gate stub
// with a real token-validation routine that consults the legal_access_grants
// table. Phase 2 ships the stub: LegalAccessGateError is thrown for any
// legal-audience request that does not pass unredacted_access=true through
// the options.
//
// Phase 4 will land the markdown -> PDF / HTML render layer; Phase 2 returns
// markdown only.

import { createHash } from 'node:crypto';
import {
  lookupCache,
  writeReportRecord,
  incrementCacheHit,
} from './cache';
import { validateReport, type ValidationResult } from './validator';
import { reviewerPrompt } from './prompts/reviewer';
import { trustSafetyLeadPrompt } from './prompts/trust_safety_lead';
import { legalPrompt } from './prompts/legal';
import { execSummaryPrompt } from './prompts/exec_summary';
import {
  getClient,
  type DbClientSurface,
} from '../data/db-client';
import type {
  ImplementedAudience,
  PromptTemplate,
  GenerationOptions,
} from './types';

export type {
  Audience,
  DeferredAudience,
  ImplementedAudience,
  ReportRecord,
  GenerationOptions,
  CacheKey,
  PromptTemplate,
} from './types';

export { DEFERRED_AUDIENCES, IMPLEMENTED_AUDIENCES } from './types';
export {
  lookupCache,
  writeReportRecord,
  incrementCacheHit,
} from './cache';
export { validateReport } from './validator';
export type { ValidationResult, Violation, ViolationType } from './validator';

const PROMPTS: Record<ImplementedAudience, PromptTemplate> = {
  reviewer: reviewerPrompt,
  trust_safety_lead: trustSafetyLeadPrompt,
  legal: legalPrompt,
  exec_summary: execSummaryPrompt,
};

// Phase 2 stub. The Phase 3 dispatch replaces this with a token-validation
// routine consulting the legal_access_grants table (per spec section 7.3).
// The signature is stable across the upgrade: callers pass
// options.unredacted_access=true after the ops-runbook approval flow lands
// a time-bounded token; the dispatcher converts the token to the boolean.
//
// Phase 2 boundary: the gate fires on every legal-audience request that
// does not carry unredacted_access=true. The pre-gen post-write hook
// explicitly skips the legal audience for that reason -- it would fire
// without an auth context and the gate would refuse, costing API budget
// for nothing.
export class LegalAccessGateError extends Error {
  override readonly name = 'LegalAccessGateError';
  readonly evaluation_id: string;
  constructor(evaluation_id: string) {
    super(
      'Legal-audience reports require approval per the ops runbook ' +
        '(docs/runbooks/legal-report-access.md). Phase 2 dispatcher stub: ' +
        'pass options.unredacted_access=true after the manual approval ' +
        'has been recorded. Phase 3 will replace this gate with a real ' +
        'token-validation routine.',
    );
    this.evaluation_id = evaluation_id;
  }
}

export class EvaluationNotFoundError extends Error {
  override readonly name = 'EvaluationNotFoundError';
  readonly evaluation_id: string;
  constructor(evaluation_id: string) {
    super(`Evaluation not found: ${evaluation_id}`);
    this.evaluation_id = evaluation_id;
  }
}

export interface GenerateReportOptions extends GenerationOptions {
  // Phase 2 auth-gate stub: must be true for audience='legal'. Phase 3
  // replaces this boolean with a token-validation step inside the
  // dispatcher.
  unredacted_access?: boolean;
  // Test seam. Production callers do not pass this.
  dbClient?: DbClientSurface;
  // Test seam for the model call. Production resolves the real client
  // inside callAnthropic(). Phase 2 keeps the real Anthropic SDK call
  // out of scope; the dispatch tests mock this seam so the cache /
  // validate / write flow is covered without hitting the network.
  callModel?: (args: {
    system: string;
    user: string;
    model: string;
    temperature: number;
    audience: ImplementedAudience;
  }) => Promise<string>;
}

export interface GenerateReportResult {
  markdown: string;
  cache_hit: boolean;
  validation: ValidationResult;
  report_prompt_hash: string;
  audience: ImplementedAudience;
  evaluation_id: string;
}

// SHA-256 over the concatenation of (system, user template, canonical
// envelope JSON). The envelope JSON is canonicalized (sorted keys) so two
// engine runs that differ only in object-key order do not produce
// different report-record rows.
function computePromptHash(
  audience: ImplementedAudience,
  template: PromptTemplate,
  envelope: unknown,
): string {
  const hash = createHash('sha256');
  hash.update('audience=' + audience + '\n');
  hash.update('prompt_version=' + template.prompt_version + '\n');
  hash.update('system_len=' + String(template.system.length) + '\n');
  hash.update(template.system);
  hash.update('\nuser_template=\n');
  hash.update(template.user);
  hash.update('\nenvelope=\n');
  hash.update(canonicalJson(envelope));
  return hash.digest('hex');
}

// Stable JSON serialization: sorted object keys, no whitespace. The engine
// emits envelopes with consistent shape but key order is not guaranteed
// across runtime versions; canonicalization makes the hash robust.
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') +
    '}'
  );
}

function substituteEnvelope(userTemplate: string, envelope: unknown): string {
  return userTemplate.replace('{{ENVELOPE_JSON}}', JSON.stringify(envelope, null, 2));
}

// Default model call. Phase 2 leaves this as a stub that throws if no
// override is provided AND the SAFEEVAL_REPORT_GEN_LIVE flag is unset.
// Phase 3 implements the real Anthropic SDK call. Tests pass options.callModel.
async function defaultCallModel(args: {
  system: string;
  user: string;
  model: string;
  temperature: number;
  audience: ImplementedAudience;
}): Promise<string> {
  if (process.env.SAFEEVAL_REPORT_GEN_LIVE !== 'true') {
    throw new Error(
      'Report generator live API call is disabled (Phase 2). Set ' +
        'SAFEEVAL_REPORT_GEN_LIVE=true once Phase 3 lands the real Anthropic ' +
        'wire-up, or pass options.callModel in test contexts. Args: ' +
        JSON.stringify({
          model: args.model,
          temperature: args.temperature,
          audience: args.audience,
          system_len: args.system.length,
          user_len: args.user.length,
        }),
    );
  }
  // Phase 3 will replace this branch with a real Anthropic SDK call. Until
  // then, opting into live mode without supplying a callModel is a wiring
  // error; surfacing it loudly is preferable to a silent fallback.
  throw new Error(
    'Report generator live mode (SAFEEVAL_REPORT_GEN_LIVE=true) requires the ' +
      'Phase 3 Anthropic wire-up, which has not landed yet. Pass options.callModel ' +
      'explicitly or wait for Phase 3.',
  );
}

export interface GenerateReportInput {
  evaluation_id: string;
  audience: ImplementedAudience;
  options?: GenerateReportOptions;
}

export async function generateReport(
  evaluation_id: string,
  audience: ImplementedAudience,
  options: GenerateReportOptions = { source: 'on_demand' },
): Promise<GenerateReportResult> {
  // Auth-gate (Phase 2 stub). Legal audience must carry
  // unredacted_access=true through the options. Phase 3 swaps the boolean
  // for a token-validation routine.
  if (audience === 'legal' && options.unredacted_access !== true) {
    throw new LegalAccessGateError(evaluation_id);
  }

  const client = options.dbClient ?? getClient();
  const template = PROMPTS[audience];
  if (!template) {
    // Should be unreachable given the ImplementedAudience type guard at the
    // call site; surface the inconsistency rather than allow a runtime
    // undefined.
    throw new Error(`No prompt template registered for audience: ${audience}`);
  }

  // Look up the evaluation row.
  const evaluation = await client.getEvaluation(evaluation_id);
  if (!evaluation) {
    throw new EvaluationNotFoundError(evaluation_id);
  }
  const envelope = evaluation.envelope;

  // Compute the report_prompt_hash over the assembled prompt + canonical
  // envelope JSON. Phase 1's prompt-version tag is included; a prompt
  // revision that bumps the version (or the body) produces a new hash and
  // the cache misses.
  const report_prompt_hash = computePromptHash(audience, template, envelope);

  // Cache lookup. On hit, increment cache_hit_count and return.
  const cached = await lookupCache(evaluation_id, audience, report_prompt_hash, client);
  if (cached) {
    await incrementCacheHit(cached.id, client);
    return {
      markdown: cached.markdown,
      cache_hit: true,
      validation: { valid: true, violations: [] },
      report_prompt_hash,
      audience,
      evaluation_id,
    };
  }

  // Cache miss: assemble user prompt, call the model.
  const userPrompt = substituteEnvelope(template.user, envelope);
  const callModel = options.callModel ?? defaultCallModel;
  const markdown = await callModel({
    system: template.system,
    user: userPrompt,
    model: options.model ?? 'claude-sonnet-4-6',
    temperature: options.temperature ?? 0,
    audience,
  });

  // Post-generation validation. Soft failure: invalid markdown is still
  // written to the cache and returned to the caller; the caller decides
  // what to do with violations.
  const validation = validateReport(markdown, audience);

  await writeReportRecord(
    {
      evaluation_id,
      audience,
      report_prompt_hash,
      markdown,
      source: options.source,
    },
    client,
  );

  return {
    markdown,
    cache_hit: false,
    validation,
    report_prompt_hash,
    audience,
    evaluation_id,
  };
}
