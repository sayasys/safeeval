import { describe, it, expect } from 'vitest';
import {
  sanitize,
  SANITIZER_VERSION,
} from '../../src/lib/data/sanitizer';
import type { V5Envelope } from '../../src/lib/data/types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function promptEnvelope(text: string): V5Envelope {
  return {
    schema_version: '5.1',
    ontology_version: '5.1',
    evaluated_at: '2026-05-28T00:00:00Z',
    model_pipeline: ['stage-1'],
    prompt_length: text.length,
    input: { kind: 'prompt', text },
    disposition: { action: 'allow', confidence: 1 },
    evidence: { aggregate_score: 0 },
  };
}

function conversationEnvelope(turns: { sender: string; text: string }[]): V5Envelope {
  return {
    schema_version: '5.1',
    ontology_version: '5.1',
    evaluated_at: '2026-05-28T00:00:00Z',
    model_pipeline: ['stage-1'],
    prompt_length: turns.reduce((acc, t) => acc + t.text.length, 0),
    input: {
      kind: 'conversation',
      conversation: {
        modality: 'text',
        turns,
        parse_confidence: 1,
        parse_warnings: [],
      },
    },
    disposition: { action: 'allow', confidence: 1 },
    evidence: { aggregate_score: 0 },
  };
}

function getPromptText(envelope: V5Envelope): string {
  if (envelope.input?.kind !== 'prompt') throw new Error('not a prompt envelope');
  return envelope.input.text;
}

// ---------------------------------------------------------------------------
// Per-type fixtures (>= 6 PII types per dispatch)
// ---------------------------------------------------------------------------

describe('sanitizer: per-type regex coverage', () => {
  it('redacts EMAIL', async () => {
    const env = promptEnvelope('Send to alice@example.com for confirmation.');
    const result = await sanitize(env);
    expect(getPromptText(result.sanitized_envelope)).toBe(
      'Send to <EMAIL_1> for confirmation.',
    );
    expect(result.redaction_log.total_redactions).toBe(1);
    expect(result.redaction_log.redactions[0]).toMatchObject({
      type: 'EMAIL',
      field_path: 'input.text',
      placeholder: '<EMAIL_1>',
      source: 'regex',
    });
  });

  it('redacts PHONE (NANP)', async () => {
    const env = promptEnvelope('Call me at (555) 123-4567 tonight.');
    const result = await sanitize(env);
    expect(getPromptText(result.sanitized_envelope)).toBe(
      'Call me at <PHONE_1> tonight.',
    );
    const entry = result.redaction_log.redactions[0];
    expect(entry?.type).toBe('PHONE');
    expect(entry?.placeholder).toBe('<PHONE_1>');
  });

  it('redacts SSN (dashed)', async () => {
    const env = promptEnvelope('SSN: 123-45-6789.');
    const result = await sanitize(env);
    expect(getPromptText(result.sanitized_envelope)).toBe('SSN: <SSN_1>.');
    expect(result.redaction_log.redactions[0]?.type).toBe('SSN');
  });

  it('redacts CREDIT_CARD with valid Luhn', async () => {
    // 4111 1111 1111 1111 is the canonical Visa test PAN; passes Luhn.
    const env = promptEnvelope('Charge 4111 1111 1111 1111 today.');
    const result = await sanitize(env);
    expect(getPromptText(result.sanitized_envelope)).toBe(
      'Charge <CREDIT_CARD_1> today.',
    );
    expect(result.redaction_log.redactions[0]?.type).toBe('CREDIT_CARD');
  });

  it('rejects CREDIT_CARD candidates that fail Luhn', async () => {
    // 1234 5678 9012 3456 fails Luhn; must NOT be redacted.
    const env = promptEnvelope('Charge 1234 5678 9012 3456 today.');
    const result = await sanitize(env);
    expect(getPromptText(result.sanitized_envelope)).toBe(
      'Charge 1234 5678 9012 3456 today.',
    );
    expect(result.redaction_log.total_redactions).toBe(0);
  });

  it('redacts IBAN with valid mod-97', async () => {
    // DE89370400440532013000 is a published valid German IBAN test vector.
    const env = promptEnvelope('Send EUR to DE89370400440532013000 today.');
    const result = await sanitize(env);
    expect(getPromptText(result.sanitized_envelope)).toBe(
      'Send EUR to <IBAN_1> today.',
    );
    expect(result.redaction_log.redactions[0]?.type).toBe('IBAN');
  });

  it('rejects IBAN candidates that fail mod-97', async () => {
    const env = promptEnvelope('Send EUR to DE00000000000000000000 today.');
    const result = await sanitize(env);
    expect(getPromptText(result.sanitized_envelope)).toBe(
      'Send EUR to DE00000000000000000000 today.',
    );
    expect(result.redaction_log.total_redactions).toBe(0);
  });

  it('redacts OTP with context anchor (digit span only)', async () => {
    const env = promptEnvelope('Your verification code: 482910 expires soon.');
    const result = await sanitize(env);
    expect(getPromptText(result.sanitized_envelope)).toBe(
      'Your verification code: <OTP_1> expires soon.',
    );
    const entry = result.redaction_log.redactions[0];
    expect(entry?.type).toBe('OTP');
    expect(entry?.original_length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Co-reference preservation (per spec section 3 step 4)
// ---------------------------------------------------------------------------

describe('sanitizer: co-reference preservation', () => {
  it('same email twice maps to the same placeholder', async () => {
    const env = promptEnvelope(
      'Mail alice@example.com, then call alice@example.com to confirm.',
    );
    const result = await sanitize(env);
    expect(getPromptText(result.sanitized_envelope)).toBe(
      'Mail <EMAIL_1>, then call <EMAIL_1> to confirm.',
    );
    expect(result.redaction_log.total_redactions).toBe(2);
    expect(result.redaction_log.redactions.every((r) => r.placeholder === '<EMAIL_1>')).toBe(true);
  });

  it('two distinct emails get sequential placeholders', async () => {
    const env = promptEnvelope('Email alice@example.com and bob@example.com today.');
    const result = await sanitize(env);
    expect(getPromptText(result.sanitized_envelope)).toBe(
      'Email <EMAIL_1> and <EMAIL_2> today.',
    );
    const placeholders = result.redaction_log.redactions.map((r) => r.placeholder);
    expect(placeholders).toEqual(['<EMAIL_1>', '<EMAIL_2>']);
  });

  it('canonicalizes case for email co-reference', async () => {
    const env = promptEnvelope(
      'Send to Alice@Example.com, then call alice@example.com.',
    );
    const result = await sanitize(env);
    expect(getPromptText(result.sanitized_envelope)).toBe(
      'Send to <EMAIL_1>, then call <EMAIL_1>.',
    );
    expect(result.redaction_log.total_redactions).toBe(2);
  });

  it('co-references across conversation turns share the placeholder map', async () => {
    const env = conversationEnvelope([
      { sender: 'attacker', text: 'Reach me at alice@example.com.' },
      { sender: 'victim', text: 'Was it alice@example.com?' },
    ]);
    const result = await sanitize(env);
    if (result.sanitized_envelope.input?.kind !== 'conversation') {
      throw new Error('expected conversation envelope');
    }
    const turns = result.sanitized_envelope.input.conversation.turns;
    expect(turns[0]?.text).toBe('Reach me at <EMAIL_1>.');
    expect(turns[1]?.text).toBe('Was it <EMAIL_1>?');
    expect(result.redaction_log.total_redactions).toBe(2);
    expect(result.redaction_log.redactions.map((r) => r.field_path)).toEqual([
      'input.conversation.turns[0].text',
      'input.conversation.turns[1].text',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Redaction log shape + offset accuracy
// ---------------------------------------------------------------------------

describe('sanitizer: redaction log accuracy', () => {
  it('log offsets index the original (raw) field text', async () => {
    const raw = 'Send to alice@example.com today.';
    const env = promptEnvelope(raw);
    const result = await sanitize(env);
    const entry = result.redaction_log.redactions[0];
    expect(entry).toBeDefined();
    const start = entry!.original_offset;
    const len = entry!.original_length;
    expect(raw.slice(start, start + len)).toBe('alice@example.com');
  });

  it('multiple redactions in one field carry independent offsets into the raw text', async () => {
    const raw = 'Email alice@example.com and bob@example.com today.';
    const env = promptEnvelope(raw);
    const result = await sanitize(env);
    expect(result.redaction_log.redactions).toHaveLength(2);
    for (const entry of result.redaction_log.redactions) {
      const slice = raw.slice(entry.original_offset, entry.original_offset + entry.original_length);
      expect(slice).toMatch(/^[a-z]+@example\.com$/);
    }
  });

  it('emits the canonical log envelope shape', async () => {
    const env = promptEnvelope('No PII here.');
    const result = await sanitize(env);
    expect(result.redaction_log).toEqual({
      version: '1',
      sanitizer_version: SANITIZER_VERSION,
      total_redactions: 0,
      redactions: [],
    });
  });

  it('attaches a confidence score and source tag per entry', async () => {
    const env = promptEnvelope('Charge 4111 1111 1111 1111 today.');
    const result = await sanitize(env);
    const entry = result.redaction_log.redactions[0];
    expect(entry?.confidence).toBe(1.0);
    expect(entry?.source).toBe('regex');
  });
});

// ---------------------------------------------------------------------------
// Determinism + pass-through
// ---------------------------------------------------------------------------

describe('sanitizer: determinism and pass-through', () => {
  it('produces identical output on repeated calls', async () => {
    const env = promptEnvelope(
      'Email alice@example.com or call (555) 123-4567 or use code: 482910.',
    );
    const first = await sanitize(env);
    const second = await sanitize(env);
    expect(getPromptText(first.sanitized_envelope)).toBe(
      getPromptText(second.sanitized_envelope),
    );
    expect(first.redaction_log).toEqual(second.redaction_log);
  });

  it('passes envelope through unchanged when no PII is present', async () => {
    const env = promptEnvelope('Hello world.');
    const result = await sanitize(env);
    expect(getPromptText(result.sanitized_envelope)).toBe('Hello world.');
    expect(result.redaction_log.total_redactions).toBe(0);
    expect(result.redaction_log.redactions).toEqual([]);
  });

  it('preserves non-input envelope fields byte-for-byte', async () => {
    const env = promptEnvelope('Send to alice@example.com.');
    env.cache_key = 'stage2:v5.1:sha256:' + 'a'.repeat(64);
    env.stage2_prompt_hash = 'b'.repeat(64);
    env.disposition.confidence = 0.7;
    const result = await sanitize(env);
    expect(result.sanitized_envelope.cache_key).toBe(env.cache_key);
    expect(result.sanitized_envelope.stage2_prompt_hash).toBe(env.stage2_prompt_hash);
    expect(result.sanitized_envelope.disposition.confidence).toBe(0.7);
    expect(result.sanitized_envelope.schema_version).toBe('5.1');
  });

  it('does not mutate the input envelope', async () => {
    const env = promptEnvelope('Email alice@example.com.');
    const before = structuredClone(env);
    await sanitize(env);
    expect(env).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Multi-type single field
// ---------------------------------------------------------------------------

describe('sanitizer: multiple PII types in one field', () => {
  it('redacts EMAIL + PHONE + OTP in a single prompt', async () => {
    const raw = 'Email alice@example.com, call (555) 123-4567, code: 482910.';
    const env = promptEnvelope(raw);
    const result = await sanitize(env);
    expect(getPromptText(result.sanitized_envelope)).toBe(
      'Email <EMAIL_1>, call <PHONE_1>, code: <OTP_1>.',
    );
    expect(result.redaction_log.total_redactions).toBe(3);
    const types = result.redaction_log.redactions.map((r) => r.type).sort();
    expect(types).toEqual(['EMAIL', 'OTP', 'PHONE']);
  });
});
