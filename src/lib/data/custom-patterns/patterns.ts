// Persistence helpers for org-defined Patterns (Phase 1).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 3.1 / 3.2 / 7. Every helper is organization-scoped: the orgId is the
// first argument and is threaded into every store call, so a caller can never
// read or mutate another org's patterns through this API (the M13 RLS policies
// are the structural backstop).
//
// A note on typology validation: the memo (section 3.1) closes the `typology`
// field against docs/08-v5-ontology.md section 3.9 at the application layer, with
// a companion checkOrgPatternTypologyLockstep verifier. That doc-closed-set
// verifier is out of this Phase 1 brief's scope (the brief scopes only the
// group-name lockstep), so this layer validates typology as a non-empty string
// and leaves the closed-set tightening to the phase that lands the verifier.

import { getClient } from '../db-client';
import {
  makeSupabaseCustomPatternsStore,
  type CustomPatternsStore,
  type InsertPatternComponentRow,
} from './store';
import {
  L3_GROUP_NAMES,
  MATCH_MODES,
  TAG_SOURCES,
  type NewPattern,
  type Pattern,
  type PatternWithComponents,
} from './types';
import {
  PATTERN_NAME_PATTERN,
  WEIGHT_MIN,
  WEIGHT_MAX,
} from './constants';
import { CustomPatternsValidationError, PatternNotFoundError } from './errors';

export interface CustomPatternsOptions {
  // Test seam: inject a store (typically the in-memory fake) without touching
  // the module-level Supabase singleton. Production callers omit this.
  store?: CustomPatternsStore;
}

export function resolveStore(options?: CustomPatternsOptions): CustomPatternsStore {
  return options?.store ?? makeSupabaseCustomPatternsStore(getClient().getRawClient());
}

function validateNewPattern(pattern: NewPattern): void {
  if (typeof pattern.name !== 'string' || !PATTERN_NAME_PATTERN.test(pattern.name)) {
    throw new CustomPatternsValidationError(
      'name',
      'must be 1-80 chars, start alphanumeric, and contain only letters, digits, spaces, underscores, or hyphens',
    );
  }
  if (typeof pattern.typology !== 'string' || pattern.typology.length === 0) {
    throw new CustomPatternsValidationError('typology', 'must be a non-empty string');
  }
  if (pattern.match_mode !== undefined && !MATCH_MODES.includes(pattern.match_mode)) {
    throw new CustomPatternsValidationError(
      'match_mode',
      `must be one of ${MATCH_MODES.join(', ')}`,
    );
  }
  if (!Array.isArray(pattern.components)) {
    throw new CustomPatternsValidationError('components', 'must be an array');
  }
  for (const [i, c] of pattern.components.entries()) {
    if (!L3_GROUP_NAMES.includes(c.group_name)) {
      throw new CustomPatternsValidationError(
        `components[${i}].group_name`,
        `must be one of ${L3_GROUP_NAMES.join(', ')}`,
      );
    }
    if (typeof c.tag_id !== 'string' || c.tag_id.length === 0) {
      throw new CustomPatternsValidationError(`components[${i}].tag_id`, 'must be a non-empty string');
    }
    if (!TAG_SOURCES.includes(c.tag_source)) {
      throw new CustomPatternsValidationError(
        `components[${i}].tag_source`,
        `must be one of ${TAG_SOURCES.join(', ')}`,
      );
    }
    if (c.weight !== undefined) {
      if (typeof c.weight !== 'number' || !Number.isFinite(c.weight) || c.weight < WEIGHT_MIN || c.weight > WEIGHT_MAX) {
        throw new CustomPatternsValidationError(
          `components[${i}].weight`,
          `must be a number in [${WEIGHT_MIN}, ${WEIGHT_MAX}]`,
        );
      }
    }
  }
}

// Create a Pattern plus its components. Inserts the parent first, then the
// component rows. If the component insert fails the parent is removed (best
// effort) so the operation is all-or-nothing from the caller's view -- there is
// no PostgREST transaction, so this is the closest available approximation.
export async function createPattern(
  orgId: string,
  pattern: NewPattern,
  options?: CustomPatternsOptions,
): Promise<PatternWithComponents> {
  validateNewPattern(pattern);
  const store = resolveStore(options);

  const created = await store.insertPattern({
    organization_id: orgId,
    name: pattern.name,
    typology: pattern.typology,
    match_mode: pattern.match_mode ?? 'subset',
    status: 'active',
  });

  let components;
  try {
    const rows: InsertPatternComponentRow[] = pattern.components.map((c) => ({
      pattern_id: created.id,
      group_name: c.group_name,
      tag_id: c.tag_id,
      tag_source: c.tag_source,
      weight: c.weight ?? 1.0,
    }));
    components = await store.insertPatternComponents(rows);
  } catch (err) {
    // Roll back the orphaned parent. Swallow cleanup errors so the original
    // failure is what surfaces.
    try {
      await store.deletePattern(orgId, created.id);
    } catch {
      /* best effort */
    }
    throw err;
  }

  return { ...created, components };
}

// Load a Pattern with its components, scoped to the org. Returns null if the
// pattern does not exist OR belongs to another org (the org filter makes those
// two cases indistinguishable to the caller, by design).
export async function getPattern(
  orgId: string,
  patternId: string,
  options?: CustomPatternsOptions,
): Promise<PatternWithComponents | null> {
  const store = resolveStore(options);
  const pattern = await store.getPatternById(orgId, patternId);
  if (!pattern) return null;
  const components = await store.getPatternComponents(pattern.id);
  return { ...pattern, components };
}

export async function listPatterns(
  orgId: string,
  options?: CustomPatternsOptions,
): Promise<Pattern[]> {
  const store = resolveStore(options);
  return store.listPatterns(orgId);
}

// Soft-delete: flip status to 'archived' (memo section 3.1 -- patterns are
// archived, not hard-deleted, so historical references stay resolvable).
export async function archivePattern(
  orgId: string,
  patternId: string,
  options?: CustomPatternsOptions,
): Promise<Pattern> {
  const store = resolveStore(options);
  const updated = await store.updatePatternStatus(orgId, patternId, 'archived');
  if (!updated) throw new PatternNotFoundError(orgId, patternId);
  return updated;
}
