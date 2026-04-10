import { describe, it, expect } from 'bun:test';
import { GenerateSiteInputSchema } from './spec.js';

const validRoutes = [
  { screenId: 'scr_1', route: '/' },
  { screenId: 'scr_2', route: '/about' },
];

describe('GenerateSiteInputSchema', () => {
  it('accepts valid input', () => {
    const result = GenerateSiteInputSchema.safeParse({
      projectId: 'proj_abc',
      outputDir: '/tmp/out',
      routes: validRoutes,
    });
    expect(result.success).toBe(true);
  });

  const rejectionCases = [
    { desc: 'rejects empty projectId',   input: { projectId: '',         outputDir: '/tmp/out', routes: validRoutes } },
    { desc: 'rejects missing projectId', input: { outputDir: '/tmp/out', routes: validRoutes } },
    { desc: 'rejects empty outputDir',   input: { projectId: 'p1',       outputDir: '',         routes: validRoutes } },
    { desc: 'rejects empty routes array',input: { projectId: 'p1',       outputDir: '/tmp/out', routes: [] } },
    { desc: 'rejects route without leading /', input: { projectId: 'p1', outputDir: '/tmp/out', routes: [{ screenId: 'scr_1', route: 'about' }] } },
    { desc: 'rejects empty screenId in route', input: { projectId: 'p1', outputDir: '/tmp/out', routes: [{ screenId: '', route: '/' }] } },
  ];

  for (const { desc, input } of rejectionCases) {
    it(desc, () => {
      const result = GenerateSiteInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  }

  it('applies default fileMode of 0o600', () => {
    const result = GenerateSiteInputSchema.safeParse({
      projectId: 'p1',
      outputDir: '/tmp/out',
      routes: validRoutes,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.fileMode).toBe(0o600);
  });

  it('applies default assetsSubdir of "assets"', () => {
    const result = GenerateSiteInputSchema.safeParse({
      projectId: 'p1',
      outputDir: '/tmp/out',
      routes: validRoutes,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.assetsSubdir).toBe('assets');
  });

  it('accepts optional fileMode, tempDir, assetsSubdir overrides', () => {
    const result = GenerateSiteInputSchema.safeParse({
      projectId: 'p1',
      outputDir: '/tmp/out',
      routes: validRoutes,
      fileMode: 0o644,
      tempDir: '/ram/tmp',
      assetsSubdir: 'static',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.fileMode).toBe(0o644);
    expect(result.data.tempDir).toBe('/ram/tmp');
    expect(result.data.assetsSubdir).toBe('static');
  });
});
