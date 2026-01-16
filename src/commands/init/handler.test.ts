import { describe, test, expect, mock } from 'bun:test';
import { InitHandler } from './handler';

// Mock UI components
mock.module('../../ui/wizard.js', () => ({
  promptMcpClient: mock(() => Promise.resolve('test-client')),
  promptConfirm: mock(() => Promise.resolve(true)),
  promptTransportType: mock(() => Promise.resolve('http')),
}));

const mockSpinner = {
  start: mock(() => { }),
  succeed: mock(() => { }),
  fail: mock(() => { }),
};
mock.module('../../ui/spinner.js', () => ({
  createSpinner: mock(() => mockSpinner),
}));

describe('InitHandler', () => {
  test('should execute the happy path successfully', async () => {
    // Manually mock services
    const mockGcloudService: any = {
      ensureInstalled: mock(() => Promise.resolve({ success: true, data: { location: 'local', version: '450.0.0', path: '/usr/bin/gcloud' } })),
      authenticate: mock(() => Promise.resolve({ success: true, data: { account: 'test@example.com' } })),
      authenticateADC: mock(() => Promise.resolve({ success: true, data: {} })),
      setProject: mock(() => Promise.resolve({ success: true, data: {} })),
      installBetaComponents: mock(() => Promise.resolve({ success: true, data: {} })),
      getAccessToken: mock(() => Promise.resolve('test-token')),
    };

    const mockProjectService: any = {
      selectProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } })),
    };

    const mockStitchService: any = {
      configureIAM: mock(() => Promise.resolve({ success: true, data: { role: 'roles/serviceusage.serviceUsageConsumer' } })),
      enableAPI: mock(() => Promise.resolve({ success: true, data: { api: 'stitch.googleapis.com' } })),
      testConnection: mock(() => Promise.resolve({ success: true, data: { statusCode: 200 } })),
    };

    const mockMcpConfigService: any = {
      generateConfig: mock(() => Promise.resolve({ success: true, data: { config: '{ "mcp": "config" }', instructions: 'Instructions' } })),
    };

    const handler = new InitHandler(
      mockGcloudService,
      mockMcpConfigService,
      mockProjectService,
      mockStitchService
    );
    const result = await handler.execute({ local: true });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.projectId).toBe('test-project');
      expect(result.data.mcpConfig).toBe('{ "mcp": "config" }');
      expect(result.data.instructions).toBe('Instructions');
    }
  });
});
