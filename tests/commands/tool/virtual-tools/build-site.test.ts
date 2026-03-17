import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { buildSiteTool } from '../../../../src/commands/tool/virtual-tools/build-site.js';
import { createMockStitch, createMockProject, createMockScreen } from '../../../../src/services/stitch-sdk/MockStitchSDK.js';

const screens = [
    createMockScreen({ screenId: 'home', title: 'Home' }),
    createMockScreen({ screenId: 'about', title: 'About' }),
];
const mockStitch = createMockStitch(createMockProject('proj-1', screens));

mock.module('@google/stitch-sdk', () => ({
  stitch: mockStitch
}));

describe('build_site virtual tool (SDK)', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = { callTool: mock() };
    global.fetch = mock(() => Promise.resolve(new Response('<html/>', { status: 200 }))) as any;
  });

  it('resolves screens from SDK project instead of ProjectSyncer', async () => {
    const result = await buildSiteTool.execute(mockClient, {
      projectId: 'proj-1',
      routes: [{ screenId: 'home', route: '/' }, { screenId: 'about', route: '/about' }],
    });

    expect(result.success).toBe(true);
    expect(mockStitch.project).toHaveBeenCalledWith('proj-1');
  });

  it('should throw when screen ID is not found', async () => {
    await expect(
      buildSiteTool.execute(mockClient, {
        projectId: 'proj-1',
        routes: [{ screenId: 'nonexistent', route: '/' }],
      })
    ).rejects.toThrow("Screen IDs not found in project: nonexistent");
  });

  it('should throw for empty routes array', async () => {
    await expect(
      buildSiteTool.execute(mockClient, {
        projectId: '123',
        routes: [],
      })
    ).rejects.toThrow("non-empty array");
  });

  it("should throw when routes is not an array", async () => {
    await expect(
      buildSiteTool.execute(mockClient, {
        projectId: "123",
        routes: "not-an-array",
      })
    ).rejects.toThrow("routes must be an array");
  });

  it("should throw on duplicate routes", async () => {
    await expect(
      buildSiteTool.execute(mockClient, {
        projectId: "123",
        routes: [
          { screenId: "screen-1", route: "/" },
          { screenId: "screen-2", route: "/" },
        ],
      })
    ).rejects.toThrow("Duplicate route paths found: /");
  });

  it('build_site respects fetchWithRetry 429 retry logic', async () => {
     const origSetTimeout = globalThis.setTimeout;
     globalThis.setTimeout = ((fn: Function) => { fn(); return 0; }) as any;

     let calls = 0;
     const fetchMock = mock(async () => {
       calls++;
       if (calls < 3) {
         throw new Error("Too Many Requests (429)");
       }
       return new Response("<html>Success</html>", { status: 200 });
     });
     global.fetch = fetchMock as any;

     const result = await buildSiteTool.execute(mockClient, {
         projectId: 'proj-1',
         routes: [{ screenId: 'home', route: '/' }]
     });

     expect(calls).toBe(3);
     expect(result.pages[0].html).toBe("<html>Success</html>");

     globalThis.setTimeout = origSetTimeout;
  });
});
