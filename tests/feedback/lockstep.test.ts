// Synthetic-mini-repo tests for the three classifier-edits lockstep
// verifiers in scripts/check-lockstep.js.
//
// Each verifier accepts a rootDir override so tests can drive it against
// a fabricated docs / src tree. Coverage:
//
//   checkEditableFieldsLockstep:
//     - happy path: ontology table matches FIELD_PATHS
//     - fail: ontology adds a field missing from FIELD_PATHS
//     - fail: FIELD_PATHS adds a field missing from ontology
//     - fail: ontology section header missing
//
//   checkRationaleTagLockstep:
//     - happy path: ontology table matches RATIONALE_TAGS
//     - fail: ontology adds a tag missing from RATIONALE_TAGS
//     - fail: RATIONALE_TAGS adds a tag missing from ontology
//
//   checkEditorRoleLockstep:
//     - happy path: ontology role + matrix match EDITOR_ROLES +
//       EDITOR_ROLE_PERMISSIONS
//     - fail: ontology adds a role missing from EDITOR_ROLES
//     - fail: ontology grants senior_reviewer a field that
//       EDITOR_ROLE_PERMISSIONS denies
//     - fail: EDITOR_ROLE_PERMISSIONS grants policy_lead a field that
//       ontology denies

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const lockstep = require('../../scripts/check-lockstep.js');

interface FakeRepoOptions {
  ontologyText?: string;
  typesText?: string;
  permissionsText?: string;
}

function makeFakeRepo(opts: FakeRepoOptions): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'safeeval-feedback-lockstep-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(
    path.join(root, 'src', 'lib', 'feedback'),
    { recursive: true },
  );

  if (opts.ontologyText !== undefined) {
    fs.writeFileSync(
      path.join(root, 'docs', '08-v5-ontology.md'),
      opts.ontologyText,
      'utf-8',
    );
  }
  if (opts.typesText !== undefined) {
    fs.writeFileSync(
      path.join(root, 'src', 'lib', 'feedback', 'types.ts'),
      opts.typesText,
      'utf-8',
    );
  }
  if (opts.permissionsText !== undefined) {
    fs.writeFileSync(
      path.join(root, 'src', 'lib', 'feedback', 'permissions.ts'),
      opts.permissionsText,
      'utf-8',
    );
  }
  return root;
}

function rmRepo(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}

// Canonical 15-entry FIELD_PATHS set used across tests.
const CANONICAL_FIELD_PATHS = [
  'l1.category',
  'l2.subcategory',
  'l3.method',
  'l3.tactic',
  'l3.target',
  'l3.overlap',
  'reason_codes',
  'disposition.action',
  'evidence.aggregate_score',
  'evidence.component_scores.target',
  'evidence.component_scores.lure',
  'evidence.component_scores.trust',
  'evidence.component_scores.extract',
  'evidence.component_scores.evade',
  'persona.claimed',
];

// Canonical 18-entry RATIONALE_TAGS set.
const CANONICAL_RATIONALE_TAGS = [
  'wrong_l1_category',
  'wrong_l2_subcategory',
  'wrong_l3_method',
  'wrong_l3_tactic',
  'wrong_l3_target',
  'wrong_l3_overlap',
  'missing_reason_code',
  'extra_reason_code',
  'false_bright_line_fire',
  'missed_bright_line',
  'discriminator_boundary_unclear',
  'severity_mismatch',
  'disposition_too_lenient',
  'disposition_too_strict',
  'component_score_off',
  'persona_misidentified',
  'coverage_gap',
  'other',
];

const CANONICAL_EDITOR_ROLES = ['senior_reviewer', 'policy_lead', 'qa_reviewer'];

const SENIOR_REVIEWER_FIELDS = [
  'l1.category',
  'l2.subcategory',
  'reason_codes',
  'disposition.action',
  'evidence.aggregate_score',
  'evidence.component_scores.target',
  'evidence.component_scores.lure',
  'evidence.component_scores.trust',
  'evidence.component_scores.extract',
  'evidence.component_scores.evade',
];

const POLICY_LEAD_FIELDS = [...CANONICAL_FIELD_PATHS];

// Builders for the synthetic ontology / types / permissions files.

function fieldPathRow(name: string): string {
  return `| \`${name}\` | description | semantics |`;
}

function rationaleRow(name: string): string {
  return `| \`${name}\` | description |`;
}

function buildOntology(opts: {
  fieldPaths: string[];
  rationaleTags: string[];
  editorRoles: string[];
  matrix: Record<string, Set<string>>; // role -> allowed field paths
}): string {
  const lines: string[] = [];
  lines.push('# Fake ontology');
  lines.push('');
  lines.push('### 3.15 `field_path` (closed-set vocabulary)');
  lines.push('');
  lines.push('Intro.');
  lines.push('');
  lines.push('| field_path | description | semantics |');
  lines.push('|---|---|---|');
  for (const fp of opts.fieldPaths) {
    lines.push(fieldPathRow(fp));
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('### 3.16 `rationale_tag` (closed-set vocabulary)');
  lines.push('');
  lines.push('Intro.');
  lines.push('');
  lines.push('| rationale_tag | description |');
  lines.push('|---|---|');
  for (const tag of opts.rationaleTags) {
    lines.push(rationaleRow(tag));
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('### 3.17 `editor_role` (closed-set vocabulary)');
  lines.push('');
  lines.push('Intro.');
  lines.push('');
  lines.push('| editor_role | definition | edit authority |');
  lines.push('|---|---|---|');
  for (const r of opts.editorRoles) {
    lines.push(`| \`${r}\` | def | auth |`);
  }
  lines.push('');
  lines.push('**Permission matrix:**');
  lines.push('');
  const roleHeaderCells = opts.editorRoles.join(' | ');
  lines.push('| field_path | ' + roleHeaderCells + ' |');
  const dashRow = '|---|' + opts.editorRoles.map(() => '---|').join('');
  lines.push(dashRow);
  for (const fp of opts.fieldPaths) {
    const cells = opts.editorRoles
      .map((r) => (opts.matrix[r] && opts.matrix[r].has(fp) ? 'allow' : 'deny'))
      .join(' | ');
    lines.push(`| \`${fp}\` | ${cells} |`);
  }
  lines.push('');
  lines.push('## 4. Next section');
  lines.push('');
  return lines.join('\n');
}

function buildTypes(opts: {
  fieldPaths: string[];
  rationaleTags: string[];
  editorRoles: string[];
}): string {
  const lines: string[] = [];
  lines.push("export const EDITOR_ROLES = [");
  for (const r of opts.editorRoles) lines.push(`  '${r}',`);
  lines.push("] as const;");
  lines.push("");
  lines.push("export const FIELD_PATHS = [");
  for (const fp of opts.fieldPaths) lines.push(`  '${fp}',`);
  lines.push("] as const;");
  lines.push("");
  lines.push("export const RATIONALE_TAGS = [");
  for (const tag of opts.rationaleTags) lines.push(`  '${tag}',`);
  lines.push("] as const;");
  return lines.join('\n');
}

function buildPermissions(matrix: Record<string, string[]>): string {
  const roles = Object.keys(matrix);
  const lines: string[] = [];
  lines.push('export const EDITOR_ROLE_PERMISSIONS: Record<EditorRole, ReadonlySet<FieldPath>> = {');
  for (const role of roles) {
    const fields = matrix[role];
    if (fields.length === 0) {
      lines.push(`  ${role}: new Set<FieldPath>(),`);
    } else {
      lines.push(`  ${role}: new Set<FieldPath>([`);
      for (const fp of fields) lines.push(`    '${fp}',`);
      lines.push('  ]),');
    }
  }
  lines.push('};');
  return lines.join('\n');
}

function canonicalMatrixDoc(): Record<string, Set<string>> {
  return {
    senior_reviewer: new Set(SENIOR_REVIEWER_FIELDS),
    policy_lead: new Set(POLICY_LEAD_FIELDS),
    qa_reviewer: new Set<string>(),
  };
}

function canonicalMatrixCode(): Record<string, string[]> {
  return {
    senior_reviewer: SENIOR_REVIEWER_FIELDS,
    policy_lead: POLICY_LEAD_FIELDS,
    qa_reviewer: [],
  };
}

function canonicalRepo(): {
  ontologyText: string;
  typesText: string;
  permissionsText: string;
} {
  return {
    ontologyText: buildOntology({
      fieldPaths: CANONICAL_FIELD_PATHS,
      rationaleTags: CANONICAL_RATIONALE_TAGS,
      editorRoles: CANONICAL_EDITOR_ROLES,
      matrix: canonicalMatrixDoc(),
    }),
    typesText: buildTypes({
      fieldPaths: CANONICAL_FIELD_PATHS,
      rationaleTags: CANONICAL_RATIONALE_TAGS,
      editorRoles: CANONICAL_EDITOR_ROLES,
    }),
    permissionsText: buildPermissions(canonicalMatrixCode()),
  };
}

describe('checkEditableFieldsLockstep (synthetic mini-repo)', () => {
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

  it('passes when ontology section 3.15 matches FIELD_PATHS', () => {
    const root = build(canonicalRepo());
    expect(lockstep.checkEditableFieldsLockstep(root)).toBe(true);
  });

  it('fails when ontology has a field missing from FIELD_PATHS', () => {
    const canonical = canonicalRepo();
    const docHasExtra = buildOntology({
      fieldPaths: [...CANONICAL_FIELD_PATHS, 'rogue.field'],
      rationaleTags: CANONICAL_RATIONALE_TAGS,
      editorRoles: CANONICAL_EDITOR_ROLES,
      matrix: canonicalMatrixDoc(),
    });
    const root = build({ ...canonical, ontologyText: docHasExtra });
    expect(lockstep.checkEditableFieldsLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/ontology has but types\.ts lacks: rogue\.field/);
  });

  it('fails when FIELD_PATHS has a field missing from ontology', () => {
    const canonical = canonicalRepo();
    const typesHasExtra = buildTypes({
      fieldPaths: [...CANONICAL_FIELD_PATHS, 'rogue.field'],
      rationaleTags: CANONICAL_RATIONALE_TAGS,
      editorRoles: CANONICAL_EDITOR_ROLES,
    });
    const root = build({ ...canonical, typesText: typesHasExtra });
    expect(lockstep.checkEditableFieldsLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/types\.ts has but ontology lacks: rogue\.field/);
  });

  it('fails when ontology section 3.15 header is missing', () => {
    const noSection = buildOntology({
      fieldPaths: [],
      rationaleTags: CANONICAL_RATIONALE_TAGS,
      editorRoles: CANONICAL_EDITOR_ROLES,
      matrix: canonicalMatrixDoc(),
    }).replace('### 3.15 `field_path` (closed-set vocabulary)', '### 3.99 absent');
    const canonical = canonicalRepo();
    const root = build({ ...canonical, ontologyText: noSection });
    expect(lockstep.checkEditableFieldsLockstep(root)).toBe(false);
  });
});

describe('checkRationaleTagLockstep (synthetic mini-repo)', () => {
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

  it('passes when ontology section 3.16 matches RATIONALE_TAGS', () => {
    const root = build(canonicalRepo());
    expect(lockstep.checkRationaleTagLockstep(root)).toBe(true);
  });

  it('fails when ontology has a tag missing from RATIONALE_TAGS', () => {
    const canonical = canonicalRepo();
    const docHasExtra = buildOntology({
      fieldPaths: CANONICAL_FIELD_PATHS,
      rationaleTags: [...CANONICAL_RATIONALE_TAGS, 'rogue_tag'],
      editorRoles: CANONICAL_EDITOR_ROLES,
      matrix: canonicalMatrixDoc(),
    });
    const root = build({ ...canonical, ontologyText: docHasExtra });
    expect(lockstep.checkRationaleTagLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/ontology has but types\.ts lacks: rogue_tag/);
  });

  it('fails when RATIONALE_TAGS has a tag missing from ontology', () => {
    const canonical = canonicalRepo();
    const typesHasExtra = buildTypes({
      fieldPaths: CANONICAL_FIELD_PATHS,
      rationaleTags: [...CANONICAL_RATIONALE_TAGS, 'rogue_tag'],
      editorRoles: CANONICAL_EDITOR_ROLES,
    });
    const root = build({ ...canonical, typesText: typesHasExtra });
    expect(lockstep.checkRationaleTagLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/types\.ts has but ontology lacks: rogue_tag/);
  });
});

describe('checkEditorRoleLockstep (synthetic mini-repo)', () => {
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

  it('passes when ontology section 3.17 matches EDITOR_ROLES + EDITOR_ROLE_PERMISSIONS', () => {
    const root = build(canonicalRepo());
    expect(lockstep.checkEditorRoleLockstep(root)).toBe(true);
  });

  it('fails when ontology adds a role missing from EDITOR_ROLES', () => {
    const canonical = canonicalRepo();
    const docHasExtraRole = buildOntology({
      fieldPaths: CANONICAL_FIELD_PATHS,
      rationaleTags: CANONICAL_RATIONALE_TAGS,
      editorRoles: [...CANONICAL_EDITOR_ROLES, 'rogue_role'],
      matrix: { ...canonicalMatrixDoc(), rogue_role: new Set<string>() },
    });
    const root = build({ ...canonical, ontologyText: docHasExtraRole });
    expect(lockstep.checkEditorRoleLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/ontology has but types\.ts lacks: rogue_role/);
  });

  it('fails when ontology grants senior_reviewer a field that EDITOR_ROLE_PERMISSIONS denies', () => {
    const canonical = canonicalRepo();
    // Ontology says senior_reviewer CAN edit l3.method; code denies.
    const docOverGrants = buildOntology({
      fieldPaths: CANONICAL_FIELD_PATHS,
      rationaleTags: CANONICAL_RATIONALE_TAGS,
      editorRoles: CANONICAL_EDITOR_ROLES,
      matrix: {
        senior_reviewer: new Set([...SENIOR_REVIEWER_FIELDS, 'l3.method']),
        policy_lead: new Set(POLICY_LEAD_FIELDS),
        qa_reviewer: new Set<string>(),
      },
    });
    const root = build({ ...canonical, ontologyText: docOverGrants });
    expect(lockstep.checkEditorRoleLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/role "senior_reviewer"/);
    expect(errors).toMatch(/ontology allows but EDITOR_ROLE_PERMISSIONS lacks: l3\.method/);
  });

  it('fails when EDITOR_ROLE_PERMISSIONS grants senior_reviewer a field that ontology denies', () => {
    const canonical = canonicalRepo();
    // Code grants senior_reviewer l3.method; ontology denies.
    const codeOverGrants = buildPermissions({
      senior_reviewer: [...SENIOR_REVIEWER_FIELDS, 'l3.method'],
      policy_lead: POLICY_LEAD_FIELDS,
      qa_reviewer: [],
    });
    const root = build({ ...canonical, permissionsText: codeOverGrants });
    expect(lockstep.checkEditorRoleLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/role "senior_reviewer"/);
    expect(errors).toMatch(/EDITOR_ROLE_PERMISSIONS allows but ontology lacks: l3\.method/);
  });

  it('fails when qa_reviewer is granted any field in EDITOR_ROLE_PERMISSIONS', () => {
    const canonical = canonicalRepo();
    const codeGrantsQa = buildPermissions({
      senior_reviewer: SENIOR_REVIEWER_FIELDS,
      policy_lead: POLICY_LEAD_FIELDS,
      qa_reviewer: ['l1.category'],
    });
    const root = build({ ...canonical, permissionsText: codeGrantsQa });
    expect(lockstep.checkEditorRoleLockstep(root)).toBe(false);
    const errors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errors).toMatch(/role "qa_reviewer"/);
  });
});
