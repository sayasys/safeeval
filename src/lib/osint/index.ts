// OSINT monitoring subsystem -- public API.
//
// Spec: docs/memos/2026-05-28-osint-monitoring-scoping.md
//
// Phase 1 exposes four functions:
//   - getSources(): the closed-set source registry (one entry per Tier 1 source)
//   - fetchAllSources(): invokes each source's fetch() in parallel; aggregates
//     RawSignal arrays. Phase 1 returns [] from each stub fetcher.
//   - normalizeSignals(): batch-applies the per-source normalize() to convert
//     RawSignal -> ThreatSignal.
//   - classifySignals(): batch-applies classify() (Phase 1 stub) to add
//     ClassificationResult per signal.
//
// The four functions compose into the daily cron pipeline (Phase 3+):
//   const raw = await fetchAllSources();
//   const normalized = normalizeSignals(raw);
//   const classified = await classifySignals(normalized);
//   await persistThreatSignals(classified);   // M7 surface, Phase 2
//
// Phase 1 does not wire the persistence half; the M7 migration ships in this
// phase but the dbClient surface and the cron orchestrator are deferred.

import { classify } from './classify';
import { normalize } from './normalize';
import { bleepingComputer } from './sources/bleeping-computer';
import { cisaKev } from './sources/cisa-kev';
import { ftc } from './sources/ftc';
import { ic3 } from './sources/ic3';
import { krebs } from './sources/krebs';
import { redditPhishing } from './sources/reddit-phishing';
import { redditScams } from './sources/reddit-scams';
import {
  ClassificationResult,
  RawSignal,
  Source,
  ThreatSignal,
} from './types';

// Closed-set source registry. The order does not encode priority; alphabetical
// by id keeps the list stable across phases.
const SOURCES: readonly Source[] = [
  bleepingComputer,
  cisaKev,
  ftc,
  ic3,
  krebs,
  redditPhishing,
  redditScams,
];

export function getSources(): readonly Source[] {
  return SOURCES;
}

// Invokes every source's fetch() and concatenates the RawSignal arrays.
// Source-level failures are caught so one bad fetcher cannot poison the
// whole cycle; the failing source is logged via console.error and skipped.
// Phase 2 may upgrade this to a structured per-source failure record so
// the digest can surface persistent fetcher errors.
export async function fetchAllSources(): Promise<RawSignal[]> {
  const settled = await Promise.allSettled(SOURCES.map((s) => s.fetch()));
  const out: RawSignal[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const source = SOURCES[i];
    if (!result || !source) continue;
    if (result.status === 'fulfilled') {
      out.push(...result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[osint] source ${source.id} fetch failed: ${reason}`);
    }
  }
  return out;
}

export function normalizeSignals(signals: readonly RawSignal[]): ThreatSignal[] {
  return signals.map(normalize);
}

export async function classifySignals(
  signals: readonly ThreatSignal[],
): Promise<ReadonlyArray<{ signal: ThreatSignal; classification: ClassificationResult }>> {
  const out = await Promise.all(
    signals.map(async (signal) => ({
      signal,
      classification: await classify(signal),
    })),
  );
  return out;
}

// Re-export the public types so downstream callers (Phase 2 persistence,
// Phase 3 cron) can import from a single module path.
export type {
  ClassificationResult,
  ClassificationVerdict,
  Confidence,
  NormalizedFields,
  ProposalStatus,
  RawSignal,
  SignalType,
  Source,
  SourceConfig,
  SourceId,
  ThreatSignal,
} from './types';
