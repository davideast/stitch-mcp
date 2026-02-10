import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { SiteCommandHandler } from './index.js';
import { SiteManifest } from './utils/SiteManifest.js';
import type { RemoteScreen } from '../../lib/services/site/types.js';

const TEST_PROJECT_ID = 'test-export-project';
const baseDir = path.join(os.homedir(), '.stitch-mcp', 'site', TEST_PROJECT_ID);

function makeClient(screens: RemoteScreen[]) {
  return {
    callTool: async (_name: string, _args: Record<string, any>) => ({
      screens,
    }),
  } as any;
}

const remoteScreens: RemoteScreen[] = [
  { name: 'screen-a', title: 'Home', htmlCode: { downloadUrl: 'https://example.com/a.html' } },
  { name: 'screen-b', title: 'About', htmlCode: { downloadUrl: 'https://example.com/b.html' } },
  { name: 'screen-c', title: 'Contact', htmlCode: { downloadUrl: 'https://example.com/c.html' } },
];

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

  it('skips screens without htmlCode', async () => {
    const screensWithMissing: RemoteScreen[] = [
      { name: 'screen-a', title: 'Home', htmlCode: { downloadUrl: 'https://example.com/a.html' } },
      { name: 'screen-no-html', title: 'No HTML' } as RemoteScreen,
    ];

    const manifest = new SiteManifest(TEST_PROJECT_ID);
    await manifest.save([
      { id: 'screen-a', status: 'included', route: '/' },
      { id: 'screen-no-html', status: 'included', route: '/missing' },
    ]);

    const handler = new SiteCommandHandler(makeClient(screensWithMissing));
    await handler.execute({ projectId: TEST_PROJECT_ID, export: true });

    const output = JSON.parse(logged[0]);
    // screen-no-html is filtered out by toUIScreens since it has no htmlCode
    expect(output.routes).toEqual([
      { screenId: 'screen-a', route: '/' },
    ]);
  });

  it('does not launch interactive UI when export is true', async () => {
    const handler = new SiteCommandHandler(makeClient(remoteScreens));
    // If it tried to render, it would hang or throw because there's no TTY.
    // A clean return means the interactive path was skipped.
    await handler.execute({ projectId: TEST_PROJECT_ID, export: true });
    expect(logged.length).toBe(1);
  });
});
