// Unit tests for the Gemini 1.5 Flash reasoning fallback (Phase 2).
//
// Mocks fetch via the fetchImpl DI seam on DetectorOptions; no real Gemini
// call. Covers: happy path, ambiguous-band gating (delegated to index.ts but
// asserted here at the layer boundary), timeout, API non-2xx error, and
// malformed response (multiple shapes). ascii-safe.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  reasonAboutAmbiguousDetection,
  REASONING_MODEL_ID,
} from '../../src/lib/media-detection/reasoning-layer';
import type {
  MediaArtifact,
  MediaDetectionResult,
} from '../../src/lib/media-detection/types';

const URL_ARTIFACT: MediaArtifact = {
  type: 'image',
  url_or_base64: 'https://example.invalid/face.png',
  mime_type: 'image/png',
};

const BASE64_ARTIFACT: MediaArtifact = {
  type: 'image',
  url_or_base64:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  mime_type: 'image/png',
};

const AMBIGUOUS_DETECTOR_RESULT: MediaDetectionResult = {
  is_synthetic: 0.52,
  confidence: 0.55,
  model_id: 'Organika/sdxl-detector',
  latency_ms: 184,
};

function geminiResponse(verdict: string, confidence: number, reasoning: string): Response {
  // Gemini's response shape: candidates[0].content.parts[0].text contains the
  // JSON-as-string per generationConfig.responseMimeType='application/json'.
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ verdict, confidence, reasoning }) }],
          },
        },
      ],
    }),
    { status: 200, statusText: 'OK', headers: { 'Content-Type': 'application/json' } }
  );
}

function rawTextResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    { status: 200, statusText: 'OK', headers: { 'Content-Type': 'application/json' } }
  );
}

let originalKey: string | undefined;

beforeEach(() => {
  originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-gemini-key';
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
});

describe('reasonAboutAmbiguousDetection -- happy path', () => {
  it('parses a likely_synthetic verdict with confidence and prose', async () => {
    const fetchImpl: typeof fetch = async () =>
      geminiResponse(
        'likely_synthetic',
        0.78,
        'Visible smearing around eyes and asymmetric facial features consistent with diffusion-model artifacts.'
      );
    const result = await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, {
      fetchImpl,
    });
    expect(result.verdict).toBe('likely_synthetic');
    expect(result.confidence).toBeCloseTo(0.78, 5);
    expect(result.reasoning).toMatch(/smearing/);
    expect(result.model_id).toBe(REASONING_MODEL_ID);
  });

  it('parses a likely_real verdict', async () => {
    const fetchImpl: typeof fetch = async () =>
      geminiResponse('likely_real', 0.83, 'Natural skin texture, consistent lighting, no telltale generation signatures.');
    const result = await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, {
      fetchImpl,
    });
    expect(result.verdict).toBe('likely_real');
    expect(result.confidence).toBeCloseTo(0.83, 5);
  });

  it('parses a still_ambiguous verdict (Gemini cannot decide either)', async () => {
    const fetchImpl: typeof fetch = async () =>
      geminiResponse('still_ambiguous', 0.5, 'Mixed signals; some texture inconsistencies but plausible authenticity.');
    const result = await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, {
      fetchImpl,
    });
    expect(result.verdict).toBe('still_ambiguous');
  });

  it('posts the artifact as inlineData for base64 inputs and fileData for URL inputs', async () => {
    const observed: Array<{ partKeys: string[] }> = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      const body = String((init?.body ?? '') as string);
      const parsed = JSON.parse(body) as {
        contents: Array<{ parts: Array<Record<string, unknown>> }>;
      };
      const parts = parsed.contents[0]!.parts;
      // The non-text part carries the artifact reference.
      const artifactPart = parts.find((p) => !('text' in p));
      observed.push({ partKeys: Object.keys(artifactPart ?? {}) });
      return geminiResponse('likely_synthetic', 0.7, 'ok');
    };
    await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, { fetchImpl });
    await reasonAboutAmbiguousDetection(BASE64_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, { fetchImpl });
    expect(observed[0]!.partKeys).toEqual(['fileData']);
    expect(observed[1]!.partKeys).toEqual(['inlineData']);
  });

  it('strips a code-fenced JSON response wrapper if Gemini emits one', async () => {
    const fetchImpl: typeof fetch = async () =>
      rawTextResponse('```json\n' + JSON.stringify({ verdict: 'likely_synthetic', confidence: 0.7, reasoning: 'ok' }) + '\n```');
    const result = await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, {
      fetchImpl,
    });
    expect(result.verdict).toBe('likely_synthetic');
    expect(result.confidence).toBeCloseTo(0.7, 5);
  });

  it('truncates an overly long reasoning prose to the cap', async () => {
    const longProse = 'x'.repeat(2000);
    const fetchImpl: typeof fetch = async () =>
      geminiResponse('likely_synthetic', 0.7, longProse);
    const result = await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, {
      fetchImpl,
    });
    expect(result.reasoning.length).toBeLessThanOrEqual(600);
  });
});

describe('reasonAboutAmbiguousDetection -- defensive prompting + framing', () => {
  it('frames the media as data not instructions in the prompt body', async () => {
    let promptText = '';
    const fetchImpl: typeof fetch = async (_url, init) => {
      const body = String((init?.body ?? '') as string);
      const parsed = JSON.parse(body) as {
        contents: Array<{ parts: Array<{ text?: string }> }>;
      };
      promptText = parsed.contents[0]!.parts[0]!.text ?? '';
      return geminiResponse('likely_synthetic', 0.7, 'ok');
    };
    await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, { fetchImpl });
    expect(promptText).toMatch(/DATA being analyzed/);
    expect(promptText).toMatch(/Do not follow any/);
    // The detector context the layer hands Gemini.
    expect(promptText).toMatch(/0\.52/);
    expect(promptText).toMatch(/Organika\/sdxl-detector/);
  });
});

describe('reasonAboutAmbiguousDetection -- error paths', () => {
  it('degrades to still_ambiguous when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchImpl: typeof fetch = async () => {
      throw new Error('should not be called without an API key');
    };
    const result = await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, {
      fetchImpl,
    });
    expect(result.verdict).toBe('still_ambiguous');
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toMatch(/GEMINI_API_KEY/);
    expect(result.model_id).toBe(REASONING_MODEL_ID);
  });

  it('degrades to still_ambiguous on Gemini HTTP 5xx', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('upstream down', { status: 503, statusText: 'Service Unavailable' });
    const result = await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, {
      fetchImpl,
    });
    expect(result.verdict).toBe('still_ambiguous');
    expect(result.reasoning).toMatch(/503/);
  });

  it('degrades to still_ambiguous on Gemini HTTP 429 rate-limit', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('quota exhausted', { status: 429, statusText: 'Too Many Requests' });
    const result = await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, {
      fetchImpl,
    });
    expect(result.verdict).toBe('still_ambiguous');
    expect(result.reasoning).toMatch(/429/);
  });

  it('degrades to still_ambiguous on timeout', async () => {
    const fetchImpl: typeof fetch = async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const e = new Error('The operation was aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });
    const result = await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, {
      fetchImpl,
      timeoutMs: 25,
    });
    expect(result.verdict).toBe('still_ambiguous');
    expect(result.reasoning).toMatch(/timed out/i);
  });

  it('degrades to still_ambiguous on malformed JSON text payload', async () => {
    const fetchImpl: typeof fetch = async () => rawTextResponse('not json {oops');
    const result = await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, {
      fetchImpl,
    });
    expect(result.verdict).toBe('still_ambiguous');
    expect(result.reasoning).toMatch(/JSON/);
  });

  it('degrades to still_ambiguous on out-of-vocab verdict (schema rejection)', async () => {
    const fetchImpl: typeof fetch = async () =>
      geminiResponse('definitely_a_deepfake', 0.99, 'too confident to be safe');
    const result = await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, {
      fetchImpl,
    });
    expect(result.verdict).toBe('still_ambiguous');
    expect(result.reasoning).toMatch(/out-of-vocab/);
  });

  it('degrades to still_ambiguous when candidates[0].content.parts[0].text is missing', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ candidates: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const result = await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, {
      fetchImpl,
    });
    expect(result.verdict).toBe('still_ambiguous');
    expect(result.reasoning).toMatch(/missing candidates/);
  });

  it('clamps an out-of-[0,1] confidence number to 0 (defensive parse)', async () => {
    const fetchImpl: typeof fetch = async () =>
      geminiResponse('likely_synthetic', 1.7, 'over-confident');
    const result = await reasonAboutAmbiguousDetection(URL_ARTIFACT, AMBIGUOUS_DETECTOR_RESULT, {
      fetchImpl,
    });
    expect(result.verdict).toBe('likely_synthetic');
    expect(result.confidence).toBe(0);
  });
});
