// Post-generation defensive-prompting validator.
//
// Spec: docs/memos/2026-05-28-report-generator-implementation-spec.md
//       section 9.3.
//
// Runs against the markdown returned by the Anthropic API before the
// dispatcher writes the report record. Three layers:
//   (a) Instruction-leakage patterns (shared with the Phase 1 prompts via
//       INSTRUCTION_LEAKAGE_PATTERNS) -- catches OK / PWNED format-override
//       success markers, role-swap confirmations, system-prompt exfiltration,
//       and the delimiter-escape diagnostic where the model echoed the
//       closing envelope marker into its output.
//   (b) Audience MUST-NOT-include checks -- per-audience banned token list
//       drawn from docs/08-v5-ontology.md section 3.14. The exec_summary
//       audience cannot leak component scores; trust_safety_lead cannot leak
//       engine vocabulary; legal cannot use marketing language.
//   (c) Length envelope -- each audience has a word-count band; the hard
//       envelope widens the soft band by 50% on each side per spec
//       section 9.3.
//
// Soft failure mode: a valid=false result does NOT throw. The dispatcher
// logs a warning and still returns the report; the human reading the
// report decides what to do. The validator is a signal, not a gate.

import { INSTRUCTION_LEAKAGE_PATTERNS } from './prompts/defensive-framing';
import type { ImplementedAudience } from './types';

export type ViolationType =
  | 'instruction_leakage'
  | 'audience_must_not'
  | 'length_under'
  | 'length_over';

export interface Violation {
  type: ViolationType;
  rule: string;
  // First 80 chars of the offending substring. Truncated so a full
  // injection-success payload does not get echoed into the validator's
  // log line.
  snippet: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

// Soft length envelopes (target band) per docs/08-v5-ontology.md section
// 3.14. The validator widens by 50% on each side to compute the hard band:
//   reviewer        target 400-600 -> hard 200-900
//   trust_safety    target 250-350 -> hard 125-525
//   legal           target 350-500 -> hard 175-750
//   exec_summary    target  80-100 -> hard  40-150
const LENGTH_TARGETS: Record<ImplementedAudience, readonly [number, number]> = {
  reviewer: [400, 600],
  trust_safety_lead: [250, 350],
  legal: [350, 500],
  exec_summary: [80, 100],
};

function hardLengthBand(audience: ImplementedAudience): readonly [number, number] {
  const [min, max] = LENGTH_TARGETS[audience];
  return [Math.floor(min * 0.5), Math.ceil(max * 1.5)];
}

// Audience-specific MUST-NOT vocabulary. Each entry is a case-insensitive
// substring or regex source string the validator searches the report
// markdown for. A match adds an audience_must_not violation.
//
// Provenance per docs/08-v5-ontology.md section 3.14 MUST NOT see column:
//   exec_summary MUST NOT include reviewer-specific detail (component
//     scores, reason codes), implementation detail (prompt hashes, cache
//     keys), or legal framework vocabulary (IC3 / FTC category names).
//   trust_safety_lead MUST NOT include raw component scores, system-prompt
//     internals, or engine vocabulary (L2 codes, "Stage 2 discriminator",
//     "cache_key" -- translate to plain language).
//   legal MUST NOT use marketing language; the validator catches
//     "our system" / "we caught" / "we detected" as the canonical
//     marketing-tone tells per spec section 3.3.
//   reviewer MUST NOT speculate about redacted placeholders -- a
//     placeholder-resolution check is already in
//     INSTRUCTION_LEAKAGE_PATTERNS, so reviewer's MUST-NOT list focuses on
//     register: no marketing language and no recommendations beyond the
//     adjudication checklist.
//
// Each entry: { rule: human-readable id, source: regex source string }.
interface MustNotRule {
  rule: string;
  source: string;
}

const AUDIENCE_MUST_NOT: Record<ImplementedAudience, readonly MustNotRule[]> = {
  reviewer: [
    { rule: 'reviewer: no marketing tone ("our system")', source: 'our system' },
    { rule: 'reviewer: no marketing tone ("we caught")', source: 'we caught' },
  ],
  trust_safety_lead: [
    { rule: 'trust_safety_lead: no L2/L3 engine codes', source: '\\bL[23] [a-z_]+' },
    { rule: 'trust_safety_lead: no Stage N discriminator vocabulary', source: 'Stage [0-9]+ discriminator' },
    { rule: 'trust_safety_lead: no cache_key surface', source: 'cache_key' },
    { rule: 'trust_safety_lead: no prompt_hash surface', source: 'prompt_hash' },
    { rule: 'trust_safety_lead: no raw component score tokens', source: '\\b(target|lure|trust|extract|evade)_score\\b' },
  ],
  legal: [
    { rule: 'legal: no marketing tone ("our system detected")', source: 'our system detected' },
    { rule: 'legal: no marketing tone ("we caught")', source: 'we caught' },
    { rule: 'legal: no marketing tone ("we detected")', source: 'we detected' },
  ],
  exec_summary: [
    { rule: 'exec_summary: no <envelope> delimiter leakage', source: '<envelope>' },
    { rule: 'exec_summary: no envelope-JSON leakage', source: '"disposition"\\s*:' },
    { rule: 'exec_summary: no audit-metadata surface', source: 'prompt_hash' },
    { rule: 'exec_summary: no audit-metadata surface', source: 'cache_key' },
    { rule: 'exec_summary: no L1/L2/L3 engine codes', source: '\\bL[123] [a-z_]+' },
    { rule: 'exec_summary: no raw component score tokens', source: '\\b(target|lure|trust|extract|evade)_score\\b' },
    { rule: 'exec_summary: no IC3 framework vocabulary', source: '\\bIC3\\b' },
    { rule: 'exec_summary: no FTC framework vocabulary', source: '\\bFTC Consumer Sentinel\\b' },
    { rule: 'exec_summary: no FinCEN framework vocabulary', source: '\\bFinCEN\\b' },
  ],
};

function snippet(haystack: string, matched: string): string {
  const idx = haystack.indexOf(matched);
  if (idx < 0) return matched.slice(0, 80);
  const start = Math.max(0, idx - 10);
  const end = Math.min(haystack.length, idx + matched.length + 10);
  return haystack.slice(start, end).replace(/\s+/g, ' ').slice(0, 80);
}

function countWords(markdown: string): number {
  return markdown.split(/\s+/).filter((token) => token.length > 0).length;
}

export function validateReport(
  markdown: string,
  audience: ImplementedAudience,
): ValidationResult {
  const violations: Violation[] = [];

  // (a) Instruction-leakage patterns.
  for (const source of INSTRUCTION_LEAKAGE_PATTERNS) {
    let re: RegExp;
    try {
      re = new RegExp(source, 'im');
    } catch {
      // A malformed pattern source is a defensive-framing bug, not a
      // validator failure; skip rather than throw.
      continue;
    }
    const match = re.exec(markdown);
    if (match) {
      violations.push({
        type: 'instruction_leakage',
        rule: `instruction_leakage: /${source}/i`,
        snippet: snippet(markdown, match[0]),
      });
    }
  }

  // (b) Audience MUST-NOT-include rules.
  for (const rule of AUDIENCE_MUST_NOT[audience]) {
    let re: RegExp;
    try {
      re = new RegExp(rule.source, 'i');
    } catch {
      continue;
    }
    const match = re.exec(markdown);
    if (match) {
      violations.push({
        type: 'audience_must_not',
        rule: rule.rule,
        snippet: snippet(markdown, match[0]),
      });
    }
  }

  // (c) Length envelope (hard band; soft band is the report-quality
  // target authored into the prompt, not a validator-enforced rule).
  const [hardMin, hardMax] = hardLengthBand(audience);
  const wordCount = countWords(markdown);
  if (wordCount < hardMin) {
    violations.push({
      type: 'length_under',
      rule: `length_envelope_${audience}: ${wordCount} words (hard min ${hardMin})`,
      snippet: `wordCount=${wordCount}`,
    });
  } else if (wordCount > hardMax) {
    violations.push({
      type: 'length_over',
      rule: `length_envelope_${audience}: ${wordCount} words (hard max ${hardMax})`,
      snippet: `wordCount=${wordCount}`,
    });
  }

  return { valid: violations.length === 0, violations };
}
