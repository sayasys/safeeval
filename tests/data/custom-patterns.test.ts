// Custom patterns + custom L3 classifiers -- persistence coverage (Phase 1).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md.
// Drives every persistence helper against the in-memory store fake (which
// enforces the same organization_id scoping the Supabase implementation does),
// plus a static M13 migration dry-run. Cross-org isolation, the Q9 live cap, and
// the Q13 retirement-authority guard are exercised directly.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  makeInMemoryCustomPatternsStore,
  type CustomPatternsStore,
} from '../../src/lib/data/custom-patterns/store';
import {
  createPattern,
  getPattern,
  listPatterns,
  archivePattern,
} from '../../src/lib/data/custom-patterns/patterns';
import {
  createCustomClassifier,
  getCustomClassifier,
  listCustomClassifiers,
  promoteToShadow,
  promoteToLive,
  retireClassifier,
} from '../../src/lib/data/custom-patterns/classifiers';
import {
  CustomPatternsValidationError,
  PatternNotFoundError,
  ClassifierNotFoundError,
  InsufficientExamplesError,
  InsufficientReviewersError,
  OrgClassifierCapExceededError,
  ClassifierRetirementForbiddenError,
  InvalidStatusTransitionError,
} from '../../src/lib/data/custom-patterns/errors';
import {
  LIVE_CLASSIFIER_CAP,
  BRIGHT_LINE_MAX_LENGTH,
  BRIGHT_LINE_INDICATORS_MAX,
  CONFLICTS_WITH_MAX,
  PROMOTION_VOLUME_N,
  PROMOTION_FEEDBACK_M,
} from '../../src/lib/data/custom-patterns/constants';
import type { NewPattern, NewCustomL3Classifier, NewCustomL3Example } from '../../src/lib/data/custom-patterns/types';

const ORG_A = '00000000-0000-0000-0000-00000000000a';
const ORG_B = '00000000-0000-0000-0000-00000000000b';
const USER = '00000000-0000-0000-0000-000000000001';

function freshStore(): { store: CustomPatternsStore } {
  return { store: makeInMemoryCustomPatternsStore() };
}

function samplePattern(overrides: Partial<NewPattern> = {}): NewPattern {
  return {
    name: 'Romance-Crypto Cross Pollination',
    typology: 'investment_fraud',
    components: [
      { group_name: 'tactic', tag_id: 'trust_love', tag_source: 'closed_set' },
      { group_name: 'target', tag_id: 'crypto_holder', tag_source: 'closed_set' },
    ],
    ...overrides,
  };
}

function sampleClassifier(overrides: Partial<NewCustomL3Classifier> = {}): NewCustomL3Classifier {
  return {
    group_name: 'context_marker',
    tag_name: 'our_loyalty_token_promo_pretext',
    definition:
      'Fires when the input references the organization loyalty-token promotion as a pretext for an unsolicited investment ask.',
    created_by_user_id: USER,
    ...overrides,
  };
}

function sampleExamples(): NewCustomL3Example[] {
  return [
    { kind: 'positive', text: 'Join our loyalty-token promo and double your deposit today.' },
    { kind: 'positive', text: 'Our promo lets early members 10x their holdings -- send funds now.' },
    { kind: 'negative', text: 'Reminder: your monthly statement is ready to view.' },
    { kind: 'negative', text: 'Welcome to the community! Here is how to set up 2FA.' },
  ];
}

// Seed the M15 persistence so a shadow classifier clears the precision-proxy
// promotion gate (memo 6.3): >= PROMOTION_VOLUME_N checks logged and >=
// PROMOTION_FEEDBACK_M confirm-feedback events from 2 distinct reviewers
// (precision proxy 1.0). promoteToLive enforces the gate server-side, so the
// Phase 1 success / cap tests below seed this before promoting.
async function seedReadyForPromotion(
  orgId: string,
  classifierId: string,
  opts: { store: CustomPatternsStore },
): Promise<void> {
  for (let i = 0; i < PROMOTION_VOLUME_N; i++) {
    await opts.store.insertMatchLog({
      organization_id: orgId,
      classifier_id: classifierId,
      evaluation_id: null,
      matched: true,
      confidence: 0.9,
      via: 'inference',
    });
  }
  for (let i = 0; i < PROMOTION_FEEDBACK_M; i++) {
    await opts.store.insertMatchFeedback({
      organization_id: orgId,
      classifier_id: classifierId,
      match_log_id: null,
      reviewer_id: i % 2 === 0 ? 'rev_1' : 'rev_2',
      verdict: 'confirm',
    });
  }
}

// Fully promote a classifier to live, for the cap test.
async function makeLiveClassifier(
  orgId: string,
  index: number,
  opts: { store: CustomPatternsStore },
): Promise<void> {
  const created = await createCustomClassifier(
    orgId,
    sampleClassifier({ tag_name: `custom_tag_${index}` }),
    sampleExamples(),
    opts,
  );
  await promoteToShadow(orgId, created.id, opts);
  await seedReadyForPromotion(orgId, created.id, opts);
  await promoteToLive(orgId, created.id, ['rev_1', 'rev_2'], opts);
}

describe('custom patterns persistence', () => {
  it('creates, reads, and lists a pattern with its components', async () => {
    const opts = freshStore();
    const created = await createPattern(ORG_A, samplePattern(), opts);
    expect(created.id).toBeTruthy();
    expect(created.organization_id).toBe(ORG_A);
    expect(created.match_mode).toBe('subset');
    expect(created.status).toBe('active');
    expect(created.components).toHaveLength(2);

    const fetched = await getPattern(ORG_A, created.id, opts);
    expect(fetched).not.toBeNull();
    expect(fetched!.components).toHaveLength(2);
    expect(fetched!.components[0]?.tag_id).toBe('trust_love');

    const list = await listPatterns(ORG_A, opts);
    expect(list.map((p) => p.id)).toContain(created.id);
  });

  it('rejects invalid pattern input', async () => {
    const opts = freshStore();
    await expect(createPattern(ORG_A, samplePattern({ name: ' bad-start' }), opts)).rejects.toBeInstanceOf(
      CustomPatternsValidationError,
    );
    await expect(
      createPattern(
        ORG_A,
        samplePattern({ components: [{ group_name: 'not_a_group' as never, tag_id: 'x', tag_source: 'closed_set' }] }),
        opts,
      ),
    ).rejects.toBeInstanceOf(CustomPatternsValidationError);
    await expect(
      createPattern(
        ORG_A,
        samplePattern({ components: [{ group_name: 'tactic', tag_id: 't', tag_source: 'closed_set', weight: 2 }] }),
        opts,
      ),
    ).rejects.toBeInstanceOf(CustomPatternsValidationError);
  });

  it('archives a pattern and errors on a missing one', async () => {
    const opts = freshStore();
    const created = await createPattern(ORG_A, samplePattern(), opts);
    const archived = await archivePattern(ORG_A, created.id, opts);
    expect(archived.status).toBe('archived');
    await expect(archivePattern(ORG_A, 'does-not-exist', opts)).rejects.toBeInstanceOf(PatternNotFoundError);
  });

  it('quarantines patterns by organization (org A cannot see org B)', async () => {
    const opts = freshStore();
    const a = await createPattern(ORG_A, samplePattern(), opts);
    await createPattern(ORG_B, samplePattern({ name: 'Org B Pattern' }), opts);

    // Org B cannot read org A's pattern.
    expect(await getPattern(ORG_B, a.id, opts)).toBeNull();
    // Org B's list excludes org A's pattern.
    const bList = await listPatterns(ORG_B, opts);
    expect(bList.map((p) => p.id)).not.toContain(a.id);
    // Org B cannot archive org A's pattern.
    await expect(archivePattern(ORG_B, a.id, opts)).rejects.toBeInstanceOf(PatternNotFoundError);
  });
});

describe('custom L3 classifiers persistence + lifecycle', () => {
  it('creates and reads a classifier with examples in proposed status', async () => {
    const opts = freshStore();
    const created = await createCustomClassifier(ORG_A, sampleClassifier(), sampleExamples(), opts);
    expect(created.status).toBe('proposed');
    expect(created.examples).toHaveLength(4);

    const fetched = await getCustomClassifier(ORG_A, created.id, opts);
    expect(fetched).not.toBeNull();
    expect(fetched!.tag_name).toBe('our_loyalty_token_promo_pretext');
    expect(fetched!.examples).toHaveLength(4);

    const list = await listCustomClassifiers(ORG_A, undefined, opts);
    expect(list.map((c) => c.id)).toContain(created.id);
    const proposedOnly = await listCustomClassifiers(ORG_A, 'proposed', opts);
    expect(proposedOnly.map((c) => c.id)).toContain(created.id);
  });

  it('defaults bright_line_indicators / conflicts_with to [] when omitted', async () => {
    const opts = freshStore();
    const created = await createCustomClassifier(ORG_A, sampleClassifier(), sampleExamples(), opts);
    expect(created.bright_line_indicators).toEqual([]);
    expect(created.conflicts_with).toEqual([]);

    const fetched = await getCustomClassifier(ORG_A, created.id, opts);
    expect(fetched!.bright_line_indicators).toEqual([]);
    expect(fetched!.conflicts_with).toEqual([]);
  });

  it('persists and reads back bright_line_indicators + conflicts_with (memo 5.5 / 5.6)', async () => {
    const opts = freshStore();
    const created = await createCustomClassifier(
      ORG_A,
      sampleClassifier({
        bright_line_indicators: ['trust me bro', 'guaranteed 10x'],
        conflicts_with: ['pig_butchering', 'our_other_tag'],
      }),
      sampleExamples(),
      opts,
    );
    expect(created.bright_line_indicators).toEqual(['trust me bro', 'guaranteed 10x']);
    expect(created.conflicts_with).toEqual(['pig_butchering', 'our_other_tag']);

    const fetched = await getCustomClassifier(ORG_A, created.id, opts);
    expect(fetched!.bright_line_indicators).toEqual(['trust me bro', 'guaranteed 10x']);
    expect(fetched!.conflicts_with).toEqual(['pig_butchering', 'our_other_tag']);
  });

  it('rejects oversized optional arrays', async () => {
    const opts = freshStore();
    await expect(
      createCustomClassifier(
        ORG_A,
        sampleClassifier({
          bright_line_indicators: Array.from({ length: BRIGHT_LINE_INDICATORS_MAX + 1 }, (_, i) => `b${i}`),
        }),
        sampleExamples(),
        opts,
      ),
    ).rejects.toBeInstanceOf(CustomPatternsValidationError);
    await expect(
      createCustomClassifier(
        ORG_A,
        sampleClassifier({
          conflicts_with: Array.from({ length: CONFLICTS_WITH_MAX + 1 }, (_, i) => `t_${i}`),
        }),
        sampleExamples(),
        opts,
      ),
    ).rejects.toBeInstanceOf(CustomPatternsValidationError);
  });

  it('rejects invalid optional entries (over-length, non-ASCII, non-tag-shape)', async () => {
    const opts = freshStore();
    // Over-length bright-line indicator.
    await expect(
      createCustomClassifier(
        ORG_A,
        sampleClassifier({ bright_line_indicators: ['x'.repeat(BRIGHT_LINE_MAX_LENGTH + 1)] }),
        sampleExamples(),
        opts,
      ),
    ).rejects.toBeInstanceOf(CustomPatternsValidationError);
    // Non-ASCII bright-line indicator (em dash built from a char code).
    const emDash = String.fromCharCode(0x2014);
    await expect(
      createCustomClassifier(
        ORG_A,
        sampleClassifier({ bright_line_indicators: [`urgent${emDash}now`] }),
        sampleExamples(),
        opts,
      ),
    ).rejects.toBeInstanceOf(CustomPatternsValidationError);
    // conflicts_with entry that is not a snake_case tag name.
    await expect(
      createCustomClassifier(
        ORG_A,
        sampleClassifier({ conflicts_with: ['Not-A-Tag'] }),
        sampleExamples(),
        opts,
      ),
    ).rejects.toBeInstanceOf(CustomPatternsValidationError);
  });

  it('rejects invalid classifier and example input', async () => {
    const opts = freshStore();
    await expect(
      createCustomClassifier(ORG_A, sampleClassifier({ tag_name: 'Bad-Name' }), sampleExamples(), opts),
    ).rejects.toBeInstanceOf(CustomPatternsValidationError);
    await expect(
      createCustomClassifier(ORG_A, sampleClassifier({ definition: 'too short' }), sampleExamples(), opts),
    ).rejects.toBeInstanceOf(CustomPatternsValidationError);
    await expect(
      createCustomClassifier(ORG_A, sampleClassifier(), [{ kind: 'positive', text: '' }], opts),
    ).rejects.toBeInstanceOf(CustomPatternsValidationError);
  });

  it('promotes proposed -> shadow when example floor is met', async () => {
    const opts = freshStore();
    const created = await createCustomClassifier(ORG_A, sampleClassifier(), sampleExamples(), opts);
    const shadowed = await promoteToShadow(ORG_A, created.id, opts);
    expect(shadowed.status).toBe('shadow');
    expect(shadowed.shadow_started_at).toBeTruthy();
  });

  it('blocks promotion to shadow without >= 2 examples of each kind', async () => {
    const opts = freshStore();
    const created = await createCustomClassifier(
      ORG_A,
      sampleClassifier(),
      [
        { kind: 'positive', text: 'only one positive example here' },
        { kind: 'negative', text: 'only one negative example here' },
      ],
      opts,
    );
    await expect(promoteToShadow(ORG_A, created.id, opts)).rejects.toBeInstanceOf(InsufficientExamplesError);
  });

  it('rejects an out-of-order shadow promotion', async () => {
    const opts = freshStore();
    const created = await createCustomClassifier(ORG_A, sampleClassifier(), sampleExamples(), opts);
    await promoteToShadow(ORG_A, created.id, opts);
    // Already in shadow; promoting to shadow again is invalid.
    await expect(promoteToShadow(ORG_A, created.id, opts)).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });

  it('promotes shadow -> live with >= 2 distinct reviewers once the gate is met', async () => {
    const opts = freshStore();
    const created = await createCustomClassifier(ORG_A, sampleClassifier(), sampleExamples(), opts);
    await promoteToShadow(ORG_A, created.id, opts);
    await seedReadyForPromotion(ORG_A, created.id, opts);
    const live = await promoteToLive(ORG_A, created.id, ['rev_1', 'rev_2'], opts);
    expect(live.status).toBe('live');
    expect(live.promoted_at).toBeTruthy();
  });

  it('blocks promotion to live without >= 2 distinct reviewers', async () => {
    const opts = freshStore();
    const created = await createCustomClassifier(ORG_A, sampleClassifier(), sampleExamples(), opts);
    await promoteToShadow(ORG_A, created.id, opts);
    // One distinct reviewer (duplicate id collapses).
    await expect(promoteToLive(ORG_A, created.id, ['rev_1', 'rev_1'], opts)).rejects.toBeInstanceOf(
      InsufficientReviewersError,
    );
  });

  it('rejects promotion to live from a non-shadow state', async () => {
    const opts = freshStore();
    const created = await createCustomClassifier(ORG_A, sampleClassifier(), sampleExamples(), opts);
    // Still proposed.
    await expect(promoteToLive(ORG_A, created.id, ['rev_1', 'rev_2'], opts)).rejects.toBeInstanceOf(
      InvalidStatusTransitionError,
    );
  });

  it('enforces the per-org live classifier cap (Q9)', async () => {
    const opts = freshStore();
    for (let i = 0; i < LIVE_CLASSIFIER_CAP; i++) {
      await makeLiveClassifier(ORG_A, i, opts);
    }
    expect((await listCustomClassifiers(ORG_A, 'live', opts)).length).toBe(LIVE_CLASSIFIER_CAP);

    // The cap+1-th promotion must be rejected.
    const overflow = await createCustomClassifier(
      ORG_A,
      sampleClassifier({ tag_name: 'custom_tag_overflow' }),
      sampleExamples(),
      opts,
    );
    await promoteToShadow(ORG_A, overflow.id, opts);
    // Seed the gate so the overflow promotion clears the precision-proxy check
    // and reaches the cap check (which is what this test asserts).
    await seedReadyForPromotion(ORG_A, overflow.id, opts);
    await expect(promoteToLive(ORG_A, overflow.id, ['rev_1', 'rev_2'], opts)).rejects.toBeInstanceOf(
      OrgClassifierCapExceededError,
    );

    // The cap is per-org: org B can still promote.
    await expect(makeLiveClassifier(ORG_B, 0, opts)).resolves.toBeUndefined();
  });

  it('restricts retirement authority to owner / admin (Q13)', async () => {
    const opts = freshStore();
    const created = await createCustomClassifier(ORG_A, sampleClassifier(), sampleExamples(), opts);

    await expect(retireClassifier(ORG_A, created.id, 'reviewer', opts)).rejects.toBeInstanceOf(
      ClassifierRetirementForbiddenError,
    );
    await expect(retireClassifier(ORG_A, created.id, 'member', opts)).rejects.toBeInstanceOf(
      ClassifierRetirementForbiddenError,
    );

    const retiredByAdmin = await retireClassifier(ORG_A, created.id, 'admin', opts);
    expect(retiredByAdmin.status).toBe('retired');
    expect(retiredByAdmin.retired_at).toBeTruthy();

    // Idempotent: retiring again returns the retired row.
    const again = await retireClassifier(ORG_A, created.id, 'owner', opts);
    expect(again.status).toBe('retired');
  });

  it('quarantines classifiers by organization (org A cannot see org B)', async () => {
    const opts = freshStore();
    const a = await createCustomClassifier(ORG_A, sampleClassifier(), sampleExamples(), opts);
    await createCustomClassifier(ORG_B, sampleClassifier({ tag_name: 'org_b_tag' }), sampleExamples(), opts);

    expect(await getCustomClassifier(ORG_B, a.id, opts)).toBeNull();
    const bList = await listCustomClassifiers(ORG_B, undefined, opts);
    expect(bList.map((c) => c.id)).not.toContain(a.id);

    // Org B cannot drive org A's classifier through its lifecycle.
    await expect(promoteToShadow(ORG_B, a.id, opts)).rejects.toBeInstanceOf(ClassifierNotFoundError);
    await expect(retireClassifier(ORG_B, a.id, 'owner', opts)).rejects.toBeInstanceOf(ClassifierNotFoundError);
  });
});

describe('M13 migration dry-run', () => {
  const sql = readFileSync(
    join(process.cwd(), 'src', 'lib', 'data', 'schema', 'M13_custom_patterns_and_classifiers.sql'),
    'utf-8',
  );

  it('creates the four tables', () => {
    expect(sql).toContain('CREATE TABLE org_patterns');
    expect(sql).toContain('CREATE TABLE pattern_components');
    expect(sql).toContain('CREATE TABLE org_custom_l3_classifiers');
    expect(sql).toContain('CREATE TABLE org_custom_l3_examples');
  });

  it('enables RLS and creates a tenant-isolation policy on each table', () => {
    for (const table of [
      'org_patterns',
      'pattern_components',
      'org_custom_l3_classifiers',
      'org_custom_l3_examples',
    ]) {
      expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`${table}_tenant_isolation`);
    }
    // Parent tables filter organization_id directly; child tables transitively.
    expect(sql).toContain("organization_id = current_setting('app.current_organization_id', true)::uuid");
    expect(sql).toContain('EXISTS (');
  });

  it('carries the closed-set CHECK constraints from the adjudications', () => {
    // Q3: match_mode.
    expect(sql).toContain("match_mode IN ('subset', 'weighted')");
    // Q6: tag_name snake_case ASCII 1-40.
    expect(sql).toContain("tag_name ~ '^[a-z][a-z0-9_]{0,39}$'");
    // Q7: definition 40-600.
    expect(sql).toContain('length(definition) BETWEEN 40 AND 600');
    // Group-name closed set (both tables).
    expect(sql).toContain(
      "group_name IN ('method', 'tactic', 'target', 'context_marker', 'overlap', 'risk_marker')",
    );
    // Lifecycle status closed sets.
    expect(sql).toContain("status IN ('active', 'archived')");
    expect(sql).toContain("status IN ('proposed', 'shadow', 'live', 'retired')");
  });

  it('is reversible and documents the M12 -> M13 numbering correction', () => {
    expect(sql).toContain('-- DOWN');
    expect(sql).toContain('DROP TABLE IF EXISTS org_patterns');
    expect(sql).toContain('DROP TABLE IF EXISTS org_custom_l3_examples');
    expect(sql).toMatch(/NUMBERING CORRECTION/);
    expect(sql).toContain('M13');
  });
});

describe('M14 migration dry-run (bright_line + conflicts_with backfill)', () => {
  const sql = readFileSync(
    join(process.cwd(), 'src', 'lib', 'data', 'schema', 'M14_classifier_bright_line_and_conflicts.sql'),
    'utf-8',
  );

  it('adds both columns to org_custom_l3_classifiers as NOT NULL DEFAULT empty arrays', () => {
    expect(sql).toContain('ALTER TABLE org_custom_l3_classifiers');
    expect(sql).toContain("ADD COLUMN bright_line_indicators TEXT[] NOT NULL DEFAULT '{}'");
    expect(sql).toContain("ADD COLUMN conflicts_with TEXT[] NOT NULL DEFAULT '{}'");
  });

  it('documents the Phase 1 schema-gap backfill and the memo sections', () => {
    expect(sql).toMatch(/BACKFILL, NOT A FEATURE ADDITION/);
    expect(sql).toContain('section 5.5');
    expect(sql).toContain('section 5.6');
    // Defaults leave existing rows unaffected -- stated in the header.
    expect(sql).toMatch(/DEFAULTS ARE EMPTY ARRAYS/);
  });

  it('carries a reversible DOWN block dropping both columns', () => {
    expect(sql).toContain('-- DOWN');
    expect(sql).toContain('ALTER TABLE org_custom_l3_classifiers DROP COLUMN bright_line_indicators;');
    expect(sql).toContain('ALTER TABLE org_custom_l3_classifiers DROP COLUMN conflicts_with;');
  });
});
