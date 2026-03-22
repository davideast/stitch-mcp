import { describe, it, expect, mock } from 'bun:test';
import { createMockStitch, createMockProject, createMockScreen } from '../../services/stitch-sdk/MockStitchSDK.js';
import { ServeHandler } from './handler.js';

const PROJECT_ID = 'proj_abc';

function makeClient(screens: any[]) {
  return createMockStitch(createMockProject(PROJECT_ID, screens));
}

describe('ServeHandler', () => {
  it('returns screens with codeUrls on success', async () => {
    const client = makeClient([
      createMockScreen({ screenId: 'scr_1', title: 'Home', getHtml: mock(() => Promise.resolve('https://cdn.example.com/home.html')) }),
      createMockScreen({ screenId: 'scr_2', title: 'About', getHtml: mock(() => Promise.resolve('https://cdn.example.com/about.html')) }),
    ]);

    const handler = new ServeHandler(client);
    const result = await handler.execute(PROJECT_ID);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.projectId).toBe(PROJECT_ID);
    expect(result.screens).toHaveLength(2);
    expect(result.screens).toContainEqual(expect.objectContaining({ screenId: 'scr_1', title: 'Home' }));
  });

  it('excludes screens where getHtml rejects', async () => {
    const client = makeClient([
      createMockScreen({ screenId: 'scr_1', title: 'Home', getHtml: mock(() => Promise.resolve('https://cdn.example.com/home.html')) }),
      createMockScreen({ screenId: 'scr_2', title: 'No HTML', getHtml: mock(() => Promise.reject(new Error('no code'))) }),
    ]);

    const handler = new ServeHandler(client);
    const result = await handler.execute(PROJECT_ID);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.screens).toHaveLength(1);
    expect(result.screens[0]?.screenId).toBe('scr_1');
  });

  it('returns SCREENS_FETCH_FAILED when project.screens() throws', async () => {
    const client = makeClient([]);
    (client.project as any).mockImplementation(() => ({
      screens: mock(() => Promise.reject(new Error('network error'))),
      data: null,
    }));

    const handler = new ServeHandler(client);
    const result = await handler.execute(PROJECT_ID);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('SCREENS_FETCH_FAILED');
  });
});
