import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { GenerateSiteInput } from './spec.js';

// ── fs mock ────────────────────────────────────────────────────────────────────
// Must be declared before any import that transitively loads fs/promises.

const mockReadFile = mock((_path: string) => Promise.resolve(''));
const mockWriteFile = mock(() => Promise.resolve());
const mockMkdir = mock(() => Promise.resolve());
const mockRm = mock(() => Promise.resolve());

mock.module('node:fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  rm: mockRm,
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj_abc';
const OUTPUT_DIR = '/tmp/test-out';

const VALID_ROUTES: GenerateSiteInput['routes'] = [
  { screenId: 'scr_1', route: '/' },
  { screenId: 'scr_2', route: '/about' },
];

function makeInput(overrides: Partial<GenerateSiteInput> = {}): GenerateSiteInput {
  return {
    projectId: PROJECT_ID,
    outputDir: OUTPUT_DIR,
    routes: VALID_ROUTES,
    ...overrides,
  };
}

const mockDownloadAssets = mock((_outputDir: string, _opts?: any) => Promise.resolve());
const mockProject = mock(() => ({
  downloadAssets: mockDownloadAssets,
}));

function makeClient() {
  return {
    project: mockProject,
  } as any;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GenerateSiteHandler', () => {
  beforeEach(() => {
    mockDownloadAssets.mockClear();
    mockReadFile.mockClear();
    mockWriteFile.mockClear();
    mockMkdir.mockClear();
    mockRm.mockClear();
  });

  // Cycle 3: Phase 1 — SDK delegation

  it('calls sdk.downloadAssets with a stagingDir inside outputDir', async () => {
    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());

    await handler.execute(makeInput());

    expect(mockDownloadAssets).toHaveBeenCalledTimes(1);
    const [calledOutputDir] = mockDownloadAssets.mock.calls[0]!;
    expect(calledOutputDir).toMatch(new RegExp(`^${OUTPUT_DIR}/`));
    expect(mockProject).toHaveBeenCalledWith(PROJECT_ID);
  });

  it('passes fileMode, tempDir, assetsSubdir through to sdk.downloadAssets', async () => {
    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());

    await handler.execute(makeInput({
      fileMode: 0o644,
      tempDir: '/ram/tmp',
      assetsSubdir: 'static',
    }));

    const [, calledOpts] = mockDownloadAssets.mock.calls[0]!;
    expect(calledOpts.fileMode).toBe(0o644);
    expect(calledOpts.tempDir).toBe('/ram/tmp');
    expect(calledOpts.assetsSubdir).toBe('static');
  });

  it('propagates DOWNLOAD_FAILED when sdk.downloadAssets returns failure', async () => {
    mockDownloadAssets.mockRejectedValueOnce(new Error('cdn unreachable'));

    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());
    const result = await handler.execute(makeInput());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('DOWNLOAD_FAILED');
    expect(result.error.message).toContain('cdn unreachable');
  });

  it('returns success with pages when sdk.downloadAssets succeeds', async () => {
    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());

    const result = await handler.execute(makeInput());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.outputDir).toBe(OUTPUT_DIR);
    expect(result.pages).toEqual(VALID_ROUTES);
  });

  // Cycle 4: Phase 2 — Astro post-processing

  it('reads staged HTML for each screen and writes to src/pages/{route}.astro', async () => {
    mockReadFile.mockImplementation((p: string) =>
      Promise.resolve(`<html><body>page for ${p}</body></html>`)
    );

    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());
    await handler.execute(makeInput());

    // One readFile per route
    expect(mockReadFile).toHaveBeenCalledTimes(VALID_ROUTES.length);

    // scr_1 → index.astro, scr_2 → about/index.astro
    const writePaths = (mockWriteFile as any).mock.calls.map(([p]: any) => p as string);
    expect(writePaths.some((p: string) => p.endsWith('src/pages/index.astro'))).toBe(true);
    expect(writePaths.some((p: string) => p.endsWith('src/pages/about/index.astro'))).toBe(true);
  });

  it('prepends Astro frontmatter fences to written pages', async () => {
    mockReadFile.mockResolvedValue('<html><body>Hello</body></html>');

    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());
    await handler.execute(makeInput({ routes: [{ screenId: 'scr_1', route: '/' }] }));

    const [, content] = (mockWriteFile as any).mock.calls[0]!;
    expect(content as string).toMatch(/^---\n---\n/);
  });

  it('escapes curly braces in text nodes for Astro compatibility', async () => {
    mockReadFile.mockResolvedValue('<html><body><p>Price: {amount}</p></body></html>');

    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());
    await handler.execute(makeInput({ routes: [{ screenId: 'scr_1', route: '/' }] }));

    const [, content] = (mockWriteFile as any).mock.calls[0]!;
    // The curly braces must be escaped — raw {amount} would be an Astro expression
    expect(content as string).not.toContain('{amount}');
    expect(content as string).toContain("{'{'}")
  });

  it('preserves curly braces inside <script> and <style> tags unescaped', async () => {
    mockReadFile.mockResolvedValue(
      '<html><head><style>a { color: red; }</style></head><body></body></html>'
    );

    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());
    await handler.execute(makeInput({ routes: [{ screenId: 'scr_1', route: '/' }] }));

    const [, content] = (mockWriteFile as any).mock.calls[0]!;
    // CSS braces inside <style> must NOT be escaped
    expect(content as string).toContain('color: red;');
    expect(content as string).not.toContain("{'{'} color: red;");
  });
});
