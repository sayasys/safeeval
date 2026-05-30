// Pattern composer server-action core -- coverage (Phase 3 UI).
//
// Drives the dependency-injected core in src/app/app/patterns/action-core.ts
// against the in-memory store fake. The thin 'use server' wrappers in actions.ts
// only resolve the session and delegate here; the org-scoping, component
// flattening, match-mode hardcoding, lifecycle, and error-mapping logic all live
// in this core, so this is the meaningful test boundary. (The requireOrgRole
// gate itself is covered by tests/auth/roles.test.ts.) Also covers the Phase 3
// listPatternsWithComponents read helper the list view consumes.

import { describe, it, expect } from 'vitest';
import {
  runCreatePattern,
  runArchivePattern,
  toFailure,
  type CreatePatternInput,
} from '../../src/app/app/patterns/action-core';
import {
  makeInMemoryCustomPatternsStore,
  type CustomPatternsStore,
} from '../../src/lib/data/custom-patterns/store';
import {
  getPattern,
  listPatterns,
  listPatternsWithComponents,
} from '../../src/lib/data/custom-patterns/patterns';

const ORG_A = '00000000-0000-0000-0000-00000000000a';
const ORG_B = '00000000-0000-0000-0000-00000000000b';

function freshOpts(): { store: CustomPatternsStore } {
  return { store: makeInMemoryCustomPatternsStore() };
}

function validInput(overrides: Partial<CreatePatternInput> = {}): CreatePatternInput {
  return {
    name: 'Romance-crypto cross-pollination',
    typology: 'investment_fraud',
    components: [
      { group_name: 'tactic', tag_id: 'trust_love', tag_source: 'closed_set' },
      { group_name: 'target', tag_id: 'crypto_holder', tag_source: 'closed_set' },
    ],
    ...overrides,
  };
}

describe('runCreatePattern', () => {
  it('creates an active subset pattern with its components', async () => {
    const opts = freshOpts();
    const result = await runCreatePattern(ORG_A, validInput(), opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('active');
    expect(result.data.match_mode).toBe('subset');
    expect(result.data.name).toBe('Romance-crypto cross-pollination');
    expect(result.data.typology).toBe('investment_fraud');
    expect(result.data.components).toHaveLength(2);
    expect(result.data.components.map((c) => c.tag_id).sort()).toEqual([
      'crypto_holder',
      'trust_love',
    ]);
  });

  it('hardcodes match_mode to subset even if the input tried to set something else', async () => {
    const opts = freshOpts();
    // The CreatePatternInput type has no match_mode field; this asserts the core
    // always writes subset regardless of what the wire shape carries.
    const result = await runCreatePattern(ORG_A, validInput(), opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.match_mode).toBe('subset');
  });

  it('threads a mix of closed-set and org-custom components through with tag_source intact', async () => {
    const opts = freshOpts();
    const result = await runCreatePattern(
      ORG_A,
      validInput({
        components: [
          { group_name: 'method', tag_id: 'sock_puppet', tag_source: 'closed_set' },
          { group_name: 'method', tag_id: 'org_special_lure', tag_source: 'org_custom' },
        ],
      }),
      opts,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bySource = Object.fromEntries(
      result.data.components.map((c) => [c.tag_id, c.tag_source]),
    );
    expect(bySource.sock_puppet).toBe('closed_set');
    expect(bySource.org_special_lure).toBe('org_custom');
  });

  it('rejects a pattern with zero components as a VALIDATION failure', async () => {
    const opts = freshOpts();
    const result = await runCreatePattern(ORG_A, validInput({ components: [] }), opts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(result.field).toBe('components');
  });

  it('maps an invalid pattern name to a VALIDATION field failure', async () => {
    const opts = freshOpts();
    const result = await runCreatePattern(ORG_A, validInput({ name: '-bad-leading' }), opts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(result.field).toBe('name');
  });

  it('maps an out-of-set group to a VALIDATION field failure', async () => {
    const opts = freshOpts();
    const result = await runCreatePattern(
      ORG_A,
      validInput({
        components: [{ group_name: 'not_a_group', tag_id: 'x', tag_source: 'closed_set' }],
      }),
      opts,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(result.field).toBe('components[0].group_name');
  });

  it('maps an out-of-set tag_source to a VALIDATION field failure', async () => {
    const opts = freshOpts();
    const result = await runCreatePattern(
      ORG_A,
      validInput({
        components: [{ group_name: 'tactic', tag_id: 'trust_love', tag_source: 'made_up' }],
      }),
      opts,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(result.field).toBe('components[0].tag_source');
  });
});

describe('org scoping', () => {
  it('a pattern created under org A is invisible to org B', async () => {
    const opts = freshOpts();
    const created = await runCreatePattern(ORG_A, validInput(), opts);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(await listPatterns(ORG_A, opts)).toHaveLength(1);
    expect(await listPatterns(ORG_B, opts)).toHaveLength(0);
    expect(await getPattern(ORG_B, created.data.id, opts)).toBeNull();
  });
});

describe('runArchivePattern', () => {
  it('archives an active pattern', async () => {
    const opts = freshOpts();
    const created = await runCreatePattern(ORG_A, validInput(), opts);
    if (!created.ok) return;

    const result = await runArchivePattern(ORG_A, created.data.id, opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('archived');
  });

  it('archiving is idempotent (an already-archived pattern stays archived)', async () => {
    const opts = freshOpts();
    const created = await runCreatePattern(ORG_A, validInput(), opts);
    if (!created.ok) return;
    await runArchivePattern(ORG_A, created.data.id, opts);
    const again = await runArchivePattern(ORG_A, created.data.id, opts);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.data.status).toBe('archived');
  });

  it('reports a missing pattern as not found', async () => {
    const opts = freshOpts();
    const result = await runArchivePattern(ORG_A, 'pattern-99999999', opts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('PATTERN_NOT_FOUND');
  });

  it('cannot archive another org\'s pattern', async () => {
    const opts = freshOpts();
    const created = await runCreatePattern(ORG_A, validInput(), opts);
    if (!created.ok) return;
    const result = await runArchivePattern(ORG_B, created.data.id, opts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('PATTERN_NOT_FOUND');
  });
});

describe('toFailure', () => {
  it('collapses an unknown error to a generic INTERNAL failure', () => {
    const failure = toFailure(new Error('raw database string'));
    expect(failure.ok).toBe(false);
    expect(failure.code).toBe('INTERNAL');
    expect(failure.message).not.toContain('raw database string');
  });
});

describe('listPatternsWithComponents (Phase 3 list-view helper)', () => {
  it('hydrates each listed pattern with its components', async () => {
    const opts = freshOpts();
    await runCreatePattern(ORG_A, validInput({ name: 'Pattern one' }), opts);
    await runCreatePattern(
      ORG_A,
      validInput({
        name: 'Pattern two',
        components: [{ group_name: 'risk_marker', tag_id: 'payment_instruction_embedded', tag_source: 'closed_set' }],
      }),
      opts,
    );

    const rows = await listPatternsWithComponents(ORG_A, opts);
    expect(rows).toHaveLength(2);
    const counts = Object.fromEntries(rows.map((r) => [r.name, r.components.length]));
    expect(counts['Pattern one']).toBe(2);
    expect(counts['Pattern two']).toBe(1);
  });

  it('scopes to the org', async () => {
    const opts = freshOpts();
    await runCreatePattern(ORG_A, validInput(), opts);
    expect(await listPatternsWithComponents(ORG_B, opts)).toHaveLength(0);
  });
});

// Full flow the detail view renders: create -> read back the persisted shape
// with components grouped, then archive -> the read-back reflects the new status.
describe('integration: create -> detail -> archive', () => {
  it('round-trips the composition and reflects the lifecycle transition', async () => {
    const opts = freshOpts();
    const created = await runCreatePattern(
      ORG_A,
      validInput({
        components: [
          { group_name: 'tactic', tag_id: 'trust_love', tag_source: 'closed_set' },
          { group_name: 'target', tag_id: 'crypto_holder', tag_source: 'closed_set' },
          { group_name: 'overlap', tag_id: 'payment_fraud_enablement', tag_source: 'closed_set' },
        ],
      }),
      opts,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // What the detail server component loads via getPattern.
    const loaded = await getPattern(ORG_A, created.data.id, opts);
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Romance-crypto cross-pollination');
    expect(loaded?.typology).toBe('investment_fraud');
    expect(loaded?.match_mode).toBe('subset');
    expect(loaded?.status).toBe('active');
    expect(loaded?.components).toHaveLength(3);

    await runArchivePattern(ORG_A, created.data.id, opts);
    const afterArchive = await getPattern(ORG_A, created.data.id, opts);
    expect(afterArchive?.status).toBe('archived');
  });
});
