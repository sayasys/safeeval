// Hardened outbound HTTP fetcher for the OSINT subsystem.
//
// Spec: docs/memos/sec/2026-05-28-osint-outbound-data-flow-posture.md section 3.1
// "HTTP fetcher hardening -- dedicated wrapper, allow-listed, redirect-bounded,
//  size-bounded."
//
// Every source module routes its outbound traffic through this wrapper. No
// source module makes a direct fetch() or axios call. The wrapper enforces
// six independent controls:
//
//   1. Explicit per-source allow-list of host domains. Requests to any host
//      outside the registered list throw UnknownDomainError.
//   2. Redirect bound to same-origin only. Cross-origin redirects throw
//      DisallowedByRobots-adjacent refusal (logged as a refused-redirect at
//      the call site); same-origin redirects are followed once.
//   3. Wall-clock timeout per request (default 10s, overrideable per source).
//   4. Response-body cap (default 1MB, overrideable per source) enforced by
//      streaming the body and aborting when the cap is exceeded.
//   5. Descriptive User-Agent string identifying SafeEval + the maintainer
//      contact email, parameterized via OSINT_MAINTAINER_EMAIL env var.
//   6. robots.txt-aware. Strict mode per Steven's adjudication of open
//      question 7.4 -- if robots.txt disallows the path, the wrapper refuses
//      to fetch and throws DisallowedByRobots.
//
// The typed-error surface is the contract source modules and tests assert
// against. Each error class is independently catchable so callers can
// distinguish robots refusal from timeout from oversized response.
//
// Real robots.txt fetching and parsing is deferred to Phase 2 along with the
// real source-fetcher wiring. Phase 1 implements the wrapper shape, the
// allow-list enforcement, the timeout, the size cap, the UA injection, and
// the robots-check seam (with a default permissive parser so tests can drive
// the strict-mode behavior via a robots.txt fixture). The Phase 2 work swaps
// in a real robots-parser library and live HTTP traffic.

import { SourceConfig } from './types';

// --- Typed error classes ---------------------------------------------------

export class DisallowedByRobots extends Error {
  override readonly name = 'DisallowedByRobots';
  readonly url: string;
  constructor(url: string) {
    super(`robots.txt disallows fetching ${url}`);
    this.url = url;
  }
}

export class TimeoutError extends Error {
  override readonly name = 'TimeoutError';
  readonly url: string;
  readonly timeoutMs: number;
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} exceeded ${timeoutMs}ms timeout`);
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

export class ResponseTooLarge extends Error {
  override readonly name = 'ResponseTooLarge';
  readonly url: string;
  readonly maxBytes: number;
  constructor(url: string, maxBytes: number) {
    super(`Response from ${url} exceeded ${maxBytes}-byte cap`);
    this.url = url;
    this.maxBytes = maxBytes;
  }
}

export class UnknownDomainError extends Error {
  override readonly name = 'UnknownDomainError';
  readonly url: string;
  readonly host: string;
  constructor(url: string, host: string) {
    super(`Host ${host} is not in the allow-list for the requesting source`);
    this.url = url;
    this.host = host;
  }
}

export class CrossOriginRedirectError extends Error {
  override readonly name = 'CrossOriginRedirectError';
  readonly fromUrl: string;
  readonly toUrl: string;
  constructor(fromUrl: string, toUrl: string) {
    super(`Cross-origin redirect from ${fromUrl} to ${toUrl} refused`);
    this.fromUrl = fromUrl;
    this.toUrl = toUrl;
  }
}

// --- Defaults --------------------------------------------------------------

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576; // 1 MB

// User-Agent string per sec memo section 3.1. The maintainer email is
// parameterized via OSINT_MAINTAINER_EMAIL; the placeholder default keeps
// tests deterministic and lets the production deployment override.
export function buildUserAgent(maintainerEmail?: string): string {
  const email = maintainerEmail ?? process.env.OSINT_MAINTAINER_EMAIL ?? 'maintainer@example.com';
  return `SafeEval-OSINT-Bot/1.0 (research; contact: ${email})`;
}

// --- Robots.txt seam -------------------------------------------------------

// Phase 1 ships a minimal robots-checker seam so tests can drive strict-mode
// behavior via a fixture. The real parser (e.g. the robots-parser npm package
// referenced in the scoping memo section 4.2) lands in Phase 2 along with
// the live source fetchers. Phase 1's seam answers two test-driven shapes:
//
//   - "robots.txt disallows /foo for our UA" -> isPathAllowed returns false
//   - "robots.txt is missing or permissive" -> isPathAllowed returns true
//
// The seam is intentionally injectable so tests do not need to mock network
// calls; production callers can replace the default permissive checker with
// a real-network-bound implementation at Phase 2.
export interface RobotsChecker {
  isPathAllowed(url: string, userAgent: string): Promise<boolean>;
}

export const permissiveRobotsChecker: RobotsChecker = {
  async isPathAllowed(): Promise<boolean> {
    return true;
  },
};

// --- Fetch surface ---------------------------------------------------------

export interface OsintFetchOptions {
  // The source's registered config; used to look up allow-list, size cap,
  // timeout overrides.
  sourceConfig: SourceConfig;

  // Optional User-Agent override. Falls back to buildUserAgent() which reads
  // OSINT_MAINTAINER_EMAIL from the environment.
  userAgent?: string;

  // Injectable robots.txt checker. Defaults to the permissive checker so
  // Phase 1 source stubs do not hit the network during unit tests; the
  // strict-mode tests pass a checker that returns false for disallowed paths.
  robotsChecker?: RobotsChecker;

  // Underlying fetch implementation. Defaults to the platform fetch. Tests
  // inject a mock to drive timeout / size-cap / redirect behavior without
  // a real network call.
  fetchImpl?: typeof fetch;
}

export interface OsintFetchResult {
  status: number;
  bytes: number;
  body: string;
  finalUrl: string; // after any same-origin redirects
}

// Fetch a URL through the hardened wrapper. Throws one of the typed errors
// above on policy violation; otherwise returns the response body (truncated
// to the size cap) and the HTTP status.
export async function osintFetch(
  url: string,
  options: OsintFetchOptions,
): Promise<OsintFetchResult> {
  const config = options.sourceConfig;
  const userAgent = options.userAgent ?? buildUserAgent();
  const robotsChecker = options.robotsChecker ?? permissiveRobotsChecker;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = config.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;

  // Control 1: allow-list enforcement. Parse the URL, look up the host, and
  // refuse if it is not in the source's allow-list.
  const parsed = parseUrlOrThrow(url);
  if (!config.allowedDomains.includes(parsed.host)) {
    throw new UnknownDomainError(url, parsed.host);
  }

  // Control 6: robots.txt-aware strict mode. The default permissive checker
  // returns true; a strict-mode test fixture returns false for disallowed
  // paths and the wrapper throws.
  const allowed = await robotsChecker.isPathAllowed(url, userAgent);
  if (!allowed) {
    throw new DisallowedByRobots(url);
  }

  // Controls 2-5: redirect-bounded fetch with timeout and size cap. The
  // fetch implementation receives redirect: 'manual' so we can inspect the
  // Location header; we follow once for same-origin, refuse for cross-origin.
  return performBoundedFetch({
    url,
    host: parsed.host,
    userAgent,
    timeoutMs,
    maxBytes,
    fetchImpl,
    redirectsRemaining: 1,
  });
}

interface BoundedFetchArgs {
  url: string;
  host: string;
  userAgent: string;
  timeoutMs: number;
  maxBytes: number;
  fetchImpl: typeof fetch;
  redirectsRemaining: number;
}

async function performBoundedFetch(args: BoundedFetchArgs): Promise<OsintFetchResult> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), args.timeoutMs);

  let response: Response;
  try {
    response = await args.fetchImpl(args.url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': args.userAgent,
        'Accept': '*/*',
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TimeoutError(args.url, args.timeoutMs);
    }
    throw err;
  }
  clearTimeout(timeoutHandle);

  // Redirect handling. fetch with redirect: 'manual' surfaces 3xx as
  // response.status with response.headers.get('location') set.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) {
      // 3xx without Location is malformed; surface the status and an empty
      // body so the caller can decide what to do.
      return { status: response.status, bytes: 0, body: '', finalUrl: args.url };
    }
    const target = resolveLocation(args.url, location);
    const targetParsed = parseUrlOrThrow(target);
    if (targetParsed.host !== args.host) {
      throw new CrossOriginRedirectError(args.url, target);
    }
    if (args.redirectsRemaining <= 0) {
      // Same-origin redirect but we've used our hop budget. Return the 3xx
      // so the caller can decide.
      return { status: response.status, bytes: 0, body: '', finalUrl: args.url };
    }
    return performBoundedFetch({
      ...args,
      url: target,
      redirectsRemaining: args.redirectsRemaining - 1,
    });
  }

  // Size-bounded body read. The body is streamed to bound memory; when the
  // accumulator exceeds maxBytes we abort with ResponseTooLarge.
  const body = await readBoundedBody(response, args.url, args.maxBytes);
  return {
    status: response.status,
    bytes: body.length,
    body,
    finalUrl: args.url,
  };
}

async function readBoundedBody(
  response: Response,
  url: string,
  maxBytes: number,
): Promise<string> {
  // Some fetch implementations (Node 18+, undici) return a ReadableStream;
  // older shims return a fully-buffered body. Handle both. The bounded read
  // is the only correctness-critical path; the buffered fallback re-checks
  // the size after the fact.
  if (!response.body) {
    const text = await response.text();
    if (text.length > maxBytes) {
      throw new ResponseTooLarge(url, maxBytes);
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore cancel errors
      }
      throw new ResponseTooLarge(url, maxBytes);
    }
    chunks.push(value);
  }
  return new TextDecoder('utf-8').decode(concatChunks(chunks, total));
}

function concatChunks(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

interface ParsedUrl {
  host: string;
  url: URL;
}

function parseUrlOrThrow(url: string): ParsedUrl {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnknownDomainError(url, '');
  }
  return { host: parsed.host, url: parsed };
}

function resolveLocation(baseUrl: string, location: string): string {
  try {
    return new URL(location, baseUrl).toString();
  } catch {
    return location;
  }
}
