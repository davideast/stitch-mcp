import { describe, it, expect } from 'bun:test';
import { ListScreensInputSchema } from './spec.js';

describe('ListScreensInputSchema', () => {
  it('accepts a valid projectId', () => {
    const result = ListScreensInputSchema.safeParse({ projectId: 'proj_abc' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty projectId', () => {
    const result = ListScreensInputSchema.safeParse({ projectId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing projectId', () => {
    const result = ListScreensInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
