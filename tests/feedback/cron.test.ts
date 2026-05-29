// Tests for the feedback aggregation cron entry point (Phase 2).
//
// Coverage:
//   - CRON_SECRET enforcement: 401 without header, with wrong header, and when
//     the server-side secret is unset (fail closed).
//   - Disabled: valid secret + aggregation flag off -> 200 "aggregation
//     disabled" without touching the store.
//   - Executed: valid secret + flag on -> runs aggregateEdits + surfaceProposals
//     and returns clusters_found / proposals_created / edits_processed.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runFeedbackAggregationCron } from '../../src/lib/feedback/cron';
import type { FeedbackStore, PendingEditRow } from '../../src/lib/feedback/store';

const NOW = new Date('2026-05-29T00:00:00.000Z');
const SECRET = 'test-cron-secret';

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

interface Counters {
  pendingQueries: number;
  proposals: number;
  inbox: number;
}

function makeMockStore(pending: PendingEditRow[]): { store: FeedbackStore; counters: Counters } {
  const counters: Counters = { pendingQueries: 0, proposals: 0, inbox: 0 };
  let proposalId = 0;
  let inboxId = 0;
  const store: FeedbackStore = {
    queryPendingEdits: async () => {
      counters.pendingQueries += 1;
      return pending;
    },
    queryCoverageGapEdits: async () => [],
    insertAggregatedProposal: async () => {
      counters.proposals += 1;
      return { id: ++proposalId };
    },
    insertArchitectInboxEntry: async () => {
      counters.inbox += 1;
      return { id: ++inboxId };
    },
    markEditsAggregated: async () => {},
    queryCorpusRecords: async () => [],
  };
  return { store, counters };
}

function cluster(n: number, distinct: number): PendingEditRow[] {
  return Array.from({ length: n }, (_, i) =>
    makeEdit({ id: i + 1, editor_id: `reviewer_${i % distinct}` }),
  );
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('CRON_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('runFeedbackAggregationCron -- CRON_SECRET enforcement', () => {
  it('returns 401 when no Authorization header is supplied', async () => {
    vi.stubEnv('SAFEEVAL_FEEDBACK_AGGREGATION_ENABLED', 'true');
    const { store, counters } = makeMockStore(cluster(6, 4));
    const res = await runFeedbackAggregationCron(null, { store, now: NOW });
    expect(res.status).toBe(401);
    expect(res.body.status).toBe('unauthorized');
    expect(counters.pendingQueries).toBe(0);
  });

  it('returns 401 when the Authorization header does not match', async () => {
    vi.stubEnv('SAFEEVAL_FEEDBACK_AGGREGATION_ENABLED', 'true');
    const { store } = makeMockStore(cluster(6, 4));
    const res = await runFeedbackAggregationCron('Bearer wrong', { store, now: NOW });
    expect(res.status).toBe(401);
  });

  it('returns 401 (fail closed) when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    vi.stubEnv('SAFEEVAL_FEEDBACK_AGGREGATION_ENABLED', 'true');
    const { store } = makeMockStore(cluster(6, 4));
    const res = await runFeedbackAggregationCron(`Bearer ${SECRET}`, { store, now: NOW });
    expect(res.status).toBe(401);
  });
});

describe('runFeedbackAggregationCron -- gating', () => {
  it('returns a disabled summary when the aggregation flag is off', async () => {
    vi.stubEnv('SAFEEVAL_FEEDBACK_AGGREGATION_ENABLED', 'false');
    const { store, counters } = makeMockStore(cluster(6, 4));
    const res = await runFeedbackAggregationCron(`Bearer ${SECRET}`, { store, now: NOW });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('disabled');
    expect(res.body.message).toMatch(/aggregation disabled/);
    // No store access when disabled.
    expect(counters.pendingQueries).toBe(0);
  });
});

describe('runFeedbackAggregationCron -- execution', () => {
  beforeEach(() => {
    vi.stubEnv('SAFEEVAL_FEEDBACK_AGGREGATION_ENABLED', 'true');
  });

  it('runs aggregation + surfaces proposals with a valid secret', async () => {
    const { store, counters } = makeMockStore(cluster(6, 4));
    const res = await runFeedbackAggregationCron(`Bearer ${SECRET}`, { store, now: NOW });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('executed');
    expect(res.body.clusters_found).toBe(1);
    expect(res.body.proposals_created).toBe(1);
    expect(res.body.edits_processed).toBe(6);
    expect(counters.proposals).toBe(1);
    expect(counters.inbox).toBe(1);
  });

  it('reports zero clusters when nothing meets the threshold', async () => {
    const { store } = makeMockStore(cluster(3, 3));
    const res = await runFeedbackAggregationCron(`Bearer ${SECRET}`, { store, now: NOW });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('executed');
    expect(res.body.clusters_found).toBe(0);
    expect(res.body.proposals_created).toBe(0);
    expect(res.body.edits_processed).toBe(0);
  });
});
