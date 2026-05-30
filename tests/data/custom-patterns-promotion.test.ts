// Shadow -> live promotion lifecycle coverage (Phase 4, Piece 3).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 6.3 + 11 R5 + the Q4 adjudicated defaults (0.7 / 50 / 10 / >= 2).
// Drives the precision-proxy gate against the in-memory store: each of the four
// gate conditions blocks promotion independently; all four together let it
// through; the Q9 cap still applies above the gate; cross-org feedback does not
// leak into another org's readiness. Also exercises the action-core wrappers.

import { describe, it, expect } from 'vitest';
import {
  makeInMemoryCustomPatternsStore,
  type CustomPatternsStore,
} from '../../src/lib/data/custom-patterns/store';
import {
  createCustomClassifier,
  promoteToShadow,
  promoteToLive,
} from '../../src/lib/data/custom-patterns/classifiers';
import {
  computePromotionReadiness,
  recordMatchCheck,
  recordInferencePass,
  recordMatchFeedback,
  getFeedbackReviewerIds,
} from '../../src/lib/data/custom-patterns/promotion';
import {
  PromotionGateNotMetError,
  InsufficientReviewersError,
  OrgClassifierCapExceededError,
} from '../../src/lib/data/custom-patterns/errors';
import {
  PROMOTION_VOLUME_N,
  PROMOTION_FEEDBACK_M,
  LIVE_CLASSIFIER_CAP,
} from '../../src/lib/data/custom-patterns/constants';
import {
  runPromoteToLive,
  runGetPromotionReadiness,
} from '../../src/app/app/classifiers/action-core';
import type {
  NewCustomL3Classifier,
  NewCustomL3Example,
  ClassifierCheckResult,
} from '../../src/lib/data/custom-patterns';

const ORG_A = '00000000-0000-0000-0000-00000000000a';
const ORG_B = '00000000-0000-0000-0000-00000000000b';
const USER = '00000000-0000-0000-0000-000000000001';

function freshStore(): { store: CustomPatternsStore } {
  return { store: makeInMemoryCustomPatternsStore() };
}

let tagSeq = 0;
function sampleClassifier(overrides: Partial<NewCustomL3Classifier> = {}): NewCustomL3Classifier {
  tagSeq += 1;
  return {
    group_name: 'context_marker',
    tag_name: `our_custom_tag_${tagSeq}`,
    definition: 'Detects references to our loyalty-token tournament promo used as a fraud pretext on the platform.',
    created_by_user_id: USER,
    ...overrides,
  };
}

function sampleExamples(): NewCustomL3Example[] {
  return [
    { kind: 'positive', text: 'join our token tournament now' },
    { kind: 'positive', text: 'the loyalty promo doubles your tokens' },
    { kind: 'negative', text: 'a benign unrelated support question' },
    { kind: 'negative', text: 'thanks for the help yesterday' },
  ];
}

// Create + move a classifier to shadow, returning its id.
async function makeShadowClassifier(
  orgId: string,
  opts: { store: CustomPatternsStore },
): Promise<string> {
  const created = await createCustomClassifier(orgId, sampleClassifier(), sampleExamples(), opts);
  await promoteToShadow(orgId, created.id, opts);
  return created.id;
}

// Seed the M15 persistence with a controllable shape so each gate condition can
// be tested in isolation. `confirms` + `corrects` feedback events are spread
// round-robin across `reviewers` distinct reviewer ids.
async function seed(
  orgId: string,
  classifierId: string,
  opts: { store: CustomPatternsStore },
  shape: { evals: number; confirms: number; corrects: number; reviewers: number },
): Promise<void> {
  for (let i = 0; i < shape.evals; i++) {
    await recordMatchCheck(orgId, classifierId, { matched: true, confidence: 0.9, via: 'inference' }, opts);
  }
  const rev = (k: number): string => `rev_${(k % Math.max(1, shape.reviewers)) + 1}`;
  let k = 0;
  for (let i = 0; i < shape.confirms; i++) {
    await recordMatchFeedback(orgId, classifierId, { reviewerId: rev(k++), verdict: 'confirm' }, opts);
  }
  for (let i = 0; i < shape.corrects; i++) {
    await recordMatchFeedback(orgId, classifierId, { reviewerId: rev(k++), verdict: 'correct' }, opts);
  }
}

const READY = { evals: PROMOTION_VOLUME_N, confirms: PROMOTION_FEEDBACK_M, corrects: 0, reviewers: 2 };

describe('computePromotionReadiness -- the four gate conditions (memo 6.3 / R5)', () => {
  it('not ready when evaluations_count < N', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    await seed(ORG_A, id, opts, { ...READY, evals: PROMOTION_VOLUME_N - 1 });
    const r = await computePromotionReadiness(ORG_A, id, opts);
    expect(r.ready).toBe(false);
    expect(r.evaluations_count).toBe(PROMOTION_VOLUME_N - 1);
    expect(r.reason).toContain('more evaluations');
  });

  it('not ready when feedback_events_count < M', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    await seed(ORG_A, id, opts, { ...READY, confirms: PROMOTION_FEEDBACK_M - 1 });
    const r = await computePromotionReadiness(ORG_A, id, opts);
    expect(r.ready).toBe(false);
    expect(r.feedback_events_count).toBe(PROMOTION_FEEDBACK_M - 1);
    expect(r.reason).toContain('more feedback events');
  });

  it('not ready when distinct_reviewers < 2', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    await seed(ORG_A, id, opts, { ...READY, reviewers: 1 });
    const r = await computePromotionReadiness(ORG_A, id, opts);
    expect(r.ready).toBe(false);
    expect(r.distinct_reviewers).toBe(1);
    expect(r.reason).toContain('distinct reviewers');
  });

  it('not ready when precision_proxy < 0.7', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    // 6 confirm + 4 correct = 0.6 precision across 2 reviewers, 50 evals.
    await seed(ORG_A, id, opts, { evals: PROMOTION_VOLUME_N, confirms: 6, corrects: 4, reviewers: 2 });
    const r = await computePromotionReadiness(ORG_A, id, opts);
    expect(r.ready).toBe(false);
    expect(r.precision_proxy).toBeCloseTo(0.6, 5);
    expect(r.feedback_events_count).toBe(10);
    expect(r.reason).toContain('precision');
  });

  it('ready when all four conditions are met, with a clear progress message', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    await seed(ORG_A, id, opts, READY);
    const r = await computePromotionReadiness(ORG_A, id, opts);
    expect(r.ready).toBe(true);
    expect(r.evaluations_count).toBe(PROMOTION_VOLUME_N);
    expect(r.feedback_events_count).toBe(PROMOTION_FEEDBACK_M);
    expect(r.distinct_reviewers).toBe(2);
    expect(r.precision_proxy).toBe(1);
    expect(r.reason).toContain('Ready to promote');
  });

  it('reports precision 0 with no feedback (denominator guard)', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    await seed(ORG_A, id, opts, { evals: PROMOTION_VOLUME_N, confirms: 0, corrects: 0, reviewers: 2 });
    const r = await computePromotionReadiness(ORG_A, id, opts);
    expect(r.precision_proxy).toBe(0);
    expect(r.ready).toBe(false);
  });
});

describe('promoteToLive -- server-side gate enforcement', () => {
  it('throws PromotionGateNotMetError when the gate is not met', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    await seed(ORG_A, id, opts, { ...READY, evals: 10 }); // under volume
    await expect(promoteToLive(ORG_A, id, ['rev_1', 'rev_2'], opts)).rejects.toBeInstanceOf(
      PromotionGateNotMetError,
    );
  });

  it('throws InsufficientReviewersError before the gate when the approver set is thin', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    await seed(ORG_A, id, opts, READY);
    await expect(promoteToLive(ORG_A, id, ['rev_1', 'rev_1'], opts)).rejects.toBeInstanceOf(
      InsufficientReviewersError,
    );
  });

  it('promotes when the gate is met', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    await seed(ORG_A, id, opts, READY);
    const live = await promoteToLive(ORG_A, id, ['rev_1', 'rev_2'], opts);
    expect(live.status).toBe('live');
    expect(live.promoted_at).toBeTruthy();
  });

  it('still enforces the Q9 live cap above the gate', async () => {
    const opts = freshStore();
    for (let i = 0; i < LIVE_CLASSIFIER_CAP; i++) {
      const id = await makeShadowClassifier(ORG_A, opts);
      await seed(ORG_A, id, opts, READY);
      await promoteToLive(ORG_A, id, ['rev_1', 'rev_2'], opts);
    }
    const overflow = await makeShadowClassifier(ORG_A, opts);
    await seed(ORG_A, overflow, opts, READY);
    await expect(promoteToLive(ORG_A, overflow, ['rev_1', 'rev_2'], opts)).rejects.toBeInstanceOf(
      OrgClassifierCapExceededError,
    );
  });
});

describe('cross-org isolation of promotion readiness', () => {
  it('org A feedback cannot influence org B readiness', async () => {
    const opts = freshStore();
    const idA = await makeShadowClassifier(ORG_A, opts);
    const idB = await makeShadowClassifier(ORG_B, opts);

    // Fully calibrate org A's classifier.
    await seed(ORG_A, idA, opts, READY);

    // Org B's classifier has no data; its readiness must be untouched by org A.
    const rB = await computePromotionReadiness(ORG_B, idB, opts);
    expect(rB.evaluations_count).toBe(0);
    expect(rB.feedback_events_count).toBe(0);
    expect(rB.ready).toBe(false);

    // And org A's classifier id is not readable / promotable from org B.
    await expect(promoteToLive(ORG_B, idA, ['rev_1', 'rev_2'], opts)).rejects.toBeTruthy();
  });
});

describe('recording helpers', () => {
  it('recordInferencePass writes one match-log row per check', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    const checks: ClassifierCheckResult[] = [
      { classifier_id: id, group_name: 'context_marker', tag_name: 't', status: 'shadow', matched: true, confidence: 0.8, reasoning: 'matched', via: 'inference' },
      { classifier_id: id, group_name: 'context_marker', tag_name: 't', status: 'shadow', matched: false, confidence: 0.1, reasoning: 'no', via: 'inference' },
      { classifier_id: id, group_name: 'context_marker', tag_name: 't', status: 'shadow', matched: true, confidence: 1.0, reasoning: 'bright-line indicator: x', via: 'bright_line' },
    ];
    await recordInferencePass(ORG_A, checks, 42, opts);
    const r = await computePromotionReadiness(ORG_A, id, opts);
    expect(r.evaluations_count).toBe(3); // all checks count toward volume, matched or not
  });

  it('getFeedbackReviewerIds returns the distinct reviewer set', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    await recordMatchFeedback(ORG_A, id, { reviewerId: 'rev_1', verdict: 'confirm' }, opts);
    await recordMatchFeedback(ORG_A, id, { reviewerId: 'rev_2', verdict: 'confirm' }, opts);
    await recordMatchFeedback(ORG_A, id, { reviewerId: 'rev_1', verdict: 'correct' }, opts);
    const reviewers = await getFeedbackReviewerIds(ORG_A, id, opts);
    expect(reviewers.sort()).toEqual(['rev_1', 'rev_2']);
  });
});

describe('action-core promotion wrappers', () => {
  it('runGetPromotionReadiness returns the readiness snapshot', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    await seed(ORG_A, id, opts, READY);
    const result = await runGetPromotionReadiness(ORG_A, id, opts);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.ready).toBe(true);
  });

  it('runPromoteToLive derives reviewers + promotes when ready', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    await seed(ORG_A, id, opts, READY);
    const result = await runPromoteToLive(ORG_A, id, opts);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe('live');
  });

  it('runPromoteToLive surfaces a structured PROMOTION_GATE_NOT_MET failure', async () => {
    const opts = freshStore();
    const id = await makeShadowClassifier(ORG_A, opts);
    await seed(ORG_A, id, opts, { ...READY, evals: 5 });
    const result = await runPromoteToLive(ORG_A, id, opts);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('PROMOTION_GATE_NOT_MET');
  });
});
