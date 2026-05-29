// Report-generator public API, Phase 1.
//
// Phase 1 exports type definitions and constants only. Runtime entry points
// (generateReport, getReport) land in Phase 2 (cache + dispatcher) and
// Phase 3 (auth-gate + HTTP route) per
// docs/memos/2026-05-28-report-generator-implementation-spec.md section 13.

export type {
  Audience,
  DeferredAudience,
  ImplementedAudience,
  ReportRecord,
  GenerationOptions,
  CacheKey,
  PromptTemplate,
} from './types';

export { DEFERRED_AUDIENCES, IMPLEMENTED_AUDIENCES } from './types';
