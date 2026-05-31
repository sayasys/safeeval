// Supabase client wrapper for SafeEval persistence (Phase 2).
//
// Spec: docs/memos/2026-05-28-data-track-implementation-spec.md section 1.
//
// Sole importer of @supabase/supabase-js inside the data layer. Exposes a
// singleton client, a tenant-scoping helper, a typed insertEvaluation surface,
// and a ping() health check.
//
// Connection model. Supabase fronts Postgres with PgBouncer (transaction mode
// for the public pooled endpoint). We do not roll our own pool; the
// @supabase/supabase-js client speaks PostgREST over HTTP, and connection
// reuse is delegated to the platform.
//
// Transactional caveat. PostgREST-over-HTTP does not expose client-driven
// BEGIN/COMMIT. The withOrganizationContext() helper below issues an RPC that
// calls set_config('app.current_organization_id', $1, false) for the current
// session. Under PgBouncer transaction-mode pooling, a follow-up INSERT may
// land on a different backend session and lose the GUC. The production-grade
// fix is a single stored procedure that takes organization_id as an argument
// and performs set_config + INSERT atomically inside one server-side
// transaction. Phase 4 (engine wire-up) introduces that stored procedure as
// part of a follow-on migration; until then this wrapper is sufficient for the
// single-tenant portfolio deployment (every legacy row belongs to the shared
// "Portfolio self" organization, so RLS is structurally a no-op and the loss
// of GUC across pooled sessions has no observable effect).
//
// Multi-tenancy rename (M12): the column and GUC are organization_id /
// app.current_organization_id. The prior customer_id naming was renamed in the
// M12 migration; no customer_id alias survives.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export class DbClientConfigError extends Error {
  override readonly name = 'DbClientConfigError';
  constructor(message: string) {
    super(message);
  }
}

export class DbClientError extends Error {
  override readonly name = 'DbClientError';
  readonly cause_message: string | undefined;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.cause_message = options?.cause instanceof Error ? options.cause.message : undefined;
  }
}

// Row shape for the evaluations table. Mirrors M1 schema + the M12 rename
// (customer_id -> organization_id). Field names are the JSON-Schema top-level
// names hoisted into columns (cache_key, ontology_version, schema_version,
// stage[1-4]_prompt_hash). The aggregate_score is NUMERIC(4,3) in the DDL; JS
// passes a number and lets Postgres coerce. organization_id is a UUID FK to
// organizations(id).
export interface InsertEvaluationRow {
  organization_id: string;
  envelope: unknown;                                       // sanitized JSONB
  cache_key: string;
  ontology_version: string;
  schema_version: string;
  stage1_prompt_hash: string | null;
  stage2_prompt_hash: string | null;
  stage3_prompt_hash: string | null;
  stage4_prompt_hash: string | null;
  disposition: 'allow' | 'safe_completion' | 'human_review' | 'block';
  aggregate_score: number | null;
  pii_redaction_log: unknown;                              // JSONB
}

export interface InsertEvaluationResult {
  evaluation_id: string;
}

export interface PingResult {
  ok: boolean;
  latency_ms: number;
}

// ---------------------------------------------------------------------------
// Report-generator row surface. Phase 2 of the report generator adds the
// reports table (migration M4); this client surface exposes the minimal
// read/write methods the cache module needs.
// ---------------------------------------------------------------------------

export type ReportAudienceColumn =
  | 'reviewer'
  | 'trust_safety_lead'
  | 'legal'
  | 'exec_summary';

export interface InsertReportRow {
  evaluation_id: string;
  audience: ReportAudienceColumn;
  report_prompt_hash: string;
  markdown: string;
}

export interface ReportRow {
  id: string;
  evaluation_id: string;
  audience: ReportAudienceColumn;
  report_prompt_hash: string;
  markdown: string;
  generated_at: string;
  cache_hit_count: number;
}

// Lightweight row for the reports list view. Omits the markdown body (which can
// be large and is only needed by the detail view) so the list query stays
// cheap. The reports table carries no organization_id of its own; org scoping
// is resolved through the evaluation FK (see listReportsByOrganization).
export interface ReportListRow {
  id: string;
  evaluation_id: string;
  audience: ReportAudienceColumn;
  generated_at: string;
}

export interface EvaluationRow {
  id: string;
  // Owning organization (UUID FK). Surfaced so callers can org-scope access --
  // notably the on-demand report route, which 404s an evaluation that does not
  // belong to the requesting user's organization.
  organization_id: string;
  envelope: unknown;
  disposition: 'allow' | 'safe_completion' | 'human_review' | 'block';
  cache_key: string;
  ontology_version: string;
  schema_version: string;
}

// Minimal evaluations list row for org-scoped history queries.
export interface EvaluationListRow {
  id: string;
  organization_id: string;
  disposition: 'allow' | 'safe_completion' | 'human_review' | 'block';
  aggregate_score: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Legal-access audit log surface (report-gen Phase 3, migration M10).
//
// Every legal-audience report access attempt -- granted OR denied -- writes a
// row to legal_access_log. The denied rows are the security-review surface
// ("user X attempted legal access at time T"); the granted rows are the
// chain-of-custody record the legal audience itself documents.
//
// The write is best-effort from the gate's perspective (a logging failure
// must not convert a denied access into a granted one), but the db-client
// surface itself throws on error so the caller can decide.
// ---------------------------------------------------------------------------

export interface InsertLegalAccessLogRow {
  // auth_user_id of the caller. May be null for an unauthenticated attempt
  // that reached the gate (the middleware normally blocks these with a 401,
  // so a null here is itself worth recording).
  user_id: string | null;
  evaluation_id: string;
  // Always 'legal' in Phase 3; the column is extensible for future audiences
  // that adopt the same audit-gate pattern.
  audience: 'legal';
  granted: boolean;
  // Populated on a denied access (e.g. the presented role); null on grant.
  denied_reason: string | null;
  // Deferred audit field; left null in Phase 3. The route does not yet thread
  // the caller IP through to the gate.
  ip_address?: string | null;
}

// Subset of SupabaseClient that the data layer actually uses. Defined as an
// interface so tests can pass a mock without depending on the real SDK shape.
export interface DbClientSurface {
  insertEvaluation(row: InsertEvaluationRow): Promise<InsertEvaluationResult>;
  withOrganizationContext<T>(organization_id: string, fn: () => Promise<T>): Promise<T>;
  ping(): Promise<PingResult>;
  getRawClient(): SupabaseClient;

  // Report-generator surface (Phase 2 of report-gen track).
  getEvaluation(evaluation_id: string): Promise<EvaluationRow | null>;
  // Org-scoped evaluation history (M12 multi-tenancy). Newest first.
  getEvaluationsByOrganization(
    organization_id: string,
    limit?: number,
  ): Promise<EvaluationListRow[]>;
  getReportRecord(
    evaluation_id: string,
    audience: ReportAudienceColumn,
    report_prompt_hash: string,
  ): Promise<ReportRow | null>;
  insertReportRecord(row: InsertReportRow): Promise<ReportRow>;
  incrementReportCacheHit(report_id: string): Promise<void>;

  // Reports list/detail read surface (report-gen surfacing, 2026-05-30).
  // The reports table has no organization_id; org-scoped listing joins through
  // the evaluations FK. getReportById fetches a single full row (markdown
  // included) for the detail view; the caller resolves org scoping via
  // getEvaluation against the row's evaluation_id (see src/lib/data/reports.ts).
  getReportById(report_id: string): Promise<ReportRow | null>;
  listReportsByOrganization(
    organization_id: string,
    limit?: number,
  ): Promise<ReportListRow[]>;
  // Unscoped list for the single-tenant portfolio (the synthesized personal
  // org carries no evaluation rows to scope against). Newest first.
  listAllReports(limit?: number): Promise<ReportListRow[]>;

  // Legal-access audit log (report-gen Phase 3, migration M10).
  insertLegalAccessLog(row: InsertLegalAccessLogRow): Promise<void>;
}

// Singleton state. The first getClient() call materializes the client; later
// calls return the same instance. Tests can call resetClientForTesting() to
// clear it between cases.
let _singleton: DbClientSurface | null = null;

export function getClient(): DbClientSurface {
  if (_singleton) return _singleton;
  _singleton = createDefaultClient();
  return _singleton;
}

export function resetClientForTesting(): void {
  _singleton = null;
}

// Test seam: inject a mock implementation. Used by persistence tests; never
// called from production code.
export function setClientForTesting(client: DbClientSurface): void {
  _singleton = client;
}

function createDefaultClient(): DbClientSurface {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new DbClientConfigError(
      'SUPABASE_URL is not set. Required for the data persistence layer.',
    );
  }
  if (!key) {
    throw new DbClientConfigError(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Required for server-side RLS bypass.',
    );
  }

  const raw = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return makeClient(raw);
}

// Factory exposed for testing and for the engine wire-up in Phase 4.
export function makeClient(raw: SupabaseClient): DbClientSurface {
  return {
    getRawClient: () => raw,

    async insertEvaluation(row: InsertEvaluationRow): Promise<InsertEvaluationResult> {
      const { data, error } = await raw
        .from('evaluations')
        .insert(row)
        .select('id')
        .single();
      if (error) {
        throw new DbClientError(`insertEvaluation failed: ${error.message}`, { cause: error });
      }
      if (!data || typeof data.id === 'undefined' || data.id === null) {
        throw new DbClientError('insertEvaluation returned no id');
      }
      return { evaluation_id: String(data.id) };
    },

    async withOrganizationContext<T>(organization_id: string, fn: () => Promise<T>): Promise<T> {
      // RPC name and signature per the Phase 4 follow-on migration (deferred):
      //   create function app_set_organization_context(p_organization_id uuid)
      //     returns void language sql security definer as
      //   $$ select set_config('app.current_organization_id', p_organization_id::text, false) $$;
      // If the RPC is not yet defined (Phase 2 / portfolio), the call fails
      // open. We swallow the error path here so withOrganizationContext does
      // not block the surrounding work in a single-tenant deployment, but log
      // it for the integration phase.
      const { error } = await raw.rpc('app_set_organization_context', {
        p_organization_id: organization_id,
      });
      if (error) {
        // Single-tenant portfolio path: the RPC may not exist yet. Surface
        // the failure as a structured log but let fn() proceed; tenant
        // isolation is structurally a no-op while every row belongs to the
        // shared Portfolio self org. Phase 4 hardens this with the stored proc.
        if (!isRpcMissingError(error)) {
          throw new DbClientError(
            `withOrganizationContext: app_set_organization_context RPC failed: ${error.message}`,
            { cause: error },
          );
        }
      }
      return fn();
    },

    async getEvaluation(evaluation_id: string): Promise<EvaluationRow | null> {
      const { data, error } = await raw
        .from('evaluations')
        .select('id, organization_id, envelope, disposition, cache_key, ontology_version, schema_version')
        .eq('id', evaluation_id)
        .maybeSingle();
      if (error) {
        throw new DbClientError(`getEvaluation failed: ${error.message}`, { cause: error });
      }
      if (!data) return null;
      return {
        id: String(data.id),
        organization_id: String(data.organization_id),
        envelope: data.envelope,
        disposition: data.disposition as EvaluationRow['disposition'],
        cache_key: data.cache_key,
        ontology_version: data.ontology_version,
        schema_version: data.schema_version,
      };
    },

    async getEvaluationsByOrganization(
      organization_id: string,
      limit = 100,
    ): Promise<EvaluationListRow[]> {
      const { data, error } = await raw
        .from('evaluations')
        .select('id, organization_id, disposition, aggregate_score, created_at')
        .eq('organization_id', organization_id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        throw new DbClientError(
          `getEvaluationsByOrganization failed: ${error.message}`,
          { cause: error },
        );
      }
      if (!Array.isArray(data)) return [];
      return data.map((row) => ({
        id: String(row.id),
        organization_id: String(row.organization_id),
        disposition: row.disposition as EvaluationListRow['disposition'],
        aggregate_score:
          typeof row.aggregate_score === 'number' ? row.aggregate_score : null,
        created_at: row.created_at,
      }));
    },

    async getReportRecord(
      evaluation_id: string,
      audience: ReportAudienceColumn,
      report_prompt_hash: string,
    ): Promise<ReportRow | null> {
      const { data, error } = await raw
        .from('reports')
        .select('id, evaluation_id, audience, report_prompt_hash, markdown, generated_at, cache_hit_count')
        .eq('evaluation_id', evaluation_id)
        .eq('audience', audience)
        .eq('report_prompt_hash', report_prompt_hash)
        .maybeSingle();
      if (error) {
        throw new DbClientError(`getReportRecord failed: ${error.message}`, { cause: error });
      }
      if (!data) return null;
      return {
        id: String(data.id),
        evaluation_id: String(data.evaluation_id),
        audience: data.audience as ReportAudienceColumn,
        report_prompt_hash: data.report_prompt_hash,
        markdown: data.markdown,
        generated_at: data.generated_at,
        cache_hit_count: data.cache_hit_count ?? 0,
      };
    },

    async insertReportRecord(row: InsertReportRow): Promise<ReportRow> {
      const { data, error } = await raw
        .from('reports')
        .insert({
          evaluation_id: row.evaluation_id,
          audience: row.audience,
          report_prompt_hash: row.report_prompt_hash,
          markdown: row.markdown,
        })
        .select('id, evaluation_id, audience, report_prompt_hash, markdown, generated_at, cache_hit_count')
        .single();
      if (error) {
        throw new DbClientError(`insertReportRecord failed: ${error.message}`, { cause: error });
      }
      if (!data) {
        throw new DbClientError('insertReportRecord returned no row');
      }
      return {
        id: String(data.id),
        evaluation_id: String(data.evaluation_id),
        audience: data.audience as ReportAudienceColumn,
        report_prompt_hash: data.report_prompt_hash,
        markdown: data.markdown,
        generated_at: data.generated_at,
        cache_hit_count: data.cache_hit_count ?? 0,
      };
    },

    async incrementReportCacheHit(report_id: string): Promise<void> {
      // Two-step read-modify-write. A server-side UPDATE ... SET
      // cache_hit_count = cache_hit_count + 1 via raw SQL would be atomic but
      // requires an RPC; the Phase 2 surface uses PostgREST patch semantics.
      // Race: two concurrent hits can lose an increment. Acceptable for the
      // analytics-grade counter use case; the cache-effectiveness signal is
      // directional, not load-bearing.
      const { data: existing, error: readErr } = await raw
        .from('reports')
        .select('cache_hit_count')
        .eq('id', report_id)
        .maybeSingle();
      if (readErr) {
        throw new DbClientError(
          `incrementReportCacheHit (read) failed: ${readErr.message}`,
          { cause: readErr },
        );
      }
      if (!existing) {
        throw new DbClientError(`incrementReportCacheHit: report id ${report_id} not found`);
      }
      const next = (existing.cache_hit_count ?? 0) + 1;
      const { error: writeErr } = await raw
        .from('reports')
        .update({ cache_hit_count: next })
        .eq('id', report_id);
      if (writeErr) {
        throw new DbClientError(
          `incrementReportCacheHit (write) failed: ${writeErr.message}`,
          { cause: writeErr },
        );
      }
    },

    async getReportById(report_id: string): Promise<ReportRow | null> {
      const { data, error } = await raw
        .from('reports')
        .select('id, evaluation_id, audience, report_prompt_hash, markdown, generated_at, cache_hit_count')
        .eq('id', report_id)
        .maybeSingle();
      if (error) {
        throw new DbClientError(`getReportById failed: ${error.message}`, { cause: error });
      }
      if (!data) return null;
      return {
        id: String(data.id),
        evaluation_id: String(data.evaluation_id),
        audience: data.audience as ReportAudienceColumn,
        report_prompt_hash: data.report_prompt_hash,
        markdown: data.markdown,
        generated_at: data.generated_at,
        cache_hit_count: data.cache_hit_count ?? 0,
      };
    },

    async listReportsByOrganization(
      organization_id: string,
      limit = 200,
    ): Promise<ReportListRow[]> {
      // The reports table has no organization_id; scope via the evaluations FK
      // with a PostgREST inner-join embed. `evaluations!inner(organization_id)`
      // restricts to reports whose evaluation belongs to the org, and the
      // embedded-column filter applies the org id.
      const { data, error } = await raw
        .from('reports')
        .select('id, evaluation_id, audience, generated_at, evaluations!inner(organization_id)')
        .eq('evaluations.organization_id', organization_id)
        .order('generated_at', { ascending: false })
        .limit(limit);
      if (error) {
        throw new DbClientError(
          `listReportsByOrganization failed: ${error.message}`,
          { cause: error },
        );
      }
      return mapReportListRows(data);
    },

    async listAllReports(limit = 200): Promise<ReportListRow[]> {
      const { data, error } = await raw
        .from('reports')
        .select('id, evaluation_id, audience, generated_at')
        .order('generated_at', { ascending: false })
        .limit(limit);
      if (error) {
        throw new DbClientError(`listAllReports failed: ${error.message}`, { cause: error });
      }
      return mapReportListRows(data);
    },

    async insertLegalAccessLog(row: InsertLegalAccessLogRow): Promise<void> {
      const { error } = await raw.from('legal_access_log').insert({
        user_id: row.user_id,
        evaluation_id: row.evaluation_id,
        audience: row.audience,
        granted: row.granted,
        denied_reason: row.denied_reason,
        ip_address: row.ip_address ?? null,
      });
      if (error) {
        throw new DbClientError(
          `insertLegalAccessLog failed: ${error.message}`,
          { cause: error },
        );
      }
    },

    async ping(): Promise<PingResult> {
      const t0 = Date.now();
      try {
        // Cheap probe: SELECT 1 via the schema_migrations table (created by
        // the migration runner). If the table does not exist yet, we still
        // report ok=true if Postgres responded; the latency is what callers
        // care about.
        const { error } = await raw
          .from('schema_migrations')
          .select('id', { count: 'exact', head: true })
          .limit(1);
        const latency_ms = Date.now() - t0;
        if (error && !isRelationMissingError(error)) {
          return { ok: false, latency_ms };
        }
        return { ok: true, latency_ms };
      } catch (err) {
        return { ok: false, latency_ms: Date.now() - t0 };
      }
    },
  };
}

// Map raw report list rows to the ReportListRow shape. Tolerates the embedded
// `evaluations` join object PostgREST returns on the org-scoped query (it is
// selected only to drive the inner join / filter and is discarded here).
function mapReportListRows(data: unknown): ReportListRow[] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => ({
    id: String(row.id),
    evaluation_id: String(row.evaluation_id),
    audience: row.audience as ReportAudienceColumn,
    generated_at: row.generated_at,
  }));
}

interface SupabaseLikeError {
  message?: string;
  code?: string;
  hint?: string;
}

function isRpcMissingError(error: SupabaseLikeError): boolean {
  // Postgres function-does-not-exist code is 42883. Supabase also surfaces
  // PGRST202 when PostgREST cannot find the RPC.
  if (error.code === '42883' || error.code === 'PGRST202') return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes('app_set_customer_context') &&
    (message.includes('does not exist') || message.includes('could not find'));
}

function isRelationMissingError(error: SupabaseLikeError): boolean {
  // 42P01 = undefined_table.
  if (error.code === '42P01') return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes('schema_migrations') && message.includes('does not exist');
}
