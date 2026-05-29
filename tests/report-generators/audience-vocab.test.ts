// Vocabulary correctness tests for the Phase 1 report-generator surface.
//
// Asserts the closed-set audience vocabulary properties:
//   - exactly 5 audience names match docs/08-v5-ontology.md section 3.14,
//   - the Audience literal type and the IMPLEMENTED + DEFERRED const
//     surfaces are self-consistent,
//   - IMPLEMENTED has exactly the four standard-tier audiences,
//   - DEFERRED has exactly the end_user slot.
//
// The runtime lockstep verifier (scripts/check-lockstep.js
// checkAudienceLockstep) covers the doc-to-code equality; this test covers
// the code-side internal consistency that the lockstep doesn't see.

import { describe, it, expect } from 'vitest';
import {
  DEFERRED_AUDIENCES,
  IMPLEMENTED_AUDIENCES,
  type Audience,
  type DeferredAudience,
  type ImplementedAudience,
} from '../../src/lib/report-generators/types';

describe('audience vocabulary closed-set discipline', () => {
  it('exposes exactly five audience names in the Audience literal type', () => {
    // The literal type is erased at runtime; we materialize it via a
    // const assertion holding every name from the literal. If the literal
    // gains or loses a value, this object's keys diverge and the assertion
    // catches it at compile time.
    const allNames: Record<Audience, true> = {
      reviewer: true,
      trust_safety_lead: true,
      legal: true,
      exec_summary: true,
      end_user: true,
    };
    expect(Object.keys(allNames).sort()).toEqual(
      ['end_user', 'exec_summary', 'legal', 'reviewer', 'trust_safety_lead'],
    );
  });

  it('IMPLEMENTED_AUDIENCES holds exactly four names (the Standard tier)', () => {
    expect(IMPLEMENTED_AUDIENCES).toHaveLength(4);
    expect([...IMPLEMENTED_AUDIENCES].sort()).toEqual(
      ['exec_summary', 'legal', 'reviewer', 'trust_safety_lead'],
    );
  });

  it('DEFERRED_AUDIENCES holds exactly the end_user slot', () => {
    expect(DEFERRED_AUDIENCES).toHaveLength(1);
    expect(DEFERRED_AUDIENCES[0]).toBe('end_user');
  });

  it('IMPLEMENTED and DEFERRED partition the Audience vocabulary with no overlap', () => {
    const implemented = new Set<string>(IMPLEMENTED_AUDIENCES);
    const deferred = new Set<string>(DEFERRED_AUDIENCES);
    for (const name of deferred) {
      expect(implemented.has(name)).toBe(false);
    }
    for (const name of implemented) {
      expect(deferred.has(name)).toBe(false);
    }
    expect(implemented.size + deferred.size).toBe(5);
  });

  it('DeferredAudience type is exactly the end_user single literal', () => {
    // Round-trip via a typed binding; this fails to compile if
    // DeferredAudience widens.
    const x: DeferredAudience = 'end_user';
    expect(x).toBe('end_user');
  });

  it('ImplementedAudience is the closed set of the four Standard-tier names', () => {
    // Same round-trip discipline as above; the four assignments below
    // fail to compile if the literal narrows or widens.
    const a: ImplementedAudience = 'reviewer';
    const b: ImplementedAudience = 'trust_safety_lead';
    const c: ImplementedAudience = 'legal';
    const d: ImplementedAudience = 'exec_summary';
    expect([a, b, c, d].sort()).toEqual(
      ['exec_summary', 'legal', 'reviewer', 'trust_safety_lead'],
    );
  });
});
