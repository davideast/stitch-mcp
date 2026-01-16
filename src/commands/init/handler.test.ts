import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { InitHandler } from './handler.js';
import { GcloudService, GcloudResult, AuthResult } from '../../services/gcloud/spec.js';
import { ProjectService, ProjectSelectionResult } from '../../services/project/spec.js';
import { StitchService, IAMConfigResult, APIEnableResult, ConnectionTestResult } from '../../services/stitch/spec.js';
import { McpConfigService } from '../../services/mcp-config/spec.js';
import * as wizard from '../../ui/wizard.js';

// Mocks
const mockGcloudService: Partial<GcloudService> = {
  ensureInstalled: mock(),
  getActiveAccount: mock(),
  authenticate: mock(),
  hasADC: mock(),
  authenticateADC: mock(),
  getProjectId: mock(),
  setProject: mock(),
  installBetaComponents: mock(),
  getAccessToken: mock(),
};

const mockProjectService: Partial<ProjectService> = {
  getProjectDetails: mock(),
  selectProject: mock(),
};

const mockStitchService: Partial<StitchService> = {
  checkIAMRole: mock(),
  configureIAM: mock(),
  checkAPIEnabled: mock(),
  enableAPI: mock(),
  testConnection: mock(),
};

const mockMcpConfigService: Partial<McpConfigService> = {
  generateConfig: mock(),
};

mock.module('../../ui/wizard', () => ({
  promptMcpClient: mock(),
  promptConfirm: mock(),
  promptTransportType: mock(),
}));

describe('InitHandler', () => {
  let handler: InitHandler;

  beforeEach(() => {
    // Reset mocks before each test
    for (const key in mockGcloudService) {
      (mockGcloudService[key as keyof GcloudService] as any).mockClear();
    }
    for (const key in mockProjectService) {
      (mockProjectService[key as keyof ProjectService] as any).mockClear();
    }
    for (const key in mockStitchService) {
      (mockStitchService[key as keyof StitchService] as any).mockClear();
    }
    (wizard.promptMcpClient as any).mockClear();
    (wizard.promptConfirm as any).mockClear();
    (wizard.promptTransportType as any).mockClear();

    // Setup default happy path mock implementations
    (mockGcloudService.ensureInstalled as any).mockResolvedValue({ success: true, data: { version: '450.0.0', location: 'local', path: '/bin/gcloud' } });
    (mockGcloudService.getActiveAccount as any).mockResolvedValue(null);
    (mockGcloudService.authenticate as any).mockResolvedValue({ success: true, data: { account: 'test@example.com', type: 'user' } });
    (mockGcloudService.hasADC as any).mockResolvedValue(false);
    (mockGcloudService.authenticateADC as any).mockResolvedValue({ success: true, data: { account: 'test@example.com', type: 'adc' } });
    (mockGcloudService.getProjectId as any).mockResolvedValue(null);
    (mockGcloudService.setProject as any).mockResolvedValue({ success: true, data: { projectId: 'test-project' } });
    (mockGcloudService.installBetaComponents as any).mockResolvedValue({ success: true });
    (mockGcloudService.getAccessToken as any).mockResolvedValue('test-token');

    (mockProjectService.selectProject as any).mockResolvedValue({ success: true, data: { projectId: 'test-project', name: 'Test Project' } });
    (mockProjectService.getProjectDetails as any).mockResolvedValue({ success: true, data: { projectId: 'active-project', name: 'Active Project' } });

    (mockStitchService.checkIAMRole as any).mockResolvedValue(false);
    (mockStitchService.configureIAM as any).mockResolvedValue({ success: true, data: { role: 'roles/serviceusage.serviceUsageConsumer', member: 'user:test@example.com' } });
    (mockStitchService.checkAPIEnabled as any).mockResolvedValue(false);
    (mockStitchService.enableAPI as any).mockResolvedValue({ success: true, data: { api: 'stitch.googleapis.com', enabled: true } });
    (mockStitchService.testConnection as any).mockResolvedValue({ success: true, data: { connected: true, statusCode: 200 } });

    (mockMcpConfigService.generateConfig as any).mockResolvedValue({ success: true, data: { config: '{}', instructions: 'Run this command' } });

    (wizard.promptMcpClient as any).mockResolvedValue('test-client');
    (wizard.promptConfirm as any).mockResolvedValue(true);
    (wizard.promptTransportType as any).mockResolvedValue('http');

    handler = new InitHandler(
      mockGcloudService as GcloudService,
      mockMcpConfigService as McpConfigService,
      mockProjectService as ProjectService,
      mockStitchService as StitchService
    );
  });

  it('should run the full init flow for a new user', async () => {
    const result = await handler.execute({ local: false });

    expect(result.success).toBe(true);
    expect(mockGcloudService.ensureInstalled).toHaveBeenCalledTimes(1);
    expect(mockGcloudService.authenticate).toHaveBeenCalledTimes(1);
    expect(mockGcloudService.authenticateADC).toHaveBeenCalledTimes(1);
    expect(mockProjectService.selectProject).toHaveBeenCalledTimes(1);
    expect(mockStitchService.configureIAM).toHaveBeenCalledTimes(1);
    expect(mockStitchService.enableAPI).toHaveBeenCalledTimes(1);
    expect(mockMcpConfigService.generateConfig).toHaveBeenCalledTimes(1);
    expect(mockStitchService.testConnection).toHaveBeenCalledTimes(1);
  });

  it('should skip authentication if user is already logged in and confirms', async () => {
    (mockGcloudService.getActiveAccount as any).mockResolvedValue('existing@example.com');
    (wizard.promptConfirm as any).mockResolvedValue(true); // Confirm to use existing account

    await handler.execute({ local: false });

    expect(mockGcloudService.authenticate).not.toHaveBeenCalled();
    expect(mockGcloudService.getActiveAccount).toHaveBeenCalledTimes(1);
  });

  it('should re-authenticate if user chooses not to use active account', async () => {
    (mockGcloudService.getActiveAccount as any).mockResolvedValue('existing@example.com');
    (wizard.promptConfirm as any).mockImplementation((message) => !message.includes('Continue?')); // Decline to use existing account

    await handler.execute({ local: false });

    expect(mockGcloudService.authenticate).toHaveBeenCalledTimes(1);
  });

  it('should skip ADC setup if ADC already exists and user confirms', async () => {
    (mockGcloudService.hasADC as any).mockResolvedValue(true);
    (wizard.promptConfirm as any).mockResolvedValue(true); // Confirm to use existing ADC

    await handler.execute({ local: false });

    expect(mockGcloudService.authenticateADC).not.toHaveBeenCalled();
    expect(mockGcloudService.hasADC).toHaveBeenCalledTimes(1);
  });

  it('should skip project selection if an active project is found and user confirms', async () => {
    (mockGcloudService.getProjectId as any).mockResolvedValue('active-project');
    (wizard.promptConfirm as any).mockResolvedValue(true); // Confirm to use active project

    await handler.execute({ local: false });

    expect(mockProjectService.selectProject).not.toHaveBeenCalled();
    expect(mockProjectService.getProjectDetails).toHaveBeenCalledWith({ projectId: 'active-project' });
  });

  it('should skip IAM configuration if role already exists', async () => {
    (mockStitchService.checkIAMRole as any).mockResolvedValue(true);

    await handler.execute({ local: false });

    expect(mockStitchService.configureIAM).not.toHaveBeenCalled();
    expect(wizard.promptConfirm).not.toHaveBeenCalledWith(expect.stringContaining('add the required IAM role'));
  });

  it('should skip API enablement if API is already enabled', async () => {
    (mockStitchService.checkAPIEnabled as any).mockResolvedValue(true);

    await handler.execute({ local: false });

    expect(mockStitchService.enableAPI).not.toHaveBeenCalled();
  });

  it('should return a failure result if gcloud installation fails', async () => {
      (mockGcloudService.ensureInstalled as any).mockResolvedValue({ success: false, error: { code: 'GCLOUD_SETUP_FAILED', message: 'Install failed' } });

      const result = await handler.execute({ local: false });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('GCLOUD_SETUP_FAILED');
      }
  });
});
