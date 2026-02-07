import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { StitchHandler } from './handler.js';
import { mockExecCommand } from '../../../tests/mocks/shell.js';
import type { ShellResult } from '../../platform/shell.js';

// Mock external dependencies
mock.module('../../platform/shell.js', () => ({
  execCommand: mockExecCommand,
}));

// Mock node:fs
mock.module('node:fs', () => ({
  default: {
    existsSync: mock(() => false),
    promises: {
      access: mock(async () => {
        throw new Error('File not found');
      }),
    },
    constants: {
      F_OK: 0,
    },
  },
}));

describe('StitchHandler', () => {
  let handler: StitchHandler;
  const originalFetch = global.fetch;

  beforeEach(() => {
    handler = new StitchHandler();
    mockExecCommand.mockClear();
    (global.fetch as any) = mock();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('configureIAM', () => {
    const validInput = { projectId: 'test-project', userEmail: 'user@example.com' };

    test('should return success on successful IAM configuration', async () => {
      mockExecCommand.mockResolvedValue({ success: true, stdout: 'Success', stderr: '', exitCode: 0 });

      const result = await handler.configureIAM(validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('roles/serviceusage.serviceUsageConsumer');
        expect(result.data.member).toBe('user:user@example.com');
      }
      expect(mockExecCommand).toHaveBeenCalledTimes(1);
    });

    test('should return failure when execCommand fails', async () => {
      const mockResult: ShellResult = {
        success: false,
        stderr: 'Permission denied',
        stdout: '',
        exitCode: 1,
        error: 'gcloud error',
      };
      mockExecCommand.mockResolvedValue(mockResult);

      const result = await handler.configureIAM(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('IAM_CONFIG_FAILED');
        expect(result.error.message).toContain('Permission denied');
        expect(result.error.recoverable).toBe(true);
      }
    });

    test('should handle exceptions and return failure', async () => {
      const error = new Error('Unexpected error');
      mockExecCommand.mockRejectedValue(error);

      const result = await handler.configureIAM(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('IAM_CONFIG_FAILED');
        expect(result.error.message).toBe('Unexpected error');
        expect(result.error.recoverable).toBe(false);
      }
    });
  });

  describe('enableAPI', () => {
    const validInput = { projectId: 'test-project' };

    test('should return success on successful API enablement', async () => {
      mockExecCommand.mockResolvedValue({ success: true, stdout: 'API enabled', stderr: '', exitCode: 0 });

      const result = await handler.enableAPI(validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.api).toBe('stitch.googleapis.com');
        expect(result.data.enabled).toBe(true);
      }
    });

    test('should return failure when execCommand fails', async () => {
      mockExecCommand.mockResolvedValue({
        success: false,
        stderr: 'Billing not enabled',
        stdout: '',
        exitCode: 1,
      });

      const result = await handler.enableAPI(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('API_ENABLE_FAILED');
        expect(result.error.message).toContain('Billing not enabled');
        expect(result.error.suggestion).toBe('Ensure the project has billing enabled');
      }
    });
  });

  describe('testConnection', () => {
    const validInput = { projectId: 'test-project', accessToken: 'test-token' };

    test('should return success on a successful connection', async () => {
      const mockResponse = { ok: true, status: 200, json: async () => ({ result: 'ok' }) };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await handler.testConnection(validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.connected).toBe(true);
        expect(result.data.statusCode).toBe(200);
        expect(result.data.url).toBe('https://stitch.googleapis.com/mcp');
        expect(result.data.response).toEqual({ result: 'ok' });
      }
    });

    test('should return permission denied on 403 status', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'Permission denied' } }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await handler.testConnection(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PERMISSION_DENIED');
        expect(result.error.message).toBe('Permission denied');
      }
    });

    test('should return connection failed on other non-ok status', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Internal Server Error' } }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await handler.testConnection(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CONNECTION_TEST_FAILED');
        expect(result.error.message).toBe('Internal Server Error');
      }
    });

    test('should handle fetch exceptions', async () => {
      const error = new Error('Network error');
      (global.fetch as any).mockRejectedValue(error);

      const result = await handler.testConnection(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CONNECTION_TEST_FAILED');
        expect(result.error.message).toBe('Network error');
        expect(result.error.recoverable).toBe(false);
      }
    });
  });

  describe('checkIAMRole', () => {
    const validInput = { projectId: 'test-project', userEmail: 'user@example.com' };

    test('should return true if IAM role exists', async () => {
      mockExecCommand.mockResolvedValue({ success: true, stdout: 'user:user@example.com', stderr: '', exitCode: 0 });
      const result = await handler.checkIAMRole(validInput);
      expect(result).toBe(true);
    });

    test('should return false if IAM role does not exist', async () => {
      mockExecCommand.mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });
      const result = await handler.checkIAMRole(validInput);
      expect(result).toBe(false);
    });

    test('should return false on command failure', async () => {
      mockExecCommand.mockResolvedValue({ success: false, stdout: '', stderr: 'error', exitCode: 1 });
      const result = await handler.checkIAMRole(validInput);
      expect(result).toBe(false);
    });
  });

  describe('checkAPIEnabled', () => {
    const validInput = { projectId: 'test-project' };

    test('should return true if API is enabled', async () => {
      mockExecCommand.mockResolvedValue({ success: true, stdout: 'stitch.googleapis.com', stderr: '', exitCode: 0 });
      const result = await handler.checkAPIEnabled(validInput);
      expect(result).toBe(true);
    });

    test('should return false if API is not enabled', async () => {
      mockExecCommand.mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });
      const result = await handler.checkAPIEnabled(validInput);
      expect(result).toBe(false);
    });

    test('should return false on command failure', async () => {
      mockExecCommand.mockResolvedValue({ success: false, stdout: '', stderr: 'error', exitCode: 1 });
      const result = await handler.checkAPIEnabled(validInput);
      expect(result).toBe(false);
    });
  });
});
