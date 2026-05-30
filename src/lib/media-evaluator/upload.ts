// Client-side + server-side media upload validation.
//
// Shared by the Evaluator page (pre-upload guard + accept attribute) and the
// /api/evaluate route (server-side re-check) and the tests. Keeping the mime
// allowlists and size caps in one pure module means the browser, the route,
// and the unit tests cannot drift apart.
//
// Size caps follow the dispatch: image <= 10MB, audio <= 25MB. NOTE: Vercel
// serverless functions reject request bodies over ~4.5MB before they reach the
// route, so very large uploads fail at the platform layer regardless of these
// caps; the bundled sample assets stay well under that ceiling. ascii-safe.

export type MediaMode = 'image' | 'audio';

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const AUDIO_MAX_BYTES = 25 * 1024 * 1024;

// Accept-list of mime types. Some browsers report m4a as audio/x-m4a or
// audio/mp4, and wav as audio/wav or audio/x-wav, so both spellings are
// allowed. Empty type (some drag-drop / fetched blobs report '') is tolerated
// and falls back to the extension check.
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
export const AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/vorbis',
];

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'];

// The accept attribute for the <input type="file"> elements.
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
export const AUDIO_ACCEPT = 'audio/mpeg,audio/wav,audio/mp4,audio/ogg,.mp3,.wav,.m4a,.ogg';

// Human-readable allowed-format strings for the UI hint and error copy.
export const IMAGE_FORMATS_LABEL = 'PNG, JPG, or WebP';
export const AUDIO_FORMATS_LABEL = 'MP3, WAV, M4A, or OGG';

export interface MediaFileMeta {
  name: string;
  type: string;
  size: number;
}

export interface MediaValidation {
  ok: boolean;
  error: string | null;
}

export function maxBytesFor(mode: MediaMode): number {
  return mode === 'audio' ? AUDIO_MAX_BYTES : IMAGE_MAX_BYTES;
}

export function maxLabelFor(mode: MediaMode): string {
  return mode === 'audio' ? '25MB' : '10MB';
}

function hasAllowedExtension(name: string, exts: string[]): boolean {
  const lower = (name || '').toLowerCase();
  return exts.some((ext) => lower.endsWith(ext));
}

// Validate a picked file against the active media mode. mime type OR extension
// must match the allowlist (a blob with an empty type still passes when its
// name carries an allowed extension), and the byte size must be within the cap.
export function validateMediaFile(file: MediaFileMeta, mode: MediaMode): MediaValidation {
  if (!file || typeof file !== 'object') {
    return { ok: false, error: 'No file selected.' };
  }
  const mimes = mode === 'audio' ? AUDIO_MIME_TYPES : IMAGE_MIME_TYPES;
  const exts = mode === 'audio' ? AUDIO_EXTENSIONS : IMAGE_EXTENSIONS;
  const formats = mode === 'audio' ? AUDIO_FORMATS_LABEL : IMAGE_FORMATS_LABEL;

  const type = (file.type || '').toLowerCase();
  const mimeOk = type.length > 0 && mimes.indexOf(type) >= 0;
  const extOk = hasAllowedExtension(file.name || '', exts);
  if (!mimeOk && !extOk) {
    return { ok: false, error: `Unsupported file type. Use ${formats}.` };
  }

  const size = typeof file.size === 'number' ? file.size : 0;
  if (size <= 0) {
    return { ok: false, error: 'That file looks empty. Pick another.' };
  }
  const cap = maxBytesFor(mode);
  if (size > cap) {
    return { ok: false, error: `File is too large. ${mode === 'audio' ? 'Audio' : 'Image'} files must be ${maxLabelFor(mode)} or smaller.` };
  }
  return { ok: true, error: null };
}
