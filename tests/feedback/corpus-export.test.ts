// Tests for the fine-tuning corpus export (Phase 2).
//
// Coverage:
//   - Gating: exportFineTuningCorpus throws ExportGatedError when the flag is
//     off (no DB touch).
//   - JSONL shape: each line carries input / original_output /
//     corrected_output / rationale / audit_metadata per scoping memo section 9.
//   - applyEdit produces corrected_output for dotted, component-score, and
//     indexed reason-code paths.
//   - Stage 2 vs Stage 4 field-path partition (corpusFieldPaths) and the
//     target threaded to the store.
//   - Streaming pagination across multiple store pages.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  exportFineTuningCorpus,
  ExportGatedError,
  applyEdit,
} from '../../src/lib/feedback/corpus-export';
import {
  corpusFieldPaths,
  STAGE2_FIELD_PATHS,
  STAGE4_FIELD_PATHS,
  type FeedbackStore,
  type CorpusRecordRow,
  type CorpusTarget,
} from '../../src/lib/feedback/store';

function makeRow(over: Partial<CorpusRecordRow> = {}): CorpusRecordRow {
  return {
    edit_id: 1,
    evaluation_id: 'eval_1',
    field_path: 'l1.category',
    change_type: 'modify',
    before_value: 'fraud_financial',
    after_value: 'fraud_identity',
    rationale_tag: 'wrong_l1_category',
    rationale_text: 'misrouted domain',
    editor_role: 'senior_reviewer',
    envelope: {
      input: { kind: 'prompt', text: 'a prompt' },
      l1: { category: 'fraud_financial' },
      disposition: { action: 'allow' },
      reason_codes: ['rc_a', 'rc_b'],
    },
    cache_key: 'stage2:v5.1:sha256:' + 'a'.repeat(64),
    stage1_prompt_hash: 'b'.repeat(64),
    stage2_prompt_hash: 'c'.repeat(64),
    stage3_prompt_hash: 'd'.repeat(64),
    stage4_prompt_hash: 'e'.repeat(64),
    ...over,
  };
}

// Mock store that serves a fixed set of rows for the given target, paginated by
// the afterId cursor + limit.
function makeMockStore(rowsByTarget: Partial<Record<CorpusTarget, CorpusRecordRow[]>>): {
  store: FeedbackStore;
  calls: { target: CorpusTarget; afterId: number; limit: number }[];
} {
  const calls: { target: CorpusTarget; afterId: number; limit: number }[] = [];
  const store: FeedbackStore = {
    queryPendingEdits: async () => [],
    queryCoverageGapEdits: async () => [],
    insertAggregatedProposal: async () => ({ id: 1 }),
    insertArchitectInboxEntry: async () => ({ id: 1 }),
    markEditsAggregated: async () => {},
    queryCorpusRecords: async (target, afterId, limit) => {
      calls.push({ target, afterId, limit });
      const all = (rowsByTarget[target] ?? []).filter((r) => r.edit_id > afterId);
      return all.slice(0, limit);
    },
  };
  return { store, calls };
}

let workdir: string;

beforeEach(() => {
  vi.unstubAllEnvs();
  workdir = mkdtempSync(join(tmpdir(), 'safeeval-corpus-'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(workdir, { recursive: true, force: true });
});

describe('exportFineTuningCorpus -- gating', () => {
  it('throws ExportGatedError when the flag is off', async () => {
    vi.stubEnv('SAFEEVAL_CORPUS_EXPORT_ENABLED', 'false');
    const { store, calls } = makeMockStore({ stage2: [makeRow()] });
    await expect(
      exportFineTuningCorpus({ target: 'stage2', store, output_dir: workdir }),
    ).rejects.toBeInstanceOf(ExportGatedError);
    // No DB touch when gated.
    expect(calls).toHaveLength(0);
  });
});

describe('exportFineTuningCorpus -- JSONL shape', () => {
  beforeEach(() => {
    vi.stubEnv('SAFEEVAL_CORPUS_EXPORT_ENABLED', 'true');
  });

  it('writes one JSONL line per record with the section-9 shape', async () => {
    const { store } = makeMockStore({ stage2: [makeRow()] });
    const outPath = join(workdir, 'stage2.jsonl');
    const result = await exportFineTuningCorpus({
      target: 'stage2',
      store,
      output_path: outPath,
    });

    expect(result.record_count).toBe(1);
    expect(result.file_path).toBe(outPath);
    expect(result.total_size_bytes).toBeGreaterThan(0);

    const lines = readFileSync(outPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const rec = JSON.parse(lines[0]!);

    expect(rec.input).toEqual({ kind: 'prompt', text: 'a prompt' });
    expect(rec.original_output.l1.category).toBe('fraud_financial');
    // corrected_output applies the edit (before -> after) at field_path.
    expect(rec.corrected_output.l1.category).toBe('fraud_identity');
    expect(rec.rationale).toEqual({
      tag: 'wrong_l1_category',
      text: 'misrouted domain',
      editor_role: 'senior_reviewer',
    });
    expect(rec.audit_metadata.evaluation_id).toBe('eval_1');
    expect(rec.audit_metadata.edit_id).toBe(1);
    expect(rec.audit_metadata.prompt_hashes.stage2_prompt_hash).toBe('c'.repeat(64));
    expect(rec.audit_metadata.prompt_hashes.cache_key).toMatch(/^stage2:/);
  });

  it('streams across multiple store pages', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeRow({ edit_id: i + 1 }));
    const { store, calls } = makeMockStore({ stage2: rows });
    const outPath = join(workdir, 'paged.jsonl');
    const result = await exportFineTuningCorpus({
      target: 'stage2',
      store,
      output_path: outPath,
      page_size: 2,
    });
    expect(result.record_count).toBe(5);
    // 2 + 2 + 1 -> three pages; the third (size 1 < page_size) ends the loop.
    expect(calls.map((c) => c.afterId)).toEqual([0, 2, 4]);
    const lines = readFileSync(outPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(5);
  });
});

describe('exportFineTuningCorpus -- target partition', () => {
  beforeEach(() => {
    vi.stubEnv('SAFEEVAL_CORPUS_EXPORT_ENABLED', 'true');
  });

  it('threads the target to the store query', async () => {
    const { store, calls } = makeMockStore({ stage4: [makeRow({ field_path: 'disposition.action' })] });
    await exportFineTuningCorpus({
      target: 'stage4',
      store,
      output_path: join(workdir, 'stage4.jsonl'),
    });
    expect(calls[0]!.target).toBe('stage4');
  });

  it('corpusFieldPaths returns the stage-specific closed sets', () => {
    expect(corpusFieldPaths('stage2')).toBe(STAGE2_FIELD_PATHS);
    expect(corpusFieldPaths('stage4')).toBe(STAGE4_FIELD_PATHS);
    expect(STAGE2_FIELD_PATHS).toContain('l1.category');
    expect(STAGE2_FIELD_PATHS).not.toContain('disposition.action');
    expect(STAGE4_FIELD_PATHS).toContain('disposition.action');
    expect(STAGE4_FIELD_PATHS).toContain('evidence.component_scores.lure');
    expect(STAGE4_FIELD_PATHS).not.toContain('l1.category');
  });
});

describe('applyEdit', () => {
  const envelope = {
    l1: { category: 'fraud_financial' },
    evidence: { component_scores: { lure: 3 } },
    disposition: { action: 'allow' },
    reason_codes: ['rc_a', 'rc_b', 'rc_c'],
  };

  it('modifies a nested dotted path without mutating the original', () => {
    const out = applyEdit(envelope, 'evidence.component_scores.lure', 'modify', 7) as Record<string, any>;
    expect(out.evidence.component_scores.lure).toBe(7);
    expect(envelope.evidence.component_scores.lure).toBe(3); // original untouched
  });

  it('modifies a top-level closed-set field', () => {
    const out = applyEdit(envelope, 'l1.category', 'modify', 'fraud_identity') as Record<string, any>;
    expect(out.l1.category).toBe('fraud_identity');
  });

  it('sets an indexed reason code on add/modify', () => {
    const out = applyEdit(envelope, 'reason_codes[1]', 'modify', 'rc_x') as Record<string, any>;
    expect(out.reason_codes).toEqual(['rc_a', 'rc_x', 'rc_c']);
  });

  it('splices an indexed reason code on remove', () => {
    const out = applyEdit(envelope, 'reason_codes[1]', 'remove', null) as Record<string, any>;
    expect(out.reason_codes).toEqual(['rc_a', 'rc_c']);
  });

  it('nulls a scalar field on remove', () => {
    const out = applyEdit(envelope, 'disposition.action', 'remove', null) as Record<string, any>;
    expect(out.disposition.action).toBeNull();
  });
});
