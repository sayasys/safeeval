// Custom L3 classifier server-action core -- coverage (Phase 2 UI).
//
// Drives the dependency-injected core in src/app/app/classifiers/action-core.ts
// against the in-memory store fake. The thin 'use server' wrappers in actions.ts
// only resolve the session and delegate here; the org-scoping, lifecycle, role,
// and error-mapping logic all live in this core, so this is the meaningful test
// boundary. (The requireOrgRole gate itself is covered by tests/auth/roles.test.ts.)

import { describe, it, expect } from 'vitest';
import {
  runCreateClassifier,
  runPromoteToShadow,
  runRetireClassifier,
  toFailure,
  type CreateClassifierInput,
} from '../../src/app/app/classifiers/action-core';
import {
  makeInMemoryCustomPatternsStore,
  type CustomPatternsStore,
} from '../../src/lib/data/custom-patterns/store';
import {
  getCustomClassifier,
  listCustomClassifiers,
} from '../../src/lib/data/custom-patterns/classifiers';

const ORG_A = '00000000-0000-0000-0000-00000000000a';
const ORG_B = '00000000-0000-0000-0000-00000000000b';
const USER = '00000000-0000-0000-0000-000000000001';

function freshOpts(): { store: CustomPatternsStore } {
  return { store: makeInMemoryCustomPatternsStore() };
}

function validInput(overrides: Partial<CreateClassifierInput> = {}): CreateClassifierInput {
  return {
    group_name: 'tactic',
    tag_name: 'loyalty_token_promo',
    definition: 'd'.repeat(60),
    positives: ['fires on this input', 'and on this one'],
    negatives: ['does not fire here', 'nor on this'],
    ...overrides,
  };
}

describe('runCreateClassifier', () => {
  it('creates a proposed classifier with its examples', async () => {
    const opts = freshOpts();
    const result = await runCreateClassifier(ORG_A, USER, validInput(), opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('proposed');
    expect(result.data.tag_name).toBe('loyalty_token_promo');
    expect(result.data.created_by_user_id).toBe(USER);
    expect(result.data.examples).toHaveLength(4);
    expect(result.data.examples.filter((e) => e.kind === 'positive')).toHaveLength(2);
  });

  it('threads bright_line_indicators + conflicts_with through to the persisted row', async () => {
    const opts = freshOpts();
    const result = await runCreateClassifier(
      ORG_A,
      USER,
      validInput({
        bright_line_indicators: ['trust me bro', 'guaranteed 10x'],
        conflicts_with: ['pig_butchering'],
      }),
      opts,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.bright_line_indicators).toEqual(['trust me bro', 'guaranteed 10x']);
    expect(result.data.conflicts_with).toEqual(['pig_butchering']);
  });

  it('trims and drops blank optional rows before persisting', async () => {
    const opts = freshOpts();
    const result = await runCreateClassifier(
      ORG_A,
      USER,
      validInput({
        bright_line_indicators: ['  spaced phrase  ', '', '   '],
        conflicts_with: ['pig_butchering', ''],
      }),
      opts,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.bright_line_indicators).toEqual(['spaced phrase']);
    expect(result.data.conflicts_with).toEqual(['pig_butchering']);
  });

  it('defaults the optional arrays to [] when the input omits them', async () => {
    const opts = freshOpts();
    const result = await runCreateClassifier(ORG_A, USER, validInput(), opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.bright_line_indicators).toEqual([]);
    expect(result.data.conflicts_with).toEqual([]);
  });

  it('maps an invalid optional entry to a VALIDATION failure', async () => {
    const opts = freshOpts();
    const result = await runCreateClassifier(
      ORG_A,
      USER,
      validInput({ conflicts_with: ['Not-A-Tag'] }),
      opts,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(result.field).toBe('conflicts_with[0]');
  });

  it('drops blank example rows before persisting', async () => {
    const opts = freshOpts();
    const result = await runCreateClassifier(
      ORG_A,
      USER,
      validInput({ positives: ['real', '', '  '], negatives: ['a', 'b'] }),
      opts,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.examples.filter((e) => e.kind === 'positive')).toHaveLength(1);
  });

  it('maps an invalid tag name to a VALIDATION field failure', async () => {
    const opts = freshOpts();
    const result = await runCreateClassifier(
      ORG_A,
      USER,
      validInput({ tag_name: 'Bad-Tag' }),
      opts,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(result.field).toBe('tag_name');
  });

  it('maps an out-of-set group to a VALIDATION field failure', async () => {
    const opts = freshOpts();
    const result = await runCreateClassifier(
      ORG_A,
      USER,
      validInput({ group_name: 'not_a_group' }),
      opts,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(result.field).toBe('group_name');
  });
});

describe('org scoping', () => {
  it('a classifier created under org A is invisible to org B', async () => {
    const opts = freshOpts();
    const created = await runCreateClassifier(ORG_A, USER, validInput(), opts);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(await listCustomClassifiers(ORG_A, undefined, opts)).toHaveLength(1);
    expect(await listCustomClassifiers(ORG_B, undefined, opts)).toHaveLength(0);
    expect(await getCustomClassifier(ORG_B, created.data.id, opts)).toBeNull();
  });
});

describe('runPromoteToShadow', () => {
  it('promotes a classifier with >= 2 of each example to shadow', async () => {
    const opts = freshOpts();
    const created = await runCreateClassifier(ORG_A, USER, validInput(), opts);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await runPromoteToShadow(ORG_A, created.data.id, opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('shadow');
    expect(result.data.shadow_started_at).toBeTruthy();
  });

  it('blocks promotion when an example kind is short of the floor', async () => {
    const opts = freshOpts();
    const created = await runCreateClassifier(
      ORG_A,
      USER,
      validInput({ positives: ['only one positive'] }),
      opts,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await runPromoteToShadow(ORG_A, created.data.id, opts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INSUFFICIENT_EXAMPLES');
  });

  it('rejects a second promotion as an invalid transition', async () => {
    const opts = freshOpts();
    const created = await runCreateClassifier(ORG_A, USER, validInput(), opts);
    if (!created.ok) return;
    await runPromoteToShadow(ORG_A, created.data.id, opts);

    const again = await runPromoteToShadow(ORG_A, created.data.id, opts);
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('reports a missing classifier as not found', async () => {
    const opts = freshOpts();
    const result = await runPromoteToShadow(ORG_A, 'classifier-99999999', opts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CLASSIFIER_NOT_FOUND');
  });
});

describe('runRetireClassifier', () => {
  it('owner may retire (from any non-retired state)', async () => {
    const opts = freshOpts();
    const created = await runCreateClassifier(ORG_A, USER, validInput(), opts);
    if (!created.ok) return;

    const result = await runRetireClassifier(ORG_A, created.data.id, 'owner', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('retired');
    expect(result.data.retired_at).toBeTruthy();
  });

  it('admin may retire', async () => {
    const opts = freshOpts();
    const created = await runCreateClassifier(ORG_A, USER, validInput(), opts);
    if (!created.ok) return;
    const result = await runRetireClassifier(ORG_A, created.data.id, 'admin', opts);
    expect(result.ok).toBe(true);
  });

  it('member is forbidden from retiring', async () => {
    const opts = freshOpts();
    const created = await runCreateClassifier(ORG_A, USER, validInput(), opts);
    if (!created.ok) return;

    const result = await runRetireClassifier(ORG_A, created.data.id, 'member', opts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('RETIREMENT_FORBIDDEN');
  });

  it('reviewer is forbidden from retiring', async () => {
    const opts = freshOpts();
    const created = await runCreateClassifier(ORG_A, USER, validInput(), opts);
    if (!created.ok) return;
    const result = await runRetireClassifier(ORG_A, created.data.id, 'reviewer', opts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('RETIREMENT_FORBIDDEN');
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

// Full flow the detail view renders: create -> read back the persisted shape ->
// move to shadow -> the read-back reflects the new status.
describe('integration: create -> detail -> shadow', () => {
  it('round-trips the definition and reflects the lifecycle transition', async () => {
    const opts = freshOpts();
    const created = await runCreateClassifier(
      ORG_A,
      USER,
      validInput({ bright_line_indicators: ['trust me bro'], conflicts_with: ['pig_butchering'] }),
      opts,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // What the detail server component loads via getCustomClassifier.
    const loaded = await getCustomClassifier(ORG_A, created.data.id, opts);
    expect(loaded).not.toBeNull();
    expect(loaded?.tag_name).toBe('loyalty_token_promo');
    expect(loaded?.group_name).toBe('tactic');
    expect(loaded?.definition).toBe('d'.repeat(60));
    expect(loaded?.examples).toHaveLength(4);
    expect(loaded?.status).toBe('proposed');
    // The detail view renders these two sections off the persisted arrays.
    expect(loaded?.bright_line_indicators).toEqual(['trust me bro']);
    expect(loaded?.conflicts_with).toEqual(['pig_butchering']);

    await runPromoteToShadow(ORG_A, created.data.id, opts);
    const afterShadow = await getCustomClassifier(ORG_A, created.data.id, opts);
    expect(afterShadow?.status).toBe('shadow');
    expect(afterShadow?.shadow_started_at).toBeTruthy();
  });
});
