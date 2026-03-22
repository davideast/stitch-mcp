import { describe, it, expect } from 'bun:test';
import { ServeOptionsSchema } from './spec.js';

describe('ServeOptionsSchema', () => {
  it('accepts a valid project id', () => {
    const result = ServeOptionsSchema.safeParse({ project: 'proj_abc' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing project', () => {
    const result = ServeOptionsSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('defaults listScreens to false', () => {
    const result = ServeOptionsSchema.safeParse({ project: 'proj_abc' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.listScreens).toBe(false);
  });

  it('defaults json to false', () => {
    const result = ServeOptionsSchema.safeParse({ project: 'proj_abc' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.json).toBe(false);
  });
});
