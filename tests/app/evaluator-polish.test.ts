// Evaluator polish coverage. The evaluator page and its layout are client/server
// React surfaces that the node test environment cannot render, so -- following
// the same convention as app-nav.test.ts -- these assertions read the source and
// check the structural and copy decisions that the polish pass locked in:
//   - the layout swaps nav by auth state and frames the page with the shared Footer
//   - the landing Nav carries an optional current-tab highlight
//   - the page leads with a hero H1 + plain-language copy, free of the old jargon
//   - the example chips are labelled and the CTA is the brand-blue "Run evaluation"

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

const LAYOUT_SRC = read('src/app/evaluator/layout.js');
const PAGE_SRC = read('src/app/evaluator/page.js');
const NAV_SRC = read('src/components/landing/Nav.js');

describe('evaluator layout: auth-aware chrome', () => {
  it('resolves the session server-side at request time', () => {
    expect(LAYOUT_SRC).toContain("import { getCurrentUser } from '@/lib/auth'");
    expect(LAYOUT_SRC).toContain('await getCurrentUser()');
    expect(LAYOUT_SRC).toContain("export const dynamic = 'force-dynamic'");
  });

  it('renders the AppNav for signed-in users and the landing Nav for visitors', () => {
    expect(LAYOUT_SRC).toContain('AppNav');
    expect(LAYOUT_SRC).toContain('email={user.email}');
    expect(LAYOUT_SRC).toContain('<Nav current="/evaluator" />');
    // The auth state picks between them.
    expect(LAYOUT_SRC).toContain('user ?');
  });

  it('frames the page with the shared Footer', () => {
    expect(LAYOUT_SRC).toContain('Footer');
    expect(LAYOUT_SRC).toContain('<Footer />');
  });
});

describe('landing Nav: current-tab highlight', () => {
  it('accepts a current prop and marks the matching link', () => {
    expect(NAV_SRC).toContain('function Nav({ current })');
    expect(NAV_SRC).toContain("aria-current={current === link.href ? 'page' : undefined}");
    expect(NAV_SRC).toContain('font-medium');
  });
});

describe('evaluator page: hero + plain-language copy', () => {
  it('leads with an "Evaluate a prompt" H1 at hero scale', () => {
    expect(PAGE_SRC).toMatch(/<h1[^>]*>\s*Evaluate a prompt\s*<\/h1>/);
    expect(PAGE_SRC).toContain('text-4xl md:text-5xl');
  });

  it('explains what the user does and gets back, in plain language', () => {
    expect(PAGE_SRC).toContain('Paste a prompt to see how SafeEval classifies it');
    expect(PAGE_SRC).toContain('walks it through the same fraud-and-scams policy a reviewer would apply');
  });

  it('drops the bespoke header and gray-bg shell', () => {
    expect(PAGE_SRC).not.toContain('View on GitHub');
    expect(PAGE_SRC).not.toContain('AI trust');
    expect(PAGE_SRC).not.toContain('min-h-screen bg-gray-50');
    expect(PAGE_SRC).not.toContain('About this tool');
  });

  it('strips the internal jargon from the description', () => {
    for (const jargon of [
      'structured decomposition',
      'scored components',
      'typology analysis',
      'escalation decision',
      'policy rationale',
      'Fraud Analysis Framework (FAF)',
    ]) {
      expect(PAGE_SRC).not.toContain(jargon);
    }
  });
});

describe('evaluator page: labelled chips + clarified CTA', () => {
  it('labels the example chips', () => {
    expect(PAGE_SRC).toContain('Try one of these');
  });

  it('uses a brand-blue "Run evaluation" CTA instead of a dark "Evaluate"', () => {
    expect(PAGE_SRC).toContain('Run evaluation');
    expect(PAGE_SRC).toContain('bg-brand-blue');
    // The old echo-the-title button copy is gone from the prompt CTA.
    expect(PAGE_SRC).not.toMatch(/\?\s*'Evaluating\.\.\.'\s*:\s*'Evaluate'/);
  });
});

describe('evaluator page: result + empty state design language', () => {
  it('uses cool slate borders and a soft-shadowed disposition card', () => {
    expect(PAGE_SRC).toContain('bg-white border border-slate-200 rounded-xl');
    expect(PAGE_SRC).toContain('rounded-2xl border-2 shadow-soft');
    // Section eyebrows moved onto the cool slate scale.
    expect(PAGE_SRC).toContain('text-xs font-semibold text-slate-700 uppercase tracking-wider');
  });

  it('shows a subtle placeholder before the first evaluation', () => {
    expect(PAGE_SRC).toContain('Your evaluation will appear here');
    expect(PAGE_SRC).toContain('!loading && !v5');
  });
});
