// Feedback-module persistence surface -- Phase 2.
//
// Spec: docs/memos/2026-05-28-classifier-feedback-loop-scoping.md section 7
// (module layout names a `db-client.ts -- thin wrapper around the data-track
// db-client for INSERT path`). This file is that wrapper, named store.ts to
// avoid confusion with src/lib/data/db-client.ts.
//
// Why a separate, narrow surface rather than extending DbClientSurface: the
// feedback module is a downstream consumer (reviewer overrides), not part of
// the engine write path. Keeping its DB methods in a module-local interface
// (a) keeps the data-track db-client surface focused on the evaluation/report
// write path, (b) keeps the persistence-layer mock in tests/data untouched,
// and (c) gives aggregation.ts / corpus-export.ts a single injectable seam
// (FeedbackStore) the unit tests mock without standing up Supabase.
//
// The default implementation wraps the data-track raw Supabase client
// (getClient().getRawClient()) so the feedback module reuses the singleton
// connection rather than opening its own.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient } from '../data/db-client';
import type {
  ChangeType,
  EditorRole,
  PropagationStatus,
  RationaleTag,
} from './types';

// A pending classifier_edits row as the aggregation cron reads it. before/after
// are JSONB (unknown shape); created_at is an ISO string.
export interface PendingEditRow {
  id: number;
  evaluation_id: string;
  editor_id: string;
  editor_role: EditorRole;
  field_path: string;
  change_type: ChangeType;
  before_value: unknown;
  after_value: unknown;
  rationale_tag: RationaleTag;
  rationale_text: string | null;
  created_at: string;
}

// Insert shape for aggregated_proposals (M11). proposal_status defaults to
// 'aggregated' at the DB layer; callers may override.
export interface AggregatedProposalInsert {
  cluster_signature: string;
  field_path: string;
  change_type: ChangeType;
  before_value: unknown;
  after_value: unknown;
  rationale_tag: RationaleTag;
  edit_count: number;
  distinct_editors: number;
  window_start: string;
  window_end: string;
  proposal_status?: PropagationStatus;
}

// Escalation priority for the architect inbox (M11). Mirrors the parallel-
// cowork-tracks escalation vocabulary.
export type InboxPriority = 'route-to-steven' | 'default-accept';

export interface ArchitectInboxInsert {
  proposal_id: number;
  source_track?: string;
  priority: InboxPriority;
}

// Target model for the fine-tuning corpus export (scoping memo section 9).
export type CorpusTarget = 'stage2' | 'stage4';

// A classifier_edits row joined to its upstream evaluations row, as the corpus
// export reads it. The envelope is the sanitized engine output; the stage hashes
// + cache_key are the audit-metadata provenance.
export interface CorpusRecordRow {
  edit_id: number;
  evaluation_id: string;
  field_path: string;
  change_type: ChangeType;
  before_value: unknown;
  after_value: unknown;
  rationale_tag: RationaleTag;
  rationale_text: string | null;
  editor_role: EditorRole;
  envelope: unknown;
  cache_key: string | null;
  stage1_prompt_hash: string | null;
  stage2_prompt_hash: string | null;
  stage3_prompt_hash: string | null;
  stage4_prompt_hash: string | null;
}

export interface FeedbackStore {
  // Aggregation cron reads. Returns classifier_edits rows with
  // propagation_status = 'pending' and created_at within the rolling window.
  queryPendingEdits(windowDays: number): Promise<PendingEditRow[]>;

  // Coverage_gap real-time path: the edits for one evaluation tagged
  // coverage_gap (used by the persistence post-write hook).
  queryCoverageGapEdits(evaluationId: string): Promise<PendingEditRow[]>;

  insertAggregatedProposal(p: AggregatedProposalInsert): Promise<{ id: number }>;
  insertArchitectInboxEntry(e: ArchitectInboxInsert): Promise<{ id: number }>;

  // Mark the supplied edit ids as 'aggregated' so they do not re-enter the
  // next cycle's window. No-op for an empty list.
  markEditsAggregated(editIds: number[]): Promise<void>;

  // Corpus export read. Returns a page of joined rows ordered by edit id
  // ascending, restricted to the field_path set for the given target, with
  // id > afterId. Pagination keeps the export streaming-friendly for large
  // corpora.
  queryCorpusRecords(
    target: CorpusTarget,
    afterId: number,
    limit: number,
  ): Promise<CorpusRecordRow[]>;
}

// Field-path filters per scoping memo section 9.
//   Stage 2 discriminator fine-tuning: L1 / L2 / L3 assignment fields.
//   Stage 4 cascade fine-tuning: disposition + evidence/component-score fields.
export const STAGE2_FIELD_PATHS: readonly string[] = [
  'l1.category',
  'l2.subcategory',
  'l3.method',
  'l3.tactic',
  'l3.target',
  'l3.overlap',
];

export const STAGE4_FIELD_PATHS: readonly string[] = [
  'disposition.action',
  'evidence.aggregate_score',
  'evidence.component_scores.target',
  'evidence.component_scores.lure',
  'evidence.component_scores.trust',
  'evidence.component_scores.extract',
  'evidence.component_scores.evade',
];

export function corpusFieldPaths(target: CorpusTarget): readonly string[] {
  return target === 'stage2' ? STAGE2_FIELD_PATHS : STAGE4_FIELD_PATHS;
}

class FeedbackStoreError extends Error {
  override readonly name = 'FeedbackStoreError';
  readonly cause_message: string | undefined;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause_message = cause instanceof Error ? cause.message : undefined;
  }
}

// ISO cutoff for "now - windowDays". Isolated so the supabase impl computes it
// once per query. (Date.now is fine in app runtime; only workflow scripts ban
// it.)
function windowCutoffIso(windowDays: number): string {
  const ms = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

function rowToPendingEdit(row: Record<string, unknown>): PendingEditRow {
  return {
    id: Number(row['id']),
    evaluation_id: String(row['evaluation_id']),
    editor_id: String(row['editor_id']),
    editor_role: row['editor_role'] as EditorRole,
    field_path: String(row['field_path']),
    change_type: row['change_type'] as ChangeType,
    before_value: row['before_value'] ?? null,
    after_value: row['after_value'] ?? null,
    rationale_tag: row['rationale_tag'] as RationaleTag,
    rationale_text:
      row['rationale_text'] == null ? null : String(row['rationale_text']),
    created_at: String(row['created_at']),
  };
}

// Default implementation backed by the data-track Supabase client. The corpus
// join uses an embedded resource select (PostgREST FK embedding) against the
// evaluations relation; classifier_edits.evaluation_id is the FK.
export function makeSupabaseFeedbackStore(raw: SupabaseClient): FeedbackStore {
  return {
    async queryPendingEdits(windowDays: number): Promise<PendingEditRow[]> {
      const cutoff = windowCutoffIso(windowDays);
      const { data, error } = await raw
        .from('classifier_edits')
        .select(
          'id, evaluation_id, editor_id, editor_role, field_path, change_type, before_value, after_value, rationale_tag, rationale_text, created_at',
        )
        .eq('propagation_status', 'pending')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true });
      if (error) {
        throw new FeedbackStoreError(`queryPendingEdits failed: ${error.message}`, error);
      }
      return (data ?? []).map(rowToPendingEdit);
    },

    async queryCoverageGapEdits(evaluationId: string): Promise<PendingEditRow[]> {
      const { data, error } = await raw
        .from('classifier_edits')
        .select(
          'id, evaluation_id, editor_id, editor_role, field_path, change_type, before_value, after_value, rationale_tag, rationale_text, created_at',
        )
        .eq('evaluation_id', evaluationId)
        .eq('rationale_tag', 'coverage_gap')
        .order('created_at', { ascending: true });
      if (error) {
        throw new FeedbackStoreError(
          `queryCoverageGapEdits failed: ${error.message}`,
          error,
        );
      }
      return (data ?? []).map(rowToPendingEdit);
    },

    async insertAggregatedProposal(
      p: AggregatedProposalInsert,
    ): Promise<{ id: number }> {
      const { data, error } = await raw
        .from('aggregated_proposals')
        .insert({
          cluster_signature: p.cluster_signature,
          field_path: p.field_path,
          change_type: p.change_type,
          before_value: p.before_value ?? null,
          after_value: p.after_value ?? null,
          rationale_tag: p.rationale_tag,
          edit_count: p.edit_count,
          distinct_editors: p.distinct_editors,
          window_start: p.window_start,
          window_end: p.window_end,
          ...(p.proposal_status ? { proposal_status: p.proposal_status } : {}),
        })
        .select('id')
        .single();
      if (error) {
        throw new FeedbackStoreError(
          `insertAggregatedProposal failed: ${error.message}`,
          error,
        );
      }
      if (!data || data.id == null) {
        throw new FeedbackStoreError('insertAggregatedProposal returned no id');
      }
      return { id: Number(data.id) };
    },

    async insertArchitectInboxEntry(
      e: ArchitectInboxInsert,
    ): Promise<{ id: number }> {
      const { data, error } = await raw
        .from('architect_inbox_queue')
        .insert({
          proposal_id: e.proposal_id,
          source_track: e.source_track ?? 'feedback',
          priority: e.priority,
        })
        .select('id')
        .single();
      if (error) {
        throw new FeedbackStoreError(
          `insertArchitectInboxEntry failed: ${error.message}`,
          error,
        );
      }
      if (!data || data.id == null) {
        throw new FeedbackStoreError('insertArchitectInboxEntry returned no id');
      }
      return { id: Number(data.id) };
    },

    async markEditsAggregated(editIds: number[]): Promise<void> {
      if (editIds.length === 0) return;
      const { error } = await raw
        .from('classifier_edits')
        .update({ propagation_status: 'aggregated' })
        .in('id', editIds);
      if (error) {
        throw new FeedbackStoreError(
          `markEditsAggregated failed: ${error.message}`,
          error,
        );
      }
    },

    async queryCorpusRecords(
      target: CorpusTarget,
      afterId: number,
      limit: number,
    ): Promise<CorpusRecordRow[]> {
      const fieldPaths = corpusFieldPaths(target);
      const { data, error } = await raw
        .from('classifier_edits')
        .select(
          'id, evaluation_id, field_path, change_type, before_value, after_value, rationale_tag, rationale_text, editor_role, ' +
            'evaluations:evaluation_id (envelope, cache_key, stage1_prompt_hash, stage2_prompt_hash, stage3_prompt_hash, stage4_prompt_hash)',
        )
        .in('field_path', fieldPaths as string[])
        .gt('id', afterId)
        .order('id', { ascending: true })
        .limit(limit);
      if (error) {
        throw new FeedbackStoreError(
          `queryCorpusRecords failed: ${error.message}`,
          error,
        );
      }
      // PostgREST embedded-select typing widens `data` to include a parse-error
      // sentinel union; the runtime rows are plain records. Narrow explicitly.
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      return rows.map((row) => {
        // PostgREST embeds the FK relation as either an object or a single-
        // element array depending on cardinality inference; normalize both.
        const embedded = row['evaluations'];
        const ev = (Array.isArray(embedded) ? embedded[0] : embedded) as
          | Record<string, unknown>
          | undefined;
        return {
          edit_id: Number(row['id']),
          evaluation_id: String(row['evaluation_id']),
          field_path: String(row['field_path']),
          change_type: row['change_type'] as ChangeType,
          before_value: row['before_value'] ?? null,
          after_value: row['after_value'] ?? null,
          rationale_tag: row['rationale_tag'] as RationaleTag,
          rationale_text:
            row['rationale_text'] == null ? null : String(row['rationale_text']),
          editor_role: row['editor_role'] as EditorRole,
          envelope: ev?.['envelope'] ?? null,
          cache_key: ev?.['cache_key'] == null ? null : String(ev['cache_key']),
          stage1_prompt_hash:
            ev?.['stage1_prompt_hash'] == null ? null : String(ev['stage1_prompt_hash']),
          stage2_prompt_hash:
            ev?.['stage2_prompt_hash'] == null ? null : String(ev['stage2_prompt_hash']),
          stage3_prompt_hash:
            ev?.['stage3_prompt_hash'] == null ? null : String(ev['stage3_prompt_hash']),
          stage4_prompt_hash:
            ev?.['stage4_prompt_hash'] == null ? null : String(ev['stage4_prompt_hash']),
        };
      });
    },
  };
}

// Lazy singleton wrapping the data-track raw client. Tests inject their own
// FeedbackStore and never reach this.
let _store: FeedbackStore | null = null;

export function getFeedbackStore(): FeedbackStore {
  if (_store) return _store;
  _store = makeSupabaseFeedbackStore(getClient().getRawClient());
  return _store;
}

export function setFeedbackStoreForTesting(store: FeedbackStore | null): void {
  _store = store;
}
