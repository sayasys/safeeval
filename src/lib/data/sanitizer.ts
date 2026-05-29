// Phase 1 placeholder. Real implementation lands in commit 3.
import type { SanitizeResult, V5Envelope } from './types';

export const SANITIZER_VERSION = '0.0.0-stub';

export async function sanitize(envelope: V5Envelope): Promise<SanitizeResult> {
  return {
    sanitized_envelope: envelope,
    redaction_log: {
      version: '1',
      sanitizer_version: SANITIZER_VERSION,
      total_redactions: 0,
      redactions: [],
    },
  };
}
