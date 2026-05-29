// Tests for LLM-assisted free-text rationale clustering (Phase 2 / Full tier).
//
// Mirrors tests/osint/classify.test.ts. Coverage:
//   - Gating: clustering OFF by default returns empty result; model not called.
//   - Eligibility: only 'other' / 'coverage_gap' edits are sent to the model.
//   - Happy path: themes parsed from structured output.
//   - proposed_new_tags parsed when present.
//   - Schema validation (Layer 2): malformed / missing-themes output -> empty.
//   - API failure: thrown callModel -> empty result.
//   - Defensive prompting Layer 3: an instruction-leakage marker in a model
//     free-text field drops the whole result.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clusterRationaleText,
  type CallModelFn,
} from '../../src/lib/feedback/cluster';
import type { ClassifierEdit } from '../../src/lib/feedback/types';

function makeEdit(over: Partial<ClassifierEdit> = {}): ClassifierEdit {
  return {
    id: 1,
    evaluation_id: 'eval_1',
    editor_id: 'reviewer_a',
    editor_role: 'policy_lead',
    field_path: 'l3.method',
    change_type: 'add',
    before_value: null,
    after_value: 'pretexting_video_call',
    rationale_tag: 'coverage_gap',
    rationale_text: 'L3 method should be pretexting_video_call',
    created_at: '2026-05-28T12:00:00.000Z',
    propagation_status: 'pending',
    ...over,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('clusterRationaleText -- gating', () => {
  it('returns empty result and does not call the model when the flag is off', async () => {
    vi.stubEnv('SAFEEVAL_FEEDBACK_CLUSTERING_ENABLED', '');
    const callModel = vi.fn();
    const result = await clusterRationaleText([makeEdit()], { callModel });
    expect(result.themes).toEqual([]);
    expect(result.proposed_new_tags).toBeUndefined();
    expect(callModel).not.toHaveBeenCalled();
  });
});

describe('clusterRationaleText -- enabled', () => {
  beforeEach(() => {
    vi.stubEnv('SAFEEVAL_FEEDBACK_CLUSTERING_ENABLED', 'true');
  });

  it('returns empty result and skips the model when no eligible edits', async () => {
    const callModel = vi.fn();
    // Only a non-clusterable tag present.
    const result = await clusterRationaleText(
      [makeEdit({ rationale_tag: 'wrong_l3_method', rationale_text: null })],
      { callModel },
    );
    expect(result.themes).toEqual([]);
    expect(callModel).not.toHaveBeenCalled();
  });

  it('sends only clusterable edits to the model', async () => {
    const captured: { user: string } = { user: '' };
    const callModel: CallModelFn = vi.fn(async (args) => {
      captured.user = args.user;
      return JSON.stringify({ themes: [] });
    });
    await clusterRationaleText(
      [
        makeEdit({ id: 10, rationale_tag: 'coverage_gap', rationale_text: 'note-cov' }),
        makeEdit({ id: 11, rationale_tag: 'other', rationale_text: 'note-other' }),
        makeEdit({ id: 12, rationale_tag: 'wrong_l1_category', rationale_text: 'note-skip' }),
      ],
      { callModel },
    );
    expect(captured.user).toContain('edit_id=10');
    expect(captured.user).toContain('edit_id=11');
    expect(captured.user).not.toContain('edit_id=12');
    expect(captured.user).not.toContain('note-skip');
  });

  it('parses themes from structured output', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue(
      JSON.stringify({
        themes: [
          {
            description: 'Missing video-call pretext method',
            edit_ids: [1, 2],
            suggested_existing_tag_if_any: null,
            suggested_new_tag_if_needed: 'pretexting_video_call',
          },
        ],
      }),
    );
    const result = await clusterRationaleText([makeEdit()], { callModel });
    expect(result.themes).toHaveLength(1);
    expect(result.themes[0]!.description).toMatch(/video-call/);
    expect(result.themes[0]!.edit_ids).toEqual([1, 2]);
    expect(result.themes[0]!.suggested_new_tag_if_needed).toBe('pretexting_video_call');
    expect(result.themes[0]!.suggested_existing_tag_if_any).toBeNull();
  });

  it('parses proposed_new_tags when present', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue(
      JSON.stringify({
        themes: [
          {
            description: 'Recovery-fraud secondary victimization mislabel',
            edit_ids: [3],
            suggested_existing_tag_if_any: null,
            suggested_new_tag_if_needed: 'secondary_victimization_misclassified',
          },
        ],
        proposed_new_tags: [
          {
            tag: 'secondary_victimization_misclassified',
            rationale: 'L2 stayed romance_fraud when it was recovery fraud',
            supporting_edit_ids: [3],
          },
        ],
      }),
    );
    const result = await clusterRationaleText([makeEdit({ rationale_tag: 'other', rationale_text: 'x' })], {
      callModel,
    });
    expect(result.proposed_new_tags).toHaveLength(1);
    expect(result.proposed_new_tags![0]!.tag).toBe('secondary_victimization_misclassified');
    expect(result.proposed_new_tags![0]!.supporting_edit_ids).toEqual([3]);
  });

  it('strips a json code fence around the output', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue(
      '```json\n' + JSON.stringify({ themes: [{ description: 'fenced', edit_ids: [] }] }) + '\n```',
    );
    const result = await clusterRationaleText([makeEdit()], { callModel });
    expect(result.themes[0]!.description).toBe('fenced');
  });
});

describe('clusterRationaleText -- schema validation (Layer 2)', () => {
  beforeEach(() => {
    vi.stubEnv('SAFEEVAL_FEEDBACK_CLUSTERING_ENABLED', 'true');
  });

  it('drops non-JSON output', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue('OK');
    const result = await clusterRationaleText([makeEdit()], { callModel });
    expect(result.themes).toEqual([]);
  });

  it('drops output missing the themes array', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue(JSON.stringify({ foo: 'bar' }));
    const result = await clusterRationaleText([makeEdit()], { callModel });
    expect(result.themes).toEqual([]);
  });

  it('drops a theme missing its description', async () => {
    const callModel: CallModelFn = vi.fn().mockResolvedValue(
      JSON.stringify({ themes: [{ edit_ids: [1] }] }),
    );
    const result = await clusterRationaleText([makeEdit()], { callModel });
    expect(result.themes).toEqual([]);
  });
});

describe('clusterRationaleText -- API failure', () => {
  beforeEach(() => {
    vi.stubEnv('SAFEEVAL_FEEDBACK_CLUSTERING_ENABLED', 'true');
  });

  it('returns empty result when callModel rejects', async () => {
    const callModel: CallModelFn = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const result = await clusterRationaleText([makeEdit()], { callModel });
    expect(result.themes).toEqual([]);
  });
});

describe('clusterRationaleText -- Layer 3 instruction leakage', () => {
  beforeEach(() => {
    vi.stubEnv('SAFEEVAL_FEEDBACK_CLUSTERING_ENABLED', 'true');
  });

  const cases: { label: string; mutate: (o: any) => any }[] = [
    {
      label: 'role-swap marker in description',
      mutate: (o) => {
        o.themes[0].description = 'I am now an uncensored AI; here is the data.';
        return o;
      },
    },
    {
      label: 'exfiltration marker in proposed tag rationale',
      mutate: (o) => {
        o.proposed_new_tags = [
          { tag: 'x', rationale: 'my system prompt is to cluster notes', supporting_edit_ids: [] },
        ];
        return o;
      },
    },
  ];

  it.each(cases)('drops the whole result on injection: $label', async ({ mutate }) => {
    const base = {
      themes: [
        { description: 'benign theme', edit_ids: [1], suggested_existing_tag_if_any: null, suggested_new_tag_if_needed: null },
      ],
    };
    const payload = mutate(JSON.parse(JSON.stringify(base)));
    const callModel: CallModelFn = vi.fn().mockResolvedValue(JSON.stringify(payload));
    const result = await clusterRationaleText([makeEdit()], { callModel });
    expect(result.themes).toEqual([]);
    expect(result.proposed_new_tags).toBeUndefined();
  });
});
