import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { LogoutHandler } from './handler.js';
import type { GcloudService } from '../../services/gcloud/spec.js';
import { mockExecCommand } from '../../../tests/mocks/shell.js';

// Mock the shell module
mock.module('../../platform/shell.js', () => ({
  execCommand: mockExecCommand,
}));

// Mock node:fs
const mockExistsSync = mock(() => false);
const mockRmSync = mock();
mock.module('node:fs', () => ({
  default: {
    existsSync: mockExistsSync,
    rmSync: mockRmSync,
    promises: {
      writeFile: mock(),
    },
  },
}));

describe('LogoutHandler', () => {
  let handler: LogoutHandler;
  let mockGcloudService: GcloudService;

  beforeEach(() => {
    // Reset mocks
    mockExecCommand.mockClear();
    mockExistsSync.mockClear();
    mockRmSync.mockClear();

    // Create mock gcloud service
    mockGcloudService = {
      ensureInstalled: mock(() =>
        Promise.resolve({
          success: true,
          data: { version: '552.0.0', location: 'bundled', path: '/path/to/gcloud' },
        })
      ),
      getActiveAccount: mock(() => Promise.resolve('test@example.com')),
      hasADC: mock(() => Promise.resolve(true)),
      authenticate: mock(),
      authenticateADC: mock(),
      listProjects: mock(),
      setProject: mock(),
      getAccessToken: mock(),
      getProjectId: mock(),
      installBetaComponents: mock(),
    } as any;

    handler = new LogoutHandler(mockGcloudService);
  });

  describe('execute', () => {
    test('should successfully logout with both user and ADC credentials', async () => {
      // Mock successful revocations
      mockExecCommand.mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });

      const result = await handler.execute({ force: true, clearConfig: false });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userRevoked).toBe(true);
        expect(result.data.adcRevoked).toBe(true);
        expect(result.data.configCleared).toBe(false);
      }
    });

    test('should handle already logged out scenario gracefully', async () => {
      // Mock no active account
      mockGcloudService.getActiveAccount = mock(() => Promise.resolve(null));
      mockGcloudService.hasADC = mock(() => Promise.resolve(false));

      const result = await handler.execute({ force: true, clearConfig: false });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userRevoked).toBe(true); // Treated as success
        expect(result.data.adcRevoked).toBe(true); // Treated as success
      }
    });

    test('should handle gcloud not found error', async () => {
      mockGcloudService.ensureInstalled = mock(() =>
        Promise.resolve({
          success: false,
          error: {
            code: 'DOWNLOAD_FAILED',
            message: 'gcloud not found',
            recoverable: true,
          },
        })
      );

      const result = await handler.execute({ force: true, clearConfig: false });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('GCLOUD_NOT_FOUND');
      }
    });

    test('should clear config directory when --clear-config is set', async () => {
      // Mock successful revocations
      mockExecCommand.mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });

      // Mock fs to simulate config directory exists
      mockExistsSync.mockReturnValue(true);

      const result = await handler.execute({ force: true, clearConfig: true });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.configCleared).toBe(true);
      }

      // Verify rmSync was called
      expect(mockRmSync).toHaveBeenCalled();
    });

    test('should handle partial failure (user revoked but ADC fails)', async () => {
      // First call (user revoke) succeeds, second call (ADC revoke) fails
      mockExecCommand
        .mockResolvedValueOnce({ success: true, stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ success: false, stdout: '', stderr: 'ADC revoke failed', exitCode: 1 });

      const result = await handler.execute({ force: true, clearConfig: false });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userRevoked).toBe(true);
        expect(result.data.adcRevoked).toBe(false); // ADC revocation failed
      }
    });

    test('should handle no credentialed accounts message', async () => {
      // Mock stderr with "No credentialed accounts" message
      mockExecCommand
        .mockResolvedValueOnce({
          success: false,
          stdout: '',
          stderr: 'ERROR: No credentialed accounts',
          exitCode: 1
        })
        .mockResolvedValueOnce({
          success: false,
          stdout: '',
          stderr: 'No credentials found',
          exitCode: 1
        });

      const result = await handler.execute({ force: true, clearConfig: false });

      expect(result.success).toBe(true);
      if (result.success) {
        // Both should be considered successfully revoked when already logged out
        expect(result.data.userRevoked).toBe(true);
        expect(result.data.adcRevoked).toBe(true);
      }
    });
  });
});
