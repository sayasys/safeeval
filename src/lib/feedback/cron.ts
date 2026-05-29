// Vercel cron entry point for the daily feedback aggregation -- Phase 2.
//
// Spec: docs/memos/2026-05-28-classifier-feedback-loop-scoping.md section 8.1.
//
// The Next route handler at src/app/api/cron/feedback-aggregation/route.ts is a
// thin delegate to runFeedbackAggregationCron() below, which is kept framework-
// agnostic (no NextRequest / Response dependency) so the unit tests drive it
// directly with a header string + injected store.
//
// Auth: Vercel cron attaches `Authorization: Bearer ${CRON_SECRET}` when the
// CRON_SECRET env var is configured. The handler rejects any request whose
// header does not match (401) before executing. This is the only protection on
// the route -- there is no other gate, so a missing/blank CRON_SECRET fails
// closed (401) rather than open.
//
// Gating: even with a valid secret, the cron returns an "aggregation disabled"
// summary (HTTP 200) unless SAFEEVAL_FEEDBACK_AGGREGATION_ENABLED=true, so the
// route is safe to wire before the operator opts into the cost/notification
// surface.

import {
  aggregateEdits,
  aggregationEnabled,
  surfaceProposals,
  DEFAULT_WINDOW_DAYS,
  DEFAULT_CLUSTER_THRESHOLD,
} from './aggregation';
import type { FeedbackStore } from './store';

export interface CronExecutionSummary {
  ok: boolean;
  status: 'executed' | 'disabled' | 'unauthorized' | 'error';
  message?: string;
  clusters_found?: number;
  proposals_created?: number;
  edits_processed?: number;
}

export interface CronResponse {
  status: number;
  body: CronExecutionSummary;
}

export interface CronOptions {
  store?: FeedbackStore;
  now?: Date;
  window_days?: number;
  threshold?: number;
  minDistinctEditors?: number;
}

// Verify the Authorization header against CRON_SECRET. Fails closed: a missing
// header OR a missing/blank server-side secret returns false.
function isAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length === 0) return false;
  if (!authHeader) return false;
  return authHeader === `Bearer ${secret}`;
}

export async function runFeedbackAggregationCron(
  authHeader: string | null,
  options: CronOptions = {},
): Promise<CronResponse> {
  if (!isAuthorized(authHeader)) {
    return {
      status: 401,
      body: {
        ok: false,
        status: 'unauthorized',
        message:
          'Missing or invalid Authorization header. The cron route requires ' +
          'Authorization: Bearer ${CRON_SECRET}.',
      },
    };
  }

  if (!aggregationEnabled()) {
    return {
      status: 200,
      body: {
        ok: true,
        status: 'disabled',
        message:
          'aggregation disabled (SAFEEVAL_FEEDBACK_AGGREGATION_ENABLED is not ' +
          'true); no edits processed.',
      },
    };
  }

  try {
    const window_days = options.window_days ?? DEFAULT_WINDOW_DAYS;
    const threshold = options.threshold ?? DEFAULT_CLUSTER_THRESHOLD;

    const clusters = await aggregateEdits(window_days, threshold, {
      ...(options.store ? { store: options.store } : {}),
      ...(options.now ? { now: options.now } : {}),
      ...(options.minDistinctEditors !== undefined
        ? { minDistinctEditors: options.minDistinctEditors }
        : {}),
    });

    const surfaced = await surfaceProposals(
      clusters,
      options.store ? { store: options.store } : {},
    );

    const summary: CronExecutionSummary = {
      ok: true,
      status: 'executed',
      clusters_found: clusters.length,
      proposals_created: surfaced.proposals_created,
      edits_processed: surfaced.edits_marked,
    };
    // Metrics line per section 8.1 (operator greps this in the cron logs).
    console.log(
      `[feedback-aggregation] executed: clusters_found=${summary.clusters_found} ` +
        `proposals_created=${summary.proposals_created} ` +
        `edits_processed=${summary.edits_processed}`,
    );
    return { status: 200, body: summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[feedback-aggregation] failed: ${message}`);
    return {
      status: 500,
      body: { ok: false, status: 'error', message },
    };
  }
}
