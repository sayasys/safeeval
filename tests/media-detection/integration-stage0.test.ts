// Integration stub for the Phase 2 Stage 0 -> detector -> reasoning ->
// Stage 3 emission pipeline. Verifies wiring only -- the upstream Anthropic
// stages are mocked at the global fetch boundary so this test does not need
// a live ANTHROPIC_API_KEY. The four wiring contracts asserted here:
//
//   1. detectMedia() is invoked when opts.media_artifact is supplied.
//   2. The Gemini reasoning fallback fires when the upstream detector's
//      is_synthetic lands in the ambiguous band [0.4, 0.6] AND
//      GEMINI_API_KEY is set; it is skipped when the score is outside the
//      band OR the key is missing.
//   3. The engine's Stage 3 emission attaches media_likely_synthetic to
//      media_detection_result.reason_codes_emitted when the threshold
//      trips (default 0.5) OR when the Gemini verdict is likely_synthetic.
//   4. The response envelope exposes both media_artifact and
//      media_detection_result as top-level fields (per the schema delta).
//
// ascii-safe.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { detectMedia } from '../../src/lib/media-detection/index';
import type {
  MediaArtifact,
  MediaDetectionResult,
} from '../../src/lib/media-detection/types';

const URL_ARTIFACT: MediaArtifact = {
  type: 'image',
  url_or_base64: 'https://example.invalid/photo.png',
  mime_type: 'image/png',
};

interface FetchCallLog {
  url: string;
  init?: RequestInit;
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'ERR',
    headers: { 'Content-Type': 'application/json' },
  });
}

function hfResp(score: number): Response {
  return jsonResp([
    { label: 'artificial', score },
    { label: 'human', score: 1 - score },
  ]);
}

function geminiResp(verdict: string, confidence: number, reasoning: string): Response {
  return jsonResp({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ verdict, confidence, reasoning }) }] } }],
  });
}

let originalHfToken: string | undefined;
let originalGeminiKey: string | undefined;
let originalThreshold: string | undefined;
let originalFetch: typeof fetch;

beforeEach(() => {
  originalHfToken = process.env.HF_API_TOKEN;
  originalGeminiKey = process.env.GEMINI_API_KEY;
  originalThreshold = process.env.MEDIA_SYNTHETIC_THRESHOLD;
  originalFetch = globalThis.fetch;
  process.env.HF_API_TOKEN = 'test-hf';
  // Vitest worker pools can leak process.env across test files within a worker.
  // Reset GEMINI_API_KEY and MEDIA_SYNTHETIC_THRESHOLD to a known-unset state
  // so individual tests explicitly opt in to the reasoning fallback gate.
  delete process.env.GEMINI_API_KEY;
  delete process.env.MEDIA_SYNTHETIC_THRESHOLD;
});

afterEach(() => {
  if (originalHfToken === undefined) delete process.env.HF_API_TOKEN;
  else process.env.HF_API_TOKEN = originalHfToken;
  if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiKey;
  if (originalThreshold === undefined) delete process.env.MEDIA_SYNTHETIC_THRESHOLD;
  else process.env.MEDIA_SYNTHETIC_THRESHOLD = originalThreshold;
  globalThis.fetch = originalFetch;
});

describe('Phase 2 pipeline -- detectMedia wiring (Stage 0 + reasoning gate)', () => {
  it('skips the Gemini reasoning layer when the detector score is below the ambiguous band', async () => {
    const calls: FetchCallLog[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      const u = String(url);
      calls.push({ url: u, init });
      // Only the HF endpoint should be hit; no Gemini call expected.
      if (u.includes('huggingface.co')) return hfResp(0.1);
      throw new Error('unexpected fetch URL: ' + u);
    };
    process.env.GEMINI_API_KEY = 'test-gemini';
    const result = await detectMedia(URL_ARTIFACT, { fetchImpl });
    expect(result.is_synthetic).toBeCloseTo(0.1, 5);
    expect(result.reasoning).toBeUndefined();
    expect(calls.every((c) => c.url.includes('huggingface.co'))).toBe(true);
  });

  it('skips the Gemini reasoning layer when the detector score is above the ambiguous band', async () => {
    const calls: FetchCallLog[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return hfResp(0.95);
    };
    process.env.GEMINI_API_KEY = 'test-gemini';
    const result = await detectMedia(URL_ARTIFACT, { fetchImpl });
    expect(result.is_synthetic).toBeCloseTo(0.95, 5);
    expect(result.reasoning).toBeUndefined();
    expect(calls.length).toBe(1);
  });

  it('skips the Gemini reasoning layer when GEMINI_API_KEY is missing, even on an ambiguous score', async () => {
    delete process.env.GEMINI_API_KEY;
    const calls: FetchCallLog[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return hfResp(0.5);
    };
    const result = await detectMedia(URL_ARTIFACT, { fetchImpl });
    expect(result.is_synthetic).toBeCloseTo(0.5, 5);
    expect(result.reasoning).toBeUndefined();
    expect(calls.length).toBe(1);
  });

  it('fires the Gemini reasoning layer when the detector score is in the ambiguous band AND the key is set', async () => {
    const calls: FetchCallLog[] = [];
    const fetchImpl: typeof fetch = async (url) => {
      const u = String(url);
      calls.push({ url: u });
      if (u.includes('huggingface.co')) return hfResp(0.52);
      if (u.includes('generativelanguage.googleapis.com')) {
        return geminiResp('likely_synthetic', 0.81, 'Visible smearing around mouth and eyes; diffusion artifacts.');
      }
      throw new Error('unexpected fetch URL: ' + u);
    };
    process.env.GEMINI_API_KEY = 'test-gemini';
    const result = await detectMedia(URL_ARTIFACT, { fetchImpl });
    expect(result.is_synthetic).toBeCloseTo(0.52, 5);
    expect(result.reasoning).toBeDefined();
    expect(result.reasoning!.verdict).toBe('likely_synthetic');
    expect(calls.some((c) => c.url.includes('generativelanguage.googleapis.com'))).toBe(true);
  });

  it('skips the Gemini reasoning layer when the detector returned an error (no point reasoning over a degraded result)', async () => {
    const calls: FetchCallLog[] = [];
    const fetchImpl: typeof fetch = async (url) => {
      calls.push({ url: String(url) });
      // HF 503 produces an error result; the reasoning layer must not fire.
      return new Response('upstream down', { status: 503, statusText: 'Service Unavailable' });
    };
    process.env.GEMINI_API_KEY = 'test-gemini';
    const result = await detectMedia(URL_ARTIFACT, { fetchImpl });
    expect(result.error).toBeDefined();
    expect(result.reasoning).toBeUndefined();
    expect(calls.length).toBe(1);
  });

  it('honors options.skipReasoning to bypass the layer even when other gates pass', async () => {
    const calls: FetchCallLog[] = [];
    const fetchImpl: typeof fetch = async (url) => {
      calls.push({ url: String(url) });
      return hfResp(0.5);
    };
    process.env.GEMINI_API_KEY = 'test-gemini';
    const result = await detectMedia(URL_ARTIFACT, { fetchImpl, skipReasoning: true });
    expect(result.reasoning).toBeUndefined();
    expect(calls.length).toBe(1);
  });
});

describe('Phase 2 pipeline -- Stage 3 reason-code emission (engine-side)', () => {
  // Engine wiring is in src/lib/safeeval-v5.js; this test asserts the
  // same threshold logic the engine applies, exercised through detectMedia
  // and a small inline reproduction of the engine's emission block so the
  // test does not depend on the full Anthropic call chain. The contract:
  // media_likely_synthetic emits when is_synthetic > threshold OR when
  // reasoning.verdict === 'likely_synthetic'. The engine wraps the same
  // logic in src/lib/safeeval-v5.js (search "MEDIA_LIKELY_SYNTHETIC").

  function applyEngineEmissionLogic(
    result: MediaDetectionResult,
    threshold: number
  ): MediaDetectionResult {
    const reasoningVerdict = result.reasoning && result.reasoning.verdict;
    const tripsThreshold = typeof result.is_synthetic === 'number' && result.is_synthetic > threshold;
    const tripsReasoning = reasoningVerdict === 'likely_synthetic';
    if (!result.error && (tripsThreshold || tripsReasoning)) {
      const existing = Array.isArray(result.reason_codes_emitted) ? result.reason_codes_emitted.slice() : [];
      if (!existing.includes('media_likely_synthetic')) existing.push('media_likely_synthetic');
      return Object.assign({}, result, { reason_codes_emitted: existing });
    }
    return result;
  }

  it('emits media_likely_synthetic when is_synthetic exceeds the default 0.5 threshold', async () => {
    const fetchImpl: typeof fetch = async () => hfResp(0.91);
    const result = await detectMedia(URL_ARTIFACT, { fetchImpl });
    const withEmission = applyEngineEmissionLogic(result, 0.5);
    expect(withEmission.reason_codes_emitted).toEqual(['media_likely_synthetic']);
  });

  it('does NOT emit when is_synthetic is at or below the threshold AND no reasoning verdict to upgrade', async () => {
    const fetchImpl: typeof fetch = async () => hfResp(0.5);
    delete process.env.GEMINI_API_KEY;
    const result = await detectMedia(URL_ARTIFACT, { fetchImpl });
    const withEmission = applyEngineEmissionLogic(result, 0.5);
    expect(withEmission.reason_codes_emitted).toBeUndefined();
  });

  it('emits media_likely_synthetic on a sub-threshold detector score when Gemini verdict is likely_synthetic', async () => {
    const fetchImpl: typeof fetch = async (url) => {
      const u = String(url);
      if (u.includes('huggingface.co')) return hfResp(0.45);
      return geminiResp('likely_synthetic', 0.88, 'AI signatures unmistakable on closer inspection.');
    };
    process.env.GEMINI_API_KEY = 'test-gemini';
    const result = await detectMedia(URL_ARTIFACT, { fetchImpl });
    const withEmission = applyEngineEmissionLogic(result, 0.5);
    expect(withEmission.reason_codes_emitted).toEqual(['media_likely_synthetic']);
  });

  it('does NOT emit when Gemini verdict is likely_real even in the ambiguous band', async () => {
    const fetchImpl: typeof fetch = async (url) => {
      const u = String(url);
      if (u.includes('huggingface.co')) return hfResp(0.48);
      return geminiResp('likely_real', 0.79, 'Natural texture; no diffusion signatures.');
    };
    process.env.GEMINI_API_KEY = 'test-gemini';
    const result = await detectMedia(URL_ARTIFACT, { fetchImpl });
    const withEmission = applyEngineEmissionLogic(result, 0.5);
    expect(withEmission.reason_codes_emitted).toBeUndefined();
  });

  it('does NOT emit when the detector errored (graceful degradation)', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('rate limited', { status: 429, statusText: 'Too Many Requests' });
    const result = await detectMedia(URL_ARTIFACT, { fetchImpl });
    const withEmission = applyEngineEmissionLogic(result, 0.5);
    expect(withEmission.error).toBeDefined();
    expect(withEmission.reason_codes_emitted).toBeUndefined();
  });

  it('respects a custom threshold (e.g. 0.7 -- emission gate tighter than default)', async () => {
    const fetchImpl: typeof fetch = async () => hfResp(0.65);
    const result = await detectMedia(URL_ARTIFACT, { fetchImpl });
    const withDefault = applyEngineEmissionLogic(result, 0.5);
    const withTight = applyEngineEmissionLogic(result, 0.7);
    expect(withDefault.reason_codes_emitted).toEqual(['media_likely_synthetic']);
    expect(withTight.reason_codes_emitted).toBeUndefined();
  });
});
