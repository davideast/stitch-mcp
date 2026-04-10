import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { createMockStitch, createMockProject, createMockScreen } from '../../../services/stitch-sdk/MockStitchSDK.js';
import { GenerateHandler } from './handler.js';
import type { GenerateInput } from './spec.js';

const PROJECT_ID = 'proj_abc';

const mockExecute = mock(() => Promise.resolve({ success: true, outputDir: './output', pages: [] }));

mock.module('../generate-site/handler.js', () => ({
  GenerateSiteHandler: mock(() => ({
    execute: mockExecute
  }))
}));

const mockFetchHtml = mock((url: string) => Promise.resolve(`<html>content for ${url}</html>`));

function makeClient(screens: any[]) {
  return createMockStitch(createMockProject(PROJECT_ID, screens));
}

function makeHandler(client: any) {
  return new GenerateHandler(client, mockFetchHtml);
}

function makeInput(overrides: Partial<GenerateInput> = {}): GenerateInput {
  return {
    projectId: PROJECT_ID,
    routesJson: [
      { screenId: 'scr_1', route: '/' },
      { screenId: 'scr_2', route: '/about' },
    ],
    outputDir: './output',
    ...overrides,
  };
}

describe('GenerateHandler', () => {
  beforeEach(() => {
    (mockExecute as any).mockClear();
    (mockFetchHtml as any).mockClear();
  });

  it('returns success with pages when all screens resolve', async () => {
    const client = makeClient([
      createMockScreen({ screenId: 'scr_1', title: 'Home', getHtml: mock(() => Promise.resolve('https://cdn.example.com/home.html')) }),
      createMockScreen({ screenId: 'scr_2', title: 'About', getHtml: mock(() => Promise.resolve('https://cdn.example.com/about.html')) }),
    ]);

    const result = await makeHandler(client).execute(makeInput());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.outputDir).toBe('./output');
    expect(result.pages).toEqual([
      { screenId: 'scr_1', route: '/' },
      { screenId: 'scr_2', route: '/about' },
    ]);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('returns SCREEN_NOT_FOUND when a screenId does not exist in the project', async () => {
    const client = makeClient([
      createMockScreen({ screenId: 'scr_1', title: 'Home', getHtml: mock(() => Promise.resolve('https://cdn.example.com/home.html')) }),
      // scr_2 is missing
    ]);

    const result = await makeHandler(client).execute(makeInput());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('SCREEN_NOT_FOUND');
    expect(result.error.message).toContain('scr_2');
  });

  it('returns GENERATE_FAILED when GenerateSiteHandler fails', async () => {
    const client = makeClient([
      createMockScreen({ screenId: 'scr_1', title: 'Home' }),
      createMockScreen({ screenId: 'scr_2', title: 'About' }),
    ]);

    (mockExecute as any).mockImplementationOnce(() => Promise.resolve({
      success: false,
      error: { code: 'GENERATE_FAILED', message: 'SDK error', recoverable: false }
    }));

    const result = await makeHandler(client).execute(makeInput());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('GENERATE_FAILED');
    expect(result.error.message).toBe('SDK error');
  });
});
