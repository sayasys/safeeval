// Audit-metadata-keyed cache for the report-generator surface.
//
// Spec: docs/memos/2026-05-28-report-generator-implementation-spec.md
//       section 6.
//
// Cache lookup key: (evaluation_id, audience, report_prompt_hash). The
// UNIQUE constraint in M4 is the primary cache surface; lookupCache is the
// hot-path read; writeReportRecord is the post-generation write; and
// incrementCacheHit ticks the cache_hit_count column after a successful
// lookup.
//
// All three functions accept an optional dbClient argument for test
// injection (mirrors the persistence.ts test seam pattern). Production
// callers do not pass it; the module reaches for the singleton via
// getClient() at call time.
//
// Race semantics on writeReportRecord. Two concurrent generations for the
// same (evaluation_id, audience, report_prompt_hash) lose one row to the
// UNIQUE constraint; the loser catches the DB error, re-reads the
// already-written row, increments cache_hit_count to account for the
// duplicate generation work, and returns the existing record. The Phase 2
// dispatcher never wastes the second generation's markdown -- it is
// computed but discarded in favor of the canonical row written first.

import {
  getClient,
  type DbClientSurface,
  type ReportRow,
  type ReportAudienceColumn,
} from '../data/db-client';
import type { ImplementedAudience, ReportRecord } from './types';

function resolveClient(injected?: DbClientSurface): DbClientSurface {
  return injected ?? getClient();
}

function rowToRecord(row: ReportRow, source: 'pre_gen' | 'on_demand'): ReportRecord {
  return {
    id: Number(row.id),
    evaluation_id: row.evaluation_id,
    audience: row.audience as ImplementedAudience,
    report_prompt_hash: row.report_prompt_hash,
    markdown: row.markdown,
    generated_at: row.generated_at,
    cache_hit_count: row.cache_hit_count,
    generation_source: source,
  };
}

// Exact-key cache lookup. Returns null on miss; returns the persisted row
// on hit. Does NOT increment cache_hit_count -- that is the caller's job
// via incrementCacheHit (so a lookup that is part of a write-conflict
// recovery does not double-count).
export async function lookupCache(
  evaluation_id: string,
  audience: ImplementedAudience,
  report_prompt_hash: string,
  dbClient?: DbClientSurface,
): Promise<ReportRecord | null> {
  const client = resolveClient(dbClient);
  const row = await client.getReportRecord(
    evaluation_id,
    audience as ReportAudienceColumn,
    report_prompt_hash,
  );
  if (!row) return null;
  return rowToRecord(row, 'on_demand');
}

export interface WriteReportInput {
  evaluation_id: string;
  audience: ImplementedAudience;
  report_prompt_hash: string;
  markdown: string;
  source?: 'pre_gen' | 'on_demand';
}

export interface WriteReportResult {
  id: number;
  cache_conflict: boolean;
}

// Write a new report row. On UNIQUE conflict (a concurrent generation won
// the race), re-read the canonical row, bump its cache_hit_count to account
// for the duplicate work, and return the existing id with cache_conflict=true.
export async function writeReportRecord(
  input: WriteReportInput,
  dbClient?: DbClientSurface,
): Promise<WriteReportResult> {
  const client = resolveClient(dbClient);
  try {
    const row = await client.insertReportRecord({
      evaluation_id: input.evaluation_id,
      audience: input.audience as ReportAudienceColumn,
      report_prompt_hash: input.report_prompt_hash,
      markdown: input.markdown,
    });
    return { id: Number(row.id), cache_conflict: false };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Conflict path: another generation wrote the canonical row. Recover by
    // re-reading and bumping the cache_hit_count.
    const existing = await client.getReportRecord(
      input.evaluation_id,
      input.audience as ReportAudienceColumn,
      input.report_prompt_hash,
    );
    if (!existing) {
      // Should never happen -- UNIQUE conflict implies the row exists -- but
      // surface the inconsistency rather than silently swallow it.
      throw err;
    }
    await client.incrementReportCacheHit(existing.id);
    return { id: Number(existing.id), cache_conflict: true };
  }
}

// Tick the cache_hit_count for a row a lookupCache hit found. Caller
// invokes this only after lookupCache returns a non-null record.
export async function incrementCacheHit(
  report_id: number,
  dbClient?: DbClientSurface,
): Promise<void> {
  const client = resolveClient(dbClient);
  await client.incrementReportCacheHit(String(report_id));
}

interface DbErrorLike {
  message?: string;
  code?: string;
  cause_message?: string;
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as DbErrorLike;
  if (e.code === '23505') return true;
  const haystack = (e.message ?? '') + ' ' + (e.cause_message ?? '');
  const lower = haystack.toLowerCase();
  return (
    lower.includes('duplicate key') ||
    lower.includes('unique constraint') ||
    lower.includes('unique violation')
  );
}
