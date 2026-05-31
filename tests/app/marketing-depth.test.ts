// Marketing-surface depth regression coverage. The 2026-05-30 cool repaint
// flattened the marketing pages -- shadowless cards, one uniform background,
// and a near-invisible slate-on-slate hero. The depth pass restored figure-
// ground contrast within the same cool-institutional palette: a cool elevation
// ramp, a white/bg-tool section rhythm, prominent brand-blue CTA banners, a
// dark footer, a rebuilt hero mockup, and per-section glyphs. These source-read
// assertions (the node env cannot render the React surfaces) lock that in so a
// future edit can't quietly revert the page back to floating text blocks.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('depth: the cool elevation ramp is defined', () => {
  const cfg = read('tailwind.config.js');
  it('tailwind exposes the card / lift / float shadow tokens', () => {
    const shadows = cfg.slice(cfg.indexOf('boxShadow:'));
    expect(shadows).toContain('card:');
    expect(shadows).toContain('lift:');
    expect(shadows).toContain('float:');
  });
  it('the elevation ramp is cool-tinted (slate-900 rgba), not warm', () => {
    const shadows = cfg.slice(cfg.indexOf('boxShadow:'), cfg.indexOf('boxShadow:') + 600);
    expect(shadows).toContain('rgba(15, 23, 42');
  });
});

// Cards that should read as lifted surfaces, not painted-on flat blocks.
// TrustSignals is intentionally absent: the 2026-05-30 polish converted it from
// four icon-cards into a chrome-free, number-led proof strip (guarded below).
const ELEVATED_CARD_SURFACES = [
  'src/components/landing/HowItWorks.js',
  'src/components/landing/Features.js',
  'src/components/landing/CaseStudy.js',
  'src/components/product/FiveStages.js',
  'src/components/product/AuditStory.js',
  'src/components/product/FeedbackStory.js',
  'src/components/case-study/Setup.js',
  'src/components/case-study/WhatChanged.js',
];

describe('depth: marketing cards carry elevation', () => {
  for (const rel of ELEVATED_CARD_SURFACES) {
    it(`${rel} uses shadow-card on its cards`, () => {
      expect(read(rel)).toContain('shadow-card');
    });
  }
  it('hoverable cards deepen their shadow on hover', () => {
    // A representative sample -- every grid/list card opts into the hover lift.
    for (const rel of ['src/components/landing/Features.js', 'src/components/product/FiveStages.js', 'src/components/case-study/Setup.js']) {
      expect(read(rel)).toContain('hover:shadow-lift');
    }
  });
});

describe('depth: sections alternate background for rhythm', () => {
  // The white half of the white / bg-tool alternation on each page.
  const WHITE_SECTIONS = [
    'src/components/landing/Problem.js',
    'src/components/landing/Features.js',
    'src/components/landing/TrustSignals.js',
    'src/components/product/FiveStages.js',
    'src/components/product/FeedbackStory.js',
    'src/components/case-study/Setup.js',
    'src/components/case-study/Findings.js',
  ];
  for (const rel of WHITE_SECTIONS) {
    it(`${rel} renders on a white section background`, () => {
      expect(read(rel)).toContain('bg-white');
    });
  }
  // The bg-tool half stays tinted so the alternation actually alternates.
  it('HowItWorks stays on the tinted bg-tool background', () => {
    expect(read('src/components/landing/HowItWorks.js')).toContain('bg-tool');
  });
});

describe('depth: CTA banners are prominent and the footer is dark', () => {
  const CTA_BANNERS = [
    'src/components/landing/CTABanner.js',
    'src/components/product/ProductCTA.js',
    'src/components/case-study/CaseStudyCTA.js',
  ];
  for (const rel of CTA_BANNERS) {
    it(`${rel} is a prominent brand-blue floating card`, () => {
      const src = read(rel);
      expect(src).toContain('bg-brand-blue rounded-3xl');
      expect(src).toContain('shadow-float');
    });
  }
  it('the shared footer bookends the page in dark slate-900', () => {
    expect(read('src/components/landing/Footer.js')).toContain('bg-slate-900');
  });
});

describe('depth: the hero is a lifted evaluation-flow mockup', () => {
  const hero = read('src/components/landing/Hero.js');
  it('the illustration floats on shadow-float', () => {
    expect(hero).toContain('shadow-float');
  });
  it('it reads as a real classification result, not an abstract blob', () => {
    expect(hero).toContain('Disposition');
    expect(hero).toContain('Confidence');
    expect(hero).toContain('Block');
  });
});

describe('depth: text-heavy sections carry an illustrative glyph', () => {
  it('the stage flows render a per-stage icon', () => {
    expect(read('src/components/landing/HowItWorks.js')).toContain('StageIcon');
    expect(read('src/components/product/FiveStages.js')).toContain('StageIcon');
  });
  it('the setup cards render a per-card icon', () => {
    expect(read('src/components/case-study/Setup.js')).toContain('SetupIcon');
  });
  it('the trust signals read as a number-led proof strip', () => {
    // The 2026-05-30 polish replaced the four labelled icon-cards with
    // number-led proof statements: no card chrome, no per-card glyph, the
    // strong fact leads at display scale.
    const src = read('src/components/landing/TrustSignals.js');
    expect(src).toContain('text-5xl md:text-6xl');
    expect(src).toContain('177');
    expect(src).not.toContain('shadow-card');
  });
  it('the landing case-study preview shows a stat block', () => {
    expect(read('src/components/landing/CaseStudy.js')).toContain('cases evaluated');
  });
});
