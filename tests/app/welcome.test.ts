// Welcome page copy guard. The page is a server component that reads the
// session, so rather than render it in the node test environment we assert
// against its source: the next-step CTAs and their hrefs are present, and none
// of the internal build-tracker language the page used to carry survives.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(
  join(process.cwd(), 'src/app/app/welcome/page.js'),
  'utf8',
);

describe('welcome page', () => {
  it('greets in sentence case', () => {
    expect(SRC).toContain('Welcome to SafeEval.');
  });

  it('offers a "define a classifier" next step pointing at the create route', () => {
    expect(SRC).toContain('Define a custom classifier');
    expect(SRC).toContain('Create classifier');
    expect(SRC).toContain('/app/classifiers/new');
  });

  it('offers a "compose a pattern" next step pointing at the create route', () => {
    expect(SRC).toContain('Compose a pattern');
    expect(SRC).toContain('Create pattern');
    expect(SRC).toContain('/app/patterns/new');
  });

  it('offers a tertiary skip-to-dashboard link', () => {
    expect(SRC).toMatch(/Skip to dashboard/);
    expect(SRC).toContain('/app/dashboard');
  });

  it('carries no phase / scoping-memo / stub / internal-architecture language', () => {
    for (const banned of [
      /\bphase\b/i,
      /scoping memo/i,
      /\bstub\b/i,
      /provider-agnostic/i,
      /multi-tenancy/i,
      /middleware gate/i,
    ]) {
      expect(SRC).not.toMatch(banned);
    }
  });
});
