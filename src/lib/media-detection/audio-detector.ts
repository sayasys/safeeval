// Audio synthetic-media detector (Hugging Face Inference API).
//
// Adopted model per dispatch default-accept: MelodyMachine/Deepfake-audio-
// detection-V2. Same endpoint conventions as the image detector -- URL
// inputs go as JSON {"inputs": "<url>"}, base64 payloads as octet-stream.
// The synthetic-class label regex differs (audio detector vocabularies
// favor "fake/spoof/deepfake/synth"); models that don't match degrade to
// is_synthetic = 0 with confidence still populated.
// ascii-safe.

import type {
  DetectorOptions,
  MediaArtifact,
  MediaDetectionResult,
} from './types';
import { DEFAULT_DETECTOR_TIMEOUT_MS } from './types';

export const PRIMARY_AUDIO_MODEL = 'MelodyMachine/Deepfake-audio-detection-V2';

// Inference Providers router (hf-inference). The legacy host
// api-inference.huggingface.co was retired by HF and no longer resolves in
// DNS; the router preserves the same audio-classification response contract
// ([{ label, score }, ...]) and is the host the "Make calls to Inference
// Providers" fine-grained token scope authorizes.
const HF_INFERENCE_ENDPOINT = (modelId: string): string =>
  `https://router.huggingface.co/hf-inference/models/${modelId}`;

const SYNTHETIC_AUDIO_LABEL_PATTERN = /fake|spoof|synth|deepfake/i;

interface HFClassification {
  label: string;
  score: number;
}

function stripDataUriPrefix(s: string): string {
  const comma = s.indexOf(',');
  if (s.startsWith('data:') && comma !== -1) return s.slice(comma + 1);
  return s;
}

function isUrl(s: string): boolean {
  return s.startsWith('http://') || s.startsWith('https://');
}

export async function detectAudio(
  input: MediaArtifact,
  options: DetectorOptions = {}
): Promise<MediaDetectionResult> {
  const start = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_DETECTOR_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const modelId = PRIMARY_AUDIO_MODEL;

  const token = process.env.HF_API_TOKEN;
  if (!token) {
    return {
      is_synthetic: 0,
      confidence: 0,
      model_id: modelId,
      latency_ms: Date.now() - start,
      error: 'HF_API_TOKEN not configured',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Hoisted so the catch block can log which URL failed -- a network-level
  // "fetch failed" (e.g. the host no longer resolves) is otherwise opaque.
  const url = HF_INFERENCE_ENDPOINT(modelId);

  try {
    const useUrl = isUrl(input.url_or_base64);
    const body: string | Buffer = useUrl
      ? JSON.stringify({ inputs: input.url_or_base64 })
      : Buffer.from(stripDataUriPrefix(input.url_or_base64), 'base64');
    const contentType = useUrl ? 'application/json' : 'application/octet-stream';

    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      // Surface the real upstream failure to Vercel function logs (ERROR
      // level). HF returns a JSON body explaining the status -- e.g.
      // {"error":"Model ... is currently loading"} on 503 cold-start, or an
      // auth message on 401/403. The body never contains the token (the
      // Authorization header is request-side only), so it is safe to log.
      const bodyText = await res.text().catch(() => '<unreadable body>');
      // Single JSON line: Vercel's log table truncates multi-arg / multi-line
      // entries, which previously hid the real reason. Stringify keeps the
      // status, statusText, the (token-free) HF body, and the URL on one line.
      console.error(
        JSON.stringify({
          msg: '[media-detection:audio] HF inference returned non-OK',
          model_id: modelId,
          url,
          status: res.status,
          statusText: res.statusText,
          body: bodyText.slice(0, 1000),
        })
      );
      return {
        is_synthetic: 0,
        confidence: 0,
        model_id: modelId,
        latency_ms: Date.now() - start,
        error: `HF inference failed: ${res.status} ${res.statusText}`,
      };
    }

    const parsed = (await res.json()) as unknown;
    if (!Array.isArray(parsed)) {
      return {
        is_synthetic: 0,
        confidence: 0,
        model_id: modelId,
        latency_ms: Date.now() - start,
        error: 'HF inference returned malformed response (not an array)',
      };
    }

    const items = parsed.filter(
      (d): d is HFClassification =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as { label?: unknown }).label === 'string' &&
        typeof (d as { score?: unknown }).score === 'number'
    );
    if (items.length === 0) {
      return {
        is_synthetic: 0,
        confidence: 0,
        model_id: modelId,
        latency_ms: Date.now() - start,
        error: 'HF inference returned malformed response (no valid items)',
      };
    }

    const synthetic = items.find((d) => SYNTHETIC_AUDIO_LABEL_PATTERN.test(d.label));
    const is_synthetic = synthetic ? synthetic.score : 0;
    const scores = items.map((d) => d.score);
    const confidence = scores.length > 0 ? Math.max(...scores) : 0;

    return {
      is_synthetic,
      confidence,
      model_id: modelId,
      latency_ms: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isAbort =
      (err instanceof Error && err.name === 'AbortError') ||
      message.includes('aborted');
    // Surface the real failure to Vercel function logs (ERROR level). A bare
    // "fetch failed" from undici hides the actual reason (DNS, TLS, connection
    // reset, etc.) inside err.cause -- log it so a network-level failure is
    // distinguishable from auth / cold-start. The Authorization header is
    // never part of the error object, so nothing here leaks the token.
    if (!isAbort) {
      const cause = err instanceof Error ? err.cause : undefined;
      // Single JSON line (see non-OK path above). The url field is the key
      // signal for a network-level failure: a "fetch failed" whose cause is
      // ENOTFOUND/getaddrinfo against this host means the host is unreachable
      // or no longer resolves, not an auth/scope problem.
      console.error(
        JSON.stringify({
          msg: '[media-detection:audio] HF inference fetch threw',
          model_id: modelId,
          url,
          name: err instanceof Error ? err.name : typeof err,
          message,
          cause:
            cause instanceof Error
              ? { name: cause.name, message: cause.message, code: (cause as { code?: unknown }).code }
              : cause,
          stack: err instanceof Error ? err.stack : undefined,
        })
      );
    }
    return {
      is_synthetic: 0,
      confidence: 0,
      model_id: modelId,
      latency_ms: Date.now() - start,
      error: isAbort ? `HF inference timed out after ${timeoutMs}ms` : message,
    };
  } finally {
    clearTimeout(timer);
  }
}
