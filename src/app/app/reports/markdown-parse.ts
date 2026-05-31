// Minimal, safe markdown parser for report bodies.
//
// react-markdown is not a project dependency, and report markdown is
// model-generated, so rather than pull a parser in (and rather than ever touch
// dangerouslySetInnerHTML) this produces a plain data structure that the
// ReportMarkdown component renders into React elements -- safe by construction,
// no raw HTML injection. Scope is deliberately small: the constructs the report
// prompt templates actually emit (headings, paragraphs, bold/italic/code spans,
// bullet + numbered lists, blockquotes, fenced code, horizontal rules, links).
//
// The pure functions (parseBlocks/parseInline/isSafeHref) carry the logic so
// they can be unit-tested in the node test env without rendering.

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; href: string };

export type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' };

// Only allow hrefs that cannot execute script. Anything else (javascript:,
// data:, vbscript:, ...) is dropped to a non-navigating anchor by the renderer.
export function isSafeHref(href: string): boolean {
  if (typeof href !== 'string' || href.length === 0) return false;
  const h = href.trim();
  if (h.startsWith('/') || h.startsWith('#')) return true;
  return /^(https?:|mailto:)/i.test(h);
}

const INLINE_PATTERNS: { type: InlineToken['type']; re: RegExp }[] = [
  { type: 'code', re: /`([^`]+)`/ },
  { type: 'link', re: /\[([^\]]+)\]\(([^)\s]+)\)/ },
  { type: 'bold', re: /\*\*([^*]+)\*\*/ },
  { type: 'italic', re: /\*([^*]+)\*|_([^_]+)_/ },
];

// Tokenize one line of inline markdown. Repeatedly takes the earliest-matching
// construct; ties resolve to the pattern order above (so ** beats * because the
// bold match starts one char earlier than the italic match would).
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let rest = text;
  while (rest.length > 0) {
    let best: { index: number; type: InlineToken['type']; m: RegExpExecArray } | null = null;
    for (const p of INLINE_PATTERNS) {
      const m = p.re.exec(rest);
      if (m && (best === null || m.index < best.index)) {
        best = { index: m.index, type: p.type, m };
      }
    }
    if (!best) {
      tokens.push({ type: 'text', value: rest });
      break;
    }
    if (best.index > 0) {
      tokens.push({ type: 'text', value: rest.slice(0, best.index) });
    }
    const m = best.m;
    if (best.type === 'link') {
      tokens.push({ type: 'link', value: m[1] ?? '', href: m[2] ?? '' });
    } else if (best.type === 'italic') {
      tokens.push({ type: 'italic', value: m[1] ?? m[2] ?? '' });
    } else if (best.type === 'bold') {
      tokens.push({ type: 'bold', value: m[1] ?? '' });
    } else {
      tokens.push({ type: 'code', value: m[1] ?? '' });
    }
    rest = rest.slice(best.index + m[0].length);
  }
  return tokens;
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HR_RE = /^(-{3,}|\*{3,}|_{3,})$/;
const UL_RE = /^\s*[-*]\s+(.*)$/;
const OL_RE = /^\s*\d+\.\s+(.*)$/;

// Block-level parse. Walks lines, grouping runs of list items, blockquote
// lines, fenced code, and paragraph text into blocks.
export function parseBlocks(markdown: string): Block[] {
  const lines = (markdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const blocks: Block[] = [];
  // Bounds-checked accessor: every read is guarded by i < lines.length at the
  // call site, but the strict-index flag needs the undefined coalesced away.
  const lineAt = (n: number): string => lines[n] ?? '';
  let i = 0;

  while (i < lines.length) {
    const line = lineAt(i);

    if (line.trim() === '') {
      i++;
      continue;
    }

    // Fenced code block.
    if (line.trim().startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lineAt(i).trim().startsWith('```')) {
        body.push(lineAt(i));
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: (heading[1] ?? '').length,
        text: (heading[2] ?? '').trim(),
      });
      i++;
      continue;
    }

    if (HR_RE.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    if (line.trimStart().startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lineAt(i).trimStart().startsWith('>')) {
        quote.push(lineAt(i).replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', text: quote.join('\n') });
      continue;
    }

    if (UL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL_RE.test(lineAt(i))) {
        items.push((UL_RE.exec(lineAt(i))?.[1] ?? '').trim());
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (OL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL_RE.test(lineAt(i))) {
        items.push((OL_RE.exec(lineAt(i))?.[1] ?? '').trim());
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Paragraph: gather until a blank line or the start of another block.
    const para: string[] = [];
    while (i < lines.length) {
      const l = lineAt(i);
      if (
        l.trim() === '' ||
        l.trim().startsWith('```') ||
        HEADING_RE.test(l) ||
        HR_RE.test(l.trim()) ||
        l.trimStart().startsWith('>') ||
        UL_RE.test(l) ||
        OL_RE.test(l)
      ) {
        break;
      }
      para.push(l.trim());
      i++;
    }
    blocks.push({ type: 'paragraph', text: para.join(' ') });
  }

  return blocks;
}
