// Synthetic-mini-repo tests for checkAudienceLockstep.
//
// The runtime lockstep verifier at scripts/check-lockstep.js exports
// checkAudienceLockstep(rootDir) which accepts an override root so the
// tests can drive it against an on-disk synthetic mini-repo containing a
// fabricated docs/08-v5-ontology.md, src/lib/report-generators/types.ts,
// and src/lib/report-generators/prompts/ directory.
//
// Coverage:
//   - happy path: ontology, types, prompts all align -> true
//   - ontology has an audience missing from types -> false
//   - types has an audience missing from ontology -> false
//   - implemented audience missing its prompt file -> false
//   - deferred audience has a prompt file -> false
//   - no DEFERRED entries -> false (sanity assertion fires)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const lockstep = require('../../scripts/check-lockstep.js');

interface FakeRepoOptions {
  audienceTableRows: string[];
  typesAudience: string[];
  promptFiles: string[];
}

function makeFakeRepo(opts: FakeRepoOptions): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'safeeval-lockstep-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(
    path.join(root, 'src', 'lib', 'report-generators', 'prompts'),
    { recursive: true },
  );

  const ontologyText = [
    '# Fake ontology',
    '',
    '### 3.13 prior section',
    '',
    '(content)',
    '',
    '### 3.14 `audience` (closed-set vocabulary)',
    '',
    'Intro paragraph.',
    '',
    '| Audience | Who reads it | MUST see | MUST NOT see | Length | Implementation status |',
    '|---|---|---|---|---|---|',
    ...opts.audienceTableRows,
    '',
    '## 4. Next section',
    '',
    'content',
  ].join('\n');
  fs.writeFileSync(path.join(root, 'docs', '08-v5-ontology.md'), ontologyText, 'utf-8');

  const literal = opts.typesAudience.map((n) => `'${n}'`).join(' | ');
  const typesText = `export type Audience = ${literal};\n`;
  fs.writeFileSync(
    path.join(root, 'src', 'lib', 'report-generators', 'types.ts'),
    typesText,
    'utf-8',
  );

  for (const name of opts.promptFiles) {
    fs.writeFileSync(
      path.join(root, 'src', 'lib', 'report-generators', 'prompts', `${name}.ts`),
      `export const ${name}Prompt = { system: '', user: '', prompt_version: '${name}@v0.0.0' };\n`,
      'utf-8',
    );
  }

  return root;
}

function rmRepo(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}

const ROW = (name: string, status: 'IMPLEMENTED' | 'DEFERRED') =>
  `| \`${name}\` | who | must see | must not see | 100-200 words | ${status} |`;

describe('checkAudienceLockstep (synthetic mini-repo)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let createdRoots: string[] = [];

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    createdRoots = [];
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    for (const r of createdRoots) rmRepo(r);
  });

  function build(opts: FakeRepoOptions): string {
    const r = makeFakeRepo(opts);
    createdRoots.push(r);
    return r;
  }

  it('passes when ontology, types, and prompts align (1 implemented + 1 deferred)', () => {
    const root = build({
      audienceTableRows: [
        ROW('reviewer', 'IMPLEMENTED'),
        ROW('end_user', 'DEFERRED'),
      ],
      typesAudience: ['reviewer', 'end_user'],
      promptFiles: ['reviewer'],
    });
    expect(lockstep.checkAudienceLockstep(root)).toBe(true);
  });

  it('passes when ontology, types, and prompts align (4 implemented + 1 deferred -- production shape)', () => {
    const root = build({
      audienceTableRows: [
        ROW('reviewer', 'IMPLEMENTED'),
        ROW('trust_safety_lead', 'IMPLEMENTED'),
        ROW('legal', 'IMPLEMENTED'),
        ROW('exec_summary', 'IMPLEMENTED'),
        ROW('end_user', 'DEFERRED'),
      ],
      typesAudience: ['reviewer', 'trust_safety_lead', 'legal', 'exec_summary', 'end_user'],
      promptFiles: ['reviewer', 'trust_safety_lead', 'legal', 'exec_summary'],
    });
    expect(lockstep.checkAudienceLockstep(root)).toBe(true);
  });

  it('fails when ontology has an audience missing from types', () => {
    const root = build({
      audienceTableRows: [
        ROW('reviewer', 'IMPLEMENTED'),
        ROW('legal', 'IMPLEMENTED'),
        ROW('end_user', 'DEFERRED'),
      ],
      typesAudience: ['reviewer', 'end_user'],
      promptFiles: ['reviewer', 'legal'],
    });
    expect(lockstep.checkAudienceLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/ontology has but types\.ts lacks: legal/);
  });

  it('fails when types has an audience missing from ontology', () => {
    const root = build({
      audienceTableRows: [
        ROW('reviewer', 'IMPLEMENTED'),
        ROW('end_user', 'DEFERRED'),
      ],
      typesAudience: ['reviewer', 'rogue_audience', 'end_user'],
      promptFiles: ['reviewer'],
    });
    expect(lockstep.checkAudienceLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/types\.ts has but ontology lacks: rogue_audience/);
  });

  it('fails when implemented audience has no prompt file', () => {
    const root = build({
      audienceTableRows: [
        ROW('reviewer', 'IMPLEMENTED'),
        ROW('end_user', 'DEFERRED'),
      ],
      typesAudience: ['reviewer', 'end_user'],
      promptFiles: [],
    });
    expect(lockstep.checkAudienceLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/IMPLEMENTED audience "reviewer" has no prompt file/);
  });

  it('fails when deferred audience has a prompt file', () => {
    const root = build({
      audienceTableRows: [
        ROW('reviewer', 'IMPLEMENTED'),
        ROW('end_user', 'DEFERRED'),
      ],
      typesAudience: ['reviewer', 'end_user'],
      promptFiles: ['reviewer', 'end_user'],
    });
    expect(lockstep.checkAudienceLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/DEFERRED audience "end_user" has a prompt file/);
  });

  it('fails when no DEFERRED entries exist (sanity assertion fires)', () => {
    const root = build({
      audienceTableRows: [
        ROW('reviewer', 'IMPLEMENTED'),
      ],
      typesAudience: ['reviewer'],
      promptFiles: ['reviewer'],
    });
    expect(lockstep.checkAudienceLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/no DEFERRED audiences/);
  });

  it('fails cleanly when the ontology section is missing entirely', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'safeeval-lockstep-noont-'));
    createdRoots.push(root);
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'lib', 'report-generators', 'prompts'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'docs', '08-v5-ontology.md'),
      '# Empty doc with no audience section\n',
      'utf-8',
    );
    fs.writeFileSync(
      path.join(root, 'src', 'lib', 'report-generators', 'types.ts'),
      `export type Audience = 'reviewer';\n`,
      'utf-8',
    );

    expect(lockstep.checkAudienceLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/Ontology section missing/);
  });

  it('fails cleanly when types.ts is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'safeeval-lockstep-notypes-'));
    createdRoots.push(root);
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'lib', 'report-generators', 'prompts'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'docs', '08-v5-ontology.md'),
      [
        '### 3.14 `audience`',
        '',
        '| n | a | b | c | d | e |',
        '|---|---|---|---|---|---|',
        ROW('reviewer', 'IMPLEMENTED'),
        ROW('end_user', 'DEFERRED'),
      ].join('\n'),
      'utf-8',
    );

    expect(lockstep.checkAudienceLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/types\.ts missing/);
  });
});

describe('extractOntologyAudienceVocab', () => {
  it('parses the table rows and DEFERRED markers correctly', () => {
    const doc = [
      'preamble',
      '',
      '### 3.14 `audience` (closed-set vocabulary)',
      '',
      '| name | who | must | mustnt | len | status |',
      '|---|---|---|---|---|---|',
      ROW('reviewer', 'IMPLEMENTED'),
      ROW('legal', 'IMPLEMENTED'),
      ROW('end_user', 'DEFERRED'),
      '',
      '## 4. Next section',
    ].join('\n');
    const audiences = lockstep.extractOntologyAudienceVocab(doc);
    expect(audiences).toHaveLength(3);
    expect(audiences.map((a: { name: string }) => a.name)).toEqual(
      ['reviewer', 'legal', 'end_user'],
    );
    expect(audiences.find((a: { name: string }) => a.name === 'end_user').deferred).toBe(true);
    expect(audiences.find((a: { name: string }) => a.name === 'reviewer').deferred).toBe(false);
  });

  it('throws when the section header is absent', () => {
    expect(() => lockstep.extractOntologyAudienceVocab('# unrelated content\n')).toThrow(
      /Ontology section missing/,
    );
  });
});

describe('extractAudienceLiteralFromTypes', () => {
  it('parses single-line union types', () => {
    const src = `export type Audience = 'a' | 'b' | 'c';\n`;
    const names = lockstep.extractAudienceLiteralFromTypes(src);
    expect(names).toEqual(['a', 'b', 'c']);
  });

  it('parses multi-line union types', () => {
    const src = [
      'export type Audience =',
      "  | 'reviewer'",
      "  | 'trust_safety_lead'",
      "  | 'legal'",
      "  | 'exec_summary'",
      "  | 'end_user';",
    ].join('\n');
    const names = lockstep.extractAudienceLiteralFromTypes(src);
    expect(names).toEqual(['reviewer', 'trust_safety_lead', 'legal', 'exec_summary', 'end_user']);
  });

  it('throws when the Audience export is absent', () => {
    expect(() => lockstep.extractAudienceLiteralFromTypes('// nothing here\n')).toThrow(
      /Audience literal type not found/,
    );
  });

  it('throws when the body has no string literals', () => {
    expect(() => lockstep.extractAudienceLiteralFromTypes('export type Audience = string;\n')).toThrow(
      /no string-literal values extracted/,
    );
  });
});
