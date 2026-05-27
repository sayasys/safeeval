// tests/runner-conversation.js
//
// Golden-conversation regression runner (v5.1 conversation extension).
//
// Usage:
//   node tests/runner-conversation.js
//   TEST_BASE_URL=https://safeeval.vercel.app node tests/runner-conversation.js
//
// Reads every tests/golden-conversations/*.json file (phase 5 authors these).
// For each file it POSTs the conversation envelope to /api/evaluate and
// checks the response against expected_v5 (classification.l1.value,
// classification.l2.value when expected_v5.l2 is non-null, disposition.action,
// and expected_l3_substring_matches when present).
//
// Fixture format:
//   {
//     "name": "short label",
//     "input": {
//       "kind": "conversation",
//       "conversation": {
//         "modality": "text",
//         "turns": [
//           { "sender": "Alice", "text": "...", "timestamp": "..." },
//           ...
//         ]
//       }
//     },
//     "expected_v5": {
//       "l1": "...",                          (or l1_any_of: [...])
//       "l2": "..." (nullable),               (or l2_any_of: [...])
//       "disposition_action": "...",          (or disposition_action_any_of: [...])
//       "expected_l3_substring_matches": ["arc:trust_ramp", ...] (optional),
//       "min_turn_count": 2 (optional)
//     }
//   }
//
// Phase 5 will populate tests/golden-conversations/ with 20 conversation
// fixtures + 5 image fixtures. Phase 3 ships the runner; an empty fixture
// directory exits 0 with a "no fixtures" message.
//
// Exit 0 if every fixture passes (or no fixtures present); 1 otherwise.

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const FIXTURE_DIR = path.join(__dirname, 'golden-conversations');

function loadFixtures() {
  if (!fs.existsSync(FIXTURE_DIR)) return [];
  const files = fs.readdirSync(FIXTURE_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
  return files.map(f => {
    const full = path.join(FIXTURE_DIR, f);
    const raw = fs.readFileSync(full, 'utf8');
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { throw new Error('Failed to parse ' + f + ': ' + e.message); }
    return { name: parsed.name || f.replace(/\.json$/, ''), file: f, fixture: parsed };
  });
}

async function callEngine(input) {
  const res = await fetch(BASE_URL + '/api/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 200));
  }
  return res.json();
}

function checkV5(v5, expected) {
  const failures = [];
  if (!v5) {
    failures.push('v5: missing v5 envelope on response');
    return failures;
  }
  const l1Val = v5.classification && v5.classification.l1 && v5.classification.l1.value;
  const l2Val = v5.classification && v5.classification.l2 && v5.classification.l2.value;
  const action = v5.disposition && v5.disposition.action;

  if (expected.l1 !== null && expected.l1 !== undefined) {
    if (l1Val !== expected.l1) failures.push('v5.l1: expected ' + expected.l1 + ', got ' + l1Val);
  } else if (Array.isArray(expected.l1_any_of)) {
    if (!expected.l1_any_of.includes(l1Val)) {
      failures.push('v5.l1: expected one of [' + expected.l1_any_of.join(', ') + '], got ' + l1Val);
    }
  }
  if (expected.l2 !== null && expected.l2 !== undefined) {
    if (l2Val !== expected.l2) failures.push('v5.l2: expected ' + expected.l2 + ', got ' + l2Val);
  } else if (Array.isArray(expected.l2_any_of)) {
    if (!expected.l2_any_of.includes(l2Val)) {
      failures.push('v5.l2: expected one of [' + expected.l2_any_of.join(', ') + '], got ' + l2Val);
    }
  }
  if (expected.disposition_action !== null && expected.disposition_action !== undefined) {
    if (action !== expected.disposition_action) {
      failures.push('v5.disposition.action: expected ' + expected.disposition_action + ', got ' + action);
    }
  } else if (Array.isArray(expected.disposition_action_any_of)) {
    if (!expected.disposition_action_any_of.includes(action)) {
      failures.push('v5.disposition.action: expected one of [' + expected.disposition_action_any_of.join(', ') + '], got ' + action);
    }
  }

  // L3 substring matches (conversation-mode arc: / cadence: assertions).
  if (Array.isArray(expected.expected_l3_substring_matches)) {
    const l3Values = (v5.classification && Array.isArray(v5.classification.l3))
      ? v5.classification.l3.map(t => t.value) : [];
    for (const needle of expected.expected_l3_substring_matches) {
      const hit = l3Values.some(v => v === needle || v.indexOf(needle) === 0);
      if (!hit) {
        failures.push('v5.l3: expected match for ' + needle + ', got [' + l3Values.join(', ') + ']');
      }
    }
  }

  // Conversation envelope invariants.
  if (v5.input && v5.input.kind === 'conversation') {
    if (!v5.input.conversation || !Array.isArray(v5.input.conversation.turns)) {
      failures.push('v5.input.conversation.turns: missing or not an array');
    } else if (typeof expected.min_turn_count === 'number' && v5.input.conversation.turns.length < expected.min_turn_count) {
      failures.push('v5.input.conversation.turns: count ' + v5.input.conversation.turns.length + ' < expected min ' + expected.min_turn_count);
    }
    // evidence.per_turn must be present for conversation envelopes.
    if (!Array.isArray(v5.evidence.per_turn)) {
      failures.push('v5.evidence.per_turn: must be an array on conversation envelopes');
    }
  }

  return failures;
}

async function runOne(entry) {
  const { name, fixture } = entry;
  try {
    const actual = await callEngine(fixture.input);
    const failures = checkV5(actual, fixture.expected_v5 || {});
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
  console.log('SafeEval golden-conversation runner (v5.1)');
  console.log('  base URL: ' + BASE_URL);
  console.log('  fixture dir: ' + FIXTURE_DIR);
  console.log('');

  const fixtures = loadFixtures();
  if (fixtures.length === 0) {
    console.log('No conversation fixtures present. Phase 5 will populate ' + FIXTURE_DIR + '.');
    process.exit(0);
  }
  let passed = 0;
  for (const entry of fixtures) {
    const ok = await runOne(entry);
    if (ok) passed += 1;
  }
  console.log('');
  console.log(passed + ' passed / ' + fixtures.length + ' total');
  process.exit(passed === fixtures.length ? 0 : 1);
}

main().catch(err => {
  console.error('Runner crashed: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
