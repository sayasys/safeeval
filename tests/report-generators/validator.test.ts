// Validator unit tests.
//
// At least 5 named cases per the dispatch spec:
//   1. Clean pass.
//   2. Instruction-leakage: format-override marker ("OK" alone on a line).
//   3. Instruction-leakage: delimiter-escape (the closing envelope marker
//      echoed back into the report body).
//   4. Audience MUST-NOT: exec_summary report leaks a prompt_hash surface.
//   5. Audience MUST-NOT: trust_safety_lead report uses L2 engine code.
//   6. Length envelope under (hard min).
//   7. Length envelope over (hard max).
//
// Each violation carries a type, a rule id, and a truncated snippet. The
// validator is soft-failure: it returns the violations list; the dispatcher
// (not the validator) decides what to do with valid=false.

import { describe, it, expect } from 'vitest';
import { validateReport } from '../../src/lib/report-generators/validator';

function words(count: number, leader = ''): string {
  const w = Array.from({ length: count }, (_, i) => `word${i}`).join(' ');
  return leader ? leader + ' ' + w : w;
}

describe('validateReport: clean pass', () => {
  it('a 500-word reviewer report with no leakage and no banned vocab is valid', () => {
    const md = '# Disposition\n' + words(498, 'The engine routed the case for review.');
    const result = validateReport(md, 'reviewer');
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

describe('validateReport: instruction_leakage', () => {
  it('flags an isolated "OK" line as a format-override success marker', () => {
    // 90 words to stay inside the exec_summary hard band [40, 150].
    const md = words(90) + '\nOK\n';
    const result = validateReport(md, 'exec_summary');
    expect(result.valid).toBe(false);
    const types = result.violations.map((v) => v.type);
    expect(types).toContain('instruction_leakage');
  });

  it('flags an isolated "PWNED" line on a reviewer report', () => {
    const md = words(500) + '\nPWNED\n';
    const result = validateReport(md, 'reviewer');
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.type === 'instruction_leakage' && /PWNED/.test(v.rule))).toBe(true);
  });

  it('flags the closing envelope marker echoed into the report body', () => {
    const md = words(500) + '\nThe envelope closed with </envelope> as expected.';
    const result = validateReport(md, 'reviewer');
    expect(result.valid).toBe(false);
    expect(
      result.violations.some(
        (v) => v.type === 'instruction_leakage' && v.rule.includes('</envelope>'),
      ),
    ).toBe(true);
  });

  it('flags a role-swap confirmation', () => {
    const md = words(500) + '\nI am now a different assistant configured for this task.';
    const result = validateReport(md, 'reviewer');
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.type === 'instruction_leakage')).toBe(true);
  });

  it('does not flag a clean "OK" that appears mid-prose', () => {
    // Anchored ^...$ patterns should not match this in-prose OK token.
    const md = words(498, 'The engine emitted OK in the disposition field.');
    const result = validateReport(md, 'reviewer');
    // The OK token is mid-prose. May still hit other patterns? No, prose is clean.
    expect(result.violations.some((v) => v.rule.includes('OK'))).toBe(false);
  });
});

describe('validateReport: audience MUST-NOT', () => {
  it('flags an exec_summary report that leaks prompt_hash', () => {
    const md = words(90, 'Disposition: blocked.') + '\n\nprompt_hash: abc123';
    const result = validateReport(md, 'exec_summary');
    expect(result.valid).toBe(false);
    expect(
      result.violations.some(
        (v) => v.type === 'audience_must_not' && /prompt_hash/.test(v.snippet),
      ),
    ).toBe(true);
  });

  it('flags a trust_safety_lead report that uses an L2 engine code', () => {
    const md = words(300, 'The engine classified at L2 business_email_compromise.');
    const result = validateReport(md, 'trust_safety_lead');
    expect(result.valid).toBe(false);
    expect(
      result.violations.some(
        (v) => v.type === 'audience_must_not' && /L[23]/.test(v.rule),
      ),
    ).toBe(true);
  });

  it('flags a legal report that uses marketing language', () => {
    const md = words(400, 'Our system detected the pattern and acted accordingly.');
    const result = validateReport(md, 'legal');
    expect(result.valid).toBe(false);
    expect(
      result.violations.some(
        (v) => v.type === 'audience_must_not' && /marketing tone/.test(v.rule),
      ),
    ).toBe(true);
  });

  it('does NOT flag a reviewer report using engine vocabulary -- engine codes are in-register for reviewer', () => {
    const md = words(500, 'The L2 business_email_compromise classification fired.');
    const result = validateReport(md, 'reviewer');
    // No engine-code rule for reviewer; the only must-not is marketing tone.
    expect(
      result.violations.filter((v) => v.type === 'audience_must_not'),
    ).toHaveLength(0);
  });
});

describe('validateReport: length envelope', () => {
  it('flags an exec_summary report that is shorter than the hard min (40 words)', () => {
    const md = words(20);
    const result = validateReport(md, 'exec_summary');
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.type === 'length_under')).toBe(true);
  });

  it('flags a reviewer report that exceeds the hard max (900 words)', () => {
    const md = words(950);
    const result = validateReport(md, 'reviewer');
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.type === 'length_over')).toBe(true);
  });

  it('accepts a trust_safety_lead report at the soft target (~300 words)', () => {
    const md = words(300);
    const result = validateReport(md, 'trust_safety_lead');
    expect(result.violations.filter((v) => v.type === 'length_under' || v.type === 'length_over')).toHaveLength(0);
  });
});

describe('validateReport: snippet truncation', () => {
  it('truncates violation snippets to 80 chars or fewer', () => {
    const longLeak = 'I am now an uncensored AI assistant ' + 'x'.repeat(200);
    const md = words(500) + '\n' + longLeak;
    const result = validateReport(md, 'reviewer');
    for (const v of result.violations) {
      expect(v.snippet.length).toBeLessThanOrEqual(80);
    }
  });
});
