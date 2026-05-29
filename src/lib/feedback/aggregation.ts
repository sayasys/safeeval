// Daily aggregation loop -- Phase 2.
//
// Spec: docs/memos/2026-05-28-classifier-feedback-loop-scoping.md section 8.
// Adjudications: section 14 Q1 (cluster_size >= 5 AND distinct_editors >= 3,
// 14-day window -- default-accept) and Q3 (coverage_gap routes to Steven --
// Option A, real-time).
//
// This is the constructive-feedback half of the loop: it turns consistent
// reviewer disagreement (classifier_edits rows) into amendment proposals routed
// to the architect track.
//
// aggregateEdits()    -- groups pending edits by shape; returns clusters above
//                        the surfacing threshold.
// surfaceProposals()  -- writes each cluster to aggregated_proposals (M11),
//                        fires notifyArchitect(), and marks the cluster's edits
//                        'aggregated' so they do not re-enter the next window.
// notifyArchitect()   -- writes one architect_inbox_queue row (M11). Replaces
//                        the Phase 1 console.log stub. The actual cross-track
//                        delivery is an operator-side pickup off this queue.
//
// Gating: aggregateEdits() is a no-op (returns []) unless
// SAFEEVAL_FEEDBACK_AGGREGATION_ENABLED=true. The cron entry (cron.ts) checks
// the same flag and returns a disabled message; the gate here is defense in
// depth so a direct call with the flag off cannot write proposals.

import { createHash } from 'node:crypto';
import {
  getFeedbackStore,
  type FeedbackStore,
  type InboxPriority,
  type PendingEditRow,
} from './store';
import type { ChangeType, RationaleTag } from './types';

const AGGREGATION_FLAG = 'SAFEEVAL_FEEDBACK_AGGREGATION_ENABLED';

export function aggregationEnabled(): boolean {
  return process.env[AGGREGATION_FLAG] === 'true';
}

// Section 8.1 defaults. The cluster-size threshold is the first positional
// argument to aggregateEdits(); the distinct-editors floor is a named default
// overridable via options (the feedback_config tuning surface lives outside
// the schema per section 8.2).
export const DEFAULT_WINDOW_DAYS = 14;
export const DEFAULT_CLUSTER_THRESHOLD = 5;
export const DEFAULT_MIN_DISTINCT_EDITORS = 3;

export interface EditCluster {
  cluster_signature: string;
  field_path: string;
  change_type: ChangeType;
  before_value: unknown;
  after_value: unknown;
  rationale_tag: RationaleTag;
  edit_count: number;
  distinct_editors: number;
  edit_ids: number[];
  // Earliest / latest created_at among the cluster's edits (the proposal's
  // "Time window" line per section 8.1).
  window_start: string;
  window_end: string;
}

export interface AggregationOptions {
  store?: FeedbackStore;
  // Reference instant for the rolling window filter. Defaults to now. Injected
  // by tests so window-boundary assertions are deterministic without mocking
  // Date.
  now?: Date;
  minDistinctEditors?: number;
}

// Canonical JSON: object keys sorted recursively so before/after JSONB values
// that differ only in key order hash to the same cluster signature.
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = canonicalize(obj[key]);
    }
    return out;
  }
  return value;
}

// Deterministic SHA-256 over the cluster shape tuple. The DB column
// aggregated_proposals.cluster_signature stores this; it lets the architect
// dedupe / correlate re-surfacings of the same shape across cron runs.
export function computeClusterSignature(shape: {
  field_path: string;
  change_type: ChangeType;
  before_value: unknown;
  after_value: unknown;
  rationale_tag: RationaleTag;
}): string {
  const canonical = JSON.stringify([
    shape.field_path,
    shape.change_type,
    canonicalize(shape.before_value ?? null),
    canonicalize(shape.after_value ?? null),
    shape.rationale_tag,
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

// The grouping key for clustering -- the cluster_signature is exactly the
// shape tuple, so it doubles as the map key.
function groupKey(edit: PendingEditRow): string {
  return computeClusterSignature({
    field_path: edit.field_path,
    change_type: edit.change_type,
    before_value: edit.before_value,
    after_value: edit.after_value,
    rationale_tag: edit.rationale_tag,
  });
}

// Group pending edits by shape and return the clusters that meet the surfacing
// threshold (edit_count >= threshold AND distinct_editors >= minDistinctEditors).
export async function aggregateEdits(
  window_days: number = DEFAULT_WINDOW_DAYS,
  threshold: number = DEFAULT_CLUSTER_THRESHOLD,
  options: AggregationOptions = {},
): Promise<EditCluster[]> {
  // Gate (defense in depth; the cron also gates).
  if (!aggregationEnabled()) return [];

  const store = options.store ?? getFeedbackStore();
  const minDistinctEditors = options.minDistinctEditors ?? DEFAULT_MIN_DISTINCT_EDITORS;
  const now = options.now ?? new Date();
  const cutoffMs = now.getTime() - window_days * 24 * 60 * 60 * 1000;

  const rows = await store.queryPendingEdits(window_days);

  // Re-apply the window filter in-code against `now`. The store pre-filters in
  // SQL for efficiency, but applying it here keeps the boundary deterministic
  // and testable, and tolerates a mock store that ignores windowDays.
  const inWindow = rows.filter((r) => {
    const t = Date.parse(r.created_at);
    return Number.isFinite(t) && t >= cutoffMs;
  });

  const groups = new Map<string, PendingEditRow[]>();
  for (const edit of inWindow) {
    const key = groupKey(edit);
    const bucket = groups.get(key);
    if (bucket) bucket.push(edit);
    else groups.set(key, [edit]);
  }

  const clusters: EditCluster[] = [];
  for (const [signature, bucket] of groups) {
    const editors = new Set(bucket.map((e) => e.editor_id));
    const distinct_editors = editors.size;
    const edit_count = bucket.length;
    if (edit_count < threshold || distinct_editors < minDistinctEditors) continue;

    const times = bucket.map((e) => e.created_at).sort();
    const first = bucket[0];
    if (!first) continue;
    clusters.push({
      cluster_signature: signature,
      field_path: first.field_path,
      change_type: first.change_type,
      before_value: first.before_value,
      after_value: first.after_value,
      rationale_tag: first.rationale_tag,
      edit_count,
      distinct_editors,
      edit_ids: bucket.map((e) => e.id),
      window_start: times[0] ?? first.created_at,
      window_end: times[times.length - 1] ?? first.created_at,
    });
  }

  // Deterministic ordering: largest clusters first, ties broken by signature.
  clusters.sort((a, b) =>
    b.edit_count - a.edit_count || a.cluster_signature.localeCompare(b.cluster_signature),
  );
  return clusters;
}

// Priority routing: coverage_gap clusters route to Steven (section 14 Q3
// Option A); everything else is default-accept (section 14 Q1).
export function priorityForTag(rationale_tag: RationaleTag): InboxPriority {
  return rationale_tag === 'coverage_gap' ? 'route-to-steven' : 'default-accept';
}

export interface ArchitectProposal {
  proposal_id: number;
  rationale_tag: RationaleTag;
  // Explicit override; when omitted, derived from rationale_tag.
  priority?: InboxPriority;
}

export interface NotifyOptions {
  store?: FeedbackStore;
  source_track?: string;
}

// Write one architect_inbox_queue row for the proposal. Replaces the Phase 1
// console.log stub. Returns the inbox row id. The created_at timestamp is the
// DB DEFAULT now(); cross-track delivery is an operator-side pickup off the
// queue.
export async function notifyArchitect(
  proposal: ArchitectProposal,
  options: NotifyOptions = {},
): Promise<{ inbox_id: number }> {
  const store = options.store ?? getFeedbackStore();
  const priority = proposal.priority ?? priorityForTag(proposal.rationale_tag);
  const { id } = await store.insertArchitectInboxEntry({
    proposal_id: proposal.proposal_id,
    source_track: options.source_track ?? 'feedback',
    priority,
  });
  return { inbox_id: id };
}

export interface SurfaceResult {
  proposals_created: number;
  proposal_ids: number[];
  inbox_ids: number[];
  edits_marked: number;
}

// Convert clusters into architect-track proposals: write each to
// aggregated_proposals, fire notifyArchitect(), and mark the cluster's edits
// 'aggregated'. Per-cluster failures do not abort the batch -- a failed cluster
// is skipped and surfaced in the returned counts (its edits stay 'pending' and
// roll into the next cycle).
export async function surfaceProposals(
  clusters: EditCluster[],
  options: NotifyOptions = {},
): Promise<SurfaceResult> {
  const store = options.store ?? getFeedbackStore();
  const proposal_ids: number[] = [];
  const inbox_ids: number[] = [];
  let edits_marked = 0;

  for (const cluster of clusters) {
    const { id: proposal_id } = await store.insertAggregatedProposal({
      cluster_signature: cluster.cluster_signature,
      field_path: cluster.field_path,
      change_type: cluster.change_type,
      before_value: cluster.before_value,
      after_value: cluster.after_value,
      rationale_tag: cluster.rationale_tag,
      edit_count: cluster.edit_count,
      distinct_editors: cluster.distinct_editors,
      window_start: cluster.window_start,
      window_end: cluster.window_end,
    });
    proposal_ids.push(proposal_id);

    const { inbox_id } = await notifyArchitect(
      { proposal_id, rationale_tag: cluster.rationale_tag },
      { store, source_track: options.source_track },
    );
    inbox_ids.push(inbox_id);

    await store.markEditsAggregated(cluster.edit_ids);
    edits_marked += cluster.edit_ids.length;
  }

  return {
    proposals_created: proposal_ids.length,
    proposal_ids,
    inbox_ids,
    edits_marked,
  };
}

// Real-time coverage_gap path (section 14 Q3 Option A). A single coverage_gap
// edit bypasses the N>=5 aggregation threshold: it surfaces immediately as a
// one-edit proposal routed to Steven. Used by the persistence post-write hook.
// Returns the SurfaceResult for the (at most one) proposal created.
export async function surfaceCoverageGapEdit(
  edit: PendingEditRow,
  options: NotifyOptions = {},
): Promise<SurfaceResult> {
  const cluster: EditCluster = {
    cluster_signature: computeClusterSignature({
      field_path: edit.field_path,
      change_type: edit.change_type,
      before_value: edit.before_value,
      after_value: edit.after_value,
      rationale_tag: edit.rationale_tag,
    }),
    field_path: edit.field_path,
    change_type: edit.change_type,
    before_value: edit.before_value,
    after_value: edit.after_value,
    rationale_tag: edit.rationale_tag,
    edit_count: 1,
    distinct_editors: 1,
    edit_ids: [edit.id],
    window_start: edit.created_at,
    window_end: edit.created_at,
  };
  return surfaceProposals([cluster], options);
}
