// Pure view model for the dashboard. The page resolves the organization and
// its classifiers and patterns, then hands them here to shape into exactly what
// the dashboard renders -- the counts, the three most recent of each, and the
// empty-state flags. Keeping this separate from the JSX lets the logic be
// tested directly without rendering a server component.

import type { Organization } from '@/lib/auth';
import type {
  CustomL3Classifier,
  Pattern,
} from '@/lib/data/custom-patterns';

// How many recent items each dashboard section previews before the "See all"
// link takes over.
export const RECENT_LIMIT = 3;

// Human-readable plan names, keyed off the plan_tier closed set so a new tier
// added to the Organization type is a compile error here rather than a blank
// label at runtime.
export const PLAN_LABELS: Record<Organization['plan_tier'], string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

// In the Phase 1 personal-organization model a signed-in user owns their own
// organization, so the role shown on the dashboard is always Owner. When real
// memberships land this becomes a lookup; the dashboard reads it from one place
// either way.
export const OWNER_ROLE_LABEL = 'Owner';

// Newest first, capped at `limit`. Copies the array so the caller's list is
// never mutated, and leaves items without a created_at at the end rather than
// throwing.
export function recentItems<T extends { created_at: string }>(
  items: readonly T[],
  limit: number = RECENT_LIMIT,
): T[] {
  return [...items]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, limit);
}

export interface DashboardSection<T> {
  count: number;
  recent: T[];
  isEmpty: boolean;
}

export interface DashboardModel {
  orgName: string;
  roleLabel: string;
  planLabel: string;
  classifiers: DashboardSection<CustomL3Classifier>;
  patterns: DashboardSection<Pattern>;
}

function section<T extends { created_at: string }>(
  items: readonly T[],
): DashboardSection<T> {
  return {
    count: items.length,
    recent: recentItems(items),
    isEmpty: items.length === 0,
  };
}

export function buildDashboardModel(input: {
  org: Organization;
  classifiers: readonly CustomL3Classifier[];
  patterns: readonly Pattern[];
}): DashboardModel {
  const { org, classifiers, patterns } = input;
  return {
    orgName: org.name,
    roleLabel: OWNER_ROLE_LABEL,
    planLabel: PLAN_LABELS[org.plan_tier] ?? org.plan_tier,
    classifiers: section(classifiers),
    patterns: section(patterns),
  };
}
