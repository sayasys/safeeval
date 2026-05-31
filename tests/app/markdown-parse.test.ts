// Tests for the minimal report markdown parser (src/app/app/reports/
// markdown-parse.ts). The renderer (ReportMarkdown.js) is a thin presentational
// wrapper over these pure functions; covering the parser covers the behavior
// that matters (block structure, inline spans, href safety) without a DOM.

import { describe, it, expect } from 'vitest';
import {
  parseInline,
  parseBlocks,
  isSafeHref,
} from '../../src/app/app/reports/markdown-parse';

describe('isSafeHref', () => {
  it('allows http(s), mailto, relative, and anchor hrefs', () => {
    expect(isSafeHref('https://example.com')).toBe(true);
    expect(isSafeHref('http://example.com')).toBe(true);
    expect(isSafeHref('mailto:a@b.com')).toBe(true);
    expect(isSafeHref('/app/reports')).toBe(true);
    expect(isSafeHref('#section')).toBe(true);
  });
  it('rejects script-bearing and empty hrefs', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('data:text/html,<script>')).toBe(false);
    expect(isSafeHref('')).toBe(false);
    // @ts-expect-error guarding a non-string at runtime
    expect(isSafeHref(null)).toBe(false);
  });
});

describe('parseInline', () => {
  it('returns a single text token for plain text', () => {
    expect(parseInline('hello world')).toEqual([{ type: 'text', value: 'hello world' }]);
  });

  it('parses bold, italic (* and _), and code spans', () => {
    expect(parseInline('**b**')).toEqual([{ type: 'bold', value: 'b' }]);
    expect(parseInline('*i*')).toEqual([{ type: 'italic', value: 'i' }]);
    expect(parseInline('_i_')).toEqual([{ type: 'italic', value: 'i' }]);
    expect(parseInline('`c`')).toEqual([{ type: 'code', value: 'c' }]);
  });

  it('prefers bold over italic for a doubled marker', () => {
    expect(parseInline('a **bold** b')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'bold', value: 'bold' },
      { type: 'text', value: ' b' },
    ]);
  });

  it('parses links with their href', () => {
    expect(parseInline('see [docs](https://x.com/y) now')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', value: 'docs', href: 'https://x.com/y' },
      { type: 'text', value: ' now' },
    ]);
  });
});

describe('parseBlocks', () => {
  it('parses headings by level', () => {
    expect(parseBlocks('# Title')).toEqual([{ type: 'heading', level: 1, text: 'Title' }]);
    expect(parseBlocks('### Sub')).toEqual([{ type: 'heading', level: 3, text: 'Sub' }]);
  });

  it('joins wrapped paragraph lines and splits on blank lines', () => {
    const blocks = parseBlocks('one\ntwo\n\nthree');
    expect(blocks).toEqual([
      { type: 'paragraph', text: 'one two' },
      { type: 'paragraph', text: 'three' },
    ]);
  });

  it('parses unordered and ordered lists', () => {
    expect(parseBlocks('- a\n- b')).toEqual([{ type: 'ul', items: ['a', 'b'] }]);
    expect(parseBlocks('1. a\n2. b')).toEqual([{ type: 'ol', items: ['a', 'b'] }]);
  });

  it('parses blockquotes, fenced code, and horizontal rules', () => {
    expect(parseBlocks('> quoted')).toEqual([{ type: 'blockquote', text: 'quoted' }]);
    expect(parseBlocks('```\nx = 1\n```')).toEqual([{ type: 'code', text: 'x = 1' }]);
    expect(parseBlocks('---')).toEqual([{ type: 'hr' }]);
  });

  it('handles a mixed document', () => {
    const md = '# Report\n\nSummary line.\n\n- one\n- two\n\n## Detail\nbody';
    expect(parseBlocks(md)).toEqual([
      { type: 'heading', level: 1, text: 'Report' },
      { type: 'paragraph', text: 'Summary line.' },
      { type: 'ul', items: ['one', 'two'] },
      { type: 'heading', level: 2, text: 'Detail' },
      { type: 'paragraph', text: 'body' },
    ]);
  });

  it('tolerates CRLF line endings', () => {
    expect(parseBlocks('# A\r\n\r\nbody')).toEqual([
      { type: 'heading', level: 1, text: 'A' },
      { type: 'paragraph', text: 'body' },
    ]);
  });
});
