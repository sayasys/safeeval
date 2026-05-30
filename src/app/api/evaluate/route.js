// src/app/api/evaluate/route.js
// POST /api/evaluate
//
// v5-only handler. The response is the v5 envelope at the root:
//
//   { id, ...v5Envelope }
//
// Two input modes (memo 2026-05-28 section 2):
//
//   Prompt mode (legacy and continued default):
//     { "prompt": "string..." }
//   OR explicit shape (also accepted):
//     { "input": { "kind": "prompt", "text": "string..." } }
//
//   Conversation mode (new in v5.1 conversation extension):
//     { "input": { "kind": "conversation", "conversation": {
//          "modality": "text",
//          "turns":   [{ "sender": "Alice", "text": "hi", "timestamp": "2026-04-12T10:14:00Z" }, ...]
//        } } }
//   OR text body (parser-driven segmentation):
//     { "input": { "kind": "conversation", "conversation": {
//          "modality": "text", "text": "Alice: hi\nBob: hello\n..." } } }
//   OR image:
//     { "input": { "kind": "conversation", "conversation": {
//          "modality": "image",
//          "image": { "base64": "<base64-encoded image bytes>",
//                     "mediaType": "image/png" } } } }
//
// Image-handling decision (defended in phase-3 archive): base64-in-JSON.
// Rationale:
//   (a) Keeps the API contract pure JSON-in / JSON-out -- the existing prompt
//       path is JSON; conversation extends without introducing a multipart
//       parser to Next.js route handlers.
//   (b) The phase 0 spike validated this exact base64 input shape; the parser
//       module (src/lib/conversation-parser.js) consumes
//       { base64, mediaType } directly.
//   (c) Phase 4 UI can FileReader.readAsDataURL -> strip prefix -> POST. The
//       envelope's input.conversation surface does not need to expose the
//       raw image bytes back to the consumer; the envelope returns the
//       parsed turns only.
//   (d) Vercel body size default is 4.5MB; chat screenshots are typically
//       <1MB. Out of scope for v1: multi-image upload (would benefit
//       multipart). Phase 5 calibrates whether to lift to multipart.
//
// ?debug=1:
//   Passes { debug: true } to the engine so pipeline_trace is included in
//   the v5 envelope. No other query params are recognized.
//
// body.parseOnly === true (conversation mode only):
//   Runs Stage 0 only (the parser) and returns the parsed-turns envelope
//   without invoking Stages 1-4. Used by the phase 4 UI to drive the
//   preview-confirm step required by design spec section 20.3. Response:
//     { ok, output: { turns, parse_confidence, parse_warnings, modality_hint? },
//       model, duration_ms, input_kind }
//   On parser failure: { ok: false, error: "..." } at HTTP 200 (the parser's
//   degraded path is a user-facing condition, not an HTTP error).
//
// All errors are JSON envelopes -- no raw exceptions, no HTML error pages.

import { NextResponse } from 'next/server';
import {
  evaluatePromptV5,
  evaluateConversationV5,
  storeEvaluation,
  POLICY_CONFIG,
  INPUT_KIND_VALUES,
  CONVERSATION_MODALITY_VALUES,
  CONVERSATION_TURNS_MIN,
} from '@/lib/safeeval-v5';
import {
  parseConversationFromImage,
  parseConversationFromText,
} from '@/lib/conversation-parser';
import { maybePersistEvaluation } from '@/lib/data';
import { detectMedia } from '@/lib/media-detection';
import { maxBytesFor, maxLabelFor } from '@/lib/media-evaluator/upload';

// Multipart media upload (Evaluator image / audio tabs). Builds the engine's
// media_artifact envelope and routes through detectMedia() -- the same Stage 0
// detector the v5 pipeline calls when a prompt/conversation envelope carries a
// media_artifact. The synthetic-media tabs have no text to classify, so this
// path deliberately returns the detector result alone rather than running the
// fraud cascade (Stages 1-4): there is no prompt, and a placeholder prompt
// would burn model calls and emit a meaningless disposition. The response
// mirrors the detector's MediaDetectionResult under media_detection_result so
// the page renders the same shape detectMedia produces inside the engine.
async function handleMediaUpload(request) {
  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return badRequest('invalid_multipart', 'request body must be valid multipart/form-data');
  }

  const declared = form.get('media_type');
  const mediaType = declared === 'audio' ? 'audio' : declared === 'image' ? 'image' : null;
  if (!mediaType) {
    return badRequest('invalid_media_type', "media_type must be 'image' or 'audio'");
  }

  const file = form.get('file');
  // A Web File/Blob exposes arrayBuffer(); a stringified field does not.
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return badRequest('missing_file', 'a file field is required');
  }

  let bytes;
  try {
    bytes = Buffer.from(await file.arrayBuffer());
  } catch (e) {
    return badRequest('unreadable_file', 'uploaded file could not be read');
  }
  if (bytes.length === 0) {
    return badRequest('empty_file', 'uploaded file is empty');
  }
  const cap = maxBytesFor(mediaType);
  if (bytes.length > cap) {
    return badRequest('file_too_large', mediaType + ' files must be ' + maxLabelFor(mediaType) + ' or smaller');
  }

  const mimeType = (typeof file.type === 'string' && file.type.length > 0)
    ? file.type
    : (mediaType === 'audio' ? 'audio/mpeg' : 'image/png');

  const artifact = {
    type: mediaType,
    url_or_base64: bytes.toString('base64'),
    mime_type: mimeType,
  };

  let detection;
  try {
    detection = await detectMedia(artifact);
  } catch (err) {
    detection = {
      is_synthetic: 0,
      confidence: 0,
      model_id: 'media-detection-router',
      latency_ms: 0,
      error: 'detectMedia threw: ' + (err && err.message ? err.message : String(err)),
    };
  }

  return NextResponse.json({
    id: null,
    input_kind: 'media',
    media_type: mediaType,
    mime_type: mimeType,
    media_detection_result: detection,
  });
}

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

function validateConversationInput(conv) {
  if (!conv || typeof conv !== 'object') {
    return 'input.conversation must be an object';
  }
  if (CONVERSATION_MODALITY_VALUES.indexOf(conv.modality) < 0) {
    return 'input.conversation.modality must be one of: ' + CONVERSATION_MODALITY_VALUES.join(', ');
  }
  if (conv.modality === 'image') {
    if (!conv.image || typeof conv.image !== 'object') {
      return 'input.conversation.image is required for modality=image';
    }
    if (typeof conv.image.base64 !== 'string' || conv.image.base64.length === 0) {
      return 'input.conversation.image.base64 must be a non-empty base64 string';
    }
    // Soft cap on image bytes (Vercel default 4.5MB; we cap at 3MB pre-decode
    // so the base64 payload stays under 4MB).
    if (conv.image.base64.length > 4 * 1024 * 1024) {
      return 'input.conversation.image.base64 exceeds 4 MB (Vercel body size cap)';
    }
  } else {
    // modality === 'text'
    const hasTurns = Array.isArray(conv.turns) && conv.turns.length > 0;
    const hasText  = typeof conv.text === 'string' && conv.text.trim().length > 0;
    if (!hasTurns && !hasText) {
      return 'input.conversation.text or input.conversation.turns is required for modality=text';
    }
    if (hasTurns && conv.turns.length < CONVERSATION_TURNS_MIN) {
      return 'input.conversation.turns must contain at least ' + CONVERSATION_TURNS_MIN + ' entries';
    }
    if (hasTurns) {
      for (let i = 0; i < conv.turns.length; i++) {
        const t = conv.turns[i];
        if (!t || typeof t !== 'object') return 'input.conversation.turns[' + i + '] must be an object';
        if (typeof t.sender !== 'string' || t.sender.length === 0) {
          return 'input.conversation.turns[' + i + '].sender is required and must be a non-empty string';
        }
        if (typeof t.text !== 'string') {
          return 'input.conversation.turns[' + i + '].text is required and must be a string';
        }
      }
    }
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

  // Multipart media uploads (image / audio tabs) branch before the JSON parse:
  // the body is form-data, not JSON. Everything else stays JSON-in / JSON-out.
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    return handleMediaUpload(request);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return badRequest('invalid_json', 'request body must be valid JSON');
  }

  // Branch on input shape.
  //   1. Legacy { prompt: "..." }                       -> prompt mode
  //   2. { input: { kind: "prompt", text: "..." } }     -> prompt mode (explicit)
  //   3. { input: { kind: "conversation", ... } }       -> conversation mode
  const input = body && body.input;
  let v5Result;

  if (input && typeof input === 'object') {
    if (INPUT_KIND_VALUES.indexOf(input.kind) < 0) {
      return badRequest('invalid_input_kind', 'input.kind must be one of: ' + INPUT_KIND_VALUES.join(', '));
    }
    if (input.kind === 'prompt') {
      const text = input.text;
      const vErr = validatePrompt(text);
      if (vErr) return badRequest('invalid_prompt', vErr);
      try {
        v5Result = await evaluatePromptV5(text, { debug: wantDebug });
      } catch (err) {
        console.error('v5 pipeline error:', err);
        return serverError('evaluation_failed', err && err.message ? err.message : err);
      }
      const id = safeStore(text, v5Result);
      await maybePersistEvaluation(text, v5Result);
      return NextResponse.json(Object.assign({ id }, v5Result));
    }
    // input.kind === 'conversation'
    const cvErr = validateConversationInput(input.conversation);
    if (cvErr) return badRequest('invalid_conversation', cvErr);

    // body.parseOnly: Stage 0 only. Drives the preview-confirm step
    // (design spec 20.3) without burning Stages 1-4 on an un-confirmed parse.
    // Image: vision parse via parseConversationFromImage.
    // Text: deterministic regex via parseConversationFromText.
    // (Caller-supplied turns arrays bypass parseOnly; the UI only invokes
    // this path when starting from a raw text body or image.)
    if (body && body.parseOnly === true) {
      try {
        const stage0 = input.conversation.modality === 'image'
          ? await parseConversationFromImage(input.conversation.image || {})
          : parseConversationFromText(
              typeof input.conversation.text === 'string' ? input.conversation.text : '',
            );
        return NextResponse.json(stage0);
      } catch (err) {
        console.error('v5 conversation parse-only error:', err);
        return serverError('evaluation_failed', err && err.message ? err.message : err);
      }
    }

    try {
      v5Result = await evaluateConversationV5(input, { debug: wantDebug });
    } catch (err) {
      console.error('v5 conversation pipeline error:', err);
      return serverError('evaluation_failed', err && err.message ? err.message : err);
    }
    // Store key for conversation: the canonical formatted turns string the
    // pipeline saw, capped to PROMPT_LENGTH_MAX for the preview field.
    const previewText = describeConversationForStore(input.conversation, v5Result);
    const id = safeStore(previewText, v5Result);
    // Persist the conversation envelope. The rawInput argument is retained
    // on the persistEvaluation signature for caller compatibility but is
    // unused inside the function (PII zero-storage Tier A dropped the KMS
    // branch). The JSON serialization is left in place to keep parity with
    // the prompt-path caller.
    const rawConvJson = (() => {
      try { return JSON.stringify(input.conversation); } catch { return previewText; }
    })();
    await maybePersistEvaluation(rawConvJson, v5Result);
    return NextResponse.json(Object.assign({ id }, v5Result));
  }

  // Legacy path: { prompt: "..." }.
  const prompt = body && body.prompt;
  const vErr = validatePrompt(prompt);
  if (vErr) return badRequest('invalid_prompt', vErr);

  try {
    v5Result = await evaluatePromptV5(prompt, { debug: wantDebug });
  } catch (err) {
    console.error('v5 pipeline error:', err);
    return serverError('evaluation_failed', err && err.message ? err.message : err);
  }

  const id = safeStore(prompt, v5Result);
  await maybePersistEvaluation(prompt, v5Result);
  return NextResponse.json(Object.assign({ id }, v5Result));
}

function safeStore(promptText, v5Result) {
  try {
    const record = storeEvaluation(promptText, v5Result);
    return record.id;
  } catch (e) {
    console.error('storeEvaluation error:', e);
    return null;
  }
}

function describeConversationForStore(conv, v5Result) {
  const turns = v5Result && v5Result.input && v5Result.input.conversation && v5Result.input.conversation.turns;
  if (!Array.isArray(turns) || turns.length === 0) return '[conversation: 0 turns]';
  const head = turns[0];
  return '[conversation: ' + turns.length + ' turns | first: ' + head.sender + ': ' +
    String(head.text || '').slice(0, 60) + (head.text && head.text.length > 60 ? '...' : '') + ']';
}
