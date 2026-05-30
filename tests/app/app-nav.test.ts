// AppNav tests. The nav targets live in a plain data module so they can be
// asserted directly; the component wiring (the sign-out button and its handler,
// the mobile menu toggle) is checked against the source, since the node test
// environment has no DOM to render a client component into.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { APP_NAV_LINKS } from '../../src/app/app/_components/app-nav-links';

const NAV_SRC = readFileSync(
  join(process.cwd(), 'src/app/app/_components/AppNav.js'),
  'utf8',
);

describe('app nav links', () => {
  it('exposes exactly the four primary destinations', () => {
    expect(APP_NAV_LINKS).toHaveLength(4);
    expect(APP_NAV_LINKS.map((l) => l.label)).toEqual([
      'Dashboard',
      'Classifiers',
      'Patterns',
      'Evaluator',
    ]);
  });

  it('points each label at the right route', () => {
    const byLabel = Object.fromEntries(
      APP_NAV_LINKS.map((l) => [l.label, l.href]),
    );
    expect(byLabel.Dashboard).toBe('/app/dashboard');
    expect(byLabel.Classifiers).toBe('/app/classifiers');
    expect(byLabel.Patterns).toBe('/app/patterns');
    expect(byLabel.Evaluator).toBe('/evaluator');
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
