// scripts/check-lockstep.js
//
// Verifies that every typology declared in src/lib/safeeval.js TYPOLOGIES
// appears in each of the canonical FAF docs:
//   docs/01-framework.md
//   docs/03-master-policy.md
//   docs/05-classifier-guidance.md
//
// Exits 0 if every typology appears in every doc.
// Exits 1 with a per-doc miss list otherwise.
//
// This is the lockstep gate referenced in subagents/00-orchestrator.md and
// the orchestration POA. It runs in CI via .github/workflows/safeeval-gate.yml.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENGINE = path.join(ROOT, 'src', 'lib', 'safeeval.js');
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

function main() {
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
    console.error('Lockstep gate failed with ' + totalMisses + ' miss(es).');
    console.error('Every typology in TYPOLOGIES (except NONE) must appear in every canonical FAF doc.');
    process.exit(1);
  }
  console.log('Lockstep check passed.');
}

main();
