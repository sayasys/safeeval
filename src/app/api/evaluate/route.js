// src/app/api/evaluate/route.js
// POST /api/evaluate
//
// v5-only handler. The v4 engine and the dual-emit envelope have been
// sunset; v5 is the single classification surface. The response is the v5
// envelope at the root:
//
//   { id, ...v5Envelope }
//
// where v5Envelope is the schema-5.1 shape returned by evaluatePromptV5
// (classification, disposition, evidence, model_pipeline, prompt_summary,
// prompt_length, evaluated_at, etc.). storeEvaluation persists the v5 shape
// and the /api/evaluations listing endpoint filters by disposition.action.
//
// ?debug=1:
//   Passes { debug: true } to evaluatePromptV5 so pipeline_trace is included
//   in the v5 envelope. No other query params are recognized.
//
// Validation thresholds are sourced from POLICY_CONFIG (no hardcoded 10/5000).
//
// All errors are JSON envelopes -- no raw exceptions, no HTML error pages.

import { NextResponse } from 'next/server';
import { evaluatePromptV5, storeEvaluation, POLICY_CONFIG } from '@/lib/safeeval-v5';

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
  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return badRequest('invalid_request', 'malformed url');
  }
  const wantDebug = url.searchParams.get('debug') === '1';

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

  let v5Result;
  try {
    v5Result = await evaluatePromptV5(prompt, { debug: wantDebug });
  } catch (err) {
    console.error('v5 pipeline error:', err);
    return serverError('evaluation_failed', err && err.message ? err.message : err);
  }

  let id = null;
  try {
    const record = storeEvaluation(prompt, v5Result);
    id = record.id;
  } catch (e) {
    console.error('storeEvaluation error:', e);
  }

  return NextResponse.json(Object.assign({ id: id }, v5Result));
}
