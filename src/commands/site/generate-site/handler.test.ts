import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import type { GenerateSiteInput } from './spec.js';
import fs from 'node:fs';
import path from 'node:path';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj_abc';

const VALID_ROUTES: GenerateSiteInput['routes'] = [
  { screenId: 'scr_1', route: '/' },
  { screenId: 'scr_2', route: '/about' },
];

function makeInput(outputDir: string, overrides: Partial<GenerateSiteInput> = {}): GenerateSiteInput {
  return {
    projectId: PROJECT_ID,
    outputDir,
    routes: VALID_ROUTES,
    ...overrides,
  };
}

let mockHtmlContent: string | undefined;

const mockDownloadAssets = mock(async (outputDir: string, _opts?: any) => {
  console.log('mockDownloadAssets called with', outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  const trace: any[] = [];
  for (const r of VALID_ROUTES) {
    const randomFolder = 'folder_' + Math.random().toString(36).slice(2);
    const screenDir = path.join(outputDir, randomFolder);
    fs.mkdirSync(screenDir, { recursive: true });
    const filePath = path.join(screenDir, 'code.html');
    console.log('Writing dummy file to', filePath);
    fs.writeFileSync(
      filePath, 
      mockHtmlContent !== undefined ? mockHtmlContent : `<html><body>page for ${r.screenId}</body></html>`
    );
    trace.push({
      screenId: r.screenId,
      screenSlug: randomFolder,
      filePath: path.join(randomFolder, 'code.html'),
    });
  }
  console.log('Files in staging:', fs.readdirSync(outputDir));
  return trace;
});

const mockProject = mock(() => ({
  downloadAssets: mockDownloadAssets,
  screens: mock(async () => [
    { screenId: 'scr_1', title: 'scr_1' },
    { screenId: 'scr_2', title: 'scr_2' },
  ]),
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
    mockProject.mockClear();
    mockHtmlContent = undefined;
  });

  // Cycle 3: Phase 1 — SDK delegation

  it('calls sdk.downloadAssets with a stagingDir inside outputDir', async () => {
    const outputDir = path.join(import.meta.dir, 'temp-generate-site-' + Math.random().toString(36).slice(2));
    fs.mkdirSync(outputDir, { recursive: true });

    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());

    await handler.execute(makeInput(outputDir));

    expect(mockDownloadAssets).toHaveBeenCalledTimes(1);
    const [calledOutputDir] = mockDownloadAssets.mock.calls[0]!;
    expect(calledOutputDir).toMatch(new RegExp(`^${outputDir}/`));
    expect(mockProject).toHaveBeenCalledWith(PROJECT_ID);

    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('passes fileMode, tempDir, assetsSubdir through to sdk.downloadAssets', async () => {
    const outputDir = path.join(import.meta.dir, 'temp-generate-site-' + Math.random().toString(36).slice(2));
    fs.mkdirSync(outputDir, { recursive: true });

    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());

    await handler.execute(makeInput(outputDir, {
      fileMode: 0o644,
      tempDir: '/ram/tmp',
      assetsSubdir: 'static',
    }));

    const [, calledOpts] = mockDownloadAssets.mock.calls[0]!;
    expect(calledOpts.fileMode).toBe(0o644);
    expect(calledOpts.tempDir).toBe('/ram/tmp');
    expect(calledOpts.assetsSubdir).toBe('static');

    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('propagates DOWNLOAD_FAILED when sdk.downloadAssets returns failure', async () => {
    const outputDir = path.join(import.meta.dir, 'temp-generate-site-' + Math.random().toString(36).slice(2));
    fs.mkdirSync(outputDir, { recursive: true });

    mockDownloadAssets.mockRejectedValueOnce(new Error('cdn unreachable'));

    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());
    const result = await handler.execute(makeInput(outputDir));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('DOWNLOAD_FAILED');
    expect(result.error.message).toContain('cdn unreachable');

    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('returns success with pages when sdk.downloadAssets succeeds', async () => {
    const outputDir = path.join(import.meta.dir, 'temp-generate-site-' + Math.random().toString(36).slice(2));
    fs.mkdirSync(outputDir, { recursive: true });

    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());

    const result = await handler.execute(makeInput(outputDir));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.outputDir).toBe(outputDir);
    expect(result.pages).toEqual(VALID_ROUTES);

    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  // Cycle 4: Phase 2 — Astro post-processing

  it('reads staged HTML for each screen and writes to src/pages/{route}.astro', async () => {
    const outputDir = path.join(import.meta.dir, 'temp-generate-site-' + Math.random().toString(36).slice(2));
    fs.mkdirSync(outputDir, { recursive: true });

    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());
    const result = await handler.execute(makeInput(outputDir));
    
    if (!result.success) {
      console.error('FULL SUITE FAILURE ERROR:', result.error);
    }
    expect(result.success).toBe(true);

    // scr_1 → index.astro, scr_2 → about/index.astro
    expect(fs.existsSync(path.join(outputDir, 'src/pages/index.astro'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/pages/about/index.astro'))).toBe(true);

    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('prepends Astro frontmatter fences to written pages', async () => {
    const outputDir = path.join(import.meta.dir, 'temp-generate-site-' + Math.random().toString(36).slice(2));
    fs.mkdirSync(outputDir, { recursive: true });

    mockHtmlContent = '<html><body>Hello</body></html>';

    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());
    await handler.execute(makeInput(outputDir, { routes: [{ screenId: 'scr_1', route: '/' }] }));

    const content = fs.readFileSync(path.join(outputDir, 'src/pages/index.astro'), 'utf-8');
    expect(content).toMatch(/^---\n---\n/);

    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('escapes curly braces in text nodes for Astro compatibility', async () => {
    const outputDir = path.join(import.meta.dir, 'temp-generate-site-' + Math.random().toString(36).slice(2));
    fs.mkdirSync(outputDir, { recursive: true });

    mockHtmlContent = '<html><body><p>Price: {amount}</p></body></html>';

    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());
    await handler.execute(makeInput(outputDir, { routes: [{ screenId: 'scr_1', route: '/' }] }));

    const content = fs.readFileSync(path.join(outputDir, 'src/pages/index.astro'), 'utf-8');
    expect(content).not.toContain('{amount}');
    expect(content).toContain("{'{'}amount{'}'}");

    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('preserves curly braces inside <script> and <style> tags unescaped', async () => {
    const outputDir = path.join(import.meta.dir, 'temp-generate-site-' + Math.random().toString(36).slice(2));
    fs.mkdirSync(outputDir, { recursive: true });

    mockHtmlContent = '<html><head><style>a { color: red; }</style></head><body></body></html>';

    const { GenerateSiteHandler } = await import('./handler.js');
    const handler = new GenerateSiteHandler(makeClient());
    await handler.execute(makeInput(outputDir, { routes: [{ screenId: 'scr_1', route: '/' }] }));

    const content = fs.readFileSync(path.join(outputDir, 'src/pages/index.astro'), 'utf-8');
    expect(content).toContain('color: red;');
    expect(content).not.toContain("{'{'} color: red;");

    fs.rmSync(outputDir, { recursive: true, force: true });
  });
});
