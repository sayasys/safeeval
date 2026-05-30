// Dashboard tests. Two parts: the pure view model (the real logic -- counts,
// the three most recent of each, the empty-state flags) is exercised directly;
// the page source is checked for the surfaces it must render and the internal
// language it must not.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Organization } from '@/lib/auth';
import type { CustomL3Classifier, Pattern } from '@/lib/data/custom-patterns';
import {
  buildDashboardModel,
  recentItems,
  PLAN_LABELS,
  OWNER_ROLE_LABEL,
} from '../../src/app/app/dashboard/model';

function makeOrg(over: Partial<Organization> = {}): Organization {
  return {
    id: 'personal-u1',
    name: 'Personal',
    slug: 'personal',
    plan_tier: 'free',
    created_at: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

function makeClassifier(over: Partial<CustomL3Classifier> = {}): CustomL3Classifier {
  return {
    id: 'c1',
    organization_id: 'personal-u1',
    group_name: 'method',
    tag_name: 'tag_one',
    definition: 'def',
    status: 'proposed',
    bright_line_indicators: [],
    conflicts_with: [],
    shadow_started_at: null,
    promoted_at: null,
    retired_at: null,
    created_by_user_id: 'u1',
    created_at: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

function makePattern(over: Partial<Pattern> = {}): Pattern {
  return {
    id: 'p1',
    organization_id: 'personal-u1',
    name: 'Pattern One',
    typology: 'advance_fee',
    match_mode: 'subset',
    status: 'active',
    created_at: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

describe('recentItems', () => {
  it('returns an empty array for an empty list', () => {
    expect(recentItems([])).toEqual([]);
  });

  it('orders newest first by created_at', () => {
    const items = [
      { id: 'a', created_at: '2026-01-01T00:00:00.000Z' },
      { id: 'b', created_at: '2026-03-01T00:00:00.000Z' },
      { id: 'c', created_at: '2026-02-01T00:00:00.000Z' },
    ];
    expect(recentItems(items).map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('caps the preview at three by default', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      created_at: `2026-0${i + 1}-01T00:00:00.000Z`,
    }));
    expect(recentItems(items)).toHaveLength(3);
  });

  it('does not mutate the input array', () => {
    const items = [
      { id: 'a', created_at: '2026-01-01T00:00:00.000Z' },
      { id: 'b', created_at: '2026-03-01T00:00:00.000Z' },
    ];
    const snapshot = items.map((i) => i.id);
    recentItems(items);
    expect(items.map((i) => i.id)).toEqual(snapshot);
  });
});

describe('buildDashboardModel', () => {
  it('surfaces the organization name, owner role, and plan label', () => {
    const model = buildDashboardModel({
      org: makeOrg({ name: 'Acme Trust', plan_tier: 'pro' }),
      classifiers: [],
      patterns: [],
    });
    expect(model.orgName).toBe('Acme Trust');
    expect(model.roleLabel).toBe(OWNER_ROLE_LABEL);
    expect(model.planLabel).toBe('Pro');
  });

  it('reports empty sections when the org has no classifiers or patterns', () => {
    const model = buildDashboardModel({
      org: makeOrg(),
      classifiers: [],
      patterns: [],
    });
    expect(model.classifiers).toEqual({ count: 0, recent: [], isEmpty: true });
    expect(model.patterns).toEqual({ count: 0, recent: [], isEmpty: true });
  });

  it('counts everything but previews only the three most recent', () => {
    const classifiers = Array.from({ length: 5 }, (_, i) =>
      makeClassifier({ id: `c${i}`, created_at: `2026-0${i + 1}-01T00:00:00.000Z` }),
    );
    const patterns = Array.from({ length: 4 }, (_, i) =>
      makePattern({ id: `p${i}`, created_at: `2026-0${i + 1}-01T00:00:00.000Z` }),
    );
    const model = buildDashboardModel({ org: makeOrg(), classifiers, patterns });

    expect(model.classifiers.count).toBe(5);
    expect(model.classifiers.isEmpty).toBe(false);
    expect(model.classifiers.recent).toHaveLength(3);
    expect(model.classifiers.recent[0]?.id).toBe('c4');

    expect(model.patterns.count).toBe(4);
    expect(model.patterns.recent).toHaveLength(3);
    expect(model.patterns.recent[0]?.id).toBe('p3');
  });

  it('labels every plan tier in the closed set', () => {
    expect(PLAN_LABELS.free).toBe('Free');
    expect(PLAN_LABELS.pro).toBe('Pro');
    expect(PLAN_LABELS.enterprise).toBe('Enterprise');
  });
});

describe('dashboard page source', () => {
  const SRC = readFileSync(
    join(process.cwd(), 'src/app/app/dashboard/page.js'),
    'utf8',
  );

  it('renders the organization summary and both sections', () => {
    expect(SRC).toContain('Your organization');
    expect(SRC).toContain('Your custom classifiers');
    expect(SRC).toContain('Your patterns');
  });

  it('links to the list views, create routes, and the evaluator', () => {
    expect(SRC).toContain('/app/classifiers');
    expect(SRC).toContain('/app/patterns');
    expect(SRC).toContain('/app/classifiers/new');
    expect(SRC).toContain('/app/patterns/new');
    expect(SRC).toContain('/evaluator');
  });

  it('loads real org-scoped state', () => {
    expect(SRC).toContain('getOrganization');
    expect(SRC).toContain('listCustomClassifiers');
    expect(SRC).toContain('listPatterns');
  });

  it('carries no phase / scoping-memo / stub / migration language', () => {
    for (const banned of [
      /\bphase\b/i,
      /scoping memo/i,
      /\bstub\b/i,
      /M\d+ migration/i,
      /multi-tenancy/i,
    ]) {
      expect(SRC).not.toMatch(banned);
    }
  });
});
