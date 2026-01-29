import { describe, test, expect, mock } from 'bun:test';
import { InitHandler } from './handler';

// Mock UI components
mock.module('../../ui/wizard.js', () => ({
  promptMcpClient: mock(() => Promise.resolve('antigravity')),
  promptConfirm: mock(() => Promise.resolve(true)),
  promptTransportType: mock(() => Promise.resolve('stdio')), // Select Proxy
  promptAuthMode: mock(() => Promise.resolve('apiKey')), // Select API Key
  promptApiKeyStorage: mock(() => Promise.resolve('config')), // Select Config storage
  promptApiKey: mock(() => Promise.resolve('test-key')),
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

describe('InitHandler - API Key + Proxy', () => {
  test('should generate proxy config with API key', async () => {
    const mockGcloudService: any = {
      // These shouldn't be called for API Key mode, but providing mocks just in case
      ensureInstalled: mock(() => Promise.resolve({ success: true, data: { location: 'system', version: '450.0.0', path: '/usr/bin/gcloud' } })),
      setProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project' } })),
      installBetaComponents: mock(() => Promise.resolve({ success: true })),
      getAccessToken: mock(() => Promise.resolve('test-token')),
      getActiveAccount: mock(() => Promise.resolve('test@example.com')),
      hasADC: mock(() => Promise.resolve(true)),
      getProjectId: mock(() => Promise.resolve(null)),
    };

    const mockProjectService: any = {
        // Shouldn't be called
      selectProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } })),
      getProjectDetails: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } })),
    };

    const mockStitchService: any = {
        // Shouldn't be called
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

    // Verify generateConfig was called with correct parameters
    expect(mockMcpConfigService.generateConfig).toHaveBeenCalledWith(expect.objectContaining({
        client: 'antigravity',
        projectId: 'ignored-project-id',
        transport: 'stdio',
        authMode: 'apiKey',
        apiKey: 'test-key',
    }));
  });
});
