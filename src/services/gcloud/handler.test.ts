import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { GcloudHandler } from './handler';
import { mockExecCommand } from '../../../tests/mocks/shell.js';
import type { ShellResult } from '../../platform/shell.js';
import fs from 'node:fs';

// Mock external dependencies
mock.module('../../platform/shell.js', () => ({
  execCommand: mockExecCommand,
}));

// Mock node:fs
mock.module('node:fs', () => ({
  default: {
    existsSync: mock(() => false),
  },
}));

describe('GcloudHandler', () => {
  let handler: GcloudHandler;

  beforeEach(() => {
    handler = new GcloudHandler();
    mockExecCommand.mockClear();
  });

  describe('getActiveAccount', () => {
    test('should return the active account on success', async () => {
      mockExecCommand.mockResolvedValue({ success: true, stdout: 'test@example.com', stderr: '', exitCode: 0 });
      const account = await handler.getActiveAccount();
      expect(account).toBe('test@example.com');
    });

    test('should return null if no active account', async () => {
      mockExecCommand.mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });
      const account = await handler.getActiveAccount();
      expect(account).toBeNull();
    });

    test('should return null on command failure', async () => {
      mockExecCommand.mockResolvedValue({ success: false, stdout: '', stderr: 'error', exitCode: 1 });
      const account = await handler.getActiveAccount();
      expect(account).toBeNull();
    });
  });

  describe('hasADC', () => {
    test('should return true if ADC file exists', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      const result = await handler.hasADC();
      expect(result).toBe(true);
    });

    test('should return false if ADC file does not exist', async () => {
      (fs.existsSync as any).mockReturnValue(false);
      const result = await handler.hasADC();
      expect(result).toBe(false);
    });
  });

  describe('getProjectId', () => {
    test('should return the project ID on success', async () => {
      mockExecCommand.mockResolvedValue({ success: true, stdout: 'test-project', stderr: '', exitCode: 0 });
      const projectId = await handler.getProjectId();
      expect(projectId).toBe('test-project');
    });

    test('should return null if no project ID is set', async () => {
      mockExecCommand.mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });
      const projectId = await handler.getProjectId();
      expect(projectId).toBeNull();
    });

    test('should return null on command failure', async () => {
      mockExecCommand.mockResolvedValue({ success: false, stdout: '', stderr: 'error', exitCode: 1 });
      const projectId = await handler.getProjectId();
      expect(projectId).toBeNull();
    });
  });
});
