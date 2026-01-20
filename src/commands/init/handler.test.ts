import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { InitHandler } from './handler';

// Mock UI components
mock.module('../../ui/wizard.js', () => ({
  promptMcpClient: mock(() => Promise.resolve('antigravity')),
  promptConfirm: mock(() => Promise.resolve(true)),
  promptTransportType: mock(() => Promise.resolve('http')),
}));

const mockSpinner: Record<string, unknown> = {
  start: mock(() => mockSpinner),
  succeed: mock(() => mockSpinner),
  fail: mock(() => mockSpinner),
  stop: mock(() => mockSpinner),
};
mock.module('../../ui/spinner.js', () => ({
  createSpinner: mock(() => mockSpinner),
}));

// Mock checklist to auto-complete all steps
mock.module('../../ui/checklist.js', () => ({
  createChecklist: mock(() => ({
    run: mock(() => Promise.resolve({ success: true, completedSteps: ['path-setup', 'user-auth', 'adc'] })),
  })),
  verifyAllSteps: mock(() => Promise.resolve(new Map())),
}));

// Mock environment detection
mock.module('../../platform/environment.js', () => ({
  detectEnvironment: mock(() => ({
    isWSL: false,
    isSSH: false,
    isDocker: false,
    isCloudShell: false,
    hasDisplay: true,
    needsNoBrowser: false,
    reason: undefined,
  })),
}));

describe('InitHandler', () => {
  test('should execute the happy path successfully', async () => {
    const mockGcloudService: any = {
      ensureInstalled: mock(() => Promise.resolve({
        success: true,
        data: { location: 'system', version: '450.0.0', path: '/usr/bin/gcloud' }
      })),
      setProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project' } })),
      installBetaComponents: mock(() => Promise.resolve({ success: true })),
      getAccessToken: mock(() => Promise.resolve('test-token')),
      getActiveAccount: mock(() => Promise.resolve('test@example.com')),
      hasADC: mock(() => Promise.resolve(true)),
      getProjectId: mock(() => Promise.resolve(null)),
    };

    const mockProjectService: any = {
      selectProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } })),
      getProjectDetails: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } })),
    };

    const mockStitchService: any = {
      configureIAM: mock(() => Promise.resolve({ success: true, data: { role: 'roles/serviceusage.serviceUsageConsumer' } })),
      enableAPI: mock(() => Promise.resolve({ success: true, data: { api: 'stitch.googleapis.com' } })),
      testConnection: mock(() => Promise.resolve({ success: true, data: { statusCode: 200, url: 'https://stitch.googleapis.com/mcp' } })),
      checkIAMRole: mock(() => Promise.resolve(true)),
      checkAPIEnabled: mock(() => Promise.resolve(true)),
    };

    const mockMcpConfigService: any = {
      generateConfig: mock(() => Promise.resolve({
        success: true,
        data: { config: '{ "mcp": "config" }', instructions: 'Instructions' }
      })),
    };

    const handler = new InitHandler(
      mockGcloudService,
      mockMcpConfigService,
      mockProjectService,
      mockStitchService
    );
    const result = await handler.execute({ local: false, defaults: false, autoVerify: true });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.projectId).toBe('test-project');
      expect(result.data.mcpConfig).toBe('{ "mcp": "config" }');
    }
  });

  test('should skip IAM/API configuration if already enabled', async () => {
    const mockGcloudService: any = {
      ensureInstalled: mock(() => Promise.resolve({
        success: true,
        data: { location: 'system', version: '450.0.0', path: '/usr/bin/gcloud' }
      })),
      setProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project' } })),
      installBetaComponents: mock(() => Promise.resolve({ success: true })),
      getAccessToken: mock(() => Promise.resolve('test-token')),
      getActiveAccount: mock(() => Promise.resolve('test@example.com')),
      hasADC: mock(() => Promise.resolve(true)),
      getProjectId: mock(() => Promise.resolve(null)),
    };

    const mockProjectService: any = {
      selectProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } })),
      getProjectDetails: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } })),
    };

    const mockStitchService: any = {
      configureIAM: mock(() => Promise.resolve({ success: true, data: { role: 'roles/serviceusage.serviceUsageConsumer' } })),
      enableAPI: mock(() => Promise.resolve({ success: true, data: { api: 'stitch.googleapis.com' } })),
      testConnection: mock(() => Promise.resolve({ success: true, data: { statusCode: 200, url: 'https://stitch.googleapis.com/mcp' } })),
      checkIAMRole: mock(() => Promise.resolve(true)),
      checkAPIEnabled: mock(() => Promise.resolve(true)),
    };

    const mockMcpConfigService: any = {
      generateConfig: mock(() => Promise.resolve({
        success: true,
        data: { config: '{ "mcp": "config" }', instructions: 'Instructions' }
      })),
    };

    const handler = new InitHandler(
      mockGcloudService,
      mockMcpConfigService,
      mockProjectService,
      mockStitchService
    );
    await handler.execute({ local: false, defaults: false, autoVerify: true });

    // IAM and API should not be called since they're already configured
    expect(mockStitchService.configureIAM).not.toHaveBeenCalled();
    expect(mockStitchService.enableAPI).not.toHaveBeenCalled();
  });

  test('should fail if no authenticated account after checklist', async () => {
    const mockGcloudService: any = {
      ensureInstalled: mock(() => Promise.resolve({
        success: true,
        data: { location: 'system', version: '450.0.0', path: '/usr/bin/gcloud' }
      })),
      getActiveAccount: mock(() => Promise.resolve(null)), // No account found
      hasADC: mock(() => Promise.resolve(false)),
      getProjectId: mock(() => Promise.resolve(null)),
    };

    const mockProjectService: any = {
      selectProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } })),
      getProjectDetails: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } })),
    };

    const mockStitchService: any = {
      testConnection: mock(() => Promise.resolve({ success: true, data: { statusCode: 200, url: 'https://stitch.googleapis.com/mcp' } })),
      checkIAMRole: mock(() => Promise.resolve(false)),
      checkAPIEnabled: mock(() => Promise.resolve(false)),
    };

    const mockMcpConfigService: any = {
      generateConfig: mock(() => Promise.resolve({ success: true, data: { config: '{}', instructions: '' } })),
    };

    const handler = new InitHandler(
      mockGcloudService,
      mockMcpConfigService,
      mockProjectService,
      mockStitchService
    );
    const result = await handler.execute({ local: false, defaults: false, autoVerify: true });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('AUTH_FAILED');
    }
  });
});
