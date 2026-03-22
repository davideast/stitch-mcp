import { describe, it, expect, mock } from 'bun:test';
import { createMockStitch, createMockProject, createMockScreen } from '../../../services/stitch-sdk/MockStitchSDK.js';
import { ListScreensHandler } from './handler.js';

const PROJECT_ID = 'proj_abc';

function makeClient(screens: any[]) {
  return createMockStitch(createMockProject(PROJECT_ID, screens));
}

describe('ListScreensHandler', () => {
  it('returns screens with suggestedRoutes on success', async () => {
    const client = makeClient([
      createMockScreen({ screenId: 'scr_1', title: 'Home', getHtml: mock(() => Promise.resolve('https://cdn.example.com/home.html')) }),
      createMockScreen({ screenId: 'scr_2', title: 'About Us', getHtml: mock(() => Promise.resolve('https://cdn.example.com/about.html')) }),
    ]);

    const handler = new ListScreensHandler(client);
    const result = await handler.execute({ projectId: PROJECT_ID });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.projectId).toBe(PROJECT_ID);
    expect(result.screens).toHaveLength(2);
    expect(result.screens).toContainEqual({ screenId: 'scr_1', title: 'Home', suggestedRoute: '/', hasHtml: true });
    expect(result.screens).toContainEqual({ screenId: 'scr_2', title: 'About Us', suggestedRoute: '/about-us', hasHtml: true });
  });

  it('marks hasHtml false when getHtml rejects', async () => {
    const client = makeClient([
      createMockScreen({ screenId: 'scr_1', title: 'Home', getHtml: mock(() => Promise.reject(new Error('no code'))) }),
    ]);

    const handler = new ListScreensHandler(client);
    const result = await handler.execute({ projectId: PROJECT_ID });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.screens).toContainEqual(expect.objectContaining({ screenId: 'scr_1', hasHtml: false }));
  });

  it('returns SCREENS_FETCH_FAILED when project.screens() throws', async () => {
    const client = makeClient([]);
    (client.project as any).mockImplementation(() => ({
      screens: mock(() => Promise.reject(new Error('network error'))),
    }));

    const handler = new ListScreensHandler(client);
    const result = await handler.execute({ projectId: PROJECT_ID });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('SCREENS_FETCH_FAILED');
  });
});
