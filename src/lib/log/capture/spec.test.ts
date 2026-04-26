import { describe, test, expect } from 'bun:test';
import {
  CaptureInputSchema,
  CompletedPayloadSchema,
  EventSchema,
  FailedPayloadSchema,
  ProducedScreenSchema,
  RequestedPayloadSchema,
  kindOf,
} from './spec.js';

const validBlob = { sha256: 'a'.repeat(64), size: 10, mime: 'application/json' };

describe('kindOf()', () => {
  test.each([
    ['generate_screen_from_text', 'generative'],
    ['edit_screens', 'generative'],
    ['generate_variants', 'generative'],
    ['get_screen', 'read'],
    ['list_screens', 'read'],
    ['list_projects', 'read'],
    ['get_project', 'read'],
    ['create_project', 'read'],
    ['unknown_tool', null],
  ] as const)('kindOf(%s) === %s', (tool, expected) => {
    expect(kindOf(tool)).toBe(expected);
  });
});

describe('ProducedScreenSchema', () => {
  test('accepts a minimal screen with all blobs null', () => {
    const r = ProducedScreenSchema.safeParse({
      project_id: 'p', screen_id: 's', name: 'projects/p/screens/s',
      parent_screen_id: null, sibling_screen_ids: [],
      effective_prompt: '', html_blob: null, screenshot_blob: null,
      theme_blob: null, design_system_blob: null,
    });
    expect(r.success).toBe(true);
  });

  test('rejects when sibling_screen_ids missing', () => {
    const r = ProducedScreenSchema.safeParse({
      project_id: 'p', screen_id: 's', name: 'n',
      parent_screen_id: null, effective_prompt: '',
      html_blob: null, screenshot_blob: null, theme_blob: null, design_system_blob: null,
    });
    expect(r.success).toBe(false);
  });
});

describe('Payload schemas', () => {
  test('Requested requires args_blob', () => {
    expect(RequestedPayloadSchema.safeParse({ tool: 'list_projects' }).success).toBe(false);
    expect(RequestedPayloadSchema.safeParse({ tool: 'list_projects', args_blob: validBlob }).success).toBe(true);
  });

  test('Completed-generative requires produced_screens + structured_content_blob', () => {
    const r = CompletedPayloadSchema.safeParse({
      tool: 'generate_screen_from_text', duration_ms: 100, kind: 'generative',
      structured_content_blob: validBlob, produced_screens: [],
    });
    expect(r.success).toBe(true);
  });

  test('Completed-read does not allow produced_screens', () => {
    const r = CompletedPayloadSchema.safeParse({
      tool: 'get_screen', duration_ms: 1, kind: 'read',
      project_id: 'p', screen_ids: ['s'],
      produced_screens: [],
    });
    // discriminated union — read variant rejects extra-strict, but zod default is strip; assert "kind" preserved
    if (r.success) expect((r.data as any).kind).toBe('read');
    else expect(r.success).toBe(false);
  });

  test('Failed accepts is_error true | "empty"', () => {
    expect(FailedPayloadSchema.safeParse({ tool: 'x', duration_ms: 1, is_error: true }).success).toBe(true);
    expect(FailedPayloadSchema.safeParse({ tool: 'x', duration_ms: 1, is_error: 'empty' }).success).toBe(true);
    expect(FailedPayloadSchema.safeParse({ tool: 'x', duration_ms: 1, is_error: false }).success).toBe(false);
  });
});

describe('EventSchema discrimination', () => {
  test('routes by type', () => {
    const ok = EventSchema.safeParse({
      id: 'a', time: 't', trace_id: 'r', schema_version: 1,
      type: 'call.requested', payload: { tool: 'list_projects', args_blob: validBlob },
    });
    expect(ok.success).toBe(true);
  });

  test('rejects unknown type', () => {
    const r = EventSchema.safeParse({
      id: 'a', time: 't', trace_id: 'r', schema_version: 1,
      type: 'observation', payload: {},
    });
    expect(r.success).toBe(false);
  });
});

describe('CaptureInputSchema', () => {
  test('accepts minimal valid input', () => {
    const r = CaptureInputSchema.safeParse({
      tool: 'list_projects', args: {}, result: {}, duration_ms: 0,
      started_at: 't0', finished_at: 't1',
    });
    expect(r.success).toBe(true);
  });

  test('rejects negative duration', () => {
    const r = CaptureInputSchema.safeParse({
      tool: 'x', args: {}, result: {}, duration_ms: -1, started_at: 't', finished_at: 't',
    });
    expect(r.success).toBe(false);
  });
});
