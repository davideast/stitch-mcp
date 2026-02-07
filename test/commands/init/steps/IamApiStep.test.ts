import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { IamApiStep } from '../../../../src/commands/init/steps/IamApiStep.js';
import { type InitContext } from '../../../../src/commands/init/context.js';

describe('IamApiStep', () => {
  let step: IamApiStep;
  let mockContext: any;

  beforeEach(() => {
    step = new IamApiStep();
    mockContext = {
      authMode: 'oauth',
      projectId: 'test-project',
      authAccount: 'test@example.com',
      input: {
        autoVerify: false,
      },
      ui: {
        promptConfirm: mock(),
      },
      stitchService: {
        checkIAMRole: mock(),
        configureIAM: mock(),
        checkAPIEnabled: mock(),
        enableAPI: mock(),
      },
      gcloudService: {
        installBetaComponents: mock(),
        getAccessToken: mock(),
      },
    };
  });

  describe('shouldRun', () => {
    it('should return true if authMode is oauth', async () => {
      mockContext.authMode = 'oauth';
      expect(await step.shouldRun(mockContext as InitContext)).toBe(true);
    });

    it('should return false if authMode is apiKey', async () => {
      mockContext.authMode = 'apiKey';
      expect(await step.shouldRun(mockContext as InitContext)).toBe(false);
    });
  });

  describe('run', () => {
    it('should skip if authMode is apiKey', async () => {
      mockContext.authMode = 'apiKey';
      const result = await step.run(mockContext as InitContext);
      expect(result.success).toBe(true);
      expect(result.status).toBe('SKIPPED');
    });

    it('should fail if projectId is missing', async () => {
      mockContext.projectId = undefined;
      const result = await step.run(mockContext as InitContext);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Project ID or Auth Account missing');
    });

    it('should fail if authAccount is missing', async () => {
      mockContext.authAccount = undefined;
      const result = await step.run(mockContext as InitContext);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Project ID or Auth Account missing');
    });

    it('should fail if access token cannot be obtained', async () => {
      mockContext.stitchService.checkIAMRole.mockResolvedValue(true);
      mockContext.gcloudService.installBetaComponents.mockResolvedValue(undefined);
      mockContext.stitchService.checkAPIEnabled.mockResolvedValue(true);
      mockContext.gcloudService.getAccessToken.mockResolvedValue(null);

      const result = await step.run(mockContext as InitContext);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Could not obtain access token');
    });

    it('should succeed if everything is set up', async () => {
      mockContext.stitchService.checkIAMRole.mockResolvedValue(true);
      mockContext.gcloudService.installBetaComponents.mockResolvedValue(undefined);
      mockContext.stitchService.checkAPIEnabled.mockResolvedValue(true);
      mockContext.gcloudService.getAccessToken.mockResolvedValue('fake-token');

      const result = await step.run(mockContext as InitContext);
      expect(result.success).toBe(true);
      expect(result.detail).toBe('Ready');
      expect(mockContext.accessToken).toBe('fake-token');
    });

    it('should configure IAM if role is missing and user confirms', async () => {
      mockContext.stitchService.checkIAMRole.mockResolvedValue(false);
      mockContext.ui.promptConfirm.mockResolvedValue(true);
      mockContext.stitchService.configureIAM.mockResolvedValue({ success: true });
      mockContext.gcloudService.installBetaComponents.mockResolvedValue(undefined);
      mockContext.stitchService.checkAPIEnabled.mockResolvedValue(true);
      mockContext.gcloudService.getAccessToken.mockResolvedValue('fake-token');

      const result = await step.run(mockContext as InitContext);
      expect(result.success).toBe(true);
      expect(mockContext.stitchService.configureIAM).toHaveBeenCalled();
    });

    it('should enable API if it is disabled', async () => {
      mockContext.stitchService.checkIAMRole.mockResolvedValue(true);
      mockContext.gcloudService.installBetaComponents.mockResolvedValue(undefined);
      mockContext.stitchService.checkAPIEnabled.mockResolvedValue(false);
      mockContext.stitchService.enableAPI.mockResolvedValue({ success: true });
      mockContext.gcloudService.getAccessToken.mockResolvedValue('fake-token');

      const result = await step.run(mockContext as InitContext);
      expect(result.success).toBe(true);
      expect(mockContext.stitchService.enableAPI).toHaveBeenCalled();
    });
  });
});
