import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { getScreenImageTool } from '../../../../src/commands/tool/virtual-tools/get-screen-image.js';
import { createMockStitch, createMockProject, createMockScreen } from '../../../../src/services/stitch-sdk/MockStitchSDK.js';

const mockStitch = createMockStitch(createMockProject('proj-1', [
    createMockScreen({ screenId: 'home', projectId: 'proj-1' }),
    createMockScreen({ screenId: 'no-image', projectId: 'proj-1', getImage: mock(() => Promise.resolve(null)) })
]));

describe('get_screen_image virtual tool (SDK)', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = { callTool: mock() };
    global.fetch = mock(() => Promise.resolve(new Response(new ArrayBuffer(8), { status: 200 }))) as any;
  });

  it('fetches image data via SDK screen.getImage()', async () => {
    const result = await getScreenImageTool.execute(mockClient, { projectId: 'proj-1', screenId: 'home' }, mockStitch as any);

    expect(result.screenId).toBe('home');
    expect(result.imageContent).toBeDefined();
  });

  it('returns null imageContent when getImage() returns null', async () => {
    const result = await getScreenImageTool.execute(mockClient, { projectId: 'proj-1', screenId: 'no-image' }, mockStitch as any);

    expect(result.imageContent).toBeNull();
  });
});