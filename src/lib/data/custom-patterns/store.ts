// Data-access layer for custom patterns + custom L3 classifiers (Phase 1).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 7.1 (org-quarantine via an explicit organization_id filter on every
// query). Mirrors the db-client.ts / feedback/store.ts pattern: a narrow
// interface (CustomPatternsStore) plus a Supabase-backed factory
// (makeSupabaseCustomPatternsStore) and an in-memory fake
// (makeInMemoryCustomPatternsStore) for tests.
//
// EVERY read and write here is organization-scoped. The two parent tables filter
// on organization_id directly. The two child tables (pattern_components,
// org_custom_l3_examples) carry no organization_id column; the higher-level
// helpers in patterns.ts / classifiers.ts enforce their scoping transitively by
// resolving the org-owned parent first (and the M13 RLS policies are the
// structural backstop -- memo section 7.2).

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Pattern,
  PatternComponent,
  PatternStatus,
  CustomL3Classifier,
  CustomL3Example,
  ClassifierStatus,
} from './types';

export interface InsertPatternRow {
  organization_id: string;
  name: string;
  typology: string;
  match_mode: Pattern['match_mode'];
  status: PatternStatus;
}

export interface InsertPatternComponentRow {
  pattern_id: string;
  group_name: PatternComponent['group_name'];
  tag_id: string;
  tag_source: PatternComponent['tag_source'];
  weight: number;
}

export interface InsertClassifierRow {
  organization_id: string;
  group_name: CustomL3Classifier['group_name'];
  tag_name: string;
  definition: string;
  status: ClassifierStatus;
  created_by_user_id: string;
}

export interface InsertExampleRow {
  classifier_id: string;
  kind: CustomL3Example['kind'];
  text: string;
}

export interface ClassifierStatusPatch {
  status?: ClassifierStatus;
  shadow_started_at?: string | null;
  promoted_at?: string | null;
  retired_at?: string | null;
}

export interface CustomPatternsStore {
  // --- patterns ---------------------------------------------------------
  insertPattern(row: InsertPatternRow): Promise<Pattern>;
  insertPatternComponents(rows: InsertPatternComponentRow[]): Promise<PatternComponent[]>;
  getPatternById(organization_id: string, pattern_id: string): Promise<Pattern | null>;
  getPatternComponents(pattern_id: string): Promise<PatternComponent[]>;
  listPatterns(organization_id: string): Promise<Pattern[]>;
  updatePatternStatus(
    organization_id: string,
    pattern_id: string,
    status: PatternStatus,
  ): Promise<Pattern | null>;
  deletePattern(organization_id: string, pattern_id: string): Promise<void>;

  // --- classifiers ------------------------------------------------------
  insertClassifier(row: InsertClassifierRow): Promise<CustomL3Classifier>;
  insertExamples(rows: InsertExampleRow[]): Promise<CustomL3Example[]>;
  getClassifierById(
    organization_id: string,
    classifier_id: string,
  ): Promise<CustomL3Classifier | null>;
  getExamples(classifier_id: string): Promise<CustomL3Example[]>;
  listClassifiers(
    organization_id: string,
    status?: ClassifierStatus,
  ): Promise<CustomL3Classifier[]>;
  countLiveClassifiers(organization_id: string): Promise<number>;
  updateClassifier(
    organization_id: string,
    classifier_id: string,
    patch: ClassifierStatusPatch,
  ): Promise<CustomL3Classifier | null>;
  deleteClassifier(organization_id: string, classifier_id: string): Promise<void>;
}

export class CustomPatternsStoreError extends Error {
  override readonly name = 'CustomPatternsStoreError';
  readonly cause_message: string | undefined;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.cause_message = options?.cause instanceof Error ? options.cause.message : undefined;
  }
}

// ---------------------------------------------------------------------------
// Supabase-backed implementation.
// ---------------------------------------------------------------------------

function toPattern(row: Record<string, unknown>): Pattern {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    name: String(row.name),
    typology: String(row.typology),
    match_mode: row.match_mode as Pattern['match_mode'],
    status: row.status as PatternStatus,
    created_at: String(row.created_at),
  };
}

function toPatternComponent(row: Record<string, unknown>): PatternComponent {
  return {
    id: Number(row.id),
    pattern_id: String(row.pattern_id),
    group_name: row.group_name as PatternComponent['group_name'],
    tag_id: String(row.tag_id),
    tag_source: row.tag_source as PatternComponent['tag_source'],
    weight: typeof row.weight === 'number' ? row.weight : Number(row.weight),
    created_at: String(row.created_at),
  };
}

function toClassifier(row: Record<string, unknown>): CustomL3Classifier {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    group_name: row.group_name as CustomL3Classifier['group_name'],
    tag_name: String(row.tag_name),
    definition: String(row.definition),
    status: row.status as ClassifierStatus,
    shadow_started_at: row.shadow_started_at ? String(row.shadow_started_at) : null,
    promoted_at: row.promoted_at ? String(row.promoted_at) : null,
    retired_at: row.retired_at ? String(row.retired_at) : null,
    created_by_user_id: String(row.created_by_user_id),
    created_at: String(row.created_at),
  };
}

function toExample(row: Record<string, unknown>): CustomL3Example {
  return {
    id: Number(row.id),
    classifier_id: String(row.classifier_id),
    kind: row.kind as CustomL3Example['kind'],
    text: String(row.text),
    created_at: String(row.created_at),
  };
}

const PATTERN_COLS = 'id, organization_id, name, typology, match_mode, status, created_at';
const COMPONENT_COLS = 'id, pattern_id, group_name, tag_id, tag_source, weight, created_at';
const CLASSIFIER_COLS =
  'id, organization_id, group_name, tag_name, definition, status, shadow_started_at, promoted_at, retired_at, created_by_user_id, created_at';
const EXAMPLE_COLS = 'id, classifier_id, kind, text, created_at';

export function makeSupabaseCustomPatternsStore(raw: SupabaseClient): CustomPatternsStore {
  return {
    async insertPattern(row: InsertPatternRow): Promise<Pattern> {
      const { data, error } = await raw
        .from('org_patterns')
        .insert(row)
        .select(PATTERN_COLS)
        .single();
      if (error) throw new CustomPatternsStoreError(`insertPattern failed: ${error.message}`, { cause: error });
      if (!data) throw new CustomPatternsStoreError('insertPattern returned no row');
      return toPattern(data);
    },

    async insertPatternComponents(rows: InsertPatternComponentRow[]): Promise<PatternComponent[]> {
      if (rows.length === 0) return [];
      const { data, error } = await raw
        .from('pattern_components')
        .insert(rows)
        .select(COMPONENT_COLS);
      if (error) throw new CustomPatternsStoreError(`insertPatternComponents failed: ${error.message}`, { cause: error });
      return (data ?? []).map(toPatternComponent);
    },

    async getPatternById(organization_id: string, pattern_id: string): Promise<Pattern | null> {
      const { data, error } = await raw
        .from('org_patterns')
        .select(PATTERN_COLS)
        .eq('organization_id', organization_id)
        .eq('id', pattern_id)
        .maybeSingle();
      if (error) throw new CustomPatternsStoreError(`getPatternById failed: ${error.message}`, { cause: error });
      return data ? toPattern(data) : null;
    },

    async getPatternComponents(pattern_id: string): Promise<PatternComponent[]> {
      const { data, error } = await raw
        .from('pattern_components')
        .select(COMPONENT_COLS)
        .eq('pattern_id', pattern_id)
        .order('id', { ascending: true });
      if (error) throw new CustomPatternsStoreError(`getPatternComponents failed: ${error.message}`, { cause: error });
      return (data ?? []).map(toPatternComponent);
    },

    async listPatterns(organization_id: string): Promise<Pattern[]> {
      const { data, error } = await raw
        .from('org_patterns')
        .select(PATTERN_COLS)
        .eq('organization_id', organization_id)
        .order('created_at', { ascending: false });
      if (error) throw new CustomPatternsStoreError(`listPatterns failed: ${error.message}`, { cause: error });
      return (data ?? []).map(toPattern);
    },

    async updatePatternStatus(
      organization_id: string,
      pattern_id: string,
      status: PatternStatus,
    ): Promise<Pattern | null> {
      const { data, error } = await raw
        .from('org_patterns')
        .update({ status })
        .eq('organization_id', organization_id)
        .eq('id', pattern_id)
        .select(PATTERN_COLS)
        .maybeSingle();
      if (error) throw new CustomPatternsStoreError(`updatePatternStatus failed: ${error.message}`, { cause: error });
      return data ? toPattern(data) : null;
    },

    async deletePattern(organization_id: string, pattern_id: string): Promise<void> {
      const { error } = await raw
        .from('org_patterns')
        .delete()
        .eq('organization_id', organization_id)
        .eq('id', pattern_id);
      if (error) throw new CustomPatternsStoreError(`deletePattern failed: ${error.message}`, { cause: error });
    },

    async insertClassifier(row: InsertClassifierRow): Promise<CustomL3Classifier> {
      const { data, error } = await raw
        .from('org_custom_l3_classifiers')
        .insert(row)
        .select(CLASSIFIER_COLS)
        .single();
      if (error) throw new CustomPatternsStoreError(`insertClassifier failed: ${error.message}`, { cause: error });
      if (!data) throw new CustomPatternsStoreError('insertClassifier returned no row');
      return toClassifier(data);
    },

    async insertExamples(rows: InsertExampleRow[]): Promise<CustomL3Example[]> {
      if (rows.length === 0) return [];
      const { data, error } = await raw
        .from('org_custom_l3_examples')
        .insert(rows)
        .select(EXAMPLE_COLS);
      if (error) throw new CustomPatternsStoreError(`insertExamples failed: ${error.message}`, { cause: error });
      return (data ?? []).map(toExample);
    },

    async getClassifierById(
      organization_id: string,
      classifier_id: string,
    ): Promise<CustomL3Classifier | null> {
      const { data, error } = await raw
        .from('org_custom_l3_classifiers')
        .select(CLASSIFIER_COLS)
        .eq('organization_id', organization_id)
        .eq('id', classifier_id)
        .maybeSingle();
      if (error) throw new CustomPatternsStoreError(`getClassifierById failed: ${error.message}`, { cause: error });
      return data ? toClassifier(data) : null;
    },

    async getExamples(classifier_id: string): Promise<CustomL3Example[]> {
      const { data, error } = await raw
        .from('org_custom_l3_examples')
        .select(EXAMPLE_COLS)
        .eq('classifier_id', classifier_id)
        .order('id', { ascending: true });
      if (error) throw new CustomPatternsStoreError(`getExamples failed: ${error.message}`, { cause: error });
      return (data ?? []).map(toExample);
    },

    async listClassifiers(
      organization_id: string,
      status?: ClassifierStatus,
    ): Promise<CustomL3Classifier[]> {
      let q = raw
        .from('org_custom_l3_classifiers')
        .select(CLASSIFIER_COLS)
        .eq('organization_id', organization_id);
      if (status) q = q.eq('status', status);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw new CustomPatternsStoreError(`listClassifiers failed: ${error.message}`, { cause: error });
      return (data ?? []).map(toClassifier);
    },

    async countLiveClassifiers(organization_id: string): Promise<number> {
      const { count, error } = await raw
        .from('org_custom_l3_classifiers')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization_id)
        .eq('status', 'live');
      if (error) throw new CustomPatternsStoreError(`countLiveClassifiers failed: ${error.message}`, { cause: error });
      return count ?? 0;
    },

    async updateClassifier(
      organization_id: string,
      classifier_id: string,
      patch: ClassifierStatusPatch,
    ): Promise<CustomL3Classifier | null> {
      const { data, error } = await raw
        .from('org_custom_l3_classifiers')
        .update(patch)
        .eq('organization_id', organization_id)
        .eq('id', classifier_id)
        .select(CLASSIFIER_COLS)
        .maybeSingle();
      if (error) throw new CustomPatternsStoreError(`updateClassifier failed: ${error.message}`, { cause: error });
      return data ? toClassifier(data) : null;
    },

    async deleteClassifier(organization_id: string, classifier_id: string): Promise<void> {
      const { error } = await raw
        .from('org_custom_l3_classifiers')
        .delete()
        .eq('organization_id', organization_id)
        .eq('id', classifier_id);
      if (error) throw new CustomPatternsStoreError(`deleteClassifier failed: ${error.message}`, { cause: error });
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory fake (tests). Enforces the same organization_id scoping the
// Supabase implementation does, so the cross-org isolation tests are meaningful
// without a live database. It does NOT enforce DB-level UNIQUE / CHECK
// constraints (those are exercised by the M13 dry-run test and the
// application-layer validation in patterns.ts / classifiers.ts).
// ---------------------------------------------------------------------------

export function makeInMemoryCustomPatternsStore(): CustomPatternsStore {
  const patterns: Pattern[] = [];
  const components: PatternComponent[] = [];
  const classifiers: CustomL3Classifier[] = [];
  const examples: CustomL3Example[] = [];

  let uuidSeq = 0;
  let serialSeq = 0;
  let clock = 0;
  const nextUuid = (prefix: string): string => `${prefix}-${String(++uuidSeq).padStart(8, '0')}`;
  const nextSerial = (): number => ++serialSeq;
  // Deterministic, monotonically increasing ISO timestamps (no argless Date()).
  const nextTimestamp = (): string => new Date(1700000000000 + clock++ * 1000).toISOString();

  return {
    async insertPattern(row: InsertPatternRow): Promise<Pattern> {
      const created: Pattern = {
        id: nextUuid('pattern'),
        organization_id: row.organization_id,
        name: row.name,
        typology: row.typology,
        match_mode: row.match_mode,
        status: row.status,
        created_at: nextTimestamp(),
      };
      patterns.push(created);
      return { ...created };
    },

    async insertPatternComponents(rows: InsertPatternComponentRow[]): Promise<PatternComponent[]> {
      const created = rows.map((r) => {
        const c: PatternComponent = {
          id: nextSerial(),
          pattern_id: r.pattern_id,
          group_name: r.group_name,
          tag_id: r.tag_id,
          tag_source: r.tag_source,
          weight: r.weight,
          created_at: nextTimestamp(),
        };
        components.push(c);
        return { ...c };
      });
      return created;
    },

    async getPatternById(organization_id: string, pattern_id: string): Promise<Pattern | null> {
      const found = patterns.find(
        (p) => p.id === pattern_id && p.organization_id === organization_id,
      );
      return found ? { ...found } : null;
    },

    async getPatternComponents(pattern_id: string): Promise<PatternComponent[]> {
      return components
        .filter((c) => c.pattern_id === pattern_id)
        .sort((a, b) => a.id - b.id)
        .map((c) => ({ ...c }));
    },

    async listPatterns(organization_id: string): Promise<Pattern[]> {
      return patterns
        .filter((p) => p.organization_id === organization_id)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .map((p) => ({ ...p }));
    },

    async updatePatternStatus(
      organization_id: string,
      pattern_id: string,
      status: PatternStatus,
    ): Promise<Pattern | null> {
      const found = patterns.find(
        (p) => p.id === pattern_id && p.organization_id === organization_id,
      );
      if (!found) return null;
      found.status = status;
      return { ...found };
    },

    async deletePattern(organization_id: string, pattern_id: string): Promise<void> {
      for (let i = patterns.length - 1; i >= 0; i--) {
        const p = patterns[i];
        if (p && p.id === pattern_id && p.organization_id === organization_id) {
          patterns.splice(i, 1);
        }
      }
      for (let i = components.length - 1; i >= 0; i--) {
        const c = components[i];
        if (c && c.pattern_id === pattern_id) components.splice(i, 1);
      }
    },

    async insertClassifier(row: InsertClassifierRow): Promise<CustomL3Classifier> {
      const created: CustomL3Classifier = {
        id: nextUuid('classifier'),
        organization_id: row.organization_id,
        group_name: row.group_name,
        tag_name: row.tag_name,
        definition: row.definition,
        status: row.status,
        shadow_started_at: null,
        promoted_at: null,
        retired_at: null,
        created_by_user_id: row.created_by_user_id,
        created_at: nextTimestamp(),
      };
      classifiers.push(created);
      return { ...created };
    },

    async insertExamples(rows: InsertExampleRow[]): Promise<CustomL3Example[]> {
      return rows.map((r) => {
        const e: CustomL3Example = {
          id: nextSerial(),
          classifier_id: r.classifier_id,
          kind: r.kind,
          text: r.text,
          created_at: nextTimestamp(),
        };
        examples.push(e);
        return { ...e };
      });
    },

    async getClassifierById(
      organization_id: string,
      classifier_id: string,
    ): Promise<CustomL3Classifier | null> {
      const found = classifiers.find(
        (c) => c.id === classifier_id && c.organization_id === organization_id,
      );
      return found ? { ...found } : null;
    },

    async getExamples(classifier_id: string): Promise<CustomL3Example[]> {
      return examples
        .filter((e) => e.classifier_id === classifier_id)
        .sort((a, b) => a.id - b.id)
        .map((e) => ({ ...e }));
    },

    async listClassifiers(
      organization_id: string,
      status?: ClassifierStatus,
    ): Promise<CustomL3Classifier[]> {
      return classifiers
        .filter((c) => c.organization_id === organization_id && (!status || c.status === status))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .map((c) => ({ ...c }));
    },

    async countLiveClassifiers(organization_id: string): Promise<number> {
      return classifiers.filter(
        (c) => c.organization_id === organization_id && c.status === 'live',
      ).length;
    },

    async updateClassifier(
      organization_id: string,
      classifier_id: string,
      patch: ClassifierStatusPatch,
    ): Promise<CustomL3Classifier | null> {
      const found = classifiers.find(
        (c) => c.id === classifier_id && c.organization_id === organization_id,
      );
      if (!found) return null;
      if (patch.status !== undefined) found.status = patch.status;
      if (patch.shadow_started_at !== undefined) found.shadow_started_at = patch.shadow_started_at;
      if (patch.promoted_at !== undefined) found.promoted_at = patch.promoted_at;
      if (patch.retired_at !== undefined) found.retired_at = patch.retired_at;
      return { ...found };
    },

    async deleteClassifier(organization_id: string, classifier_id: string): Promise<void> {
      for (let i = classifiers.length - 1; i >= 0; i--) {
        const c = classifiers[i];
        if (c && c.id === classifier_id && c.organization_id === organization_id) {
          classifiers.splice(i, 1);
        }
      }
      for (let i = examples.length - 1; i >= 0; i--) {
        const e = examples[i];
        if (e && e.classifier_id === classifier_id) examples.splice(i, 1);
      }
    },
  };
}
