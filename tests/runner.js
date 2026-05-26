// tests/runner.js
//
// Golden-prompt regression runner for SafeEval.
//
// Usage:
//   node tests/runner.js
//
// Environment variables:
//   TEST_BASE_URL  - Base URL of the running app. Default: http://localhost:3000
//   TEST_V5        - If "1", request the v5 envelope (?v5=1) and check v5 fields.
//
// Reads every tests/golden/*.json file. For each file it POSTs the prompt
// to /api/evaluate and checks the response against expected_v4 (typology +
// escalation_tier).
//
// Response shape depends on mode (see src/app/api/evaluate/route.js):
//   default:  v4 envelope at the root -- { typology, escalation_tier, ... }
//   ?v5=1:    dual-emit envelope -- { id, v4_legacy: <v4 envelope>, v5: <v5 envelope> }
//
// In v5 mode the runner reads v4 fields from actual.v4_legacy.* and v5 fields
// from actual.v5.*. A missing v4_legacy in v5 mode fails fast with a clear
// message so future envelope drift surfaces immediately.
//
// If v5 mode is on, it also checks response.v5.classification.l1.value,
// response.v5.classification.l2.value (only when expected_v5.l2 is non-null),
// and response.v5.disposition.action.
//
// Probabilities are deliberately NOT checked -- they drift across model
// versions and create noise. See tests/README.md for the rationale.
//
// Exit code 0 if every prompt passes, 1 otherwise.
//
// TODO: schema-keeper to wire in tests/schema/v5-envelope.schema.json validation here in Round 2.

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const V5_MODE = process.env.TEST_V5 === '1';
const GOLDEN_DIR = path.join(__dirname, 'golden');

function loadGoldens() {
  const files = fs.readdirSync(GOLDEN_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
  return files.map(f => {
    const full = path.join(GOLDEN_DIR, f);
    const raw = fs.readFileSync(full, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error('Failed to parse ' + f + ': ' + e.message);
    }
    return { name: f.replace(/\.json$/, ''), file: f, golden: parsed };
  });
}

async function callEngine(prompt) {
  const url = V5_MODE
    ? BASE_URL + '/api/evaluate?v5=1'
    : BASE_URL + '/api/evaluate';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 200));
  }
  return res.json();
}

function checkV4(actual, expected) {
  const failures = [];
  let v4;
  if (V5_MODE) {
    if (!actual || !actual.v4_legacy) {
      failures.push('dual-emit envelope missing v4_legacy');
      return failures;
    }
    v4 = actual.v4_legacy;
  } else {
    v4 = actual;
  }
  if (expected.typology !== null && expected.typology !== undefined) {
    if (v4.typology !== expected.typology) {
      failures.push('typology: expected ' + expected.typology + ', got ' + v4.typology);
    }
  }
  if (v4.escalation_tier !== expected.escalation_tier) {
    failures.push('escalation_tier: expected ' + expected.escalation_tier + ', got ' + v4.escalation_tier);
  }
  return failures;
}

function checkV5(actual, expected) {
  const failures = [];
  const v5 = actual && actual.v5;
  if (!v5) {
    failures.push('v5: missing v5 envelope on response');
    return failures;
  }
  const l1Val = v5.classification && v5.classification.l1 && v5.classification.l1.value;
  const l2Val = v5.classification && v5.classification.l2 && v5.classification.l2.value;
  const action = v5.disposition && v5.disposition.action;

  if (expected.l1 !== null && expected.l1 !== undefined) {
    if (l1Val !== expected.l1) {
      failures.push('v5.l1: expected ' + expected.l1 + ', got ' + l1Val);
    }
  }
  if (expected.l2 !== null && expected.l2 !== undefined) {
    if (l2Val !== expected.l2) {
      failures.push('v5.l2: expected ' + expected.l2 + ', got ' + l2Val);
    }
  }
  if (action !== expected.disposition_action) {
    failures.push('v5.disposition.action: expected ' + expected.disposition_action + ', got ' + action);
  }

  // Spec-driven envelope invariants (phase 2d).
  // These are universal -- every v5 envelope must satisfy them regardless of fixture.

  // disposition.degraded must be a boolean.
  if (typeof v5.disposition.degraded !== 'boolean') {
    failures.push('v5.disposition.degraded: expected boolean, got ' + typeof v5.disposition.degraded);
  }

  // reasoning_summary and narrative_summary must end at sentence-final punctuation
  // (schema rules 9, 9a). Skip if empty.
  const rs = v5.disposition.reasoning_summary;
  if (typeof rs === 'string' && rs.length > 0 && !/[.!?]$/.test(rs)) {
    failures.push('v5.disposition.reasoning_summary: must end with . ! or ? (rule 9)');
  }
  const ns = v5.disposition.narrative_summary;
  if (typeof ns === 'string' && ns.length > 0 && !/[.!?]$/.test(ns)) {
    failures.push('v5.disposition.narrative_summary: must end with . ! or ? (rule 9a)');
  }

  // Rule 12 MUST half: classification.l2.value appears as a key in
  // evidence.l2_probabilities (skip when probs map is empty, e.g. Stage 2 stub).
  // Also skip when triggered_by.rules contains 'validation_fallback' -- that
  // signals the rule-12 fallback already fired and handled the MUST violation
  // in-band (the canonical case is Rule 1.5's borderline L2 forcing, where
  // the forced L2 is intentionally not in the Stage 2 probability map; memo
  // 2026-05-25-policy-case07-defender-framing.md section 6.3).
  const probs = v5.evidence && v5.evidence.l2_probabilities;
  const rules = (v5.disposition && v5.disposition.triggered_by && v5.disposition.triggered_by.rules) || [];
  const ruleTwelveFallbackFired = Array.isArray(rules) && rules.indexOf('validation_fallback') >= 0;
  if (probs && Object.keys(probs).length > 0 && l2Val && !ruleTwelveFallbackFired &&
      !Object.prototype.hasOwnProperty.call(probs, l2Val)) {
    failures.push('v5.classification.l2.value: ' + l2Val + ' not in evidence.l2_probabilities keys (rule 12 MUST)');
  }

  return failures;
}

async function runOne(entry) {
  const { name, golden } = entry;
  try {
    const actual = await callEngine(golden.prompt);
    const failures = checkV4(actual, golden.expected_v4);
    if (V5_MODE) {
      const v5Failures = checkV5(actual, golden.expected_v5);
      for (const f of v5Failures) failures.push(f);
    }
    if (failures.length === 0) {
      console.log('[PASS] ' + name);
      return true;
    }
    console.log('[FAIL] ' + name + ' (' + failures.join('; ') + ')');
    return false;
  } catch (e) {
    console.log('[FAIL] ' + name + ' (request error: ' + e.message + ')');
    return false;
  }
}

async function main() {
  console.log('SafeEval golden runner');
  console.log('  base URL: ' + BASE_URL);
  console.log('  v5 mode:  ' + (V5_MODE ? 'on' : 'off'));
  console.log('');

  const goldens = loadGoldens();
  let passed = 0;
  for (const entry of goldens) {
    const ok = await runOne(entry);
    if (ok) passed += 1;
  }
  const total = goldens.length;
  console.log('');
  console.log(passed + ' passed / ' + total + ' total');
  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error('Runner crashed: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
