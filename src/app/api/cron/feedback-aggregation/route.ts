// Vercel cron route: daily classifier-edits feedback aggregation.
//
// Spec: docs/memos/2026-05-28-classifier-feedback-loop-scoping.md section 8.1.
// Cron schedule is configured in vercel.json (daily, 02:00 UTC).
//
// Thin delegate to runFeedbackAggregationCron() in src/lib/feedback/cron.ts
// (kept framework-agnostic for unit testing). The handler enforces the
// CRON_SECRET bearer-token check inside runFeedbackAggregationCron(); a request
// without the header returns 401. With a valid secret but
// SAFEEVAL_FEEDBACK_AGGREGATION_ENABLED unset, it returns an "aggregation
// disabled" summary (HTTP 200) rather than executing.

import { NextResponse } from 'next/server';
import { runFeedbackAggregationCron } from '@/lib/feedback/cron';

// The cron route reads request headers + live DB state; it must never be
// statically optimized or cached.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const { status, body } = await runFeedbackAggregationCron(authHeader);
  return NextResponse.json(body, { status });
}
