// Sample media manifest for the Evaluator media tabs.
//
// The "Try one of these" chips load these bundled static assets from
// public/sample-media/ via a same-origin fetch (no external URLs, no
// build-time network). Each entry's `src` is an app-absolute path served by
// Next from the public/ directory.
//
// The bundled assets are small, repo-generated placeholders (a valid PNG /
// WAV each) so the upload + preview + result-card flow is demonstrable
// offline. Meaningful detector scores require HF_API_TOKEN to be configured
// and a real photographic / spoken-audio input. ascii-safe.

import type { MediaMode } from './upload';

export interface MediaSample {
  id: string;
  mode: MediaMode;
  // Chip label shown to the user.
  label: string;
  // Download filename handed to FormData.
  filename: string;
  // App-absolute path under public/.
  src: string;
  mime: string;
}

export const SAMPLE_MEDIA: MediaSample[] = [
  {
    id: 'image-ai',
    mode: 'image',
    label: 'AI-style portrait',
    filename: 'ai-style-portrait.png',
    src: '/sample-media/ai-style-portrait.png',
    mime: 'image/png',
  },
  {
    id: 'image-human',
    mode: 'image',
    label: 'Camera-style photo',
    filename: 'camera-style-photo.png',
    src: '/sample-media/camera-style-photo.png',
    mime: 'image/png',
  },
  {
    id: 'audio-ai',
    mode: 'audio',
    label: 'Synthetic-style voice',
    filename: 'synthetic-style-voice.wav',
    src: '/sample-media/synthetic-style-voice.wav',
    mime: 'audio/wav',
  },
  {
    id: 'audio-human',
    mode: 'audio',
    label: 'Spoken-style clip',
    filename: 'spoken-style-clip.wav',
    src: '/sample-media/spoken-style-clip.wav',
    mime: 'audio/wav',
  },
];

export function samplesForMode(mode: MediaMode): MediaSample[] {
  return SAMPLE_MEDIA.filter((s) => s.mode === mode);
}
