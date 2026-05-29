// Fine-tuning corpus export -- Phase 2.
//
// Spec: docs/memos/2026-05-28-classifier-feedback-loop-scoping.md section 9.
//
// Every classifier_edits row, joined to its upstream evaluations row, becomes
// one JSONL training tuple:
//   { input, original_output, corrected_output, rationale, audit_metadata }
// where original_output is the engine's emitted envelope and corrected_output
// is that envelope with the reviewer's edit applied at field_path.
//
// Two fine-tuning targets (same export shape, different field_path filter):
//   - stage2: discriminator fine-tuning (L1 / L2 / L3 assignment fields).
//   - stage4: cascade fine-tuning (disposition + evidence/component-score fields).
// The field_path partition lives in store.ts (STAGE2_FIELD_PATHS /
// STAGE4_FIELD_PATHS).
//
// Gating: SAFEEVAL_CORPUS_EXPORT_ENABLED=true. The corpus is a sensitive
// artifact (section 9 / section 13 M5 layer 3 mitigation) -- a misconfigured
// export to a third party is unrecoverable -- so the entry point throws
// ExportGatedError when the flag is unset. PII posture: the export reads
// sanitized envelopes only (PrePersistSanitizer ran before the envelope landed
// in evaluations) and never touches any unredacted surface.
//
// Streaming: rows are read from the store in pages (afterId cursor) and written
// line-by-line via fs.createWriteStream, so a large corpus never materializes
// in memory.

import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getFeedbackStore,
  type CorpusRecordRow,
  type CorpusTarget,
  type FeedbackStore,
} from './store';
import { normalizeFieldPath } from './types';

const CORPUS_EXPORT_FLAG = 'SAFEEVAL_CORPUS_EXPORT_ENABLED';

export function corpusExportEnabled(): boolean {
  return process.env[CORPUS_EXPORT_FLAG] === 'true';
}

export class ExportGatedError extends Error {
  override readonly name = 'ExportGatedError';
  constructor() {
    super(
      `Corpus export is gated. Set ${CORPUS_EXPORT_FLAG}=true to enable. The ` +
        `fine-tuning corpus is a sensitive artifact (scoping memo section 9); ` +
        `default-deny gating prevents an accidental export to a third party.`,
    );
  }
}

export const DEFAULT_PAGE_SIZE = 500;

export interface ExportOptions {
  target: CorpusTarget;
  // Directory the JSONL file is written into. Created if missing. Defaults to
  // outputs/corpus under the process CWD.
  output_dir?: string;
  // Full output path override (takes precedence over output_dir + generated
  // name). Tests pass this to read the file back deterministically.
  output_path?: string;
  // Rows fetched per store page. Lower bounds memory; higher bounds round trips.
  page_size?: number;
  store?: FeedbackStore;
}

export interface ExportResult {
  record_count: number;
  total_size_bytes: number;
  file_path: string;
}

// One JSONL record per scoping memo section 9 / Phase 2 dispatch shape.
export interface CorpusRecord {
  input: unknown;
  original_output: unknown;
  corrected_output: unknown;
  rationale: {
    tag: string;
    text: string | null;
    editor_role: string;
  };
  audit_metadata: {
    evaluation_id: string;
    edit_id: number;
    prompt_hashes: {
      cache_key: string | null;
      stage1_prompt_hash: string | null;
      stage2_prompt_hash: string | null;
      stage3_prompt_hash: string | null;
      stage4_prompt_hash: string | null;
    };
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Parse a reason_codes[N] field path into its index, or null for other paths.
function reasonCodeIndex(fieldPath: string): number | null {
  const m = /^reason_codes\[([0-9]+)\]$/.exec(fieldPath);
  return m && m[1] !== undefined ? Number(m[1]) : null;
}

// Produce corrected_output: a deep clone of the envelope with the reviewer's
// edit applied at field_path. add/modify set the slot to after_value; remove
// clears it (splice for an indexed reason code, null for a scalar field). The
// envelope is treated structurally; an unresolvable path leaves the clone
// unchanged (the original_output still carries the full provenance).
export function applyEdit(
  envelope: unknown,
  field_path: string,
  change_type: string,
  after_value: unknown,
): unknown {
  // structuredClone is available in Node 18+ (the runtime target).
  const clone = isObject(envelope) || Array.isArray(envelope)
    ? (structuredClone(envelope) as unknown)
    : envelope;

  const idx = reasonCodeIndex(field_path);
  if (idx !== null) {
    if (!isObject(clone)) return clone;
    const arr = clone['reason_codes'];
    if (!Array.isArray(arr)) {
      if (change_type === 'remove') return clone;
      clone['reason_codes'] = [];
    }
    const target = clone['reason_codes'] as unknown[];
    if (change_type === 'remove') {
      if (idx >= 0 && idx < target.length) target.splice(idx, 1);
    } else {
      target[idx] = after_value;
    }
    return clone;
  }

  // Dotted path traversal for the remaining closed-set fields. normalizeFieldPath
  // is a no-op for non-indexed paths but keeps the contract explicit.
  const segments = normalizeFieldPath(field_path).split('.');
  if (!isObject(clone)) return clone;
  let cursor: Record<string, unknown> = clone;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg === undefined) return clone;
    const next = cursor[seg];
    if (!isObject(next)) {
      // Create the intermediate object so add/modify can land the value.
      if (change_type === 'remove') return clone;
      const created: Record<string, unknown> = {};
      cursor[seg] = created;
      cursor = created;
    } else {
      cursor = next;
    }
  }
  const leaf = segments[segments.length - 1];
  if (leaf === undefined) return clone;
  if (change_type === 'remove') {
    cursor[leaf] = null;
  } else {
    cursor[leaf] = after_value;
  }
  return clone;
}

function toRecord(row: CorpusRecordRow): CorpusRecord {
  const envelope = row.envelope;
  const input = isObject(envelope) ? (envelope['input'] ?? null) : null;
  const corrected_output = applyEdit(
    envelope,
    row.field_path,
    row.change_type,
    row.after_value,
  );
  return {
    input,
    original_output: envelope,
    corrected_output,
    rationale: {
      tag: row.rationale_tag,
      text: row.rationale_text,
      editor_role: row.editor_role,
    },
    audit_metadata: {
      evaluation_id: row.evaluation_id,
      edit_id: row.edit_id,
      prompt_hashes: {
        cache_key: row.cache_key,
        stage1_prompt_hash: row.stage1_prompt_hash,
        stage2_prompt_hash: row.stage2_prompt_hash,
        stage3_prompt_hash: row.stage3_prompt_hash,
        stage4_prompt_hash: row.stage4_prompt_hash,
      },
    },
  };
}

// Generate a default filename. A coarse timestamp keeps successive exports from
// clobbering each other; tests pass output_path to avoid the timestamp.
function defaultFileName(target: CorpusTarget): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `feedback-corpus-${target}-${stamp}.jsonl`;
}

export async function exportFineTuningCorpus(
  options: ExportOptions,
): Promise<ExportResult> {
  if (!corpusExportEnabled()) {
    throw new ExportGatedError();
  }

  const store = options.store ?? getFeedbackStore();
  const pageSize = options.page_size ?? DEFAULT_PAGE_SIZE;

  let filePath: string;
  if (options.output_path) {
    filePath = options.output_path;
  } else {
    const dir = options.output_dir ?? join(process.cwd(), 'outputs', 'corpus');
    await mkdir(dir, { recursive: true });
    filePath = join(dir, defaultFileName(options.target));
  }

  const stream = createWriteStream(filePath, { encoding: 'utf8' });

  // Write one line, respecting backpressure.
  const writeLine = (line: string): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => reject(err);
      stream.once('error', onError);
      const ok = stream.write(line, () => {
        stream.removeListener('error', onError);
        resolve();
      });
      if (!ok) {
        // Wait for drain before resolving so the buffer does not grow unbounded.
        stream.once('drain', () => {
          stream.removeListener('error', onError);
          resolve();
        });
      }
    });

  let record_count = 0;
  let total_size_bytes = 0;
  let afterId = 0;

  try {
    for (;;) {
      const page = await store.queryCorpusRecords(options.target, afterId, pageSize);
      if (page.length === 0) break;
      for (const row of page) {
        const line = JSON.stringify(toRecord(row)) + '\n';
        total_size_bytes += Buffer.byteLength(line, 'utf8');
        await writeLine(line);
        record_count += 1;
        if (row.edit_id > afterId) afterId = row.edit_id;
      }
      if (page.length < pageSize) break;
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      stream.once('error', reject);
      stream.end(() => resolve());
    });
  }

  return { record_count, total_size_bytes, file_path: filePath };
}
