// Structural assertions over the v5-envelope schema delta added in Phase 1.
// Mirrors the pattern used by tests/unit-conversation-envelope.mjs: we don't
// pull in an AJV-style validator (none is in package.json); we parse the
// schema JSON and walk the $defs structure for shape correctness. The fields
// are optional at the root, so envelope-side validation is a presence-of-
// $defs / shape-of-$defs check rather than a full schema-validation round
// trip. ascii-safe.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface SchemaShape {
  properties: Record<string, unknown>;
  $defs: Record<string, SchemaDef>;
}

interface SchemaDef {
  type?: string;
  additionalProperties?: boolean;
  required?: string[];
  properties?: Record<string, { type?: string | string[]; enum?: string[]; minimum?: number; maximum?: number; minLength?: number }>;
}

const schemaPath = resolve(process.cwd(), 'tests/schema/v5-envelope.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as SchemaShape;

describe('envelope schema -- media_artifact root field', () => {
  it('is referenced from root properties via $defs', () => {
    expect(schema.properties.media_artifact).toEqual({
      $ref: '#/$defs/media_artifact',
    });
  });

  it('is NOT in the top-level required list (additive optional)', () => {
    // The root required list is on the outer schema object, not inside the
    // SchemaShape interface; safer to assert via direct read.
    const raw = JSON.parse(readFileSync(schemaPath, 'utf-8')) as { required: string[] };
    expect(raw.required).not.toContain('media_artifact');
    expect(raw.required).not.toContain('media_detection_result');
  });

  it('defines $defs.media_artifact as a closed object with the three required fields', () => {
    const def = schema.$defs.media_artifact;
    if (!def) throw new Error('media_artifact def missing');
    expect(def.type).toBe('object');
    expect(def.additionalProperties).toBe(false);
    expect(def.required).toEqual(['type', 'url_or_base64', 'mime_type']);
    const props = def.properties;
    if (!props) throw new Error('media_artifact properties missing');
    expect(props.type!.enum).toEqual(['image', 'audio', 'video']);
    expect(props.url_or_base64!.type).toBe('string');
    expect(props.url_or_base64!.minLength).toBe(1);
    expect(props.mime_type!.type).toBe('string');
    expect(props.mime_type!.minLength).toBe(1);
  });
});

describe('envelope schema -- media_detection_result root field', () => {
  it('is referenced from root properties via $defs', () => {
    expect(schema.properties.media_detection_result).toEqual({
      $ref: '#/$defs/media_detection_result',
    });
  });

  it('defines $defs.media_detection_result as a closed object with the four required fields plus optional error', () => {
    const def = schema.$defs.media_detection_result;
    if (!def) throw new Error('media_detection_result def missing');
    expect(def.type).toBe('object');
    expect(def.additionalProperties).toBe(false);
    expect(def.required).toEqual(['is_synthetic', 'confidence', 'model_id', 'latency_ms']);
    const props = def.properties;
    if (!props) throw new Error('media_detection_result properties missing');

    expect(props.is_synthetic!.type).toBe('number');
    expect(props.is_synthetic!.minimum).toBe(0);
    expect(props.is_synthetic!.maximum).toBe(1);

    expect(props.confidence!.type).toBe('number');
    expect(props.confidence!.minimum).toBe(0);
    expect(props.confidence!.maximum).toBe(1);

    expect(props.model_id!.type).toBe('string');
    expect(props.model_id!.minLength).toBe(1);

    expect(props.latency_ms!.type).toBe('number');
    expect(props.latency_ms!.minimum).toBe(0);

    // error is optional (not in required) but defined for when the detector
    // surfaces a degradation signal.
    expect(props.error!.type).toBe('string');
    expect(def.required).not.toContain('error');
  });
});

describe('envelope schema -- regression guards', () => {
  it('leaves the schema_version const at 5.1 (engine emits 5.1; bumping would break lockstep)', () => {
    const raw = JSON.parse(readFileSync(schemaPath, 'utf-8')) as {
      properties: { schema_version: { const: string }; ontology_version: { const: string } };
    };
    expect(raw.properties.schema_version.const).toBe('5.1');
    expect(raw.properties.ontology_version.const).toBe('5.1');
  });

  it('preserves the existing input discriminator (prompt + conversation)', () => {
    const raw = JSON.parse(readFileSync(schemaPath, 'utf-8')) as {
      $defs: { input: { oneOf: Array<{ properties: { kind: { const: string } } }> } };
    };
    const kinds = raw.$defs.input.oneOf.map((arm) => arm.properties.kind.const);
    expect(kinds).toContain('prompt');
    expect(kinds).toContain('conversation');
  });
});

describe('media_detection_result -- result-shape validation against detector output', () => {
  // The detectors emit MediaDetectionResult instances; this test asserts the
  // shape matches the schema's required-field set. This is the contract the
  // Phase 2 wire-up relies on: detectMedia()'s return value MUST be a valid
  // media_detection_result object.

  it('a populated success result satisfies the required field set', () => {
    const result = {
      is_synthetic: 0.92,
      confidence: 0.92,
      model_id: 'Organika/sdxl-detector',
      latency_ms: 184,
    };
    const def = schema.$defs.media_detection_result;
    if (!def) throw new Error('media_detection_result def missing');
    const required = def.required ?? [];
    for (const field of required) {
      expect(result).toHaveProperty(field);
    }
  });

  it('a degraded result (error populated) still satisfies the required field set', () => {
    const result = {
      is_synthetic: 0,
      confidence: 0,
      model_id: 'Organika/sdxl-detector',
      latency_ms: 12,
      error: 'HF inference failed: 503 Service Unavailable',
    };
    const def = schema.$defs.media_detection_result;
    if (!def) throw new Error('media_detection_result def missing');
    const required = def.required ?? [];
    for (const field of required) {
      expect(result).toHaveProperty(field);
    }
    expect(result.error).toBeTruthy();
  });
});
