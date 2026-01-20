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

  describe('Environment Configuration', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
      mockExecCommand.mockReset(); // Use mockReset to clear implementations
      delete process.env.CLOUDSDK_CONFIG;
      delete process.env.STITCH_USE_SYSTEM_GCLOUD;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should use isolated environment by default', async () => {
      // Mock successful ensureInstalled to set defaults
      // 1. commandExists (gcloud) - fail to find system
      // 2. has local binary check (fs.existsSync) - mocked to true
      // 3. getVersionFromPath (local)

      (fs.existsSync as any).mockReturnValue(true); // Pretend local binary exists

      mockExecCommand
        .mockResolvedValueOnce({ success: false, stdout: '', stderr: '', exitCode: 1 }) // commandExists (system)
        .mockResolvedValueOnce({ success: true, stdout: 'Google Cloud SDK 400.0.0', stderr: '', exitCode: 0 }) // getVersionFromPath (local)
        // authenticate calls:
        // 4. auth login --no-launch-browser
        .mockResolvedValueOnce({ success: true, stdout: 'https://accounts.google.com/...', stderr: '', exitCode: 0 })
        // 5. auth login --quiet
        .mockResolvedValueOnce({ success: true, stdout: 'Logged in', stderr: '', exitCode: 0 })
        // 6. active account check
        .mockResolvedValueOnce({ success: true, stdout: 'user@example.com', stderr: '', exitCode: 0 });

      await handler.ensureInstalled({ minVersion: '0.0.0' } as any);

      // Call a method that uses getEnvironment, e.g., authenticate
      await handler.authenticate({ skipIfActive: false });

      const calls = mockExecCommand.mock.calls;
      const authCall = calls.find((call: any[]) => call[0].includes('auth') && call[0].includes('login'));
      if (!authCall) throw new Error('Auth call not found');
      const env = authCall[1].env;

      expect(env.CLOUDSDK_CONFIG).toBeDefined();
      expect(env.CLOUDSDK_CONFIG).toContain('.stitch-mcp');
    });

    test('should use system environment when useSystemGcloud is true via ensureInstalled', async () => {
      (fs.existsSync as any).mockReturnValue(true);

      // Sequence:
      // 1. commandExists -> which gcloud
      // 2. findGlobalGcloud -> which gcloud
      // 3. getVersionFromPath -> gcloud version
      // 4. authenticate -> gcloud auth login --no-launch-browser
      // 5. authenticate -> gcloud auth login --quiet
      // 6. authenticate -> gcloud auth list (getActiveAccount)

      mockExecCommand
        // commandExists
        .mockResolvedValueOnce({ success: true, stdout: '/usr/bin/gcloud', stderr: '', exitCode: 0 })
        // findGlobalGcloud
        .mockResolvedValueOnce({ success: true, stdout: '/usr/bin/gcloud', stderr: '', exitCode: 0 })
        // getVersionFromPath
        .mockResolvedValueOnce({ success: true, stdout: 'Google Cloud SDK 400.0.0', stderr: '', exitCode: 0 })
        // authenticate (auth login --no-launch-browser)
        .mockResolvedValueOnce({ success: true, stdout: 'https://accounts.google.com/foo', stderr: '', exitCode: 0 })
        // authenticate (auth login --quiet)
        .mockResolvedValueOnce({ success: true, stdout: 'Logged in', stderr: '', exitCode: 0 })
        // authenticate (getActiveAccount)
        .mockResolvedValueOnce({ success: true, stdout: 'user@example.com', stderr: '', exitCode: 0 });

      // Set useSystemGcloud: true
      await handler.ensureInstalled({ minVersion: '0.0.0', useSystemGcloud: true } as any);

      await handler.authenticate({ skipIfActive: false });

      const calls = mockExecCommand.mock.calls;
      // Find the auth call (it should be the 4th call, or verify by arguments)
      const authCall = calls.find((call: any[]) => call[0].includes('auth') && call[0].includes('login'));
      if (!authCall) throw new Error('Auth call not found');
      const env = authCall[1].env;

      // Should NOT have CLOUDSDK_CONFIG (or at least not our isolated one)
      expect(env.CLOUDSDK_CONFIG).toBeUndefined();
    });

    test('should use system environment when STITCH_USE_SYSTEM_GCLOUD is set', async () => {
      process.env.STITCH_USE_SYSTEM_GCLOUD = 'true';

      (fs.existsSync as any).mockReturnValue(true);

      mockExecCommand
        .mockResolvedValueOnce({ success: true, stdout: '/usr/bin/gcloud', stderr: '', exitCode: 0 }) // commandExists
        .mockResolvedValueOnce({ success: true, stdout: '/usr/bin/gcloud', stderr: '', exitCode: 0 }) // findGlobalGcloud
        .mockResolvedValueOnce({ success: true, stdout: 'Google Cloud SDK 400.0.0', stderr: '', exitCode: 0 }) // getVersionFromPath
        .mockResolvedValueOnce({ success: true, stdout: 'https://accounts.google.com/foo', stderr: '', exitCode: 0 }) // auth login no-launch
        .mockResolvedValueOnce({ success: true, stdout: 'Logged in', stderr: '', exitCode: 0 }) // auth login quiet
        .mockResolvedValueOnce({ success: true, stdout: 'user@example.com', stderr: '', exitCode: 0 }); // active account

      // Even with useSystemGcloud: false (default), env var should trigger system check
      await handler.ensureInstalled({ minVersion: '0.0.0' } as any);

      await handler.authenticate({ skipIfActive: false });

      const calls = mockExecCommand.mock.calls;
      const authCall = calls.find((call: any[]) => call[0].includes('auth') && call[0].includes('login'));

      if (!authCall) throw new Error('Auth call not found');

      const env = authCall[1].env;

      expect(env.CLOUDSDK_CONFIG).toBeUndefined();
    });
  });

  describe('getProjectId', () => {
    test('should respect STITCH_PROJECT_ID env var', async () => {
      process.env.STITCH_PROJECT_ID = 'env-project';
      const projectId = await handler.getProjectId();
      expect(projectId).toBe('env-project');
      delete process.env.STITCH_PROJECT_ID;
    });

    test('should respect GOOGLE_CLOUD_PROJECT env var', async () => {
      process.env.GOOGLE_CLOUD_PROJECT = 'google-env-project';
      const projectId = await handler.getProjectId();
      expect(projectId).toBe('google-env-project');
      delete process.env.GOOGLE_CLOUD_PROJECT;
    });

    test('STITCH_PROJECT_ID should take precedence over GOOGLE_CLOUD_PROJECT', async () => {
      process.env.STITCH_PROJECT_ID = 'stitch-priority';
      process.env.GOOGLE_CLOUD_PROJECT = 'google-secondary';
      const projectId = await handler.getProjectId();
      expect(projectId).toBe('stitch-priority');
      delete process.env.STITCH_PROJECT_ID;
      delete process.env.GOOGLE_CLOUD_PROJECT;
    });

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

  describe('authenticate', () => {
    let consoleLogSpy: ReturnType<typeof mock>;

    beforeEach(() => {
      consoleLogSpy = mock();
      // @ts-ignore - mocking console.log
      global.console.log = consoleLogSpy;
    });

    afterEach(() => {
      // @ts-ignore - restore console.log
      global.console.log = console.log;
    });

    test('should always print URL when found in stderr', async () => {
      const testUrl = 'https://accounts.google.com/o/oauth2/auth?test=value';

      // Mock --no-launch-browser command (returns URL in stderr)
      mockExecCommand
        .mockResolvedValueOnce({
          success: false,
          stdout: '',
          stderr: `Please visit this URL: ${testUrl}`,
          exitCode: 1,
        })
        // Mock regular auth login command
        .mockResolvedValueOnce({
          success: true,
          stdout: 'Authenticated successfully',
          stderr: '',
          exitCode: 0,
        })
        // Mock getActiveAccount
        .mockResolvedValueOnce({
          success: true,
          stdout: 'test@example.com',
          stderr: '',
          exitCode: 0,
        });

      (fs.existsSync as any).mockReturnValue(false);

      const result = await handler.authenticate({ skipIfActive: false });

      expect(result.success).toBe(true);
      // Verify console.log was called with the URL
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
      const urlLogCall = logCalls.find((call: string) => call && call.includes(testUrl));
      expect(urlLogCall).toBeDefined();
      expect(urlLogCall).toContain(testUrl);
    });

    test('should always print URL when found in stdout', async () => {
      const testUrl = 'https://accounts.google.com/o/oauth2/auth?another=test';

      // Mock --no-launch-browser command (returns URL in stdout)
      mockExecCommand
        .mockResolvedValueOnce({
          success: true,
          stdout: `Go to the following link: ${testUrl}`,
          stderr: '',
          exitCode: 0,
        })
        // Mock regular auth login command
        .mockResolvedValueOnce({
          success: true,
          stdout: 'Authenticated successfully',
          stderr: '',
          exitCode: 0,
        })
        // Mock getActiveAccount
        .mockResolvedValueOnce({
          success: true,
          stdout: 'test@example.com',
          stderr: '',
          exitCode: 0,
        });

      (fs.existsSync as any).mockReturnValue(false);

      const result = await handler.authenticate({ skipIfActive: false });

      expect(result.success).toBe(true);
      // Verify console.log was called with the URL
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
      const urlLogCall = logCalls.find((call: string) => call && call.includes(testUrl));
      expect(urlLogCall).toBeDefined();
      expect(urlLogCall).toContain(testUrl);
    });

    test('should print warning when URL extraction fails', async () => {
      // Mock --no-launch-browser command (no URL in output)
      mockExecCommand
        .mockResolvedValueOnce({
          success: false,
          stdout: 'Some error occurred',
          stderr: 'No URL here',
          exitCode: 1,
        })
        // Mock regular auth login command
        .mockResolvedValueOnce({
          success: true,
          stdout: 'Authenticated successfully',
          stderr: '',
          exitCode: 0,
        })
        // Mock getActiveAccount
        .mockResolvedValueOnce({
          success: true,
          stdout: 'test@example.com',
          stderr: '',
          exitCode: 0,
        });

      (fs.existsSync as any).mockReturnValue(false);

      const result = await handler.authenticate({ skipIfActive: false });

      expect(result.success).toBe(true);
      // Verify warning was printed
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
      const warningCall = logCalls.find((call: string) => call && call.includes('Could not extract authentication URL'));
      expect(warningCall).toBeDefined();
    });

    test('should proceed with authentication even if URL extraction fails', async () => {
      // Mock --no-launch-browser command (no URL)
      mockExecCommand
        .mockResolvedValueOnce({
          success: false,
          stdout: '',
          stderr: '',
          exitCode: 1,
        })
        // Mock regular auth login command (succeeds)
        .mockResolvedValueOnce({
          success: true,
          stdout: 'Authenticated successfully',
          stderr: '',
          exitCode: 0,
        })
        // Mock getActiveAccount
        .mockResolvedValueOnce({
          success: true,
          stdout: 'user@example.com',
          stderr: '',
          exitCode: 0,
        });

      (fs.existsSync as any).mockReturnValue(false);

      const result = await handler.authenticate({ skipIfActive: false });

      // Authentication should still succeed
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.account).toBe('user@example.com');
      }
    });
  });

  describe('authenticateADC', () => {
    let consoleLogSpy: ReturnType<typeof mock>;

    beforeEach(() => {
      consoleLogSpy = mock();
      // @ts-ignore - mocking console.log
      global.console.log = consoleLogSpy;
    });

    afterEach(() => {
      // @ts-ignore - restore console.log
      global.console.log = console.log;
    });

    test('should always print URL when found in stderr', async () => {
      const testUrl = 'https://accounts.google.com/o/oauth2/auth?adc=test';

      // Mock --no-launch-browser command (returns URL in stderr)
      mockExecCommand
        .mockResolvedValueOnce({
          success: false,
          stdout: '',
          stderr: `Please visit this URL: ${testUrl}`,
          exitCode: 1,
        })
        // Mock regular auth application-default login command
        .mockResolvedValueOnce({
          success: true,
          stdout: 'ADC configured successfully',
          stderr: '',
          exitCode: 0,
        });

      (fs.existsSync as any).mockReturnValue(false);

      const result = await handler.authenticateADC({ skipIfActive: false });

      expect(result.success).toBe(true);
      // Verify console.log was called with the URL
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
      const urlLogCall = logCalls.find((call: string) => call && call.includes(testUrl));
      expect(urlLogCall).toBeDefined();
      expect(urlLogCall).toContain(testUrl);
    });

    test('should always print URL when found in stdout', async () => {
      const testUrl = 'https://accounts.google.com/o/oauth2/auth?adc=stdout';

      // Mock --no-launch-browser command (returns URL in stdout)
      mockExecCommand
        .mockResolvedValueOnce({
          success: true,
          stdout: `Go to the following link: ${testUrl}`,
          stderr: '',
          exitCode: 0,
        })
        // Mock regular auth application-default login command
        .mockResolvedValueOnce({
          success: true,
          stdout: 'ADC configured successfully',
          stderr: '',
          exitCode: 0,
        });

      (fs.existsSync as any).mockReturnValue(false);

      const result = await handler.authenticateADC({ skipIfActive: false });

      expect(result.success).toBe(true);
      // Verify console.log was called with the URL
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
      const urlLogCall = logCalls.find((call: string) => call && call.includes(testUrl));
      expect(urlLogCall).toBeDefined();
      expect(urlLogCall).toContain(testUrl);
    });

    test('should print warning when URL extraction fails', async () => {
      // Mock --no-launch-browser command (no URL in output)
      mockExecCommand
        .mockResolvedValueOnce({
          success: false,
          stdout: 'Some error occurred',
          stderr: 'No URL here',
          exitCode: 1,
        })
        // Mock regular auth application-default login command
        .mockResolvedValueOnce({
          success: true,
          stdout: 'ADC configured successfully',
          stderr: '',
          exitCode: 0,
        });

      (fs.existsSync as any).mockReturnValue(false);

      const result = await handler.authenticateADC({ skipIfActive: false });

      expect(result.success).toBe(true);
      // Verify warning was printed
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
      const warningCall = logCalls.find((call: string) => call && call.includes('Could not extract authentication URL'));
      expect(warningCall).toBeDefined();
    });

    test('should proceed with ADC authentication even if URL extraction fails', async () => {
      // Mock --no-launch-browser command (no URL)
      mockExecCommand
        .mockResolvedValueOnce({
          success: false,
          stdout: '',
          stderr: '',
          exitCode: 1,
        })
        // Mock regular auth application-default login command (succeeds)
        .mockResolvedValueOnce({
          success: true,
          stdout: 'ADC configured successfully',
          stderr: '',
          exitCode: 0,
        })
        // Mock getActiveAccount
        .mockResolvedValueOnce({
          success: true,
          stdout: 'adc@example.com',
          stderr: '',
          exitCode: 0,
        });

      (fs.existsSync as any).mockReturnValue(false);

      const result = await handler.authenticateADC({ skipIfActive: false });

      // ADC authentication should still succeed
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('adc');
      }
    });
  });
});
