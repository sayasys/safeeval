// Report-generator public API.
//
// Phase 1 exports type definitions and constants.
// Phase 2 adds generateReport(): the dispatcher that looks up an evaluation,
// assembles the per-audience prompt, hashes it, consults the cache,
// generates on miss via the Anthropic API, validates the output, and
// writes the report record.
//
// Phase 3 lands the real Anthropic SDK wire-up in defaultCallModel (gated on
// SAFEEVAL_REPORT_GEN_LIVE), the on-demand HTTP route under /api/app/, and
// replaces the Phase 2 unredacted_access boolean stub with the manual
// ops-runbook auth gate: requireLegalAccess() (legal-auth-gate.ts) enforces
// the pii_reviewer role and writes legal_access_log audit rows on grant and
// deny. Phase 4+ swaps the manual role assignment for real RBAC.
//
// Phase 4 will land the markdown -> PDF / HTML render layer; Phase 3 returns
// markdown only.

import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
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
import { requireLegalAccess, type LegalAccessUser } from './legal-auth-gate';
import { EvaluationNotFoundError, ReportGenerationError } from './errors';
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

// Error classes live in errors.ts (Phase 3) to break the index <->
// legal-auth-gate import cycle; re-exported here for back-compat with
// existing importers.
export {
  LegalAccessGateError,
  EvaluationNotFoundError,
  ReportGenerationError,
} from './errors';
export {
  requireLegalAccess,
  isAdmin,
  PII_REVIEWER_ROLE,
  ADMIN_ROLE,
} from './legal-auth-gate';
export type { LegalAccessUser } from './legal-auth-gate';

const PROMPTS: Record<ImplementedAudience, PromptTemplate> = {
  reviewer: reviewerPrompt,
  trust_safety_lead: trustSafetyLeadPrompt,
  legal: legalPrompt,
  exec_summary: execSummaryPrompt,
};

// Per-audience max_tokens budget for the live Anthropic call. Tuned to the
// audience length envelopes (validator.ts LENGTH_TARGETS) with headroom:
//   reviewer        400-600 words -> 600 tokens
//   trust_safety    250-350 words -> 400 tokens
//   legal           350-500 words -> 500 tokens
//   exec_summary     80-100 words -> 120 tokens
const TOKEN_BUDGETS: Record<ImplementedAudience, number> = {
  reviewer: 600,
  trust_safety_lead: 400,
  legal: 500,
  exec_summary: 120,
};

// Default report-generation model. Sonnet earns its keep on register-
// distinction precision per the cost model (scoping memo section 7); Haiku
// would degrade the legal / T&S register quality. Overridable via
// options.model for adversarial-fixture testing.
const DEFAULT_REPORT_MODEL = 'claude-sonnet-4-6';

// Live-call wall-clock timeout. The pre-gen path fires four audiences in
// parallel; a single hung audience must not block the others past this.
const REPORT_GEN_TIMEOUT_MS = 30_000;

// Test seam for the model call. Production resolves the real Anthropic
// client inside defaultCallModel(); tests inject options.callModel so the
// cache / validate / write flow is covered without network contact.
export type CallModelFn = (args: {
  system: string;
  user: string;
  model: string;
  temperature: number;
  audience: ImplementedAudience;
  evaluation_id: string;
}) => Promise<string>;

export interface GenerateReportOptions extends GenerationOptions {
  // Authenticated caller. Required for audience='legal' (the gate reads
  // user.role); ignored for the other audiences. The pre-gen post-write
  // hook does not pre-generate the legal audience, so it never sets this.
  user?: LegalAccessUser | null;
  // Admin force-regeneration (POST path): skip the cache lookup and
  // regenerate against the model even if a cached row exists.
  force_regenerate?: boolean;
  // Test seam. Production callers do not pass this.
  dbClient?: DbClientSurface;
  // Test seam for the model call (see CallModelFn).
  callModel?: CallModelFn;
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

// Default model call -- the Phase 3 live Anthropic SDK wire-up.
//
// Gating: SAFEEVAL_REPORT_GEN_LIVE must be 'true'. The flag defaults OFF so
// an authenticated request lands a clear "feature flag disabled" error rather
// than burning API budget or surprising an operator who has not opted in.
// Tests bypass this path entirely by passing options.callModel.
//
// On success: returns the model's markdown completion. On any failure
// (missing key, network error, timeout/abort, empty/non-text completion):
// throws a typed ReportGenerationError with structured context. The
// 30-second AbortController timeout bounds a hung call.
async function defaultCallModel(args: {
  system: string;
  user: string;
  model: string;
  temperature: number;
  audience: ImplementedAudience;
  evaluation_id: string;
}): Promise<string> {
  if (process.env.SAFEEVAL_REPORT_GEN_LIVE !== 'true') {
    // Feature-flag-disabled is a deliberate, non-error operator state: surface
    // it as a plain Error (not a ReportGenerationError) so the route can
    // distinguish "operator has not opted in" from "the live call failed".
    throw new Error(
      'Report generator live API call is disabled. Set ' +
        'SAFEEVAL_REPORT_GEN_LIVE=true (with ANTHROPIC_API_KEY configured) to ' +
        'enable live report generation, or pass options.callModel in tests. ' +
        `Requested: model=${args.model}, audience=${args.audience}.`,
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ReportGenerationError(
      'ANTHROPIC_API_KEY is not configured but SAFEEVAL_REPORT_GEN_LIVE is on.',
      {
        evaluation_id: args.evaluation_id,
        audience: args.audience,
        model: args.model,
        reason: 'config',
      },
    );
  }

  const client = new Anthropic({ apiKey });
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REPORT_GEN_TIMEOUT_MS);
  try {
    const resp = await client.messages.create(
      {
        model: args.model,
        max_tokens: TOKEN_BUDGETS[args.audience],
        temperature: args.temperature,
        system: args.system,
        messages: [{ role: 'user', content: args.user }],
      },
      { signal: controller.signal },
    );
    const block = resp.content[0];
    if (!block || block.type !== 'text' || block.text.trim().length === 0) {
      throw new ReportGenerationError(
        'Anthropic returned an empty or non-text completion for the report.',
        {
          evaluation_id: args.evaluation_id,
          audience: args.audience,
          model: args.model,
          reason: 'empty_response',
        },
      );
    }
    return block.text;
  } catch (err) {
    if (err instanceof ReportGenerationError) throw err;
    const aborted =
      controller.signal.aborted ||
      (err instanceof Error && err.name === 'AbortError');
    throw new ReportGenerationError(
      aborted
        ? `Report generation timed out after ${REPORT_GEN_TIMEOUT_MS}ms.`
        : 'Report generation failed: the Anthropic API call errored.',
      {
        evaluation_id: args.evaluation_id,
        audience: args.audience,
        model: args.model,
        reason: aborted ? 'timeout' : 'api_error',
        cause: err,
      },
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
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
  const client = options.dbClient ?? getClient();

  // Auth gate (Phase 3). The legal audience requires the pii_reviewer role.
  // requireLegalAccess fires before any evaluation read or model call, and
  // writes a legal_access_log row on both the grant and the deny path; on a
  // denied access it throws LegalAccessGateError. Non-legal audiences skip
  // the gate entirely.
  if (audience === 'legal') {
    await requireLegalAccess(options.user, evaluation_id, client);
  }

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

  // Cache lookup. On hit, increment cache_hit_count and return. The admin
  // force-regeneration path (options.force_regenerate) skips the lookup and
  // always regenerates against the model.
  if (!options.force_regenerate) {
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
  }

  // Cache miss (or forced regeneration): assemble user prompt, call the model.
  const userPrompt = substituteEnvelope(template.user, envelope);
  const callModel = options.callModel ?? defaultCallModel;
  const markdown = await callModel({
    system: template.system,
    user: userPrompt,
    model: options.model ?? DEFAULT_REPORT_MODEL,
    temperature: options.temperature ?? 0,
    audience,
    evaluation_id,
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
