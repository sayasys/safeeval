// Unit tests for the image synthetic-media detector. Mock fetch via the
// fetchImpl dependency-injection seam on DetectorOptions; no real HF call.
// ascii-safe.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  detectImage,
  PRIMARY_IMAGE_MODEL,
} from '../../src/lib/media-detection/image-detector';
import type { MediaArtifact } from '../../src/lib/media-detection/types';

const URL_ARTIFACT: MediaArtifact = {
  type: 'image',
  url_or_base64: 'https://example.invalid/photo.png',
  mime_type: 'image/png',
};

const BASE64_ARTIFACT: MediaArtifact = {
  type: 'image',
  // 1x1 transparent png, base64-encoded -- contents are irrelevant; the
  // detector posts the bytes upstream and the test mocks the response.
  url_or_base64:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  mime_type: 'image/png',
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

describe('detectImage -- happy paths', () => {
  it('parses a synthetic-high response and reports model_id + latency', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return jsonResponse([
        { label: 'artificial', score: 0.92 },
        { label: 'human', score: 0.08 },
      ]);
    };

    const result = await detectImage(URL_ARTIFACT, { fetchImpl });

    expect(result.is_synthetic).toBeCloseTo(0.92, 5);
    expect(result.confidence).toBeCloseTo(0.92, 5);
    expect(result.model_id).toBe(PRIMARY_IMAGE_MODEL);
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(PRIMARY_IMAGE_MODEL);
  });

  it('parses a synthetic-low response (real-looking image) as is_synthetic ~= 0.04', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse([
        { label: 'artificial', score: 0.04 },
        { label: 'human', score: 0.96 },
      ]);

    const result = await detectImage(URL_ARTIFACT, { fetchImpl });
    expect(result.is_synthetic).toBeCloseTo(0.04, 5);
    expect(result.confidence).toBeCloseTo(0.96, 5);
    expect(result.error).toBeUndefined();
  });

  it('posts base64 payloads as octet-stream and URL inputs as JSON', async () => {
    const observed: { contentType: string; bodyIsString: boolean }[] = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const contentType = headers['Content-Type'] ?? headers['content-type'] ?? '';
      observed.push({ contentType, bodyIsString: typeof init?.body === 'string' });
      return jsonResponse([{ label: 'artificial', score: 0.5 }]);
    };

    await detectImage(URL_ARTIFACT, { fetchImpl });
    await detectImage(BASE64_ARTIFACT, { fetchImpl });

    expect(observed[0]!.contentType).toBe('application/json');
    expect(observed[0]!.bodyIsString).toBe(true);
    expect(observed[1]!.contentType).toBe('application/octet-stream');
    expect(observed[1]!.bodyIsString).toBe(false);
  });
});

describe('detectImage -- error paths', () => {
  it('returns an error result (no throw) when HF_API_TOKEN is missing', async () => {
    delete process.env.HF_API_TOKEN;
    const fetchImpl: typeof fetch = async () => {
      throw new Error('should not be called when token missing');
    };
    const result = await detectImage(URL_ARTIFACT, { fetchImpl });
    expect(result.error).toMatch(/HF_API_TOKEN/);
    expect(result.is_synthetic).toBe(0);
    expect(result.model_id).toBe(PRIMARY_IMAGE_MODEL);
  });

  it('returns an error result on HTTP 5xx without throwing', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('upstream down', { status: 503, statusText: 'Service Unavailable' });
    const result = await detectImage(URL_ARTIFACT, { fetchImpl });
    expect(result.error).toMatch(/503/);
    expect(result.is_synthetic).toBe(0);
  });

  it('returns an error result on HTTP 429 rate-limit without throwing', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('rate limited', { status: 429, statusText: 'Too Many Requests' });
    const result = await detectImage(URL_ARTIFACT, { fetchImpl });
    expect(result.error).toMatch(/429/);
  });

  it('degrades to is_synthetic = 0 when HF returns no synthetic-class label', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse([{ label: 'cat', score: 0.7 }, { label: 'dog', score: 0.3 }]);
    const result = await detectImage(URL_ARTIFACT, { fetchImpl });
    expect(result.is_synthetic).toBe(0);
    expect(result.confidence).toBeCloseTo(0.7, 5);
    expect(result.error).toBeUndefined();
  });

  it('returns an error result on malformed (non-array) JSON', async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse({ unexpected: true });
    const result = await detectImage(URL_ARTIFACT, { fetchImpl });
    expect(result.error).toMatch(/malformed/i);
    expect(result.is_synthetic).toBe(0);
  });

  it('returns an error result when fetch rejects (network failure)', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('ENOTFOUND api-inference.huggingface.co');
    };
    const result = await detectImage(URL_ARTIFACT, { fetchImpl });
    expect(result.error).toMatch(/ENOTFOUND/);
    expect(result.is_synthetic).toBe(0);
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
    const result = await detectImage(URL_ARTIFACT, { fetchImpl, timeoutMs: 25 });
    expect(result.error).toMatch(/timed out/i);
    expect(result.is_synthetic).toBe(0);
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
  });
});

describe('detectImage -- diagnostic logging (no token leak)', () => {
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
    await detectImage(URL_ARTIFACT, { fetchImpl });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    // Logged as a single JSON line so Vercel's table view cannot truncate it.
    const detail = JSON.parse(String(errorSpy.mock.calls[0]![0]));
    expect(detail.msg).toMatch(/non-OK/i);
    expect(detail).toMatchObject({ status: 503 });
    expect(detail.url).toContain('huggingface.co');
    expect(JSON.stringify(detail)).toContain('currently loading');
  });

  it('logs the real cause when fetch rejects with a bare "fetch failed"', async () => {
    const fetchImpl: typeof fetch = async () => {
      const e = new Error('fetch failed');
      (e as { cause?: unknown }).cause = Object.assign(
        new Error('getaddrinfo ENOTFOUND api-inference.huggingface.co'),
        { code: 'ENOTFOUND' }
      );
      throw e;
    };
    const result = await detectImage(URL_ARTIFACT, { fetchImpl });
    expect(result.error).toBe('fetch failed');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const detail = JSON.parse(String(errorSpy.mock.calls[0]![0]));
    expect(detail.msg).toMatch(/threw/i);
    expect(detail.url).toContain('huggingface.co');
    expect(JSON.stringify(detail)).toContain('ENOTFOUND');
  });

  it('does not log the bearer token in any diagnostic output', async () => {
    process.env.HF_API_TOKEN = 'hf_supersecret_should_never_appear';
    const fetchImpl: typeof fetch = async () =>
      new Response('upstream down', { status: 500, statusText: 'Internal Server Error' });
    await detectImage(URL_ARTIFACT, { fetchImpl });
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
    await detectImage(URL_ARTIFACT, { fetchImpl, timeoutMs: 25 });
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
