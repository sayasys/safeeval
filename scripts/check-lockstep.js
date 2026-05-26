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
const V5_SCHEMA_DOC = path.join(ROOT, 'docs', '07-v5-schema.md');
const CLASSIFIER_DISPLAY_MEMO = path.join(ROOT, 'docs', 'memos', '2026-05-26-policy-v5-classifier-display-vocabulary.md');
const DOCS = [
  'docs/01-framework.md',
  'docs/03-master-policy.md',
  'docs/05-classifier-guidance.md',
];

// v5.1 classifier-display closed sets. Each entry: (a) the engine-constant
// name in src/lib/safeeval-v5.js, (b) the schema-doc reference name
// (referenced verbatim in docs/07-v5-schema.md), (c) the memo section header
// that anchors the table to scan. The lockstep check parses each source for
// the closed set and confirms set equality across (engine, schema-doc-mention,
// memo-table). See docs/memos/2026-05-26-policy-v5-classifier-display-vocabulary.md
// section 8 for the spec.
const V51_CLASSIFIER_LABEL_SETS = [
  { engine: 'TEMPLATE_LABELS',  schemaDef: 'template_labels',  memoSection: '### 2.1 Template' },
  { engine: 'DELIVERY_LABELS',  schemaDef: 'delivery_labels',  memoSection: '### 2.2 Delivery' },
  { engine: 'CONTROL_LABELS',   schemaDef: 'control_labels',   memoSection: '### 2.3 Control' },
  { engine: 'TOPIC_LABELS',     schemaDef: 'topic_labels',     memoSection: '### 3.1 Topic' },
  { engine: 'TARGET_LABELS',    schemaDef: 'target_labels',    memoSection: '### 3.2 Target' },
  { engine: 'OBJECTIVE_LABELS', schemaDef: 'objective_labels', memoSection: '### 3.3 Objective' },
  { engine: 'PRETEXT_LABELS',   schemaDef: 'pretext_labels',   memoSection: '### 3.4 Pretext' },
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

// v5.1 classifier-display lockstep. Each of the seven closed-set vocabularies
// (Template, Delivery, Control, Topic, Target, Objective, Pretext) MUST be
// consistent across:
//   (a) engine constants in src/lib/safeeval-v5.js (TEMPLATE_LABELS et al),
//   (b) the JSON Schema validator at tests/schema/v5-envelope.schema.json
//       ($defs.template_labels.enum et al),
//   (c) the vocabulary memo's per-label table at
//       docs/memos/2026-05-26-policy-v5-classifier-display-vocabulary.md,
//   (d) the schema doc reference at docs/07-v5-schema.md (presence-only --
//       the doc references the memo for the closed-set tables rather than
//       duplicating them, so this check is "the label-set name appears in
//       the schema doc somewhere," not full enum membership).
// Spec: vocabulary memo section 8.
function extractEngineLabelArray(engineSrc, constName) {
  const re = new RegExp('export\\s+const\\s+' + constName + '\\s*=\\s*\\[([\\s\\S]*?)\\]');
  const m = engineSrc.match(re);
  if (!m) throw new Error('Engine constant missing: ' + constName);
  return m[1]
    .split(',')
    .map(s => s.trim().replace(/^["']|["']$/g, ''))
    .filter(s => s.length > 0 && !s.startsWith('//'));
}

function extractMemoLabelTable(memoSrc, sectionHeader) {
  // Walk from the section header to the next heading at the same or higher
  // level. Within the section, extract every `<label>` from the table's
  // first column. Memo convention: each closed-set value appears as
  // `\`<label>\`` in a markdown table row's first column.
  const startIdx = memoSrc.indexOf(sectionHeader);
  if (startIdx === -1) throw new Error('Memo section missing: ' + sectionHeader);
  // The next section starts at the next "### " or "## " heading after the section header.
  let nextIdx = memoSrc.length;
  const candidates = [];
  const reNext = /\n(##? )/g;
  reNext.lastIndex = startIdx + sectionHeader.length;
  let nm;
  while ((nm = reNext.exec(memoSrc)) !== null) {
    candidates.push(nm.index);
  }
  if (candidates.length > 0) nextIdx = candidates[0];
  const slice = memoSrc.slice(startIdx, nextIdx);

  // The memo has two tables per section: the closed-set table (which is the
  // first one and is what we want) and a prose-to-label mapping table
  // (which may name labels in either column). We pick out labels from the
  // FIRST column only of every row that begins with `\`<word>\` |`. To
  // distinguish the closed-set table from the prose-to-label mapping
  // table, we stop scanning at the "**Prose-to-label mapping" marker.
  const stopMarker = slice.indexOf('**Prose-to-label mapping');
  const closedSetSlice = stopMarker >= 0 ? slice.slice(0, stopMarker) : slice;

  const labels = new Set();
  // Match table rows whose first column is a single-backtick-wrapped label.
  // Form: `| \`label\` |` with any whitespace around the pipes.
  const reRow = /^\s*\|\s*`([a-z_]+)`\s*\|/gm;
  let rm;
  while ((rm = reRow.exec(closedSetSlice)) !== null) {
    labels.add(rm[1]);
  }
  return Array.from(labels);
}

function extractSchemaLabelArray(schema, defName) {
  const def = schema.$defs && schema.$defs[defName];
  if (!def || !Array.isArray(def.enum)) {
    throw new Error('Schema $defs missing enum: ' + defName);
  }
  return def.enum.slice();
}

function setsEqual(a, b) {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  for (const v of a) if (!sb.has(v)) return false;
  return true;
}

function setDiff(a, b) {
  const sb = new Set(b);
  return a.filter(v => !sb.has(v));
}

function checkV51ClassifierDisplayLockstep() {
  const engineSrc = fs.readFileSync(V5_ENGINE, 'utf-8');
  const schemaDocSrc = fs.readFileSync(V5_SCHEMA_DOC, 'utf-8');
  const schema = JSON.parse(fs.readFileSync(V5_SCHEMA, 'utf-8'));

  // The vocabulary memo at CLASSIFIER_DISPLAY_MEMO is the policy-authored
  // source-of-truth that seeded the engine constants. Per the Cowork
  // workflow convention (docs/memos/ is the policy track's working
  // directory and is untracked in this portfolio repo), the memo file may
  // be absent in CI even though it exists locally on the policy author's
  // machine. The in-repo lockstep trinity is engine <-> schema <-> schema-doc;
  // the memo check is opportunistic and skipped (with a notice) when the
  // file isn't present. When it IS present, it MUST agree -- mismatches
  // are still failures so a local lockstep run catches policy/code drift.
  let memoSrc = null;
  let memoStatus = 'absent';
  if (fs.existsSync(CLASSIFIER_DISPLAY_MEMO)) {
    memoSrc = fs.readFileSync(CLASSIFIER_DISPLAY_MEMO, 'utf-8');
    memoStatus = 'present';
  }

  let totalMisses = 0;

  for (const ent of V51_CLASSIFIER_LABEL_SETS) {
    let engineLabels;
    try { engineLabels = extractEngineLabelArray(engineSrc, ent.engine); }
    catch (e) { console.error('FAIL ' + ent.engine + ': ' + e.message); totalMisses++; continue; }

    let schemaLabels;
    try { schemaLabels = extractSchemaLabelArray(schema, ent.schemaDef); }
    catch (e) { console.error('FAIL ' + ent.engine + ': ' + e.message); totalMisses++; continue; }

    let memoLabels = null;
    if (memoSrc) {
      try { memoLabels = extractMemoLabelTable(memoSrc, ent.memoSection); }
      catch (e) { console.error('FAIL ' + ent.engine + ' (memo parse): ' + e.message); totalMisses++; continue; }
    }

    let ok = true;
    if (!setsEqual(engineLabels, schemaLabels)) {
      ok = false;
      console.error('LOCKSTEP FAIL ' + ent.engine + ' (engine vs schema):');
      const extraEng = setDiff(engineLabels, schemaLabels);
      const extraSch = setDiff(schemaLabels, engineLabels);
      if (extraEng.length > 0) console.error('  engine has but schema lacks: ' + extraEng.join(', '));
      if (extraSch.length > 0) console.error('  schema has but engine lacks: ' + extraSch.join(', '));
    }
    if (memoLabels !== null && !setsEqual(engineLabels, memoLabels)) {
      ok = false;
      console.error('LOCKSTEP FAIL ' + ent.engine + ' (engine vs memo ' + ent.memoSection + '):');
      const extraEng = setDiff(engineLabels, memoLabels);
      const extraMemo = setDiff(memoLabels, engineLabels);
      if (extraEng.length > 0) console.error('  engine has but memo lacks: ' + extraEng.join(', '));
      if (extraMemo.length > 0) console.error('  memo has but engine lacks: ' + extraMemo.join(', '));
    }

    // Schema doc presence-only check: the constant name (e.g., TEMPLATE_LABELS)
    // must appear in docs/07-v5-schema.md so the schema doc references the
    // engine constants. Set membership is not duplicated in the schema doc
    // (the memo owns the tables; the schema doc references them).
    if (schemaDocSrc.indexOf(ent.engine) < 0) {
      ok = false;
      console.error('LOCKSTEP FAIL ' + ent.engine + ': name not referenced in docs/07-v5-schema.md.');
    }

    if (ok) {
      const sources = memoLabels !== null
        ? 'engine=schema=memo, doc references the name'
        : 'engine=schema, doc references the name (memo absent: ' + memoStatus + ')';
      console.log('OK ' + ent.engine + ' (' + engineLabels.length + ' values; ' + sources + ')');
    } else {
      totalMisses++;
    }
  }

  if (totalMisses > 0) {
    console.error('');
    console.error('v5.1 classifier-display lockstep failed with ' + totalMisses + ' enum(s) mismatched.');
    console.error('Closed sets must be consistent across src/lib/safeeval-v5.js, tests/schema/v5-envelope.schema.json, docs/07-v5-schema.md, and (when present locally) the vocabulary memo.');
    return false;
  }
  if (memoStatus === 'absent') {
    console.log('v5.1 classifier-display lockstep passed (memo absent in this environment; engine<->schema<->doc verified).');
  } else {
    console.log('v5.1 classifier-display lockstep passed.');
  }
  return true;
}

function main() {
  const docCodeOk = checkDocCodeLockstep();
  console.log('');
  const schemaEngineOk = checkSchemaEngineLockstep();
  console.log('');
  const classifierDisplayOk = checkV51ClassifierDisplayLockstep();
  if (!docCodeOk || !schemaEngineOk || !classifierDisplayOk) {
    process.exit(1);
  }
  console.log('');
  console.log('All lockstep checks passed.');
}

main();
