// Unit tests for the audio synthetic-media detector. Mocks fetch via the
// fetchImpl seam; mirrors the image-detector test patterns. ascii-safe.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  detectAudio,
  PRIMARY_AUDIO_MODEL,
} from '../../src/lib/media-detection/audio-detector';
import type { MediaArtifact } from '../../src/lib/media-detection/types';

const URL_ARTIFACT: MediaArtifact = {
  type: 'audio',
  url_or_base64: 'https://example.invalid/clip.mp3',
  mime_type: 'audio/mpeg',
};

const BASE64_ARTIFACT: MediaArtifact = {
  type: 'audio',
  // 4-byte placeholder base64; the detector posts these bytes upstream and
  // the test mocks the response. Contents are irrelevant.
  url_or_base64: 'AAECAw==',
  mime_type: 'audio/wav',
};

function jsonResponse(body: unknown, init?: { status?: number; statusText?: string }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    headers: { 'Content-Type': 'application/json' },
  });
}

let originalToken: string | undefined;

beforeEach(() => {
  originalToken = process.env.HF_API_TOKEN;
  process.env.HF_API_TOKEN = 'test-token';
});

afterEach(() => {
  if (originalToken === undefined) delete process.env.HF_API_TOKEN;
  else process.env.HF_API_TOKEN = originalToken;
});

describe('detectAudio -- happy paths', () => {
  it('parses a deepfake-high response and reports model_id + latency', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse([
        { label: 'fake', score: 0.87 },
        { label: 'real', score: 0.13 },
      ]);

    const result = await detectAudio(URL_ARTIFACT, { fetchImpl });
    expect(result.is_synthetic).toBeCloseTo(0.87, 5);
    expect(result.confidence).toBeCloseTo(0.87, 5);
    expect(result.model_id).toBe(PRIMARY_AUDIO_MODEL);
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it('parses a deepfake-low response (real-looking audio)', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse([
        { label: 'spoof', score: 0.05 },
        { label: 'real', score: 0.95 },
      ]);
    const result = await detectAudio(URL_ARTIFACT, { fetchImpl });
    expect(result.is_synthetic).toBeCloseTo(0.05, 5);
    expect(result.confidence).toBeCloseTo(0.95, 5);
    expect(result.error).toBeUndefined();
  });

  it('matches "deepfake" label variants via the synthetic regex', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse([
        { label: 'DEEPFAKE', score: 0.66 },
        { label: 'authentic', score: 0.34 },
      ]);
    const result = await detectAudio(URL_ARTIFACT, { fetchImpl });
    expect(result.is_synthetic).toBeCloseTo(0.66, 5);
  });

  it('posts base64 payloads as octet-stream and URL inputs as JSON', async () => {
    const observed: { contentType: string; bodyIsString: boolean }[] = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const contentType = headers['Content-Type'] ?? headers['content-type'] ?? '';
      observed.push({ contentType, bodyIsString: typeof init?.body === 'string' });
      return jsonResponse([{ label: 'fake', score: 0.5 }]);
    };
    await detectAudio(URL_ARTIFACT, { fetchImpl });
    await detectAudio(BASE64_ARTIFACT, { fetchImpl });
    expect(observed[0]!.contentType).toBe('application/json');
    expect(observed[0]!.bodyIsString).toBe(true);
    expect(observed[1]!.contentType).toBe('application/octet-stream');
    expect(observed[1]!.bodyIsString).toBe(false);
  });
});

describe('detectAudio -- error paths', () => {
  it('returns an error result (no throw) when HF_API_TOKEN is missing', async () => {
    delete process.env.HF_API_TOKEN;
    const fetchImpl: typeof fetch = async () => {
      throw new Error('should not be called when token missing');
    };
    const result = await detectAudio(URL_ARTIFACT, { fetchImpl });
    expect(result.error).toMatch(/HF_API_TOKEN/);
    expect(result.is_synthetic).toBe(0);
    expect(result.model_id).toBe(PRIMARY_AUDIO_MODEL);
  });

  it('returns an error result on HTTP 4xx without throwing', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('bad input', { status: 400, statusText: 'Bad Request' });
    const result = await detectAudio(URL_ARTIFACT, { fetchImpl });
    expect(result.error).toMatch(/400/);
    expect(result.is_synthetic).toBe(0);
  });

  it('degrades to is_synthetic = 0 when HF returns no synthetic-class label', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse([{ label: 'music', score: 0.6 }, { label: 'speech', score: 0.4 }]);
    const result = await detectAudio(URL_ARTIFACT, { fetchImpl });
    expect(result.is_synthetic).toBe(0);
    expect(result.confidence).toBeCloseTo(0.6, 5);
    expect(result.error).toBeUndefined();
  });

  it('returns an error result on malformed (non-array) JSON', async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse({ unexpected: true });
    const result = await detectAudio(URL_ARTIFACT, { fetchImpl });
    expect(result.error).toMatch(/malformed/i);
  });

  it('returns an error result when fetch rejects (network failure)', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('ECONNRESET');
    };
    const result = await detectAudio(URL_ARTIFACT, { fetchImpl });
    expect(result.error).toMatch(/ECONNRESET/);
  });

  it('honors the timeoutMs option and reports a timeout error', async () => {
    const fetchImpl: typeof fetch = async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const e = new Error('The operation was aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });
    const result = await detectAudio(URL_ARTIFACT, { fetchImpl, timeoutMs: 25 });
    expect(result.error).toMatch(/timed out/i);
  });
});

describe('detectAudio -- diagnostic logging (no token leak)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('logs the upstream status + body on a non-OK response', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('{"error":"Model is currently loading"}', {
        status: 503,
        statusText: 'Service Unavailable',
      });
    await detectAudio(URL_ARTIFACT, { fetchImpl });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [msg, detail] = errorSpy.mock.calls[0]!;
    expect(String(msg)).toMatch(/non-OK/i);
    expect(detail).toMatchObject({ status: 503 });
    expect(JSON.stringify(detail)).toContain('currently loading');
  });

  it('logs the real cause when fetch rejects with a bare "fetch failed"', async () => {
    const fetchImpl: typeof fetch = async () => {
      const e = new Error('fetch failed');
      (e as { cause?: unknown }).cause = Object.assign(
        new Error('read ECONNRESET'),
        { code: 'ECONNRESET' }
      );
      throw e;
    };
    const result = await detectAudio(URL_ARTIFACT, { fetchImpl });
    expect(result.error).toBe('fetch failed');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [msg, detail] = errorSpy.mock.calls[0]!;
    expect(String(msg)).toMatch(/threw/i);
    expect(JSON.stringify(detail)).toContain('ECONNRESET');
  });

  it('does not log the bearer token in any diagnostic output', async () => {
    process.env.HF_API_TOKEN = 'hf_supersecret_should_never_appear';
    const fetchImpl: typeof fetch = async () =>
      new Response('upstream down', { status: 500, statusText: 'Internal Server Error' });
    await detectAudio(URL_ARTIFACT, { fetchImpl });
    const logged = errorSpy.mock.calls.map((c) => JSON.stringify(c)).join(' ');
    expect(logged).not.toContain('hf_supersecret_should_never_appear');
  });

  it('does not log on a timeout/abort (already-clear error)', async () => {
    const fetchImpl: typeof fetch = async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const e = new Error('The operation was aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });
    await detectAudio(URL_ARTIFACT, { fetchImpl, timeoutMs: 25 });
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
