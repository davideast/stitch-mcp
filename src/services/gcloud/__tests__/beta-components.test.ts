import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { GcloudHandler } from '../handler.js';
import { mockExecCommand } from '../../../../tests/mocks/shell.js';

// Mock the shell module
mock.module('../../../platform/shell.js', () => ({
  execCommand: mockExecCommand,
}));

describe('GcloudHandler - installBetaComponents', () => {
  let handler: GcloudHandler;

  beforeEach(() => {
    handler = new GcloudHandler();
    mockExecCommand.mockClear();
  });

  test('should successfully install beta components with 30s timeout', async () => {
    mockExecCommand.mockResolvedValue({
      success: true,
      stdout: 'Installed beta components',
      stderr: '',
      exitCode: 0
    });

    const result = await handler.installBetaComponents();

    expect(result.success).toBe(true);
    expect(mockExecCommand).toHaveBeenCalledWith(
      expect.arrayContaining(['gcloud', 'components', 'install', 'beta', '--quiet']),
      expect.objectContaining({
        timeout: 30000  // Should have 30 second timeout
      })
    );
  });

  test('should handle timeout gracefully', async () => {
    mockExecCommand.mockResolvedValue({
      success: false,
      stdout: '',
      stderr: 'Command timed out',
      exitCode: 1,
      error: 'timeout'
    });

    const result = await handler.installBetaComponents();

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Failed to install beta components');
    expect(result.error?.message).toContain('timed out');
  });

  test('should handle password prompt hang timeout', async () => {
    // Simulates the hang due to password prompt
    mockExecCommand.mockResolvedValue({
      success: false,
      stdout: '',
      stderr: '',
      exitCode: 124, // Timeout exit code
      error: 'Command timed out after 30000ms'
    });

    const result = await handler.installBetaComponents();

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should handle network error', async () => {
    const errorMessage = 'Network error: failed to download components';
    mockExecCommand.mockResolvedValue({
      success: false,
      stdout: '',
      stderr: errorMessage,
      exitCode: 1
    });

    const result = await handler.installBetaComponents();

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain(errorMessage);
  });

  test('should handle exception during installation', async () => {
    mockExecCommand.mockRejectedValue(new Error('Unexpected error'));

    const result = await handler.installBetaComponents();

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Unexpected error');
  });

  test('should verify timeout is set to 30 seconds', async () => {
    mockExecCommand.mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });

    await handler.installBetaComponents();

    expect(mockExecCommand).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        env: expect.any(Object),
        timeout: 30000
      })
    );
  });
});
