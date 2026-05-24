// src/app/api/evaluate/route.js
// POST /api/evaluate
//
// Backward-compatible dual-emit handler.
//
// Default request (no query params):
//   Returns the v4 envelope at the root, identical to the pre-v5 behavior.
//   The live UI on safeeval.vercel.app and any external consumers see no
//   difference. storeEvaluation() is called with the v4 shape so the listing
//   endpoint (filtered by escalation_tier) keeps working.
//
// ?v5=1 (opt-in):
//   Runs the v4 and v5 pipelines in parallel via Promise.allSettled and
//   returns:
//     { id, v4_legacy: <v4 envelope>, v5: <v5 envelope or error stub> }
//   Partial success is allowed: if the v5 pipeline throws but v4 succeeds,
//   the response is 200 with v5 set to { error: "v5_pipeline_failed", detail }.
//   Symmetrically, if v4 throws but v5 succeeds, deriveV4Legacy(v5) is used
//   as the v4_legacy fallback so the wrapper shape is preserved.
//   If BOTH fail, the route returns 500 { error: "evaluation_failed", ... }.
//
// ?debug=1 (requires ?v5=1):
//   Passes { debug: true } to evaluatePromptV5 so pipeline_trace is included
//   in the v5 envelope. ?debug=1 without ?v5=1 returns
//   400 { error: "debug_requires_v5" }.
//
// Validation thresholds are sourced from POLICY_CONFIG (no hardcoded 10/5000).
//
// All errors are JSON envelopes -- no raw exceptions, no HTML error pages.

import { NextResponse } from 'next/server';
import { evaluatePrompt, storeEvaluation } from '@/lib/safeeval';
import { evaluatePromptV5, deriveV4Legacy, POLICY_CONFIG } from '@/lib/safeeval-v5';

function badRequest(code, detail) {
  const body = { error: code };
  if (detail) body.detail = detail;
  return NextResponse.json(body, { status: 400 });
}

function serverError(code, detail) {
  return NextResponse.json({ error: code, detail: String(detail) }, { status: 500 });
}

function validatePrompt(prompt) {
  if (typeof prompt !== 'string') {
    return 'prompt is required and must be a string';
  }
  const len = prompt.length;
  if (len < POLICY_CONFIG.PROMPT_LENGTH_MIN) {
    return 'prompt must be at least ' + POLICY_CONFIG.PROMPT_LENGTH_MIN + ' characters';
  }
  if (len > POLICY_CONFIG.PROMPT_LENGTH_MAX) {
    return 'prompt must be ' + POLICY_CONFIG.PROMPT_LENGTH_MAX + ' characters or fewer';
  }
  return null;
}

export async function POST(request) {
  // Parse query params first so we can validate the debug/v5 gating early.
  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return badRequest('invalid_request', 'malformed url');
  }
  const wantV5 = url.searchParams.get('v5') === '1';
  const wantDebug = url.searchParams.get('debug') === '1';

  if (wantDebug && !wantV5) {
    return badRequest('debug_requires_v5', 'pass ?v5=1 alongside ?debug=1');
  }

  // Parse body.
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return badRequest('invalid_json', 'request body must be valid JSON');
  }
  const prompt = body && body.prompt;
  const vErr = validatePrompt(prompt);
  if (vErr) {
    return badRequest('invalid_prompt', vErr);
  }

  // -------------------------------------------------------------------
  // Default path: v4 only. Behavior is byte-identical to the pre-v5 route.
  // -------------------------------------------------------------------
  if (!wantV5) {
    try {
      const v4Result = await evaluatePrompt(prompt);
      const record = storeEvaluation(prompt, v4Result);
      return NextResponse.json(Object.assign({ id: record.id }, v4Result));
    } catch (err) {
      console.error('v4 evaluation error:', err);
      return serverError('evaluation_failed', err && err.message ? err.message : err);
    }
  }

  // -------------------------------------------------------------------
  // Dual-emit path: ?v5=1. Run both pipelines in parallel and tolerate
  // partial success so a v5 bug never breaks the v4 surface area.
  // -------------------------------------------------------------------
  const settled = await Promise.allSettled([
    evaluatePrompt(prompt),
    evaluatePromptV5(prompt, { debug: wantDebug }),
  ]);
  const v4Settled = settled[0];
  const v5Settled = settled[1];

  let v4Result = null;
  let v5Result = null;
  let v5ErrorStub = null;
  let v4ErrorStub = null;

  if (v5Settled.status === 'fulfilled') {
    v5Result = v5Settled.value;
  } else {
    const detail = v5Settled.reason && v5Settled.reason.message ? v5Settled.reason.message : String(v5Settled.reason);
    console.error('v5 pipeline error:', v5Settled.reason);
    v5ErrorStub = { error: 'v5_pipeline_failed', detail: detail };
  }

  if (v4Settled.status === 'fulfilled') {
    v4Result = v4Settled.value;
  } else {
    const detail = v4Settled.reason && v4Settled.reason.message ? v4Settled.reason.message : String(v4Settled.reason);
    console.error('v4 pipeline error:', v4Settled.reason);
    // If v5 succeeded, derive a v4_legacy shape from it so the wrapper is intact.
    if (v5Result) {
      try {
        v4Result = deriveV4Legacy(v5Result);
      } catch (e) {
        v4Result = null;
      }
    }
    if (!v4Result) {
      v4ErrorStub = { error: 'v4_pipeline_failed', detail: detail };
    }
  }

  // Both pipelines failed -- nothing usable to return.
  if (!v4Result && !v5Result) {
    return serverError(
      'evaluation_failed',
      (v4ErrorStub && v4ErrorStub.detail) || (v5ErrorStub && v5ErrorStub.detail) || 'both pipelines failed'
    );
  }

  // Store the v4_legacy shape so the listing endpoint keeps filtering by
  // escalation_tier. The v5 envelope is not persisted; the route is
  // stateless for v5 and the engine is the source of truth.
  let id = null;
  try {
    const record = storeEvaluation(prompt, v4Result || v4ErrorStub || {});
    id = record.id;
  } catch (e) {
    console.error('storeEvaluation error:', e);
  }

  return NextResponse.json({
    id: id,
    v4_legacy: v4Result || v4ErrorStub,
    v5: v5Result || v5ErrorStub,
  });
}
