// PII redaction pipeline for SafeEval persistence.
//
// Spec: docs/memos/2026-05-28-data-track-implementation-spec.md section 3.
//
// Phase 1 implements the regex tier only. The Presidio subprocess tier (PERSON
// and LOCATION recognizers; richer recall for email/phone/etc.) is documented
// in the spec but deferred to a follow-on phase. The detectPresidioEntities
// hook below is a stub that returns an empty list; the merge step is still
// exercised against an empty Presidio result so the wiring is in place once
// the sidecar lands.
//
// Deferral rationale: Presidio is Python-first. The realistic JS integration
// shapes (HTTP sidecar, subprocess via python3, embedded Pyodide) all add an
// operational surface that is out of Phase 1 scope. The regex tier covers the
// explicitly-formatted classes (EMAIL, PHONE, SSN, CREDIT_CARD, IBAN, OTP)
// with high precision. Names + free-form addresses wait for Presidio.

import type {
  DetectedEntity,
  PIIEntityType,
  RedactionEntry,
  RedactionLog,
  SanitizeResult,
  V5Envelope,
  EnvelopeInput,
} from './types';

export const SANITIZER_VERSION = '0.1.0-regex';

const REDACTION_LOG_VERSION = '1' as const;

// Regex tier patterns. Per spec section 3, point 2.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// NANP (North American Numbering Plan) + E.164.
const PHONE_NANP_RE = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const PHONE_E164_RE = /\+\d{1,3}[-.\s]?\d{4,14}/g;

const SSN_DASHED_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
// Lower-precision raw nine-digit fallback; only fires when the dashed form
// did not already cover the span.
const SSN_RAW_RE = /\b\d{9}\b/g;

// 13-19 digits with optional spaces/dashes BETWEEN (not trailing) digits.
// Luhn-validated downstream; raw matches that fail Luhn are dropped.
const CREDIT_CARD_RE = /\b\d(?:[ -]?\d){12,18}\b/g;

// Two letters + two check digits + 1-30 alphanumerics. Mod-97-validated
// downstream; raw matches that fail mod-97 are dropped.
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b/g;

// OTP: context-anchored. The d flag (ES2022, Node 18+) is required to recover
// the capture-group offset for the digits-only span we redact.
const OTP_RE = /(?:\b(?:otp|code|verification|2fa|verify)[\s:]+)(\d{4,8})\b/gid;

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export async function sanitize(envelope: V5Envelope): Promise<SanitizeResult> {
  const sanitized = structuredClone(envelope);

  const placeholders = new Map<string, string>(); // canonical_key -> placeholder
  const counters = new Map<PIIEntityType, number>();
  const allEntries: RedactionEntry[] = [];

  for (const target of textBearingFields(sanitized)) {
    const rawText = target.read();
    if (!rawText) continue;

    const regexEntities = detectRegexEntities(rawText, target.path);
    const presidioEntities = await detectPresidioEntities(rawText, target.path);
    const merged = mergeDetections(regexEntities, presidioEntities);

    if (merged.length === 0) continue;

    const entriesForField: RedactionEntry[] = [];
    const ordered = [...merged].sort((a, b) => a.start - b.start);
    for (const entity of ordered) {
      const placeholder = assignPlaceholder(entity, placeholders, counters);
      entriesForField.push({
        type: entity.type,
        field_path: entity.field_path,
        original_offset: entity.start,
        original_length: entity.end - entity.start,
        placeholder,
        confidence: entity.confidence,
        source: entity.source,
      });
    }

    target.write(applyRedactions(rawText, ordered, placeholders, counters));
    allEntries.push(...entriesForField);
  }

  const redaction_log: RedactionLog = {
    version: REDACTION_LOG_VERSION,
    sanitizer_version: SANITIZER_VERSION,
    total_redactions: allEntries.length,
    redactions: allEntries,
  };

  return { sanitized_envelope: sanitized, redaction_log };
}

// ---------------------------------------------------------------------------
// Envelope traversal
// ---------------------------------------------------------------------------

interface TextField {
  path: string;
  read: () => string;
  write: (next: string) => void;
}

function textBearingFields(envelope: V5Envelope): TextField[] {
  const input = envelope.input;
  if (!input) return [];

  if (input.kind === 'prompt') {
    return [
      {
        path: 'input.text',
        read: () => input.text,
        write: (next) => {
          (envelope.input as Extract<EnvelopeInput, { kind: 'prompt' }>).text = next;
        },
      },
    ];
  }

  if (input.kind === 'conversation') {
    return input.conversation.turns.map((_turn, index) => ({
      path: `input.conversation.turns[${index}].text`,
      read: () => {
        const conv = (envelope.input as Extract<EnvelopeInput, { kind: 'conversation' }>).conversation;
        return conv.turns[index]?.text ?? '';
      },
      write: (next) => {
        const conv = (envelope.input as Extract<EnvelopeInput, { kind: 'conversation' }>).conversation;
        const turn = conv.turns[index];
        if (turn) turn.text = next;
      },
    }));
  }

  return [];
}

// ---------------------------------------------------------------------------
// Regex detection
// ---------------------------------------------------------------------------

export function detectRegexEntities(text: string, fieldPath: string): DetectedEntity[] {
  const out: DetectedEntity[] = [];

  for (const match of text.matchAll(EMAIL_RE)) {
    if (match.index === undefined) continue;
    const raw = match[0];
    out.push({
      type: 'EMAIL',
      field_path: fieldPath,
      start: match.index,
      end: match.index + raw.length,
      raw_value: raw,
      canonical_value: raw.toLowerCase(),
      confidence: 1.0,
      source: 'regex',
    });
  }

  for (const re of [PHONE_NANP_RE, PHONE_E164_RE]) {
    for (const match of text.matchAll(re)) {
      if (match.index === undefined) continue;
      const raw = match[0];
      const digits = raw.replace(/\D/g, '');
      // Reject implausible matches (NANP requires at least 10 digits; E.164 at least 7).
      if (digits.length < 7) continue;
      out.push({
        type: 'PHONE',
        field_path: fieldPath,
        start: match.index,
        end: match.index + raw.length,
        raw_value: raw,
        canonical_value: digits,
        confidence: 1.0,
        source: 'regex',
      });
    }
  }

  for (const match of text.matchAll(SSN_DASHED_RE)) {
    if (match.index === undefined) continue;
    const raw = match[0];
    out.push({
      type: 'SSN',
      field_path: fieldPath,
      start: match.index,
      end: match.index + raw.length,
      raw_value: raw,
      canonical_value: raw.replace(/\D/g, ''),
      confidence: 1.0,
      source: 'regex',
    });
  }
  // Bare 9-digit fallback; only kept if not already covered.
  for (const match of text.matchAll(SSN_RAW_RE)) {
    if (match.index === undefined) continue;
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;
    const covered = out.some((e) => e.type === 'SSN' && overlaps(e.start, e.end, start, end));
    if (covered) continue;
    out.push({
      type: 'SSN',
      field_path: fieldPath,
      start,
      end,
      raw_value: raw,
      canonical_value: raw,
      confidence: null,
      source: 'regex',
    });
  }

  for (const match of text.matchAll(CREDIT_CARD_RE)) {
    if (match.index === undefined) continue;
    const raw = match[0];
    const digits = raw.replace(/\D/g, '');
    if (!luhnValid(digits)) continue;
    out.push({
      type: 'CREDIT_CARD',
      field_path: fieldPath,
      start: match.index,
      end: match.index + raw.length,
      raw_value: raw,
      canonical_value: digits,
      confidence: 1.0,
      source: 'regex',
    });
  }

  for (const match of text.matchAll(IBAN_RE)) {
    if (match.index === undefined) continue;
    const raw = match[0];
    if (!ibanMod97Valid(raw)) continue;
    out.push({
      type: 'IBAN',
      field_path: fieldPath,
      start: match.index,
      end: match.index + raw.length,
      raw_value: raw,
      canonical_value: raw.toUpperCase(),
      confidence: 1.0,
      source: 'regex',
    });
  }

  // OTP: the d flag exposes match.indices[1] for the digit span.
  for (const match of text.matchAll(OTP_RE) as IterableIterator<RegExpMatchArray & { indices?: Array<[number, number]> }>) {
    const indices = match.indices;
    if (!indices || !indices[1]) continue;
    const [start, end] = indices[1];
    const raw = text.slice(start, end);
    out.push({
      type: 'OTP',
      field_path: fieldPath,
      start,
      end,
      raw_value: raw,
      canonical_value: raw,
      confidence: 1.0,
      source: 'regex',
    });
  }

  return out;
}

// Phase 1: Presidio integration is deferred. The hook returns an empty list
// so the merge + redaction pipeline is exercised against the regex tier only.
// Phase 2 or 3 will wire a Python sidecar (subprocess over stdio, or a small
// FastAPI service on a private port). The shape of this function is stable;
// only the body changes once the sidecar is in.
export async function detectPresidioEntities(
  _text: string,
  _fieldPath: string,
): Promise<DetectedEntity[]> {
  return [];
}

// ---------------------------------------------------------------------------
// Merge + placeholder assignment + apply
// ---------------------------------------------------------------------------

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function mergeDetections(
  regex: DetectedEntity[],
  presidio: DetectedEntity[],
): DetectedEntity[] {
  // Presidio takes precedence on overlap (carries a confidence score, plus
  // PERSON / LOCATION recall the regex tier can't match). Within a tier,
  // longer matches win on tie.
  const ordered = [...presidio, ...regex].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });

  const kept: DetectedEntity[] = [];
  for (const candidate of ordered) {
    const conflict = kept.some((e) => overlaps(e.start, e.end, candidate.start, candidate.end));
    if (!conflict) kept.push(candidate);
  }
  return kept;
}

function placeholderKey(entity: DetectedEntity): string {
  return `${entity.type}::${entity.canonical_value}`;
}

function assignPlaceholder(
  entity: DetectedEntity,
  placeholders: Map<string, string>,
  counters: Map<PIIEntityType, number>,
): string {
  const key = placeholderKey(entity);
  const existing = placeholders.get(key);
  if (existing) return existing;

  const next = (counters.get(entity.type) ?? 0) + 1;
  counters.set(entity.type, next);
  const placeholder = `<${entity.type}_${next}>`;
  placeholders.set(key, placeholder);
  return placeholder;
}

export function applyRedactions(
  text: string,
  entities: DetectedEntity[],
  placeholders: Map<string, string>,
  counters: Map<PIIEntityType, number>,
): string {
  // Iterate right-to-left so earlier offsets stay valid as we splice.
  const ordered = [...entities].sort((a, b) => b.start - a.start);
  let out = text;
  for (const entity of ordered) {
    const placeholder = assignPlaceholder(entity, placeholders, counters);
    out = out.slice(0, entity.start) + placeholder + out.slice(entity.end);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Checksums
// ---------------------------------------------------------------------------

function luhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    const ch = digits[i];
    if (ch === undefined) return false;
    let d = ch.charCodeAt(0) - 48;
    if (d < 0 || d > 9) return false;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function ibanMod97Valid(iban: string): boolean {
  if (iban.length < 4 || iban.length > 34) return false;
  // Rearrange: move first 4 chars to end, then convert A-Z to 10-35.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let numeric = '';
  for (const ch of rearranged) {
    if (ch >= '0' && ch <= '9') {
      numeric += ch;
    } else if (ch >= 'A' && ch <= 'Z') {
      numeric += String(ch.charCodeAt(0) - 55); // A=10, B=11, ..., Z=35
    } else {
      return false;
    }
  }
  // Compute mod 97 in chunks (numeric can be very long).
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = String(remainder) + numeric.slice(i, i + 7);
    remainder = Number(chunk) % 97;
  }
  return remainder === 1;
}
