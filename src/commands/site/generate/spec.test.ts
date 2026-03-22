import { describe, it, expect } from 'bun:test';
import { GenerateInputSchema } from './spec.js';

describe('GenerateInputSchema', () => {
  const validRoutes = JSON.stringify([
    { screenId: 'scr_1', route: '/' },
    { screenId: 'scr_2', route: '/about' },
  ]);

  it('accepts valid input', () => {
    const result = GenerateInputSchema.safeParse({ projectId: 'proj_abc', routesJson: validRoutes });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.routesJson).toEqual([
      { screenId: 'scr_1', route: '/' },
      { screenId: 'scr_2', route: '/about' },
    ]);
  });

  it('rejects malformed JSON in routesJson', () => {
    const result = GenerateInputSchema.safeParse({ projectId: 'proj_abc', routesJson: 'not json' });
    expect(result.success).toBe(false);
  });

  it('rejects a route that does not start with /', () => {
    const bad = JSON.stringify([{ screenId: 'scr_1', route: 'about' }]);
    const result = GenerateInputSchema.safeParse({ projectId: 'proj_abc', routesJson: bad });
    expect(result.success).toBe(false);
  });

  it('rejects an empty screenId', () => {
    const bad = JSON.stringify([{ screenId: '', route: '/' }]);
    const result = GenerateInputSchema.safeParse({ projectId: 'proj_abc', routesJson: bad });
    expect(result.success).toBe(false);
  });

  it('rejects an empty projectId', () => {
    const result = GenerateInputSchema.safeParse({ projectId: '', routesJson: validRoutes });
    expect(result.success).toBe(false);
  });

  it('defaults outputDir to "."', () => {
    const result = GenerateInputSchema.safeParse({ projectId: 'proj_abc', routesJson: validRoutes });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.outputDir).toBe('.');
  });
});
