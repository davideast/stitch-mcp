import { describe, it, expect, mock } from 'bun:test';
import { ScreensHandler } from '../../../src/commands/screens/handler.js';
import { createMockStitch, createMockProject, createMockScreen } from '../../../src/services/stitch-sdk/MockStitchSDK.js';

describe('ScreensHandler (SDK)', () => {
  it('sorts screens: code-available first, then alphabetical within each group', async () => {
    const screens = [
      createMockScreen({ screenId: 's1', title: 'Zebra', getHtml: mock(() => Promise.reject(new Error('not found'))) }),
      createMockScreen({ screenId: 's2', title: 'Beta' }),
      createMockScreen({ screenId: 's3', title: 'Alpha' }),
      createMockScreen({ screenId: 's4', title: 'Apple', getHtml: mock(() => Promise.reject(new Error('not found'))) }),
    ];
    const stitch = createMockStitch(createMockProject('123', screens));

    const handler = new ScreensHandler(stitch as any);
    const result = await handler.execute('123');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.screens[0].title).toBe('Alpha');
    expect(result.screens[0].hasCode).toBe(true);
    expect(result.screens[1].title).toBe('Beta');
    expect(result.screens[2].title).toBe('Apple');
    expect(result.screens[2].hasCode).toBe(false);
    expect(result.screens[3].title).toBe('Zebra');
  });

  it('maps SDK Screen fields to handler output shape', async () => {
    const screen = createMockScreen({
      screenId: 'my-screen-id',
      title: 'My Screen',
      getHtml: mock(() => Promise.resolve('http://code')),
      getImage: mock(() => Promise.resolve('http://image')),
    });
    const stitch = createMockStitch(createMockProject('123', [screen]));

    const handler = new ScreensHandler(stitch as any);
    const result = await handler.execute('123');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.screens[0].screenId).toBe('my-screen-id');
    expect(result.screens[0].title).toBe('My Screen');
    expect(result.screens[0].hasCode).toBe(true);
    expect(result.screens[0].codeUrl).toBe('http://code');
    expect(result.screens[0].hasImage).toBe(true);
  });

  it.skip('getHtml() and getImage() use cached data after screens() call (no double fetch)', async () => {
    // TODO: Verify the SDK caches per-screen data after a project.screens() call.
  });
});