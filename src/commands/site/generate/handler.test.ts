import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { createMockStitch, createMockProject, createMockScreen } from '../../../services/stitch-sdk/MockStitchSDK.js';
import { GenerateHandler } from './handler.js';
import type { GenerateInput } from './spec.js';

const PROJECT_ID = 'proj_abc';

const mockGenerateSite = mock(() => Promise.resolve());

mock.module('../../../lib/services/site/SiteService.js', () => ({
  SiteService: { generateSite: mockGenerateSite },
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
    mockGenerateSite.mockClear();
    mockFetchHtml.mockClear();
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
    expect(mockGenerateSite).toHaveBeenCalledTimes(1);
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

  it('returns HTML_FETCH_FAILED when getHtml rejects', async () => {
    const client = makeClient([
      createMockScreen({ screenId: 'scr_1', title: 'Home', getHtml: mock(() => Promise.reject(new Error('cdn error'))) }),
      createMockScreen({ screenId: 'scr_2', title: 'About', getHtml: mock(() => Promise.resolve('https://cdn.example.com/about.html')) }),
    ]);

    const result = await makeHandler(client).execute(makeInput());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('HTML_FETCH_FAILED');
  });
});
