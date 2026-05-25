// scripts/check-lockstep.js
//
// Two lockstep gates, run in CI via .github/workflows/safeeval-gate.yml:
//
// 1. Doc/code typology lockstep: every typology declared in src/lib/safeeval.js
//    TYPOLOGIES (except the NONE sentinel) appears in each of the canonical
//    FAF docs:
//      docs/01-framework.md
//      docs/03-master-policy.md
//      docs/05-classifier-guidance.md
//
// 2. Engine/schema disposition lockstep: every key the v5 engine emits in
//    `disposition` and `disposition.triggered_by` is declared in
//    tests/schema/v5-envelope.schema.json. Catches the class of drift that
//    landed in v5.0.1 when narrative_summary / confidence_path / policy_note
//    were added to the engine without a schema patch.
//
// Exits 0 only if all checks pass. Exits 1 otherwise.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENGINE = path.join(ROOT, 'src', 'lib', 'safeeval.js');
const V5_ENGINE = path.join(ROOT, 'src', 'lib', 'safeeval-v5.js');
const V5_SCHEMA = path.join(ROOT, 'tests', 'schema', 'v5-envelope.schema.json');
const DOCS = [
  'docs/01-framework.md',
  'docs/03-master-policy.md',
  'docs/05-classifier-guidance.md',
];

function extractTypologies(engineSource) {
  // Match: export const TYPOLOGIES = [ 'A', 'B', ... ];
  const m = engineSource.match(/export\s+const\s+TYPOLOGIES\s*=\s*\[([\s\S]*?)\]/);
  if (!m) {
    throw new Error('Could not locate TYPOLOGIES array in src/lib/safeeval.js');
  }
  const list = m[1]
    .split(',')
    .map(s => s.trim().replace(/^["\']|["\']$/g, ''))
    .filter(s => s.length > 0);
  return list;
}

function checkDocCodeLockstep() {
  const engineSrc = fs.readFileSync(ENGINE, 'utf-8');
  const typologies = extractTypologies(engineSrc);
  console.log('Found ' + typologies.length + ' typologies in engine: ' + typologies.join(', '));

  // NONE is a sentinel typology -- it represents the absence of fraud.
  // It is exempt from the lockstep check because it does not need a doc entry.
  const required = typologies.filter(t => t !== 'NONE');

  let totalMisses = 0;
  for (const docPath of DOCS) {
    const full = path.join(ROOT, docPath);
    if (!fs.existsSync(full)) {
      console.error('MISSING DOC: ' + docPath);
      totalMisses++;
      continue;
    }
    const docSrc = fs.readFileSync(full, 'utf-8');
    const misses = required.filter(t => !docSrc.includes(t));
    if (misses.length > 0) {
      console.error('LOCKSTEP FAIL in ' + docPath + ': missing ' + misses.join(', '));
      totalMisses += misses.length;
    } else {
      console.log('OK: ' + docPath);
    }
  }

  if (totalMisses > 0) {
    console.error('');
    console.error('Doc/code lockstep failed with ' + totalMisses + ' miss(es).');
    console.error('Every typology in TYPOLOGIES (except NONE) must appear in every canonical FAF doc.');
    return false;
  }
  console.log('Doc/code lockstep passed.');
  return true;
}

// Extract the set of keys from each object literal `{ ... }` whose label tags
// it as part of the disposition contract. The engine has three disposition
// emission sites + one post-assembly assignment, plus three triggered_by
// literals. Rather than maintain a hand-curated key list (which would itself
// drift), parse the source: find every assignment of the form
// `<lhs>.<key> = ...` or `<key>: <value>` inside named brace blocks anchored
// by stable markers, and union the keys.
function extractV5DispositionKeys() {
  const src = fs.readFileSync(V5_ENGINE, 'utf-8');

  // Anchors are stable comment / variable markers in safeeval-v5.js.
  // If any of these go missing, the script fails loud rather than silently
  // covering less surface.
  const dispositionAnchors = [
    // Stage 4 main happy path: `const disposition = { ... };`
    { start: 'const disposition = {', end: '};' },
    // Stage 4 fallback inside the `output:` block of the error return.
    // The output literal sits inside `return { ok: false, ..., output: { ... }, ... };`
    { start: '      output: {\n        action:', end: '      }' },
    // Stage 1 short-circuit: `const shortCircuitDisposition = { ... };`
    { start: 'const shortCircuitDisposition = {', end: '};' },
  ];
  const triggeredAnchors = [
    // applyDeterministicRules: `const triggered = { ... };`
    { start: 'const triggered = {', end: '};' },
    // Short-circuit inline literal:
    // `triggered_by: { bright_lines: [], thresholds: [], rules: [...], policy_note: null }`
    { start: "triggered_by:             { bright_lines:", end: '}' },
    // Fallback inline literal:
    // `: { bright_lines: [], thresholds: [], rules: [...], policy_note: null }`
    { start: ": { bright_lines: [], thresholds: [], rules: ['model_adjudicated'", end: '}' },
  ];

  // Walk the object literal starting at `anchor.start`. Collect identifier keys
  // that appear immediately inside the outermost `{` (brace depth 1), ignoring
  // anything inside nested braces or string literals. Works for both
  // multi-line and single-line object literals.
  function extractKeysAt(anchor) {
    const startIdx = src.indexOf(anchor.start);
    if (startIdx === -1) {
      throw new Error('Anchor missing from v5 engine source: ' + JSON.stringify(anchor.start));
    }
    const openIdx = src.indexOf('{', startIdx);
    if (openIdx === -1) {
      throw new Error('No opening brace after anchor: ' + JSON.stringify(anchor.start));
    }
    const keys = new Set();
    let depth = 1;
    let i = openIdx + 1;
    let inString = null; // null | "'" | '"' | '`'
    let pendingIdent = '';
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (inString) {
        if (c === '\\') { i += 2; continue; }
        if (c === inString) inString = null;
        i++;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') { inString = c; i++; continue; }
      if (c === '{' || c === '[') { depth++; i++; pendingIdent = ''; continue; }
      if (c === '}' || c === ']') { depth--; i++; pendingIdent = ''; continue; }
      if (depth === 1) {
        if (/[A-Za-z0-9_]/.test(c)) { pendingIdent += c; i++; continue; }
        if (c === ':' && pendingIdent && /^[a-z_]/i.test(pendingIdent)) {
          keys.add(pendingIdent);
          pendingIdent = '';
          i++;
          continue;
        }
        if (c !== ' ' && c !== '\n' && c !== '\t' && c !== '\r') {
          pendingIdent = '';
        }
      }
      i++;
    }
    return keys;
  }

  function unionAll(anchors) {
    const out = new Set();
    for (const a of anchors) {
      const ks = extractKeysAt(a);
      ks.forEach(k => out.add(k));
    }
    return out;
  }

  const dispositionKeys = unionAll(dispositionAnchors);
  // Add the post-assembly attached key. See safeeval-v5.js:
  //   `disposition.confidence_path = buildConfidencePath(...)`
  const confPathRe = /disposition\.([a-z_][a-z_0-9]*)\s*=/g;
  let m;
  while ((m = confPathRe.exec(src)) !== null) dispositionKeys.add(m[1]);

  const triggeredKeys = unionAll(triggeredAnchors);

  return { dispositionKeys, triggeredKeys };
}

function checkSchemaEngineLockstep() {
  const schema = JSON.parse(fs.readFileSync(V5_SCHEMA, 'utf-8'));
  const dispositionDef = schema.$defs && schema.$defs.disposition;
  if (!dispositionDef || !dispositionDef.properties) {
    console.error('Schema missing $defs.disposition.properties');
    return false;
  }
  const schemaDispositionKeys = new Set(Object.keys(dispositionDef.properties));
  const triggeredDef = dispositionDef.properties.triggered_by;
  if (!triggeredDef || !triggeredDef.properties) {
    console.error('Schema missing $defs.disposition.properties.triggered_by.properties');
    return false;
  }
  const schemaTriggeredKeys = new Set(Object.keys(triggeredDef.properties));

  const { dispositionKeys, triggeredKeys } = extractV5DispositionKeys();

  console.log('Engine disposition keys: ' + Array.from(dispositionKeys).sort().join(', '));
  console.log('Engine triggered_by keys: ' + Array.from(triggeredKeys).sort().join(', '));

  const missingDisposition = Array.from(dispositionKeys).filter(k => !schemaDispositionKeys.has(k));
  const missingTriggered = Array.from(triggeredKeys).filter(k => !schemaTriggeredKeys.has(k));

  if (missingDisposition.length === 0 && missingTriggered.length === 0) {
    console.log('Schema/engine disposition lockstep passed.');
    return true;
  }

  console.error('');
  console.error('Schema/engine lockstep failed:');
  if (missingDisposition.length > 0) {
    console.error('  disposition keys emitted by engine but absent from schema $defs.disposition.properties:');
    missingDisposition.forEach(k => console.error('    - ' + k));
  }
  if (missingTriggered.length > 0) {
    console.error('  triggered_by keys emitted by engine but absent from schema $defs.disposition.properties.triggered_by.properties:');
    missingTriggered.forEach(k => console.error('    - ' + k));
  }
  console.error('Add the missing keys to tests/schema/v5-envelope.schema.json before shipping.');
  return false;
}

function main() {
  const docCodeOk = checkDocCodeLockstep();
  console.log('');
  const schemaEngineOk = checkSchemaEngineLockstep();
  if (!docCodeOk || !schemaEngineOk) {
    process.exit(1);
  }
  console.log('');
  console.log('All lockstep checks passed.');
}

main();
