import { describe, test, expect, mock } from 'bun:test';
import { InitHandler } from './handler';

// Mock services
mock.module('../../services/gcloud/handler.js', () => ({
  GcloudHandler: class {
    ensureInstalled = mock(() => Promise.resolve({ success: true, data: { location: 'local', version: '450.0.0', path: '/usr/bin/gcloud' } }));
    authenticate = mock(() => Promise.resolve({ success: true, data: { account: 'test@example.com' } }));
    authenticateADC = mock(() => Promise.resolve({ success: true, data: {} }));
    setProject = mock(() => Promise.resolve({ success: true, data: {} }));
    installBetaComponents = mock(() => Promise.resolve({ success: true, data: {} }));
    getAccessToken = mock(() => Promise.resolve('test-token'));
  },
}));

mock.module('../../services/project/handler.js', () => ({
  ProjectHandler: class {
    selectProject = mock(() => Promise.resolve({ success: true, data: { projectId: 'test-project', name: 'Test Project' } }));
  },
}));

mock.module('../../services/stitch/handler.js', () => ({
  StitchHandler: class {
    configureIAM = mock(() => Promise.resolve({ success: true, data: { role: 'roles/serviceusage.serviceUsageConsumer' } }));
    enableAPI = mock(() => Promise.resolve({ success: true, data: { api: 'stitch.googleapis.com' } }));
    testConnection = mock(() => Promise.resolve({ success: true, data: { statusCode: 200 } }));
  },
}));

mock.module('../../services/mcp-config/handler.js', () => ({
  McpConfigHandler: class {
    generateConfig = mock(() => Promise.resolve({ success: true, data: { config: '{ "mcp": "config" }', instructions: 'Instructions' } }));
  },
}));

// Mock UI components
mock.module('../../ui/wizard.js', () => ({
  promptMcpClient: mock(() => Promise.resolve('test-client')),
  promptConfirm: mock(() => Promise.resolve(true)),
}));

const mockSpinner = {
  start: mock(() => {}),
  succeed: mock(() => {}),
  fail: mock(() => {}),
};
mock.module('../../ui/spinner.js', () => ({
  createSpinner: mock(() => mockSpinner),
}));

describe('InitHandler', () => {
  test('should execute the happy path successfully', async () => {
    const handler = new InitHandler();
    const result = await handler.execute({ local: true });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.projectId).toBe('test-project');
      expect(result.data.mcpConfig).toBe('{ "mcp": "config" }');
      expect(result.data.instructions).toBe('Instructions');
    }
  });
});
