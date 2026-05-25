// scripts/check-null-bytes.js
//
// Fails if any .js file under src/ contains a U+0000 null byte.
//
// Why: src/app/page.js was twice padded with trailing null bytes after edits
// from a sandbox over OneDrive. Null bytes silently break `next build` and
// produce confusing parse errors. This guard catches the regression at CI
// time so the fix never has to be done reactively again.
//
// Wired into .github/workflows/safeeval-gate.yml alongside ASCII + lockstep.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIR = path.join(ROOT, 'src');

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
}

function main() {
  if (!fs.existsSync(SCAN_DIR)) {
    console.error('Scan directory missing: ' + SCAN_DIR);
    process.exit(1);
  }
  const files = [];
  walk(SCAN_DIR, files);

  let hits = 0;
  for (const file of files) {
    const buf = fs.readFileSync(file);
    const idx = buf.indexOf(0x00);
    if (idx !== -1) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      console.error('NULL BYTE in ' + rel + ' at offset ' + idx + ' (file length ' + buf.length + ')');
      hits++;
    }
  }

  if (hits > 0) {
    console.error('');
    console.error('Null-byte guard failed: ' + hits + ' file(s) contain U+0000.');
    console.error('Strip with: node -e "const f=process.argv[1]; const fs=require(\'fs\'); const b=fs.readFileSync(f); let e=b.length; while(e>0 && b[e-1]===0)e--; fs.writeFileSync(f, b.slice(0,e));" <path>');
    process.exit(1);
  }
  console.log('Null-byte check passed: scanned ' + files.length + ' .js file(s) under src/.');
}

main();
