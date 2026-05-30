// The "Try one of these" chips load bundled static assets. This guards that
// every manifest entry points at a file that actually ships under public/ and
// that there is at least one image + one audio sample (the demo needs both).

import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { SAMPLE_MEDIA, samplesForMode } from '../../src/lib/media-evaluator/samples';

describe('sample media manifest', () => {
  it('every entry resolves to a non-empty bundled file under public/', () => {
    for (const s of SAMPLE_MEDIA) {
      expect(s.src.startsWith('/sample-media/')).toBe(true);
      const abs = join(process.cwd(), 'public', s.src.replace(/^\//, ''));
      expect(existsSync(abs), `${s.src} should exist`).toBe(true);
      expect(statSync(abs).size).toBeGreaterThan(0);
    }
  });

  it('provides at least one image and one audio sample', () => {
    expect(samplesForMode('image').length).toBeGreaterThanOrEqual(1);
    expect(samplesForMode('audio').length).toBeGreaterThanOrEqual(1);
  });

  it('filters by mode without cross-contamination', () => {
    expect(samplesForMode('image').every(s => s.mode === 'image')).toBe(true);
    expect(samplesForMode('audio').every(s => s.mode === 'audio')).toBe(true);
  });

  it('keeps bundled samples comfortably under the Vercel 4.5MB body ceiling', () => {
    for (const s of SAMPLE_MEDIA) {
      const abs = join(process.cwd(), 'public', s.src.replace(/^\//, ''));
      expect(statSync(abs).size).toBeLessThan(4_000_000);
    }
  });
});
