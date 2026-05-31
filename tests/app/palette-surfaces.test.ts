// Surface-type palette regression coverage (2026-05-30 cool-institutional
// migration). The portfolio runs a hybrid palette: tool surfaces (evaluator,
// /intelligence, /app/*, signup, login) use the cool set (bg-tool #F6F9FC,
// brand-blue, slate neutrals, red danger); marketing surfaces (landing,
// /product, /case-study) stay warm-editorial (cream/sage/coral). These source-
// read assertions -- the node env cannot render the React surfaces -- lock the
// boundary so a future edit can't silently repaint one register as the other.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

// Matches a warm palette *class* (bg-/text-/border-/ring-/divide-/gradient
// stops), not the bare words in prose, so comments mentioning the palette by
// name don't trip the guard.
const WARM_CLASS = /(?:bg|text|border|ring|divide|from|via|to)-(?:cream|sage|coral)-\d/;

const TOOL_SURFACES = [
  'src/app/evaluator/page.js',
  'src/app/evaluator/layout.js',
  'src/app/intelligence/page.js',
  'src/app/intelligence/layout.js',
  'src/app/app/_components/AppNav.js',
  'src/app/app/welcome/page.js',
  'src/app/app/dashboard/page.js',
  'src/app/app/classifiers/page.js',
  'src/app/app/classifiers/ClassifierForm.js',
  'src/app/app/classifiers/LifecycleActions.js',
  'src/app/app/classifiers/labels.ts',
  'src/app/app/patterns/page.js',
  'src/app/app/patterns/PatternComposerForm.js',
  'src/app/app/patterns/labels.ts',
  'src/app/signup/page.js',
  'src/app/login/page.js',
];

const MARKETING_SURFACES = [
  'src/components/landing/Hero.js',
  'src/components/landing/Nav.js',
  'src/components/landing/Footer.js',
  'src/app/product/page.js',
  'src/app/case-study/page.js',
];

describe('palette boundary: tool surfaces are cool-institutional', () => {
  for (const rel of TOOL_SURFACES) {
    it(`${rel} carries no warm cream/sage/coral classes`, () => {
      expect(read(rel)).not.toMatch(WARM_CLASS);
    });
  }

  it('evaluator frames the page on the cool tool background', () => {
    expect(read('src/app/evaluator/layout.js')).toContain('bg-tool');
    expect(read('src/app/intelligence/layout.js')).toContain('bg-tool');
  });

  it('evaluator primary CTA and policy link use brand-blue', () => {
    const src = read('src/app/evaluator/page.js');
    expect(src).toContain('bg-brand-blue');
    expect(src).toContain('text-brand-blue');
  });

  it('signed-in app pages sit on the cool tool background', () => {
    for (const rel of ['src/app/app/dashboard/page.js', 'src/app/app/welcome/page.js', 'src/app/signup/page.js']) {
      expect(read(rel)).toContain('min-h-screen bg-tool');
    }
  });
});

describe('palette boundary: marketing surfaces stay warm-editorial', () => {
  for (const rel of MARKETING_SURFACES) {
    it(`${rel} still uses the warm cream/sage/coral register`, () => {
      expect(read(rel)).toMatch(WARM_CLASS);
    });
  }
});

describe('severity color regression: block disposition is red, not coral', () => {
  const src = read('src/app/evaluator/page.js');

  it('the block disposition renders in the red family', () => {
    const cfg = src.slice(src.indexOf('V5_ACTION_CONFIG'));
    const block = cfg.slice(cfg.indexOf('block:'), cfg.indexOf('block:') + 240);
    expect(block).toContain('bg-red-');
    expect(block).toContain('border-red-');
    expect(block).toContain('text-red-');
    expect(block).not.toContain('coral');
  });

  it('the disposition config never references coral', () => {
    const cfg = src.slice(src.indexOf('V5_ACTION_CONFIG'), src.indexOf('V5_ACTION_CONFIG') + 1200);
    expect(cfg).not.toContain('coral');
  });

  it('tool-surface form errors render in red (text-red-600 == #DC2626)', () => {
    expect(read('src/app/signup/page.js')).toContain('text-red-900');
    expect(read('src/app/app/classifiers/ClassifierForm.js')).toContain('text-red-600');
    expect(read('src/app/app/patterns/PatternComposerForm.js')).toContain('text-red-600');
  });
});
