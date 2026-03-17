import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { getScreenCodeTool } from '../../../../src/commands/tool/virtual-tools/get-screen-code.js';
import { createMockStitch, createMockProject, createMockScreen } from '../../../../src/services/stitch-sdk/MockStitchSDK.js';
import * as stitchSdk from '@google/stitch-sdk';

mock.module('@google/stitch-sdk', () => ({
  stitch: createMockStitch(createMockProject('proj-1', [
      createMockScreen({ screenId: 'home', projectId: 'proj-1' }),
      createMockScreen({ screenId: 'no-code', projectId: 'proj-1', getHtml: mock(() => Promise.resolve(null)) })
  ]))
}));

describe('get_screen_code virtual tool (SDK)', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = { callTool: mock() };
    global.fetch = mock(() => Promise.resolve(new Response('<html>hello</html>', { status: 200 }))) as any;
  });

  it('fetches HTML text via SDK screen.getHtml()', async () => {
    const result = await getScreenCodeTool.execute(mockClient, { projectId: 'proj-1', screenId: 'home' });

    expect(result.screenId).toBe('home');
    expect(result.htmlContent).toBe('<html>hello</html>');
  });

  it('returns null htmlContent when getHtml() returns null', async () => {
    const result = await getScreenCodeTool.execute(mockClient, { projectId: 'proj-1', screenId: 'no-code' });

    expect(result.htmlContent).toBeNull();
  });
});
