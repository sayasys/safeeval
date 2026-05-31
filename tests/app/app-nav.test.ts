// AppNav tests. The nav targets live in a plain data module so they can be
// asserted directly; the component wiring (the sign-out button and its handler,
// the mobile menu toggle) is checked against the source, since the node test
// environment has no DOM to render a client component into.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  APP_NAV_LINKS,
  isPolicySectionPath,
} from '../../src/app/app/_components/app-nav-links';

const NAV_SRC = readFileSync(
  join(process.cwd(), 'src/app/app/_components/AppNav.js'),
  'utf8',
);

const SUBNAV_SRC = readFileSync(
  join(process.cwd(), 'src/app/app/_components/PolicySubNav.js'),
  'utf8',
);

describe('app nav links', () => {
  it('exposes exactly the four primary destinations (post-IA reorg)', () => {
    expect(APP_NAV_LINKS).toHaveLength(4);
    expect(APP_NAV_LINKS.map((l) => l.label)).toEqual([
      'Dashboard',
      'Policy',
      'Evaluator',
      'Intelligence',
    ]);
  });

  it('points each label at the right route', () => {
    const byLabel = Object.fromEntries(
      APP_NAV_LINKS.map((l) => [l.label, l.href]),
    );
    expect(byLabel.Dashboard).toBe('/app/dashboard');
    expect(byLabel.Policy).toBe('/app/policy');
    expect(byLabel.Evaluator).toBe('/evaluator');
    expect(byLabel.Intelligence).toBe('/intelligence');
  });

  it('no longer exposes Classifiers or Patterns as top-level tabs', () => {
    const labels = APP_NAV_LINKS.map((l) => l.label);
    expect(labels).not.toContain('Classifiers');
    expect(labels).not.toContain('Patterns');
  });
});

describe('isPolicySectionPath', () => {
  it('matches the policy landing page and both sub-pages (incl. nested)', () => {
    for (const p of [
      '/app/policy',
      '/app/classifiers',
      '/app/classifiers/new',
      '/app/classifiers/abc-123',
      '/app/patterns',
      '/app/patterns/new',
      '/app/patterns/xyz',
    ]) {
      expect(isPolicySectionPath(p)).toBe(true);
    }
  });

  it('does not match other app routes (dashboard, reports, evaluator)', () => {
    for (const p of [
      '/app/dashboard',
      '/app/reports',
      '/app/reports/42',
      '/evaluator',
      '/intelligence',
      '/app/policyx', // prefix guard: a sibling that merely shares the string must not match
    ]) {
      expect(isPolicySectionPath(p)).toBe(false);
    }
  });
});

describe('AppNav Policy-bucket highlight', () => {
  it('routes the Policy tab through isPolicySectionPath', () => {
    expect(NAV_SRC).toContain('isPolicySectionPath');
    expect(NAV_SRC).toContain(
      "if (href === '/app/policy') return isPolicySectionPath(pathname)",
    );
  });
});

describe('PolicySubNav', () => {
  it('is a client component that hides off the policy section', () => {
    expect(SUBNAV_SRC).toContain("'use client'");
    expect(SUBNAV_SRC).toContain('isPolicySectionPath');
    expect(SUBNAV_SRC).toContain('return null');
  });

  it('renders Classifiers and Patterns sub-tabs', () => {
    expect(SUBNAV_SRC).toContain("href: '/app/classifiers'");
    expect(SUBNAV_SRC).toContain("href: '/app/patterns'");
  });
});

describe('AppNav component', () => {
  it('renders the four links from the shared data module', () => {
    expect(NAV_SRC).toContain('APP_NAV_LINKS');
  });

  it('wires a sign-out button to the auth sign-out action', () => {
    expect(NAV_SRC).toContain("import { signOut } from '@/lib/auth'");
    expect(NAV_SRC).toContain('Sign out');
    expect(NAV_SRC).toContain('handleSignOut');
    expect(NAV_SRC).toContain('onClick={handleSignOut}');
    expect(NAV_SRC).toContain('await signOut()');
  });

  it('shows the signed-in email', () => {
    expect(NAV_SRC).toContain('{email}');
  });

  it('collapses to a toggleable menu below the md breakpoint', () => {
    expect(NAV_SRC).toContain('md:hidden');
    expect(NAV_SRC).toContain('aria-label="Toggle navigation menu"');
    expect(NAV_SRC).toContain('setMenuOpen');
  });
});
