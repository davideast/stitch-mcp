import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { createMockStitch, createMockProject, createMockScreen } from '../../services/stitch-sdk/MockStitchSDK.js';

// Mock Ink to prevent WASM load issues in CI
mock.module('ink', () => ({
  render: () => ({
    waitUntilExit: async () => {},
  }),
  useApp: () => ({
    exit: () => {},
  }),
  useInput: () => {},
  useStdout: () => ({ stdout: { write: () => {} } }),
  Box: () => null,
  Text: () => null,
}));

// Use dynamic imports to ensure mock.module applies before imports
const { SiteCommandHandler } = await import('./index.js');
const { SiteManifest } = await import('./utils/SiteManifest.js');

const TEST_PROJECT_ID = 'test-export-project';
const baseDir = path.join(os.homedir(), '.stitch-mcp', 'site', TEST_PROJECT_ID);

const remoteScreens = [
  createMockScreen({ screenId: 'screen-a', title: 'Home', getHtml: mock(() => Promise.resolve('https://example.com/a.html')) }),
  createMockScreen({ screenId: 'screen-b', title: 'About', getHtml: mock(() => Promise.resolve('https://example.com/b.html')) }),
  createMockScreen({ screenId: 'screen-c', title: 'Contact', getHtml: mock(() => Promise.resolve('https://example.com/c.html')) }),
];

function makeClient(screens: any[]) {
  return createMockStitch(createMockProject(TEST_PROJECT_ID, screens)) as any;
}

describe('site --export', () => {
  let originalLog: typeof console.log;
  let logged: string[];

  beforeEach(async () => {
    await fs.remove(baseDir);
    originalLog = console.log;
    logged = [];
    console.log = (...args: any[]) => {
      logged.push(args.map(String).join(' '));
    };
  });

  afterEach(async () => {
    console.log = originalLog;
    await fs.remove(baseDir);
  });

  it('outputs JSON with included screens and their routes', async () => {
    // Save manifest state: screen-a included with route, screen-b included with route
    const manifest = new SiteManifest(TEST_PROJECT_ID);
    await manifest.save([
      { id: 'screen-a', status: 'included', route: '/' },
      { id: 'screen-b', status: 'included', route: '/about' },
      { id: 'screen-c', status: 'ignored', route: '' },
    ]);

    const handler = new SiteCommandHandler(makeClient(remoteScreens));
    await handler.execute({ projectId: TEST_PROJECT_ID, export: true });

    expect(logged.length).toBe(1);
    const output = JSON.parse(logged[0]);
    expect(output).toEqual({
      projectId: TEST_PROJECT_ID,
      routes: [
        { screenId: 'screen-a', route: '/' },
        { screenId: 'screen-b', route: '/about' },
      ],
    });
  });

  it('outputs empty routes when no screens are included', async () => {
    const handler = new SiteCommandHandler(makeClient(remoteScreens));
    await handler.execute({ projectId: TEST_PROJECT_ID, export: true });

    expect(logged.length).toBe(1);
    const output = JSON.parse(logged[0]);
    expect(output).toEqual({
      projectId: TEST_PROJECT_ID,
      routes: [],
    });
  });

  it('excludes discarded screens from export', async () => {
    const manifest = new SiteManifest(TEST_PROJECT_ID);
    await manifest.save([
      { id: 'screen-a', status: 'included', route: '/' },
      { id: 'screen-b', status: 'discarded', route: '/about' },
    ]);

    const handler = new SiteCommandHandler(makeClient(remoteScreens));
    await handler.execute({ projectId: TEST_PROJECT_ID, export: true });

    const output = JSON.parse(logged[0]);
    expect(output.routes).toEqual([
      { screenId: 'screen-a', route: '/' },
    ]);
  });

  it('skips screens without getHtml resolving', async () => {
    const screensWithMissing = [
      createMockScreen({ screenId: 'screen-a', title: 'Home', getHtml: mock(() => Promise.resolve('https://example.com/a.html')) }),
      createMockScreen({ screenId: 'screen-no-html', title: 'No HTML', getHtml: mock(() => Promise.reject(new Error('no code'))) }),
    ];

    const manifest = new SiteManifest(TEST_PROJECT_ID);
    await manifest.save([
      { id: 'screen-a', status: 'included', route: '/' },
      { id: 'screen-no-html', status: 'included', route: '/missing' },
    ]);

    const handler = new SiteCommandHandler(makeClient(screensWithMissing));
    await handler.execute({ projectId: TEST_PROJECT_ID, export: true });

    const output = JSON.parse(logged[0]);
    expect(output.routes).toEqual([
      { screenId: 'screen-a', route: '/' },
    ]);
  });

  it('does not launch interactive UI when export is true', async () => {
    const handler = new SiteCommandHandler(makeClient(remoteScreens));
    await handler.execute({ projectId: TEST_PROJECT_ID, export: true });
    expect(logged.length).toBe(1);
  });
});
