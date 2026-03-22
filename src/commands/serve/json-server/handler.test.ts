import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { createMockStitch, createMockProject, createMockScreen } from '../../../services/stitch-sdk/MockStitchSDK.js';

const mockStart = mock(() => Promise.resolve('http://localhost:5173'));
const mockMount = mock(() => {});
const mockStop = mock(() => {});

mock.module('../../../lib/server/vite/StitchViteServer.js', () => ({
  StitchViteServer: class {
    start = mockStart;
    mount = mockMount;
    stop = mockStop;
  },
}));

const { JsonServerHandler } = await import('./handler.js');

const PROJECT_ID = 'proj_abc';
const mockDownloadHtml = mock((url: string) => Promise.resolve(`<html>content for ${url}</html>`));

function makeClient(screens: any[]) {
  return createMockStitch(createMockProject(PROJECT_ID, screens));
}

function makeHandler(client: any) {
  return new JsonServerHandler(client, mockDownloadHtml);
}

describe('JsonServerHandler', () => {
  beforeEach(() => {
    mockStart.mockClear();
    mockMount.mockClear();
    mockStop.mockClear();
    mockDownloadHtml.mockClear();
  });

  it('returns ready result with url and screen urls', async () => {
    const client = makeClient([
      createMockScreen({ screenId: 'scr_1', title: 'Home', getHtml: mock(() => Promise.resolve('https://cdn.example.com/home.html')) }),
    ]);

    const result = await makeHandler(client).execute({ projectId: PROJECT_ID });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.url).toBe('http://localhost:5173');
    expect(result.screens).toContainEqual({
      screenId: 'scr_1',
      title: 'Home',
      url: 'http://localhost:5173/screens/scr_1',
    });
  });

  it('returns SERVER_START_FAILED when server fails to start', async () => {
    mockStart.mockImplementationOnce(() => Promise.reject(new Error('port in use')));

    const client = makeClient([
      createMockScreen({ screenId: 'scr_1', title: 'Home', getHtml: mock(() => Promise.resolve('https://cdn.example.com/home.html')) }),
    ]);

    const result = await makeHandler(client).execute({ projectId: PROJECT_ID });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('SERVER_START_FAILED');
  });

  it('returns SCREENS_FETCH_FAILED when project.screens() throws', async () => {
    const client = makeClient([]);
    (client.project as any).mockImplementation(() => ({
      screens: mock(() => Promise.reject(new Error('network error'))),
      data: null,
    }));

    const result = await makeHandler(client).execute({ projectId: PROJECT_ID });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('SCREENS_FETCH_FAILED');
  });
});
