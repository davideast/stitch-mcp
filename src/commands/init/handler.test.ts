import { describe, test, expect, mock } from 'bun:test';
import { InitHandler } from './handler';

// Mock UI components
mock.module('../../ui/wizard.js', () => ({
  promptMcpClient: mock(() => Promise.resolve('test-client')),
  promptConfirm: mock(() => Promise.resolve(true)),
  promptTransportType: mock(() => Promise.resolve('http')),
}));

const mockSpinner = {
  start: mock(function() { return this; }),
  succeed: mock(function() { return this; }),
  fail: mock(function() { return this; }),
  stop: mock(function() { return this; }),
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
      authenticateADC: mock(() => Promise.resolve({ success: true, data: { account: 'test@example.com', type: 'adc' } })),
      setProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project' } })),
      installBetaComponents: mock(() => Promise.resolve({ success: true })),
      getAccessToken: mock(() => Promise.resolve('test-token')),
      getActiveAccount: mock(() => Promise.resolve(null)),
      hasADC: mock(() => Promise.resolve(false)),
      getProjectId: mock(() => Promise.resolve(null)),
    };

    const mockProjectService: any = {
      selectProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } })),
      getProjectDetails: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } })),
    };

    const mockStitchService: any = {
      configureIAM: mock(() => Promise.resolve({ success: true, data: { role: 'roles/serviceusage.serviceUsageConsumer' } })),
      enableAPI: mock(() => Promise.resolve({ success: true, data: { api: 'stitch.googleapis.com' } })),
      testConnection: mock(() => Promise.resolve({ success: true, data: { statusCode: 200 } })),
      checkIAMRole: mock(() => Promise.resolve(false)),
      checkAPIEnabled: mock(() => Promise.resolve(false)),
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

  test('should skip IAM/API configuration if already enabled', async () => {
    // Manually mock services
    const mockGcloudService: any = {
      ensureInstalled: mock(() => Promise.resolve({ success: true, data: { location: 'local', version: '450.0.0', path: '/usr/bin/gcloud' } })),
      authenticate: mock(() => Promise.resolve({ success: true, data: { account: 'test@example.com' } })),
      authenticateADC: mock(() => Promise.resolve({ success: true, data: { account: 'test@example.com', type: 'adc' } })),
      setProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project' } })),
      installBetaComponents: mock(() => Promise.resolve({ success: true })),
      getAccessToken: mock(() => Promise.resolve('test-token')),
      getActiveAccount: mock(() => Promise.resolve(null)),
      hasADC: mock(() => Promise.resolve(false)),
      getProjectId: mock(() => Promise.resolve(null)),
    };

    const mockProjectService: any = {
      selectProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } })),
      getProjectDetails: mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } })),
    };

    const mockStitchService: any = {
      configureIAM: mock(() => Promise.resolve({ success: true, data: { role: 'roles/serviceusage.serviceUsageConsumer' } })),
      enableAPI: mock(() => Promise.resolve({ success: true, data: { api: 'stitch.googleapis.com' } })),
      testConnection: mock(() => Promise.resolve({ success: true, data: { statusCode: 200 } })),
      checkIAMRole: mock(() => Promise.resolve(true)),
      checkAPIEnabled: mock(() => Promise.resolve(true)),
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
    await handler.execute({ local: true });

    expect(mockStitchService.configureIAM).not.toHaveBeenCalled();
    expect(mockStitchService.enableAPI).not.toHaveBeenCalled();
  });

  test('should re-authenticate and re-select project if user declines prompts', async () => {
    const mockGcloudService: any = {
      ensureInstalled: mock(() => Promise.resolve({ success: true, data: { location: 'local', version: '450.0.0', path: '/usr/bin/gcloud' } })),
      authenticate: mock(() => Promise.resolve({ success: true, data: { account: 'new@example.com' } })),
      authenticateADC: mock(() => Promise.resolve({ success: true, data: { account: 'new@example.com', type: 'adc' } })),
      setProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'new-project' } })),
      installBetaComponents: mock(() => Promise.resolve({ success: true })),
      getAccessToken: mock(() => Promise.resolve('test-token')),
      getActiveAccount: mock(() => Promise.resolve('existing@example.com')),
      hasADC: mock(() => Promise.resolve(true)),
      getProjectId: mock(() => Promise.resolve('existing-project')),
    };

    const mockProjectService: any = {
      selectProject: mock(() => Promise.resolve({ success: true, data: { projectId: 'new-project', name: 'New Project' } })),
      getProjectDetails: mock(() => Promise.resolve({ success: true, data: { projectId: 'existing-project', name: 'Existing Project' } })),
    };

    const mockStitchService: any = {
      configureIAM: mock(() => Promise.resolve({ success: true, data: { role: 'roles/serviceusage.serviceUsageConsumer' } })),
      enableAPI: mock(() => Promise.resolve({ success: true, data: { api: 'stitch.googleapis.com' } })),
      testConnection: mock(() => Promise.resolve({ success: true, data: { statusCode: 200 } })),
      checkIAMRole: mock(() => Promise.resolve(false)),
      checkAPIEnabled: mock(() => Promise.resolve(false)),
    };

    const mockMcpConfigService: any = {
      generateConfig: mock(() => Promise.resolve({ success: true, data: { config: '{ "mcp": "config" }', instructions: 'Instructions' } })),
    };

    const { promptConfirm } = await import('../../ui/wizard');
    (promptConfirm as any).mockResolvedValue(false);

    const handler = new InitHandler(
      mockGcloudService,
      mockMcpConfigService,
      mockProjectService,
      mockStitchService
    );
    const result = await handler.execute({ local: true });

    expect(result.success).toBe(true);
    if(result.success) {
      expect(result.data.projectId).toBe('new-project');
    }
    expect(mockGcloudService.authenticate).toHaveBeenCalledWith({ skipIfActive: false });
    expect(mockGcloudService.authenticateADC).toHaveBeenCalledWith({ skipIfActive: false });
    expect(mockProjectService.selectProject).toHaveBeenCalled();
  });
});
