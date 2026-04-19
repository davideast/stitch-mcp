import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { getScreenCodeTool } from '../../../../src/commands/tool/virtual-tools/get-screen-code.js';
import { createMockStitch, createMockProject, createMockScreen } from '../../../../src/services/stitch-sdk/MockStitchSDK.js';

const mockStitch = createMockStitch(createMockProject('proj-1', [
    createMockScreen({ screenId: 'home', projectId: 'proj-1' }),
    createMockScreen({ screenId: 'no-code', projectId: 'proj-1', getHtml: mock(() => Promise.resolve(null)) })
]));

describe('get_screen_code virtual tool (SDK)', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = { callTool: mock() };
    global.fetch = mock(() => Promise.resolve(new Response('<html><span class="text-2xl text-center m-auto">hello</span></html>', { status: 200 }))) as any;
  });

  it('fetches HTML text via SDK screen.getHtml()', async () => {
    const result = await getScreenCodeTool.execute(mockClient, { projectId: 'proj-1', screenId: 'home' }, mockStitch as any);

    expect(result.screenId).toBe('home');
    expect(result.htmlContent).toBe('<html><span class="text-2xl text-center m-auto">hello</span></html>');
  });

  it('returns null htmlContent when getHtml() returns null', async () => {
    const result = await getScreenCodeTool.execute(mockClient, { projectId: 'proj-1', screenId: 'no-code' }, mockStitch as any);

    expect(result.htmlContent).toBeNull();
  });

  it('returns inline CSS when inlineCss is true', async () => {
    const result = await getScreenCodeTool.execute(mockClient, { projectId: 'proj-1', screenId: 'home', inlineCss: true }, mockStitch as any);

    expect(result.screenId).toBe('home');
    expect(result.htmlContent).toBe('<html><span style="margin: auto; text-align: center; font-size: 1.5rem; line-height: 2rem;">hello</span></html>');
  });
});
