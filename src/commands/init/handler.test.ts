
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock UI modules BEFORE importing handler
mock.module('../../ui/spinner.js', () => ({
  createSpinner: () => ({
    start: () => {},
    stop: () => {},
    succeed: () => {},
    fail: () => {},
    warn: () => {},
    info: () => {},
    text: '',
  }),
}));

mock.module('../../ui/checklist.js', () => ({
  createChecklist: () => ({
    run: async () => ({ success: true }),
  }),
  verifyAllSteps: async () => new Map(),
}));

import { InitHandler, type Wizard } from './handler.js';
import { type InitInput } from './spec.js';

// Mock dependencies
const mockGcloudService = {
  ensureInstalled: mock(() => Promise.resolve({ success: true, data: { location: 'system', path: '/usr/bin/gcloud', version: '400.0.0' } })),
  getActiveAccount: mock(() => Promise.resolve('test-user@example.com')),
  hasADC: mock(() => Promise.resolve(true)),
  getProjectId: mock(() => Promise.resolve('active-project')),
  setProject: mock(() => Promise.resolve({ success: true })),
  installBetaComponents: mock(() => Promise.resolve({ success: true })),
  getAccessToken: mock(() => Promise.resolve('fake-token')),
};

const mockProjectService = {
  getProjectDetails: mock(() => Promise.resolve({ success: true, data: { projectId: 'active-project', name: 'Active Project' } })),
  selectProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'selected-project', name: 'Selected Project' } })),
};

const mockStitchService = {
  checkIAMRole: mock(() => Promise.resolve(true)),
  checkAPIEnabled: mock(() => Promise.resolve(true)),
  testConnection: mock(() => Promise.resolve({ success: true, data: { statusCode: 200 } })),
  configureIAM: mock(() => Promise.resolve({ success: true, data: { role: 'roles/serviceusage.serviceUsageConsumer' } })),
  enableAPI: mock(() => Promise.resolve({ success: true, data: { api: 'stitch.googleapis.com' } })),
};

const mockMcpConfigService = {
  generateConfig: mock(() => Promise.resolve({ success: true, data: { config: '{}', instructions: 'Done' } })),
};

// Mock Wizard
const mockWizard: Wizard = {
  promptMcpClient: mock(() => Promise.resolve('vscode')),
  promptTransportType: mock(() => Promise.resolve('stdio')),
  promptConfirm: mock(() => Promise.resolve(true)),
};

describe('InitHandler', () => {
  let initHandler: InitHandler;
  let tempDir: string;
  let pkgPath: string;

  beforeEach(() => {
    // Setup temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stitch-init-test-'));
    pkgPath = path.join(tempDir, 'package.json');

    // Reset mocks
    mockMcpConfigService.generateConfig.mockClear();

    // Reset mockWizard functions
    mockWizard.promptMcpClient = mock(() => Promise.resolve('vscode'));
    mockWizard.promptTransportType = mock(() => Promise.resolve('stdio'));
    mockWizard.promptConfirm = mock(() => Promise.resolve(true));

    initHandler = new InitHandler(
      mockGcloudService as any,
      mockMcpConfigService as any,
      mockProjectService as any,
      mockStitchService as any,
      mockWizard,
      tempDir // Pass tempDir as cwd
    );
  });

  afterEach(() => {
    // Cleanup
    try {
        fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
        // ignore
    }
  });

  it('Test 1: should save to package.json and NOT inject env if confirmed', async () => {
    // Setup package.json
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'test-project' }, null, 2));

    // Mock confirmation for saving to package.json
    mockWizard.promptConfirm = mock((msg: string) => Promise.resolve(true));

    const input: InitInput = {
      local: false,
    };

    await initHandler.execute(input);

    // Verify package.json updated
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.stitch).toBeDefined();
    expect(pkg.stitch.projectId).toBe('active-project');

    // Verify generateConfig called without env (or undefined env for STITCH_PROJECT_ID)
    const calls = mockMcpConfigService.generateConfig.mock.calls;
    expect(calls.length).toBe(1);
    const configInput = calls[0][0];
    expect(configInput.env).toBeUndefined();
  });

  it('Test 2: should NOT save to package.json and inject env if declined', async () => {
    // Setup package.json
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'test-project' }, null, 2));

    // Mock confirmation to return false specifically for package.json save
    mockWizard.promptConfirm = mock((msg: string) => {
      if (msg.includes('Save Project ID')) {
        return Promise.resolve(false);
      }
      return Promise.resolve(true);
    });

    const input: InitInput = {
        local: false,
    };

    await initHandler.execute(input);

    // Verify package.json NOT updated
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.stitch).toBeUndefined();

    // Verify generateConfig called WITH env
    const calls = mockMcpConfigService.generateConfig.mock.calls;
    expect(calls.length).toBe(1);
    const configInput = calls[0][0];
    expect(configInput.env).toEqual({ STITCH_PROJECT_ID: 'active-project' });
  });

  it('Test 3: should inject env if package.json does not exist', async () => {
    // package.json does not exist in empty temp dir

    mockWizard.promptConfirm = mock(() => Promise.resolve(true));

    const input: InitInput = {
        local: false,
    };

    await initHandler.execute(input);

    // Verify generateConfig called WITH env
    const calls = mockMcpConfigService.generateConfig.mock.calls;
    expect(calls.length).toBe(1);
    const configInput = calls[0][0];
    expect(configInput.env).toEqual({ STITCH_PROJECT_ID: 'active-project' });
  });
});
