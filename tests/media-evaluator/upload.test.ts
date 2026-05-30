// Unit coverage for the shared media upload validation (mime + extension +
// size cap). The browser pre-upload guard, the route server-side re-check, and
// these tests all call validateMediaFile, so the rules cannot drift.

import { describe, it, expect } from 'vitest';
import {
  validateMediaFile,
  maxBytesFor,
  maxLabelFor,
  IMAGE_MAX_BYTES,
  AUDIO_MAX_BYTES,
} from '../../src/lib/media-evaluator/upload';

describe('validateMediaFile -- image mode', () => {
  it('accepts a PNG within the cap', () => {
    const v = validateMediaFile({ name: 'pic.png', type: 'image/png', size: 1024 }, 'image');
    expect(v.ok).toBe(true);
    expect(v.error).toBeNull();
  });

  it('accepts JPG and WebP', () => {
    expect(validateMediaFile({ name: 'a.jpg', type: 'image/jpeg', size: 10 }, 'image').ok).toBe(true);
    expect(validateMediaFile({ name: 'a.webp', type: 'image/webp', size: 10 }, 'image').ok).toBe(true);
  });

  it('falls back to the extension when the mime type is empty (drag-drop / fetched blob)', () => {
    const v = validateMediaFile({ name: 'photo.PNG', type: '', size: 2048 }, 'image');
    expect(v.ok).toBe(true);
  });

  it('rejects an audio file picked in the image tab', () => {
    const v = validateMediaFile({ name: 'clip.mp3', type: 'audio/mpeg', size: 2048 }, 'image');
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/Unsupported file type/);
  });

  it('rejects an image over 10MB', () => {
    const v = validateMediaFile({ name: 'huge.png', type: 'image/png', size: IMAGE_MAX_BYTES + 1 }, 'image');
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/too large/);
    expect(v.error).toMatch(/10MB/);
  });

  it('rejects an empty file', () => {
    const v = validateMediaFile({ name: 'x.png', type: 'image/png', size: 0 }, 'image');
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/empty/);
  });
});

describe('validateMediaFile -- audio mode', () => {
  it('accepts MP3 / WAV / M4A / OGG, including alternate mime spellings', () => {
    expect(validateMediaFile({ name: 'a.mp3', type: 'audio/mpeg', size: 10 }, 'audio').ok).toBe(true);
    expect(validateMediaFile({ name: 'a.wav', type: 'audio/x-wav', size: 10 }, 'audio').ok).toBe(true);
    expect(validateMediaFile({ name: 'a.m4a', type: 'audio/mp4', size: 10 }, 'audio').ok).toBe(true);
    expect(validateMediaFile({ name: 'a.ogg', type: 'audio/ogg', size: 10 }, 'audio').ok).toBe(true);
  });

  it('rejects an image picked in the audio tab', () => {
    const v = validateMediaFile({ name: 'pic.png', type: 'image/png', size: 10 }, 'audio');
    expect(v.ok).toBe(false);
  });

  it('rejects audio over 25MB', () => {
    const v = validateMediaFile({ name: 'long.wav', type: 'audio/wav', size: AUDIO_MAX_BYTES + 1 }, 'audio');
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/25MB/);
  });
});

describe('validateMediaFile -- guards', () => {
  it('rejects a missing file object', () => {
    // @ts-expect-error intentional bad input
    const v = validateMediaFile(null, 'image');
    expect(v.ok).toBe(false);
  });
});

describe('cap helpers', () => {
  it('returns the per-mode byte cap and label', () => {
    expect(maxBytesFor('image')).toBe(IMAGE_MAX_BYTES);
    expect(maxBytesFor('audio')).toBe(AUDIO_MAX_BYTES);
    expect(maxLabelFor('image')).toBe('10MB');
    expect(maxLabelFor('audio')).toBe('25MB');
  });
});
