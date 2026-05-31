// Surface-type palette regression coverage. Originally (2026-05-30) the
// portfolio ran a hybrid palette -- cool tool surfaces, warm-editorial
// marketing surfaces. The hybrid was retired the same day: the whole site now
// uses one cool-institutional register (bg-tool #F6F9FC, brand-blue accents,
// slate neutrals, red reserved for danger). These source-read assertions -- the
// node env cannot render the React surfaces -- lock that in so a future edit
// can't reintroduce the warm cream/sage/coral register on any surface.

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

// Every marketing surface touched by the site-wide cool migration. The shared
// chrome (landing Nav/Footer) and all three page trees -- landing, /product,
// /case-study -- must carry no warm classes.
const MARKETING_SURFACES = [
  'src/app/page.js',
  'src/app/layout.js',
  'src/components/landing/Nav.js',
  'src/components/landing/Hero.js',
  'src/components/landing/Problem.js',
  'src/components/landing/HowItWorks.js',
  'src/components/landing/Features.js',
  'src/components/landing/CaseStudy.js',
  'src/components/landing/TrustSignals.js',
  'src/components/landing/CTABanner.js',
  'src/components/landing/Footer.js',
  'src/app/product/page.js',
  'src/components/product/ProductHero.js',
  'src/components/product/FiveStages.js',
  'src/components/product/AuditStory.js',
  'src/components/product/FeedbackStory.js',
  'src/components/product/ProductCTA.js',
  'src/app/case-study/page.js',
  'src/components/case-study/CaseStudyHero.js',
  'src/components/case-study/Setup.js',
  'src/components/case-study/Findings.js',
  'src/components/case-study/WhatChanged.js',
  'src/components/case-study/CaseStudyCTA.js',
];

// Marketing surfaces that own a primary call-to-action button.
const MARKETING_CTA_SURFACES = [
  'src/components/landing/Hero.js',
  'src/components/landing/CaseStudy.js',
  'src/components/landing/CTABanner.js',
  'src/components/product/ProductHero.js',
  'src/components/product/ProductCTA.js',
  'src/components/case-study/CaseStudyCTA.js',
];

describe('palette: tool surfaces are cool-institutional', () => {
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

describe('palette: marketing surfaces are cool-institutional too (no warm/cool hybrid)', () => {
  for (const rel of MARKETING_SURFACES) {
    it(`${rel} carries no warm cream/sage/coral classes`, () => {
      expect(read(rel)).not.toMatch(WARM_CLASS);
    });
  }

  it('landing, product, and case-study main containers sit on bg-tool', () => {
    for (const rel of ['src/app/page.js', 'src/app/product/page.js', 'src/app/case-study/page.js']) {
      expect(read(rel)).toContain('min-h-screen bg-tool');
    }
  });

  it('the root layout and globals body background are cool, not cream', () => {
    expect(read('src/app/layout.js')).toContain('bg-tool');
    expect(read('src/app/layout.js')).not.toMatch(WARM_CLASS);
    expect(read('src/app/globals.css')).toContain('bg-tool');
    expect(read('src/app/globals.css')).not.toContain('bg-cream');
  });

  it('marketing primary CTAs are brand-blue, not coral', () => {
    for (const rel of MARKETING_CTA_SURFACES) {
      const src = read(rel);
      expect(src).toContain('bg-brand-blue');
      expect(src).not.toContain('coral');
    }
  });

  it('the hero illustration uses cool fills (slate frame, brand-blue accent)', () => {
    const src = read('src/components/landing/Hero.js');
    expect(src).toContain('#E2E8F0'); // slate-200 frame
    expect(src).toContain('#2962E0'); // brand-blue accent
    // No warm hex fills survive (sage #DCEBDE family, coral #F46E54, cream #FBF8F3).
    expect(src).not.toContain('#DCE8DE');
    expect(src).not.toContain('#F46E54');
    expect(src).not.toContain('#52835D');
  });
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
