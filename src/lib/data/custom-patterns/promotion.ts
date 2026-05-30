// Shadow -> live promotion lifecycle: precision proxy + readiness (Phase 4,
// Piece 3).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 6.3 (the promotion gate + precision proxy) + section 11 R5 (the
// distinct-reviewer calibration-attack mitigation). Q4 adjudicated defaults:
// 0.7 precision / 50 evaluations / 10 feedback events / >= 2 distinct reviewers.
//
// This module reads the M15 persistence (custom_l3_match_log for the volume
// count; custom_l3_match_feedback for the precision proxy + reviewer diversity)
// and computes whether a shadow classifier is ready to promote. It also exposes
// the recording helpers the inference pass (recordInferencePass) and the
// reviewer feedback surface (recordMatchFeedback) write through.
//
// RECONCILIATION OF THE PRECISION-PROXY FORMULA (documented unilateral decision).
// The memo (6.3) gives precision_proxy = confirmations / (confirmations +
// corrections) and additionally proposes that evaluation rows the reviewer never
// touched count as implicit confirmations (an upward bias that lets customers
// promote earlier). This implementation computes the proxy over EXPLICIT feedback
// events only -- confirmations / (confirmations + corrections) where both come
// from recorded custom_l3_match_feedback rows. Reasons: (a) the Phase 4 dispatch
// brief specifies "precision proxy = (correct matches) / (total matches)" over
// reviewer feedback events and a "blocked when precision_proxy < 0.7" gate, which
// is only meaningful when the proxy ranges over feedback rather than the
// near-always-passing untouched-counts convention; (b) the untouched-counts
// upward bias would render the precision gate near-inert (vol >= 50 with a
// handful of corrections still yields ~0.95). The conservative event-based proxy
// is the R5-aligned reading. The memo's softer "calibration in progress"
// signalling is preserved as the always-available progress fields the UI renders.
//
// READINESS IS CONJUNCTIVE (documented reconciliation). The memo (6.3) frames the
// volume and feedback conditions as OR-triggers for SHOWING the banner; the brief
// frames the gate as the conjunction of all four conditions. `ready` here is the
// conjunction (N AND M AND distinct AND precision) -- the stricter, R5-safe
// reading that matches the brief's explicit test list. The memo's OR-trigger is
// expressed as the always-present progress fields: the UI shows "X/50, Y/10,
// precision P" throughout shadow, and `ready` only flips when every gate passes.

import {
  resolveStore,
  type CustomPatternsOptions,
} from './patterns';
import {
  PRECISION_PROXY_THRESHOLD,
  PROMOTION_VOLUME_N,
  PROMOTION_FEEDBACK_M,
  MIN_DISTINCT_REVIEWERS,
} from './constants';
import { ClassifierNotFoundError } from './errors';
import type { CustomL3MatchLog, CustomL3MatchFeedback, MatchVia, FeedbackVerdict } from './types';
import type { ClassifierCheckResult } from './inference';

// The promotion-gate readiness snapshot (memo 6.3). Returned by
// computePromotionReadiness and consumed by the detail view (progress / banner)
// and by promoteToLive (server-side gate enforcement).
export interface PromotionReadiness {
  ready: boolean;
  evaluations_count: number;
  feedback_events_count: number;
  distinct_reviewers: number;
  precision_proxy: number;
  reason: string;
}

// Round a 0--1 proxy to 2 decimals for the human-readable reason string. The
// numeric `precision_proxy` field stays the raw ratio for gate comparisons.
function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

// Record one classifier check against an incoming evaluation (one M15
// custom_l3_match_log row). evaluationId is null when the underlying evaluation
// is not persisted (the volume count is independent of evaluation retention).
export async function recordMatchCheck(
  orgId: string,
  classifierId: string,
  args: { evaluationId?: number | null; matched: boolean; confidence: number; via: MatchVia },
  options?: CustomPatternsOptions,
): Promise<CustomL3MatchLog> {
  const store = resolveStore(options);
  return store.insertMatchLog({
    organization_id: orgId,
    classifier_id: classifierId,
    evaluation_id: args.evaluationId ?? null,
    matched: args.matched,
    confidence: args.confidence,
    via: args.via,
  });
}

// Persist every check produced by a single inference pass (runCustomL3InferencePass)
// against one evaluation. The volume condition counts ALL checks (matched or not):
// the classifier was evaluated against the input regardless of the verdict.
export async function recordInferencePass(
  orgId: string,
  checks: readonly ClassifierCheckResult[],
  evaluationId: number | null = null,
  options?: CustomPatternsOptions,
): Promise<CustomL3MatchLog[]> {
  const store = resolveStore(options);
  const rows: CustomL3MatchLog[] = [];
  for (const check of checks) {
    rows.push(
      await store.insertMatchLog({
        organization_id: orgId,
        classifier_id: check.classifier_id,
        evaluation_id: evaluationId,
        matched: check.matched,
        confidence: check.confidence,
        via: check.via,
      }),
    );
  }
  return rows;
}

// Record one reviewer feedback event on a classifier verdict (one M15
// custom_l3_match_feedback row). `confirm` = the reviewer left the matched
// verdict in place; `correct` = the reviewer marked it a false positive.
export async function recordMatchFeedback(
  orgId: string,
  classifierId: string,
  args: { reviewerId: string; verdict: FeedbackVerdict; matchLogId?: number | null },
  options?: CustomPatternsOptions,
): Promise<CustomL3MatchFeedback> {
  const store = resolveStore(options);
  return store.insertMatchFeedback({
    organization_id: orgId,
    classifier_id: classifierId,
    match_log_id: args.matchLogId ?? null,
    reviewer_id: args.reviewerId,
    verdict: args.verdict,
  });
}

// The distinct reviewer ids that have given feedback on a classifier. Exposed so
// the promote action can pass them to promoteToLive's reviewerIds argument
// without re-deriving the set (the gate inside computePromotionReadiness counts
// the same distinct set; promoteToLive double-checks the passed set as defense in
// depth).
export async function getFeedbackReviewerIds(
  orgId: string,
  classifierId: string,
  options?: CustomPatternsOptions,
): Promise<string[]> {
  const store = resolveStore(options);
  const feedback = await store.listMatchFeedback(orgId, classifierId);
  return Array.from(new Set(feedback.map((f) => f.reviewer_id)));
}

// Compute the promotion-gate readiness for a shadow classifier (memo 6.3 + R5).
// The classifier must exist in the org (org-scoped); a missing classifier throws
// ClassifierNotFoundError. Readiness is the conjunction of the four conditions;
// the structured fields drive the always-present progress display.
export async function computePromotionReadiness(
  orgId: string,
  classifierId: string,
  options?: CustomPatternsOptions,
): Promise<PromotionReadiness> {
  const store = resolveStore(options);

  const classifier = await store.getClassifierById(orgId, classifierId);
  if (!classifier) throw new ClassifierNotFoundError(orgId, classifierId);

  const evaluations_count = await store.countMatchLog(orgId, classifierId);
  const feedback = await store.listMatchFeedback(orgId, classifierId);

  const feedback_events_count = feedback.length;
  const distinct_reviewers = new Set(feedback.map((f) => f.reviewer_id)).size;
  const confirmations = feedback.filter((f) => f.verdict === 'confirm').length;
  const corrections = feedback.filter((f) => f.verdict === 'correct').length;
  const denominator = confirmations + corrections;
  const precision_proxy = denominator === 0 ? 0 : confirmations / denominator;

  const volumeOk = evaluations_count >= PROMOTION_VOLUME_N;
  const feedbackOk = feedback_events_count >= PROMOTION_FEEDBACK_M;
  const reviewersOk = distinct_reviewers >= MIN_DISTINCT_REVIEWERS;
  const precisionOk = precision_proxy >= PRECISION_PROXY_THRESHOLD;
  const ready = volumeOk && feedbackOk && reviewersOk && precisionOk;

  const progress =
    `${evaluations_count}/${PROMOTION_VOLUME_N} evaluations, ` +
    `${feedback_events_count}/${PROMOTION_FEEDBACK_M} feedback events, ` +
    `${distinct_reviewers}/${MIN_DISTINCT_REVIEWERS} reviewers, ` +
    `precision ${fmt(precision_proxy)}/${fmt(PRECISION_PROXY_THRESHOLD)}`;

  let reason: string;
  if (ready) {
    reason = `Ready to promote (${progress}).`;
  } else {
    const unmet: string[] = [];
    if (!volumeOk) unmet.push('more evaluations');
    if (!feedbackOk) unmet.push('more feedback events');
    if (!reviewersOk) unmet.push('feedback from more distinct reviewers');
    if (!precisionOk) unmet.push('a higher precision proxy');
    reason = `Calibration in progress -- needs ${unmet.join(', ')} (${progress}).`;
  }

  return {
    ready,
    evaluations_count,
    feedback_events_count,
    distinct_reviewers,
    precision_proxy,
    reason,
  };
}
