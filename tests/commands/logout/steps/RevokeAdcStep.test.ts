import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { RevokeAdcStep } from '../../../../src/commands/logout/steps/RevokeAdcStep.js';
import { MockUI } from '../../../../src/framework/MockUI.js';
import type { LogoutContext } from '../../../../src/commands/logout/context.js';
import { mockExecCommand } from '../../../../tests/mocks/shell.js';

// Mock the shell module
mock.module('../../../../src/platform/shell.js', () => ({
  execCommand: mockExecCommand,
}));

// Mock the detector module
const mockGetGcloudConfigPath = mock(() => '/mock/gcloud/config/path');
mock.module('../../../../src/platform/detector.js', () => ({
  getGcloudConfigPath: mockGetGcloudConfigPath,
}));

describe('RevokeAdcStep', () => {
  let step: RevokeAdcStep;
  let mockContext: LogoutContext;
  let mockEnsureInstalled: ReturnType<typeof mock>;
  let mockHasADC: ReturnType<typeof mock>;

  beforeEach(() => {
    mockExecCommand.mockClear();
    mockGetGcloudConfigPath.mockClear();

    step = new RevokeAdcStep();

    mockEnsureInstalled = mock(async () => ({
      success: true,
      data: { path: '/mock/gcloud/path' },
    }));

    mockHasADC = mock(async () => true);

    mockContext = {
      input: { force: true, clearConfig: false },
      ui: new MockUI({}),
      gcloudService: {
        ensureInstalled: mockEnsureInstalled,
        hasADC: mockHasADC,
      } as any,
      gcloudPath: undefined,
      userRevoked: false,
      adcRevoked: false,
      configCleared: false,
    };
  });

  describe('shouldRun', () => {
    test('should return true and not call ensureInstalled if gcloudPath is already set', async () => {
      mockContext.gcloudPath = '/existing/path';

      const result = await step.shouldRun(mockContext);

      expect(result).toBe(true);
      expect(mockEnsureInstalled).not.toHaveBeenCalled();
      expect(mockContext.gcloudPath).toBe('/existing/path');
    });

    test('should call ensureInstalled, set gcloudPath, and return true if gcloudPath is not set', async () => {
      const result = await step.shouldRun(mockContext);

      expect(result).toBe(true);
      expect(mockEnsureInstalled).toHaveBeenCalledWith({ minVersion: '400.0.0', forceLocal: false });
      expect(mockContext.gcloudPath).toBe('/mock/gcloud/path');
    });

    test('should return false if ensureInstalled fails', async () => {
      mockEnsureInstalled.mockResolvedValueOnce({ success: false, error: new Error('Failed to install') });

      const result = await step.shouldRun(mockContext);

      expect(result).toBe(false);
      expect(mockContext.gcloudPath).toBeUndefined();
    });
  });

  describe('run', () => {
    beforeEach(() => {
      mockContext.gcloudPath = '/mock/gcloud/path';
    });

    test('should revoke ADC successfully if present', async () => {
      mockExecCommand.mockResolvedValueOnce({ success: true, stdout: '', stderr: '', exitCode: 0 });

      const result = await step.run(mockContext);

      expect(result).toEqual({ success: true });
      expect(mockContext.adcRevoked).toBe(true);
      expect(mockExecCommand).toHaveBeenCalledWith(
        ['/mock/gcloud/path', 'auth', 'application-default', 'revoke'],
        expect.objectContaining({ env: expect.any(Object) })
      );

      // Verify env passed to execCommand
      const callArgs = mockExecCommand.mock.calls[0];
      const options = callArgs[1] as any;
      expect(options.env.CLOUDSDK_CONFIG).toBe('/mock/gcloud/config/path');
      expect(options.env.CLOUDSDK_CORE_DISABLE_PROMPTS).toBe('1');
    });

    test('should mark as success and not set adcRevoked if revocation fails', async () => {
      mockExecCommand.mockResolvedValueOnce({ success: false, stdout: '', stderr: 'Revocation failed', exitCode: 1 });

      const result = await step.run(mockContext);

      expect(result).toEqual({ success: true });
      expect(mockContext.adcRevoked).toBe(false); // Revocation failed
    });

    test('should mark adcRevoked=true if revocation fails but stderr includes "No credentials"', async () => {
      mockExecCommand.mockResolvedValueOnce({ success: false, stdout: '', stderr: 'No credentials found', exitCode: 1 });

      const result = await step.run(mockContext);

      expect(result).toEqual({ success: true });
      expect(mockContext.adcRevoked).toBe(true);
    });

    test('should skip revocation if ADC is not present', async () => {
      mockHasADC.mockResolvedValueOnce(false);

      const result = await step.run(mockContext);

      expect(result).toEqual({ success: true });
      expect(mockContext.adcRevoked).toBe(true);
      expect(mockExecCommand).not.toHaveBeenCalled();
    });
  });
});
