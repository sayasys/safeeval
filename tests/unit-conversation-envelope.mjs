// tests/unit-conversation-envelope.mjs
//
// Offline structural tests for the v5.1 conversation envelope extension.
// No API key, no network -- tests cover envelope-shape invariants and the
// L3 vocabulary registration that DOES NOT require a live model call.
//
// Run: node tests/unit-conversation-envelope.mjs

import {
  L3_CATEGORIES,
  L3_VALUES_BY_CATEGORY,
  ARC_L3_VALUES,
  CADENCE_L3_VALUES,
  INPUT_KIND_VALUES,
  CONVERSATION_MODALITY_VALUES,
  CONVERSATION_TURNS_MIN,
  STAGE_0_PARSE_FAILURE_RULE,
} from '../src/lib/safeeval-v5.js';

let failures = 0;
let assertions = 0;

function assertEq(actual, expected, msg) {
  assertions += 1;
  if (actual === expected) return;
  failures += 1;
  console.error('FAIL: ' + msg);
  console.error('  expected: ' + JSON.stringify(expected));
  console.error('  actual:   ' + JSON.stringify(actual));
}

function assertTruthy(x, msg) {
  assertions += 1;
  if (x) return;
  failures += 1;
  console.error('FAIL: ' + msg);
}

function assertDeepEq(actual, expected, msg) {
  assertions += 1;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return;
  failures += 1;
  console.error('FAIL: ' + msg);
  console.error('  expected: ' + e);
  console.error('  actual:   ' + a);
}

// ---- L3 vocabulary registration ----

assertTruthy(L3_CATEGORIES.indexOf('arc') >= 0, 'L3_CATEGORIES contains arc');
assertTruthy(L3_CATEGORIES.indexOf('cadence') >= 0, 'L3_CATEGORIES contains cadence');
assertEq(ARC_L3_VALUES.length, 5, 'ARC_L3_VALUES has 5 entries (memo section 4.1 cap)');
assertEq(CADENCE_L3_VALUES.length, 2, 'CADENCE_L3_VALUES has 2 entries (memo section 4.2 cap)');
assertDeepEq(L3_VALUES_BY_CATEGORY.arc, ARC_L3_VALUES, 'L3_VALUES_BY_CATEGORY.arc points to ARC_L3_VALUES');
assertDeepEq(L3_VALUES_BY_CATEGORY.cadence, CADENCE_L3_VALUES, 'L3_VALUES_BY_CATEGORY.cadence points to CADENCE_L3_VALUES');

// Every arc/cadence value is lowercase snake_case.
const snake = /^[a-z][a-z_]*[a-z]$/;
for (const v of ARC_L3_VALUES) assertTruthy(snake.test(v), 'ARC_L3 value snake_case: ' + v);
for (const v of CADENCE_L3_VALUES) assertTruthy(snake.test(v), 'CADENCE_L3 value snake_case: ' + v);

// ---- Input discriminator closed sets ----

assertDeepEq(INPUT_KIND_VALUES.slice().sort(), ['conversation', 'prompt'], 'INPUT_KIND_VALUES is {prompt, conversation}');
assertDeepEq(CONVERSATION_MODALITY_VALUES.slice().sort(), ['image', 'text'], 'CONVERSATION_MODALITY_VALUES is {text, image}');
assertEq(CONVERSATION_TURNS_MIN, 1, 'CONVERSATION_TURNS_MIN is 1 (memo section 3.3, amended 2026-05-28)');
assertEq(STAGE_0_PARSE_FAILURE_RULE, 'stage_0_parse_failure', 'STAGE_0_PARSE_FAILURE_RULE matches memo section 6.5');

// ---- Schema-side closed set agreement (parse the schema JSON, compare) ----
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, 'schema', 'v5-envelope.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

assertEq(schema.properties.schema_version.const, '5.1', 'schema_version const is 5.1 (memo section 5: schema stays at 5.1)');
assertEq(schema.properties.ontology_version.const, '5.1', 'ontology_version const bumped to 5.1');
assertDeepEq(
  schema.$defs.l3_arc_values.enum.slice().sort(),
  ARC_L3_VALUES.slice().sort(),
  'schema.l3_arc_values.enum agrees with engine ARC_L3_VALUES'
);
assertDeepEq(
  schema.$defs.l3_cadence_values.enum.slice().sort(),
  CADENCE_L3_VALUES.slice().sort(),
  'schema.l3_cadence_values.enum agrees with engine CADENCE_L3_VALUES'
);
assertTruthy(schema.$defs.l3_pattern.pattern.indexOf('arc') >= 0, 'l3_pattern includes arc');
assertTruthy(schema.$defs.l3_pattern.pattern.indexOf('cadence') >= 0, 'l3_pattern includes cadence');
assertTruthy(schema.$defs.input !== undefined, 'schema.$defs.input defined');
assertTruthy(schema.$defs.per_turn_evidence !== undefined, 'schema.$defs.per_turn_evidence defined');
assertTruthy(schema.$defs.arc_signals !== undefined, 'schema.$defs.arc_signals defined');
assertTruthy(
  schema.$defs.disposition_rule_names.enum.indexOf('stage_0_parse_failure') >= 0,
  'schema disposition_rule_names includes stage_0_parse_failure'
);
assertTruthy(
  schema.$defs.pipeline_trace.properties.stage_0 !== undefined,
  'schema pipeline_trace.properties.stage_0 defined'
);

// ---- Engine input.kind="prompt" assembly path doesn't break ----
//
// We can construct a synthetic prompt-mode envelope via the helper to verify
// the assembler emits the input discriminator for prompt mode too. (This
// requires no model calls.)
import { evaluatePromptV5 } from '../src/lib/safeeval-v5.js';
// We can't call evaluatePromptV5 without API key. Instead verify the exports
// shape that the assembler depends on (proxy for the round-trip).
assertTruthy(typeof evaluatePromptV5 === 'function', 'evaluatePromptV5 exported');

// ---- evaluateConversationV5 exists and is a function ----
import { evaluateConversationV5 } from '../src/lib/safeeval-v5.js';
assertTruthy(typeof evaluateConversationV5 === 'function', 'evaluateConversationV5 exported');

// ---- Summary ----

console.log('');
console.log('conversation-envelope unit tests: ' + (assertions - failures) + ' passed / ' + assertions + ' total');
if (failures > 0) {
  console.error('FAILED with ' + failures + ' failures');
  process.exit(1);
}
process.exit(0);
