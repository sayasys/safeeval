// scripts/measure-haiku-precision.js
//
// Measures Haiku's benign-classification precision against a labeled dataset.
// This is the runnable check behind the documented Stage 1 short-circuit gate.
//
// Pipeline:
//   1. Read a labeled JSONL dataset (default: data/haiku-precision-seed.jsonl).
//      Each line: { "prompt": "...", "label": "benign" | "fraud" }.
//   2. For each prompt, call the same SYSTEM_STAGE_1_TRIAGE prompt that the
//      runtime engine uses, with claude-haiku-4-5 at temperature 0.
//   3. Compute Haiku's measured precision on the BENIGN class:
//        precision_benign = true_benign / (true_benign + false_benign)
//      Where false_benign = cases labeled fraud that Haiku called benign.
//   4. Compare against POLICY_CONFIG.TRIAGE_BENIGN_PRECISION_MIN (currently 0.98).
//      Pass: exit 0. Fail: print misclassified cases, exit 1.
//
// This is the gate referenced in:
//   - src/lib/safeeval-v5.js (POLICY_CONFIG.TRIAGE_BENIGN_PRECISION_MIN comment)
//   - docs/policy-spec-v5.0.md Section 1 and Decision 12
//   - docs/04-enforcement-design.md Section 8
//
// Usage:
//   node scripts/measure-haiku-precision.js [path-to-jsonl]
//
// Notes:
//   - The seed dataset at data/haiku-precision-seed.jsonl is small and curated.
//     Swap in larger label sets without changing this harness.
//   - This script REQUIRES ANTHROPIC_API_KEY in the environment. It will not
//     run in CI without that key.
//   - This script is ASCII-safe by policy (matches src/lib/safeeval-v5.js).

const fs = require('fs');
const path = require('path');

// We use dynamic import for ESM (POLICY_CONFIG, SYSTEM_STAGE_1_TRIAGE) because
// safeeval-v5.js is ESM and this script is CommonJS for portability with the
// existing check-lockstep.js script.
async function loadEngine() {
  // CommonJS-friendly access to the ESM module's exports. When run via Node 18+,
  // a dynamic import handles this transparently.
  const enginePath = path.resolve(__dirname, '..', 'src', 'lib', 'safeeval-v5.js');
  const url = 'file://' + enginePath;
  const mod = await import(url);
  return mod;
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  return text.split(/\r?\n/)
    .filter(function (line) { return line.trim().length > 0; })
    .map(function (line, idx) {
      try { return JSON.parse(line); }
      catch (e) { throw new Error('Bad JSONL at line ' + (idx + 1) + ': ' + e.message); }
    });
}

async function classifyOne(anthropic, systemPrompt, modelId, prompt) {
  const resp = await anthropic.messages.create({
    model: modelId,
    max_tokens: 400,
    temperature: 0.0,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = (resp.content[0] && resp.content[0].text) || '';
  // Parse the JSON object the same way the engine does.
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const start = t.indexOf('{');
  if (start < 0) return null;
  let depth = 0; let end = -1;
  for (let i = start; i < t.length; i++) {
    if (t[i] === '{') depth++;
    else if (t[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  try { return JSON.parse(t.slice(start, end + 1)); } catch (e) { return null; }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set. This script requires API access.');
    process.exit(2);
  }

  const dataPath = process.argv[2] || path.resolve(__dirname, '..', 'data', 'haiku-precision-seed.jsonl');
  if (!fs.existsSync(dataPath)) {
    console.error('Dataset not found: ' + dataPath);
    process.exit(2);
  }

  const dataset = readJsonl(dataPath);
  console.log('Loaded ' + dataset.length + ' labeled cases from ' + dataPath);

  // Validate labels.
  const labelValues = new Set();
  dataset.forEach(function (row) { labelValues.add(row.label); });
  const acceptedLabels = ['benign', 'fraud'];
  for (const l of labelValues) {
    if (!acceptedLabels.includes(l)) {
      console.error('Unknown label: ' + l + '. Allowed: ' + acceptedLabels.join(', '));
      process.exit(2);
    }
  }

  const engine = await loadEngine();
  const POLICY_CONFIG = engine.POLICY_CONFIG;
  const floor = POLICY_CONFIG.TRIAGE_BENIGN_PRECISION_MIN;

  const systemPrompt = engine.SYSTEM_STAGE_1_TRIAGE;
  if (typeof systemPrompt !== 'string' || systemPrompt.length === 0) { console.error('SYSTEM_STAGE_1_TRIAGE not exported from safeeval-v5.js'); process.exit(2); }

  // Anthropic SDK.
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const modelId = 'claude-haiku-4-5';

  // Run.
  console.log('Running ' + dataset.length + ' prompts through ' + modelId + ' ...');
  let truePositiveBenign = 0;    // labeled benign, Haiku called benign
  let falsePositiveBenign = 0;   // labeled fraud, Haiku called benign (the dangerous one)
  let trueNegativeBenign = 0;    // labeled fraud, Haiku did NOT call benign
  let falseNegativeBenign = 0;   // labeled benign, Haiku did NOT call benign
  const misclassified = [];

  for (let i = 0; i < dataset.length; i++) {
    const row = dataset[i];
    let predicted = null;
    try {
      const out = await classifyOne(anthropic, systemPrompt, modelId, row.prompt);
      predicted = out && out.l1_candidate;
    } catch (e) {
      console.error('  case ' + (i + 1) + ': API error: ' + e.message);
      predicted = null;
    }
    const calledBenign = predicted === 'benign';
    if (row.label === 'benign' && calledBenign) truePositiveBenign++;
    else if (row.label === 'benign' && !calledBenign) { falseNegativeBenign++; misclassified.push({ id: row.id || ('case-' + (i + 1)), label: row.label, predicted: predicted, prompt: row.prompt.slice(0, 80) + '...' }); }
    else if (row.label === 'fraud' && calledBenign) { falsePositiveBenign++; misclassified.push({ id: row.id || ('case-' + (i + 1)), label: row.label, predicted: predicted, prompt: row.prompt.slice(0, 80) + '...' }); }
    else trueNegativeBenign++;
    process.stdout.write('.');
    if ((i + 1) % 20 === 0) process.stdout.write(' ' + (i + 1) + '\n');
  }
  process.stdout.write('\n');

  // Compute precision on the BENIGN class.
  const denom = truePositiveBenign + falsePositiveBenign;
  const precisionBenign = denom === 0 ? 0 : truePositiveBenign / denom;

  console.log('');
  console.log('Results:');
  console.log('  Total cases:              ' + dataset.length);
  console.log('  Labeled benign:           ' + (truePositiveBenign + falseNegativeBenign));
  console.log('  Labeled fraud:            ' + (trueNegativeBenign + falsePositiveBenign));
  console.log('  TP (benign->benign):      ' + truePositiveBenign);
  console.log('  FP (fraud->benign):       ' + falsePositiveBenign + '  <-- the dangerous miss');
  console.log('  FN (benign->non-benign):  ' + falseNegativeBenign);
  console.log('  TN (fraud->non-benign):   ' + trueNegativeBenign);
  console.log('');
  console.log('  Precision on benign class: ' + precisionBenign.toFixed(4));
  console.log('  Required floor:            ' + floor);
  console.log('');

  if (precisionBenign >= floor) {
    console.log('PASS: Stage 1 short-circuit gate met.');
    process.exit(0);
  } else {
    console.log('FAIL: Stage 1 short-circuit gate NOT met.');
    console.log('  Per policy spec Decision 12 and Section 1, Stage 1 short-circuit');
    console.log('  is permitted only when measured precision >= ' + floor + '.');
    console.log('  Either increase the labeled dataset size and re-measure, tighten');
    console.log('  SYSTEM_STAGE_1_TRIAGE to be more conservative, or disable the');
    console.log('  short-circuit by setting TRIAGE_BENIGN_CONFIDENCE_MIN to 1.01.');
    if (misclassified.length > 0) {
      console.log('');
      console.log('Misclassified cases:');
      misclassified.slice(0, 10).forEach(function (m) {
        console.log('  ' + m.id + ' [labeled=' + m.label + ', predicted=' + m.predicted + '] ' + m.prompt);
      });
      if (misclassified.length > 10) {
        console.log('  ... and ' + (misclassified.length - 10) + ' more.');
      }
    }
    process.exit(1);
  }
}

main().catch(function (err) {
  console.error('Fatal: ' + (err && err.message ? err.message : String(err)));
  process.exit(2);
});
