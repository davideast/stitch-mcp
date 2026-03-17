import { describe, it, expect, mock } from 'bun:test';
import { ServeHandler } from '../../../src/commands/serve/handler.js';
import { createMockStitch, createMockProject, createMockScreen } from '../../../src/services/stitch-sdk/MockStitchSDK.js';

describe('ServeHandler (SDK)', () => {
  it('returns screens with code URLs from SDK project', async () => {
    const screens = [
      createMockScreen({ screenId: 'home', title: 'Home' }),
      createMockScreen({
        screenId: 'settings',
        title: 'Settings',
        getHtml: mock(() => Promise.resolve(null)),  // no HTML — should be excluded
      }),
      createMockScreen({ screenId: 'about', title: 'About' }),
    ];
    const project = createMockProject('proj-1', screens);
    const stitch = createMockStitch(project);

    const handler = new ServeHandler(stitch as any);
    const result = await handler.execute('proj-1');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(stitch.project).toHaveBeenCalledWith('proj-1');
    expect(project.screens).toHaveBeenCalled();
    expect(result.screens).toHaveLength(2); // About and Home
    expect(result.screens[0]?.screenId).toBe('about'); // sorted alphabetically
    expect(result.screens[1]?.screenId).toBe('home');
    expect(result.screens[1]?.codeUrl).toBe('https://cdn.example.com/html/screen-1');
  });

  it('returns projectTitle from SDK project', async () => {
    const project = createMockProject('proj-1', []);
    (project as any).data = { title: 'Mock Project' };
    const stitch = createMockStitch(project);
    const handler = new ServeHandler(stitch as any);
    const result = await handler.execute('proj-1');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.projectTitle).toBe('Mock Project');
  });

  it('returns error result on SDK failure', async () => {
    const stitch = { project: mock(() => { throw new Error('Network error'); }) };
    const handler = new ServeHandler(stitch as any);
    const result = await handler.execute('proj-1');
    expect(result.success).toBe(false);
  });

  it.skip('project.title is exposed on SDK Project objects', async () => {
    // TODO: Verify actual SDK source exposes .title on Project.
    // Gap #1.
  });

  it.skip('screen.getHtml() returns null (not throws) for screens without HTML', async () => {
    // TODO: Confirm null vs. StitchError('NOT_FOUND') contract. Gap #4.
    // Used in the .filter(s => s.codeUrl !== null) line above.
  });
});
