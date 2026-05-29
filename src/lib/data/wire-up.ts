// Engine -> persistence wire-up helper (Phase 4).
//
// Spec: docs/memos/2026-05-28-data-track-implementation-spec.md sections 1, 5.
// Section 1 reserves persistence integration to the API route layer (the engine
// in src/lib/safeeval-v5.js remains persistence-agnostic). Section 5 names
// fire-and-forget semantics: the user-visible response must never be blocked
// by persistence failures.
//
// Phase 4 ships persistence dark behind SAFEEVAL_PERSIST_EVALUATIONS. With the
// flag off (the default everywhere -- local dev, CI, current Vercel), this is
// a no-op. With the flag on, the v5 envelope and raw input are written to the
// evaluations table via persistEvaluation(). On success, the canonical DB id
// is attached to v5Result.evaluation_id. On failure, the error is logged and
// the field is omitted -- no null sentinel that downstream callers would have
// to special-case.
//
// KMS remains stubbed (Phase 3 deferred per Steven's call on 2026-05-28). The
// kms.skip=true option in persistEvaluation stores a null ciphertext column;
// when Phase 3 lands we flip the option and the encrypted DEK bundle is written.

import { persistEvaluation } from './persistence';
import type { V5Envelope } from './types';

// Extend the engine envelope shape with the post-persist id. The engine never
// emits evaluation_id; only the persistence wire-up does. Keeping this type
// here (not in types.ts) makes it explicit that the field is added by the
// route layer, not the engine.
export interface V5EnvelopeWithPersistedId extends V5Envelope {
  evaluation_id?: string;
}

const PERSIST_FLAG = 'SAFEEVAL_PERSIST_EVALUATIONS';

export function persistEvaluationsEnabled(): boolean {
  return process.env[PERSIST_FLAG] === 'true';
}

export async function maybePersistEvaluation(
  rawInput: string,
  v5Result: V5EnvelopeWithPersistedId,
): Promise<void> {
  if (!persistEvaluationsEnabled()) return;
  try {
    const { evaluation_id } = await persistEvaluation(v5Result, rawInput, {
      kms: { skip: true },
    });
    if (evaluation_id) v5Result.evaluation_id = evaluation_id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('persistEvaluation failed:', message);
  }
}
