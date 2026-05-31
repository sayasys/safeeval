// Source-level checks for the unified Synthetic media evaluator tab.
//
// vitest runs in a node env with no jsdom, so we cannot mount the React page.
// Instead we read the page source and assert the wiring is present: the single
// converged media tab, MIME auto-routing, backward-compat deep-links, the
// shared upload guard, and the unified result rendering. This mirrors the
// approach used by evaluator-polish.test.ts. ascii-safe.
//
// The separate image + audio tabs were converged into one "Synthetic media"
// tab (2026-05-30). These checks lock in that the converged wiring exists, not
// its runtime behavior (which needs the live HF endpoint + a browser).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = readFileSync(join(process.cwd(), 'src/app/evaluator/page.js'), 'utf8');

describe('evaluator synthetic-media tab -- source wiring', () => {
  it('defines a single unified media mode tab (no separate image/audio tabs)', () => {
    expect(PAGE).toMatch(/mode:\s*'media'/);
    expect(PAGE).toMatch(/mode-tab-media/);
    expect(PAGE).toMatch(/Synthetic media/);
    // The converged tab replaces the two old MODE_TABS / copy-table entries.
    expect(PAGE).not.toMatch(/mode-tab-image/);
    expect(PAGE).not.toMatch(/mode-tab-audio/);
  });

  it('auto-routes uploads by MIME via detectMediaKind', () => {
    expect(PAGE).toMatch(/function detectMediaKind/);
    expect(PAGE).toMatch(/indexOf\('image\/'\)/);
    expect(PAGE).toMatch(/indexOf\('audio\/'\)/);
  });

  it('keeps backward-compatible deep-links (?mode=image|audio|media + ?tab= alias)', () => {
    expect(PAGE).toMatch(/raw === 'image'/);
    expect(PAGE).toMatch(/raw === 'audio'/);
    expect(PAGE).toMatch(/raw === 'media'/);
    expect(PAGE).toMatch(/params\.get\('tab'\)/);
  });

  it('routes media uploads to /api/evaluate with a MIME-derived media_type', () => {
    expect(PAGE).toMatch(/form\.append\('media_type', kind\)/);
    expect(PAGE).toMatch(/handleEvaluateMedia/);
  });

  it('uses the shared validateMediaFile guard against the detected kind', () => {
    expect(PAGE).toMatch(/validateMediaFile/);
  });

  it('shows a detected-kind indicator in the unified drop zone', () => {
    expect(PAGE).toMatch(/Image detected/);
    expect(PAGE).toMatch(/Audio detected/);
  });

  it('accepts both image and audio mime types in one accept list', () => {
    expect(PAGE).toMatch(/MEDIA_ACCEPT_ATTR/);
    // The unified accept list is the image accept list plus the audio one.
    expect(PAGE).toMatch(/IMAGE_ACCEPT \+ ',' \+ AUDIO_ACCEPT/);
  });

  it('renders the unified media result card with verdict + confidence', () => {
    expect(PAGE).toMatch(/MediaResult/);
    expect(PAGE).toMatch(/deriveMediaVerdict/);
  });
});
