// One-shot generator for the Evaluator media-tab sample assets.
// Produces small, valid PNG + WAV placeholders under public/sample-media/.
// These are repo-bundled demo files (no external fetch); meaningful detector
// scores require HF_API_TOKEN + real media. Run: node scripts/spike/gen-sample-media.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', '..', 'public', 'sample-media');
fs.mkdirSync(OUT, { recursive: true });

// --- PNG ------------------------------------------------------------------
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
// Build a w x h truecolor PNG from a pixel function fn(x,y) -> [r,g,b].
function makePng(w, h, fn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type 2 = truecolor
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      raw[p++] = r & 255; raw[p++] = g & 255; raw[p++] = b & 255;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const W = 256, H = 256;
// "AI-style portrait": smooth synthetic-looking radial gradient.
const aiPng = makePng(W, H, (x, y) => {
  const dx = x - W / 2, dy = y - H / 2;
  const d = Math.sqrt(dx * dx + dy * dy) / (W / 2);
  return [Math.round(180 - d * 120), Math.round(120 + d * 90), Math.round(220 - d * 60)];
});
// "Camera-style photo": noisier checker/banding to read as a captured frame.
const camPng = makePng(W, H, (x, y) => {
  const band = (Math.floor(y / 16) % 2) === 0 ? 30 : -30;
  const checker = ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) === 0 ? 18 : -18;
  const base = 120 + band + checker + ((x * 7 + y * 13) % 23) - 11;
  return [base + 40, base + 10, base - 20];
});
fs.writeFileSync(path.join(OUT, 'ai-style-portrait.png'), aiPng);
fs.writeFileSync(path.join(OUT, 'camera-style-photo.png'), camPng);

// --- WAV ------------------------------------------------------------------
// 16-bit PCM mono WAV from a per-sample fn(t) -> [-1, 1].
function makeWav(seconds, sampleRate, fn) {
  const n = Math.floor(seconds * sampleRate);
  const dataLen = n * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);     // PCM chunk size
  buf.writeUInt16LE(1, 20);      // audio format PCM
  buf.writeUInt16LE(1, 22);      // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);      // block align
  buf.writeUInt16LE(16, 34);     // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let v = fn(t, i);
    if (v > 1) v = 1; if (v < -1) v = -1;
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}
const SR = 16000;
// "Synthetic-style voice": clean steady tone glide (machine-even).
const aiWav = makeWav(1.2, SR, (t) => {
  const f = 220 + 40 * Math.sin(2 * Math.PI * 0.8 * t);
  return 0.45 * Math.sin(2 * Math.PI * f * t);
});
// "Spoken-style clip": amplitude-modulated multi-tone to read as speech-like.
const humanWav = makeWav(1.2, SR, (t) => {
  const env = 0.5 + 0.5 * Math.abs(Math.sin(2 * Math.PI * 4 * t));
  const s = Math.sin(2 * Math.PI * 160 * t)
    + 0.5 * Math.sin(2 * Math.PI * 320 * t)
    + 0.3 * Math.sin(2 * Math.PI * 90 * t);
  return 0.35 * env * (s / 1.8);
});
fs.writeFileSync(path.join(OUT, 'synthetic-style-voice.wav'), aiWav);
fs.writeFileSync(path.join(OUT, 'spoken-style-clip.wav'), humanWav);

for (const f of fs.readdirSync(OUT)) {
  const st = fs.statSync(path.join(OUT, f));
  console.log(f, st.size + ' bytes');
}
