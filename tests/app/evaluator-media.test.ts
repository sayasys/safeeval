// Media-tab coverage for the Evaluator page + /api/evaluate route.
//
// The page and the route are client/server React + Next surfaces the node test
// environment cannot execute (the route imports next/server and the v5 engine
// via the @ alias; the page is a 'use client' component). Following the same
// convention as evaluator-polish.test.ts and app-nav.test.ts, these assertions
// read the source and lock in the structural + copy decisions of the media
// tabs. The behavioral logic (verdict derivation, upload validation) is unit-
// executed in tests/media-evaluator/*.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const PAGE_SRC = read('src/app/evaluator/page.js');
const ROUTE_SRC = read('src/app/api/evaluate/route.js');

describe('evaluator page: four-tab segmented control', () => {
  it('exposes prompt, conversation, image, and audio tabs', () => {
    expect(PAGE_SRC).toContain('Evaluate a prompt');
    expect(PAGE_SRC).toContain('Evaluate a conversation');
    expect(PAGE_SRC).toContain('Evaluate an image');
    expect(PAGE_SRC).toContain('Evaluate audio');
    // each tab is a real ARIA tab with its own panel id
    expect(PAGE_SRC).toContain("id: 'mode-tab-image'");
    expect(PAGE_SRC).toContain("id: 'mode-tab-audio'");
  });

  it('models image and audio as first-class modes that persist in the URL', () => {
    expect(PAGE_SRC).toContain("m === 'image' || m === 'audio'");
    expect(PAGE_SRC).toContain("if (mode !== 'prompt') url.searchParams.set('mode', mode)");
  });
});

describe('evaluator page: media input panel', () => {
  it('renders the MediaInput panel for the image/audio modes', () => {
    expect(PAGE_SRC).toContain("mode === 'image' || mode === 'audio' ? (");
    expect(PAGE_SRC).toContain('<MediaInput');
    expect(PAGE_SRC).toContain('function MediaInput(');
  });

  it('carries the per-tab subheading copy verbatim', () => {
    expect(PAGE_SRC).toContain('Upload an image to check whether it was AI-generated. SafeEval runs it through sdxl-detector and falls back to a reasoning model when the confidence is ambiguous.');
    expect(PAGE_SRC).toContain('Upload an audio file to check for synthetic speech. SafeEval runs it through Deepfake-audio-V2 with the same ambiguous-band reasoning fallback.');
  });

  it('labels the sample chips and the run button per the dispatch copy', () => {
    expect(PAGE_SRC).toContain('Try one of these');
    expect(PAGE_SRC).toContain("'Running...' : 'Run evaluation'");
  });

  it('shows an image preview and an audio player depending on mode', () => {
    expect(PAGE_SRC).toContain("mode === 'image' && mediaPreviewUrl");
    expect(PAGE_SRC).toContain("mode === 'audio' && mediaPreviewUrl");
    expect(PAGE_SRC).toContain('<audio');
  });
});

describe('evaluator page: media result + empty state', () => {
  it('renders a dedicated MediaResult card separate from the v5 fraud card', () => {
    expect(PAGE_SRC).toContain('function MediaResult(');
    expect(PAGE_SRC).toContain('<MediaResult result={mediaResult} mediaType={mode} />');
    // the v5 card and empty state are gated off in media mode so state cannot leak
    expect(PAGE_SRC).toContain('const isMediaMode =');
    expect(PAGE_SRC).toContain('{!isMediaMode && !loading && v5 && v5Cfg && (');
  });

  it('uses the plain-language verdict labels and the media empty state', () => {
    expect(PAGE_SRC).toContain('Your detection result will appear here.');
    // verdict labels live in the shared verdict module, referenced via deriveMediaVerdict
    expect(PAGE_SRC).toContain('deriveMediaVerdict');
  });

  it('switching into media modes clears the prior mode input (no leak)', () => {
    expect(PAGE_SRC).toContain('function clearModeInput(');
    expect(PAGE_SRC).toContain('resetMediaInputState()');
  });
});

describe('evaluate route: multipart media uploads', () => {
  it('branches to the multipart handler before the JSON parse', () => {
    expect(ROUTE_SRC).toContain("contentType.includes('multipart/form-data')");
    expect(ROUTE_SRC).toContain('return handleMediaUpload(request)');
  });

  it('builds the engine media_artifact and routes through detectMedia', () => {
    expect(ROUTE_SRC).toContain("import { detectMedia } from '@/lib/media-detection'");
    expect(ROUTE_SRC).toContain('url_or_base64: bytes.toString(\'base64\')');
    expect(ROUTE_SRC).toContain('await detectMedia(artifact)');
  });

  it('validates media_type and enforces the size cap server-side', () => {
    expect(ROUTE_SRC).toContain("declared === 'audio' ? 'audio' : declared === 'image' ? 'image' : null");
    expect(ROUTE_SRC).toContain('maxBytesFor(mediaType)');
    expect(ROUTE_SRC).toContain("badRequest('file_too_large'");
  });

  it('returns the detector result under media_detection_result with input_kind media', () => {
    expect(ROUTE_SRC).toContain("input_kind: 'media'");
    expect(ROUTE_SRC).toContain('media_detection_result: detection');
  });
});
