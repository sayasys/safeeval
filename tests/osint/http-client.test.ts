// Tests for the hardened OSINT HTTP fetcher.
//
// Coverage: robots.txt strict mode, timeout, response-size cap, disallowed-
// domain rejection. Each control is independently asserted.

import { describe, expect, it } from 'vitest';
import {
  CrossOriginRedirectError,
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_TIMEOUT_MS,
  DisallowedByRobots,
  ResponseTooLarge,
  RobotsChecker,
  TimeoutError,
  UnknownDomainError,
  buildUserAgent,
  osintFetch,
} from '../../src/lib/osint/http-client';
import { SourceConfig } from '../../src/lib/osint/types';

const OK_CONFIG: SourceConfig = {
  allowedDomains: ['example.test'],
};

const denyAllRobots: RobotsChecker = {
  async isPathAllowed() {
    return false;
  },
};

const allowAllRobots: RobotsChecker = {
  async isPathAllowed() {
    return true;
  },
};

function jsonResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('buildUserAgent', () => {
  it('embeds the supplied maintainer email', () => {
    const ua = buildUserAgent('alice@example.test');
    expect(ua).toBe('SafeEval-OSINT-Bot/1.0 (research; contact: alice@example.test)');
  });

  it('falls back to placeholder when neither arg nor env var is set', () => {
    const prior = process.env.OSINT_MAINTAINER_EMAIL;
    delete process.env.OSINT_MAINTAINER_EMAIL;
    try {
      const ua = buildUserAgent();
      expect(ua).toContain('maintainer@example.com');
      expect(ua).toMatch(/^SafeEval-OSINT-Bot\/1\.0 \(research; contact: /);
    } finally {
      if (prior !== undefined) process.env.OSINT_MAINTAINER_EMAIL = prior;
    }
  });
});

describe('osintFetch -- allow-list enforcement', () => {
  it('throws UnknownDomainError when the host is not allow-listed', async () => {
    const url = 'https://attacker.test/path';
    await expect(
      osintFetch(url, {
        sourceConfig: OK_CONFIG,
        robotsChecker: allowAllRobots,
        fetchImpl: async () => jsonResponse('{}'),
      }),
    ).rejects.toBeInstanceOf(UnknownDomainError);
  });

  it('refuses a malformed URL with UnknownDomainError', async () => {
    await expect(
      osintFetch('not-a-url', {
        sourceConfig: OK_CONFIG,
        fetchImpl: async () => jsonResponse('{}'),
      }),
    ).rejects.toBeInstanceOf(UnknownDomainError);
  });

  it('accepts requests to allow-listed hosts', async () => {
    const result = await osintFetch('https://example.test/feed', {
      sourceConfig: OK_CONFIG,
      robotsChecker: allowAllRobots,
      fetchImpl: async () => jsonResponse('{"hello":"world"}'),
    });
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"hello":"world"}');
  });
});

describe('osintFetch -- robots.txt strict mode', () => {
  it('throws DisallowedByRobots when the checker returns false', async () => {
    await expect(
      osintFetch('https://example.test/forbidden', {
        sourceConfig: OK_CONFIG,
        robotsChecker: denyAllRobots,
        fetchImpl: async () => jsonResponse('{}'),
      }),
    ).rejects.toBeInstanceOf(DisallowedByRobots);
  });

  it('proceeds when the checker returns true', async () => {
    const result = await osintFetch('https://example.test/allowed', {
      sourceConfig: OK_CONFIG,
      robotsChecker: allowAllRobots,
      fetchImpl: async () => jsonResponse('{"ok":true}'),
    });
    expect(result.status).toBe(200);
  });
});

describe('osintFetch -- timeout', () => {
  it('throws TimeoutError when the fetch is aborted', async () => {
    const slowFetch: typeof fetch = (_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      });
    };

    const start = Date.now();
    await expect(
      osintFetch('https://example.test/slow', {
        sourceConfig: { ...OK_CONFIG, timeoutMs: 50 },
        robotsChecker: allowAllRobots,
        fetchImpl: slowFetch,
      }),
    ).rejects.toBeInstanceOf(TimeoutError);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('honors the default timeout when not overridden', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
  });
});

describe('osintFetch -- response size cap', () => {
  it('throws ResponseTooLarge when the streamed body exceeds the cap', async () => {
    const huge = 'A'.repeat(2048);
    const streamFetch: typeof fetch = async () =>
      new Response(huge, { status: 200 });
    await expect(
      osintFetch('https://example.test/bomb', {
        sourceConfig: { ...OK_CONFIG, maxResponseBytes: 512 },
        robotsChecker: allowAllRobots,
        fetchImpl: streamFetch,
      }),
    ).rejects.toBeInstanceOf(ResponseTooLarge);
  });

  it('honors a per-source override above the default', async () => {
    const body = 'B'.repeat(1024);
    const result = await osintFetch('https://example.test/medium', {
      sourceConfig: { ...OK_CONFIG, maxResponseBytes: 4096 },
      robotsChecker: allowAllRobots,
      fetchImpl: async () => new Response(body, { status: 200 }),
    });
    expect(result.bytes).toBe(1024);
  });

  it('uses the 1MB default when no override is set', () => {
    expect(DEFAULT_MAX_RESPONSE_BYTES).toBe(1_048_576);
  });
});

describe('osintFetch -- cross-origin redirect refusal', () => {
  it('refuses cross-origin redirects with CrossOriginRedirectError', async () => {
    const redirectingFetch: typeof fetch = async () =>
      new Response('', {
        status: 302,
        headers: { location: 'https://attacker.test/exfil' },
      });
    await expect(
      osintFetch('https://example.test/redirect', {
        sourceConfig: OK_CONFIG,
        robotsChecker: allowAllRobots,
        fetchImpl: redirectingFetch,
      }),
    ).rejects.toBeInstanceOf(CrossOriginRedirectError);
  });

  it('follows same-origin redirects up to one hop', async () => {
    let hop = 0;
    const sameOriginRedirect: typeof fetch = async () => {
      hop += 1;
      if (hop === 1) {
        return new Response('', {
          status: 302,
          headers: { location: 'https://example.test/final' },
        });
      }
      return new Response('arrived', { status: 200 });
    };
    const result = await osintFetch('https://example.test/start', {
      sourceConfig: OK_CONFIG,
      robotsChecker: allowAllRobots,
      fetchImpl: sameOriginRedirect,
    });
    expect(result.status).toBe(200);
    expect(result.body).toBe('arrived');
    expect(hop).toBe(2);
  });
});
