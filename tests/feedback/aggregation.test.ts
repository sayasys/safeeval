// Tests for the feedback-loop daily aggregation (Phase 2).
//
// Coverage:
//   - Gating: aggregateEdits returns [] when the flag is off.
//   - Cluster detection: edits of the same shape group into one cluster.
//   - Threshold gating: clusters below edit_count threshold do not surface.
//   - Distinct-editors counting: clusters below the distinct-editor floor do
//     not surface even when edit_count is met.
//   - Window boundaries: edits older than the window are excluded.
//   - computeClusterSignature determinism + key-order insensitivity.
//   - surfaceProposals writes one proposal + one inbox row per cluster and
//     marks the cluster's edits aggregated.
//   - notifyArchitect priority routing (coverage_gap -> route-to-steven).
//   - surfaceCoverageGapEdit surfaces a single edit immediately.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aggregateEdits,
  surfaceProposals,
  notifyArchitect,
  surfaceCoverageGapEdit,
  computeClusterSignature,
} from '../../src/lib/feedback/aggregation';
import type {
  FeedbackStore,
  PendingEditRow,
  AggregatedProposalInsert,
  ArchitectInboxInsert,
} from '../../src/lib/feedback/store';

const NOW = new Date('2026-05-29T00:00:00.000Z');

function makeEdit(over: Partial<PendingEditRow> = {}): PendingEditRow {
  return {
    id: 1,
    evaluation_id: 'eval_1',
    editor_id: 'reviewer_a',
    editor_role: 'senior_reviewer',
    field_path: 'l1.category',
    change_type: 'modify',
    before_value: 'fraud_financial',
    after_value: 'fraud_identity',
    rationale_tag: 'wrong_l1_category',
    rationale_text: null,
    created_at: '2026-05-28T12:00:00.000Z',
    ...over,
  };
}

interface MockStore {
  store: FeedbackStore;
  proposals: AggregatedProposalInsert[];
  inbox: ArchitectInboxInsert[];
  marked: number[];
}

function makeMockStore(pending: PendingEditRow[]): MockStore {
  const proposals: AggregatedProposalInsert[] = [];
  const inbox: ArchitectInboxInsert[] = [];
  const marked: number[] = [];
  let proposalId = 0;
  let inboxId = 0;
  const store: FeedbackStore = {
    queryPendingEdits: async () => pending,
    queryCoverageGapEdits: async () => [],
    insertAggregatedProposal: async (p) => {
      proposals.push(p);
      return { id: ++proposalId };
    },
    insertArchitectInboxEntry: async (e) => {
      inbox.push(e);
      return { id: ++inboxId };
    },
    markEditsAggregated: async (ids) => {
      marked.push(...ids);
    },
    queryCorpusRecords: async () => [],
  };
  return { store, proposals, inbox, marked };
}

// A cluster of N edits with the same shape from `distinctEditors` distinct
// editor ids, all inside the window.
function makeCluster(n: number, distinctEditors: number): PendingEditRow[] {
  const out: PendingEditRow[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      makeEdit({
        id: i + 1,
        editor_id: `reviewer_${i % distinctEditors}`,
        created_at: '2026-05-28T12:00:00.000Z',
      }),
    );
  }
  return out;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('SAFEEVAL_FEEDBACK_AGGREGATION_ENABLED', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('aggregateEdits -- gating', () => {
  it('returns [] when the aggregation flag is off', async () => {
    vi.stubEnv('SAFEEVAL_FEEDBACK_AGGREGATION_ENABLED', 'false');
    const { store } = makeMockStore(makeCluster(10, 5));
    const clusters = await aggregateEdits(14, 5, { store, now: NOW });
    expect(clusters).toEqual([]);
  });
});

describe('aggregateEdits -- cluster detection', () => {
  it('groups same-shape edits into one cluster above threshold', async () => {
    const { store } = makeMockStore(makeCluster(6, 4));
    const clusters = await aggregateEdits(14, 5, { store, now: NOW });
    expect(clusters).toHaveLength(1);
    const c = clusters[0]!;
    expect(c.edit_count).toBe(6);
    expect(c.distinct_editors).toBe(4);
    expect(c.field_path).toBe('l1.category');
    expect(c.rationale_tag).toBe('wrong_l1_category');
    expect(c.edit_ids).toEqual([1, 2, 3, 4, 5, 6]);
    expect(c.cluster_signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('separates edits of different shapes into distinct clusters', async () => {
    const a = makeCluster(5, 3); // l1.category cluster (ids 1-5)
    const b = makeCluster(5, 3).map((e) =>
      makeEdit({
        id: e.id + 100,
        editor_id: e.editor_id,
        field_path: 'disposition.action',
        rationale_tag: 'disposition_too_lenient',
        before_value: 'allow',
        after_value: 'block',
      }),
    );
    const { store } = makeMockStore([...a, ...b]);
    const clusters = await aggregateEdits(14, 5, { store, now: NOW });
    expect(clusters).toHaveLength(2);
    const paths = clusters.map((c) => c.field_path).sort();
    expect(paths).toEqual(['disposition.action', 'l1.category']);
  });
});

describe('aggregateEdits -- threshold + distinct-editor gating', () => {
  it('does not surface a cluster below the edit_count threshold', async () => {
    const { store } = makeMockStore(makeCluster(4, 4));
    const clusters = await aggregateEdits(14, 5, { store, now: NOW });
    expect(clusters).toEqual([]);
  });

  it('does not surface a cluster below the distinct-editor floor', async () => {
    // 6 edits but only 2 distinct editors -> below default floor of 3.
    const { store } = makeMockStore(makeCluster(6, 2));
    const clusters = await aggregateEdits(14, 5, { store, now: NOW });
    expect(clusters).toEqual([]);
  });

  it('honors a custom minDistinctEditors override', async () => {
    const { store } = makeMockStore(makeCluster(6, 2));
    const clusters = await aggregateEdits(14, 5, {
      store,
      now: NOW,
      minDistinctEditors: 2,
    });
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.distinct_editors).toBe(2);
  });
});

describe('aggregateEdits -- window boundaries', () => {
  it('excludes edits older than the rolling window', async () => {
    const inWindow = makeCluster(5, 3); // 2026-05-28, inside 14d of NOW
    const old = makeCluster(5, 3).map((e) =>
      makeEdit({ id: e.id + 200, editor_id: e.editor_id, created_at: '2026-05-01T00:00:00.000Z' }),
    );
    const { store } = makeMockStore([...inWindow, ...old]);
    const clusters = await aggregateEdits(14, 5, { store, now: NOW });
    // Both groups share the same shape, so the in-window 5 survive and the
    // out-of-window 5 are filtered before grouping -> one cluster of 5.
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.edit_count).toBe(5);
    expect(clusters[0]!.window_start).toBe('2026-05-28T12:00:00.000Z');
  });
});

describe('computeClusterSignature', () => {
  it('is deterministic and insensitive to object key order', async () => {
    const sigA = computeClusterSignature({
      field_path: 'evidence.component_scores.lure',
      change_type: 'modify',
      before_value: { a: 1, b: 2 },
      after_value: { x: 9 },
      rationale_tag: 'component_score_off',
    });
    const sigB = computeClusterSignature({
      field_path: 'evidence.component_scores.lure',
      change_type: 'modify',
      before_value: { b: 2, a: 1 },
      after_value: { x: 9 },
      rationale_tag: 'component_score_off',
    });
    expect(sigA).toBe(sigB);
    expect(sigA).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('surfaceProposals', () => {
  it('writes one proposal + one inbox row per cluster and marks edits', async () => {
    const { store, proposals, inbox, marked } = makeMockStore(makeCluster(6, 4));
    const clusters = await aggregateEdits(14, 5, { store, now: NOW });
    const result = await surfaceProposals(clusters, { store });

    expect(result.proposals_created).toBe(1);
    expect(result.edits_marked).toBe(6);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.edit_count).toBe(6);
    expect(proposals[0]!.distinct_editors).toBe(4);
    expect(inbox).toHaveLength(1);
    // wrong_l1_category is not coverage_gap -> default-accept.
    expect(inbox[0]!.priority).toBe('default-accept');
    expect(inbox[0]!.proposal_id).toBe(result.proposal_ids[0]);
    expect(marked.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('routes a coverage_gap cluster to Steven', async () => {
    const edits = makeCluster(5, 3).map((e) =>
      makeEdit({
        id: e.id,
        editor_id: e.editor_id,
        field_path: 'l3.method',
        change_type: 'add',
        before_value: null,
        after_value: 'pretexting_video_call',
        rationale_tag: 'coverage_gap',
        rationale_text: 'L3 method missing for this pattern',
      }),
    );
    const { store, inbox } = makeMockStore(edits);
    const clusters = await aggregateEdits(14, 5, { store, now: NOW });
    await surfaceProposals(clusters, { store });
    expect(inbox[0]!.priority).toBe('route-to-steven');
  });
});

describe('notifyArchitect', () => {
  it('derives priority from rationale_tag when not overridden', async () => {
    const { store, inbox } = makeMockStore([]);
    await notifyArchitect({ proposal_id: 42, rationale_tag: 'coverage_gap' }, { store });
    expect(inbox[0]!.priority).toBe('route-to-steven');
    expect(inbox[0]!.proposal_id).toBe(42);
    expect(inbox[0]!.source_track).toBe('feedback');
  });

  it('honors an explicit priority override', async () => {
    const { store, inbox } = makeMockStore([]);
    await notifyArchitect(
      { proposal_id: 7, rationale_tag: 'coverage_gap', priority: 'default-accept' },
      { store },
    );
    expect(inbox[0]!.priority).toBe('default-accept');
  });
});

describe('surfaceCoverageGapEdit', () => {
  it('surfaces a single coverage_gap edit immediately as a route-to-steven proposal', async () => {
    const { store, proposals, inbox, marked } = makeMockStore([]);
    const edit = makeEdit({
      id: 99,
      field_path: 'l3.target',
      change_type: 'add',
      before_value: null,
      after_value: 'elderly_consumer',
      rationale_tag: 'coverage_gap',
      rationale_text: 'new target population',
    });
    const result = await surfaceCoverageGapEdit(edit, { store });
    expect(result.proposals_created).toBe(1);
    expect(proposals[0]!.edit_count).toBe(1);
    expect(proposals[0]!.distinct_editors).toBe(1);
    expect(inbox[0]!.priority).toBe('route-to-steven');
    expect(marked).toEqual([99]);
  });
});
