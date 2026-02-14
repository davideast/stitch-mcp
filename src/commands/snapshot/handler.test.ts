import { expect, test, describe, spyOn, mock, afterEach, beforeEach } from 'bun:test';
import { SnapshotHandler } from './handler.js';
import path from 'path';
import fs from 'fs-extra';

// StitchViteServer uses dynamic import('vite') inside start(), so we can
// import it directly without mocking vite at the module level.
import { StitchViteServer } from '../../lib/server/vite/StitchViteServer.js';

// Use absolute paths for reliable mocking
const resolve = (p: string) => path.resolve(import.meta.dir, p);

// Mock fs-extra (using spyOn to avoid module replacement issues if possible, but pathExists/readJson might be direct calls)
const pathExistsSpy = spyOn(fs, 'pathExists');
const readJsonSpy = spyOn(fs, 'readJson');

// Mock SiteBuilder
const siteBuilderPath = resolve('../site/ui/SiteBuilder.tsx');
const siteBuilderPathJs = resolve('../site/ui/SiteBuilder.js');
const MockSiteBuilder = () => null;
mock.module(siteBuilderPath, () => ({ SiteBuilder: MockSiteBuilder }));
mock.module(siteBuilderPathJs, () => ({ SiteBuilder: MockSiteBuilder }));

// Mock ink-testing-library
mock.module('ink-testing-library', () => ({
  render: (component: any) => ({
    lastFrame: () => 'Mocked Ink Output: Stitch Site Builder\nHome\nAbout',
    unmount: () => {}
  })
}));

// Mock Spinner
const spinnerPath = resolve('../../ui/spinner.ts');
const spinnerPathJs = resolve('../../ui/spinner.js');
const mockSpinner = {
  start: () => mockSpinner,
  succeed: () => mockSpinner,
  fail: () => mockSpinner,
  stop: () => mockSpinner
};
mock.module(spinnerPath, () => ({ createSpinner: () => mockSpinner }));
mock.module(spinnerPathJs, () => ({ createSpinner: () => mockSpinner }));

describe('SnapshotHandler Output Tests', () => {
  let consoleLogSpy: any;
  let stdoutWriteSpy: any;
  let viteSpies: any[] = [];
  let originalFetch: any;

  // Mock Service Objects
  // Ensure strict structure matching GcloudService interface and expected return types
  const mockGcloudService = {
    isInstalled: async () => true,
    getVersion: async () => '450.0.0',
    getPath: async () => '/usr/bin/gcloud',
    ensureInstalled: async () => ({ success: true, data: { version: '450.0.0', location: 'system', path: '/usr/bin/gcloud' } }),
    isAuthenticated: async () => true,
    getActiveAccount: async () => 'test@example.com',
    hasADC: async () => true,
    getProjectId: async () => 'mock-project-id',
    getAccessToken: async () => 'mock-access-token',
    authenticate: async () => ({ success: true, data: { account: 'test@example.com' } }),
    authenticateADC: async () => ({ success: true }),
    listProjects: async () => ({ success: true, data: [{ projectId: 'mock-project-id', name: 'Mock Project' }] }),
    createProject: async () => {},
    enableApi: async () => {},
    setProject: async () => ({ success: true }),
    installBetaComponents: async () => ({ success: true }),
  };

  const mockStitchService = {
    checkIAMRole: async () => true,
    checkAPIEnabled: async () => true,
    configureIAM: async () => ({ success: true, data: { role: 'roles/owner', member: 'user:test@example.com' } }),
    enableAPI: async () => ({ success: true, data: { api: 'stitch.googleapis.com', enabled: true } }),
    testConnection: async () => ({ success: true, data: { connected: true, statusCode: 200, url: 'https://api.stitch.com' } }),
    testConnectionWithApiKey: async () => ({ success: true, data: { connected: true, statusCode: 200, url: 'https://api.stitch.com' } }),
  };

  // Fixed mock shape for generateConfig
  const mockMcpConfigService = {
    generateConfig: async () => ({
        success: true,
        data: {
            config: 'mock-config-content',
            instructions: 'Add this to config file'
        }
    }),
  };

  const mockProjectService = {
    selectProject: async () => ({ success: true, data: { projectId: 'mock-project-id', name: 'Mock Project' } }),
    getProjectDetails: async () => ({ projectId: 'mock-project-id', name: 'Mock Project' }),
  };

  beforeEach(() => {
    // Spy but allow pass-through to see logs in runner
    consoleLogSpy = spyOn(console, 'log');
    // process.stdout.write needs to return true
    stdoutWriteSpy = spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Spy on Vite prototype since SiteBuilder creates it directly (not injected)
    viteSpies = [
        spyOn(StitchViteServer.prototype, 'start').mockResolvedValue('http://localhost:5173'),
        spyOn(StitchViteServer.prototype, 'stop').mockResolvedValue(undefined),
        spyOn(StitchViteServer.prototype, 'navigate').mockImplementation(() => {}),
    ];

    // Mock global fetch for site command content fetching
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any) => {
        const url = input.toString();
        if (url.includes('html')) {
            return new Response('<h1>Mock Content</h1>', { status: 200 });
        }
        return new Response('{}', { status: 200 });
    }) as any;
  });

  afterEach(() => {
    mock.restore();
    pathExistsSpy.mockRestore();
    readJsonSpy.mockRestore();
    consoleLogSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    viteSpies.forEach(s => s.mockRestore());
    globalThis.fetch = originalFetch;
  });

  test('init command snapshot', async () => {
    const mockData = {
      mcpClient: 'vscode',
      authMode: 'oauth',
      transportType: 'stdio',
      inputArgs: {
        defaults: true,
        autoVerify: true
      }
    };

    pathExistsSpy.mockResolvedValue(false);

    // Inject mocks directly
    const handler = new SnapshotHandler({
        gcloud: mockGcloudService as any,
        stitch: mockStitchService as any,
        mcpConfig: mockMcpConfigService as any,
        project: mockProjectService as any
    });

    const result = await handler.execute({ command: 'init', data: JSON.stringify(mockData) });

    expect(result.success).toBe(true);

    const logs = consoleLogSpy.mock.calls.map(c => c.join(' ')).join('\n');
    const stdouts = stdoutWriteSpy.mock.calls.map(c => c.join(' ')).join('');
    const fullOutput = logs + stdouts;

    expect(fullOutput).toContain('Stitch MCP Setup');
    expect(fullOutput).toContain('Select MCP client');
    expect(fullOutput).toContain('Setup complete!');
  });

  test('doctor command snapshot', async () => {
    const mockData = {
      inputArgs: { verbose: true }
    };

    pathExistsSpy.mockResolvedValue(false);

    const handler = new SnapshotHandler({
        gcloud: mockGcloudService as any,
        stitch: mockStitchService as any
    });

    const result = await handler.execute({ command: 'doctor', data: JSON.stringify(mockData) });

    expect(result.success).toBe(true);

    const logs = consoleLogSpy.mock.calls.map(c => c.join(' ')).join('\n');
    const stdouts = stdoutWriteSpy.mock.calls.map(c => c.join(' ')).join('');
    const fullOutput = logs + stdouts;

    expect(fullOutput).toContain('Stitch Doctor');
    expect(fullOutput).toContain('Health Check Summary');
    expect(fullOutput).toContain('All checks passed!');
  });

  test('site command snapshot', async () => {
    const mockData = {
      screens: [
        {
            name: 's1',
            title: 'Home',
            htmlCode: { downloadUrl: 'http://mock/home.html' }
        },
        {
            name: 's2',
            title: 'About',
            htmlCode: { downloadUrl: 'http://mock/about.html' }
        }
      ],
      inputArgs: { projectId: 'mock-project' }
    };

    pathExistsSpy.mockResolvedValue(false);

    const handler = new SnapshotHandler();
    const result = await handler.execute({ command: 'site', data: JSON.stringify(mockData) });

    expect(result.success).toBe(true);

    const logs = consoleLogSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(logs).toContain('Mocked Ink Output');
    expect(logs).toContain('Stitch Site Builder');
    expect(logs).toContain('Home');
    expect(logs).toContain('About');
  });
});
