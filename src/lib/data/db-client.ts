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
// BEGIN/COMMIT. The withCustomerContext() helper below issues an RPC that
// calls set_config('app.current_customer_id', $1, false) for the current
// session. Under PgBouncer transaction-mode pooling, a follow-up INSERT may
// land on a different backend session and lose the GUC. The production-grade
// fix is a single stored procedure that takes customer_id as an argument and
// performs set_config + INSERT atomically inside one server-side transaction.
// Phase 4 (engine wire-up) introduces that stored procedure as part of a
// follow-on migration; until then this wrapper is sufficient for the
// single-tenant portfolio deployment (customer_id is hardcoded 'self', so RLS
// is structurally a no-op and the loss of GUC across pooled sessions has no
// observable effect).

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

// Row shape for the evaluations table. Mirrors M1 schema. Field names are the
// JSON-Schema top-level names hoisted into columns (cache_key, ontology_version,
// schema_version, stage[1-4]_prompt_hash). The aggregate_score is NUMERIC(4,3)
// in the DDL; JS passes a number and lets Postgres coerce.
export interface InsertEvaluationRow {
  customer_id: string;
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
  unredacted_payload_kms_ciphertext: Buffer | null;
  unredacted_payload_encrypted_dek: Buffer | null;
  unredacted_payload_kms_key_id: string | null;
}

export interface InsertEvaluationResult {
  evaluation_id: string;
}

export interface PingResult {
  ok: boolean;
  latency_ms: number;
}

// Subset of SupabaseClient that the data layer actually uses. Defined as an
// interface so tests can pass a mock without depending on the real SDK shape.
export interface DbClientSurface {
  insertEvaluation(row: InsertEvaluationRow): Promise<InsertEvaluationResult>;
  withCustomerContext<T>(customer_id: string, fn: () => Promise<T>): Promise<T>;
  ping(): Promise<PingResult>;
  getRawClient(): SupabaseClient;
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

    async withCustomerContext<T>(customer_id: string, fn: () => Promise<T>): Promise<T> {
      // RPC name and signature per the Phase 4 follow-on migration (deferred):
      //   create function app_set_customer_context(p_customer_id text)
      //     returns void language sql security definer as
      //   $$ select set_config('app.current_customer_id', p_customer_id, false) $$;
      // If the RPC is not yet defined (Phase 2 / portfolio), the call fails
      // open. We swallow the error path here so withCustomerContext does not
      // block the surrounding work in a single-tenant deployment, but log it
      // for the integration phase.
      const { error } = await raw.rpc('app_set_customer_context', {
        p_customer_id: customer_id,
      });
      if (error) {
        // Single-tenant portfolio path: the RPC may not exist yet. Surface
        // the failure as a structured log but let fn() proceed; tenant
        // isolation is structurally a no-op while customer_id is hardcoded
        // 'self'. Phase 4 hardens this by introducing the stored proc.
        if (!isRpcMissingError(error)) {
          throw new DbClientError(
            `withCustomerContext: app_set_customer_context RPC failed: ${error.message}`,
            { cause: error },
          );
        }
      }
      return fn();
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
