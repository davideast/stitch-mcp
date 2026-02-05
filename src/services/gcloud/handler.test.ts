import { describe, test, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { GcloudHandler } from './handler';
import { mockExecCommand } from '../../../tests/mocks/shell.js';
import type { ShellResult } from '../../platform/shell.js';
import fs from 'node:fs';

// Mock external dependencies
mock.module('../../platform/shell.js', () => ({
  execCommand: mockExecCommand,
  commandExists: mock(async () => false),
}));

// Mock node:fs
mock.module('node:fs', () => ({
  default: {
    existsSync: mock(() => false),
    mkdirSync: mock(),
    unlinkSync: mock(),
    promises: {
      access: mock(() => Promise.reject(new Error('ENOENT'))),
      writeFile: mock(() => Promise.resolve()),
    },
    constants: {
      F_OK: 0,
    }
  },
}));

// Mock adm-zip
const mockExtractAllToAsync = mock((path: string, overwrite: boolean, keepPerms: boolean, cb: (err?: Error) => void) => {
  cb(); // Call callback immediately
});

const mockAdmZip = mock(() => ({
  extractAllTo: mock(),
  extractAllToAsync: mockExtractAllToAsync,
}));

mock.module('adm-zip', () => ({
  default: mockAdmZip
}));

// Mock platform detector
let mockPlatform = {
  os: 'linux',
  arch: 'x86_64',
  gcloudDownloadUrl: 'http://example.com/gcloud.tar.gz',
  gcloudBinaryName: 'gcloud',
  isWindows: false,
};

mock.module('../../platform/detector.js', () => ({
  detectPlatform: () => mockPlatform,
  getGcloudSdkPath: () => '/mock/stitch/google-cloud-sdk',
  getGcloudConfigPath: () => '/mock/stitch/.stitch-mcp/config',
  getStitchDir: () => '/mock/stitch/.stitch-mcp',
  getHomeDir: () => '/mock/home',
}));

describe('GcloudHandler', () => {
  let handler: GcloudHandler;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Reset platform to default
    mockPlatform = {
      os: 'linux',
      arch: 'x86_64',
      gcloudDownloadUrl: 'http://example.com/gcloud.tar.gz',
      gcloudBinaryName: 'gcloud',
      isWindows: false,
    };

    // IMPORTANT: mockReset clears history AND implementations (queued 'once' values)
    mockExecCommand.mockReset();
    mockExecCommand.mockResolvedValue({ success: false, stdout: '', stderr: 'Unexpected exec call', exitCode: 1 });

    mockAdmZip.mockClear();
    mockExtractAllToAsync.mockClear();

    // Reset fs mocks
    (fs.existsSync as any).mockImplementation(() => false);
    (fs.promises.access as any).mockImplementation(() => Promise.reject(new Error('ENOENT')));

    originalEnv = { ...process.env };
    handler = new GcloudHandler();
    // Pre-set gcloudPath to avoid internal resolution calls during unit tests for specific methods
    // This assumes the handler has already "found" gcloud, preventing getGcloudCommand from triggering 'which' or 'access' checks.
    // Tests that specifically test resolution (like ensureInstalled) should reset this to null.
    (handler as any).gcloudPath = '/mock/gcloud';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Zip Extraction (Windows)', () => {
    test('should use async zip extraction on Windows', async () => {
      // Simulate Windows
      mockPlatform = {
        os: 'windows',
        arch: 'x86_64',
        gcloudDownloadUrl: 'http://example.com/gcloud.zip',
        gcloudBinaryName: 'gcloud.cmd',
        isWindows: true,
      };

      // Re-instantiate handler to pick up new platform detection
      handler = new GcloudHandler();
      // Ensure we test the full install flow
      (handler as any).gcloudPath = null;

      // Mock global fetch
      const originalFetch = global.fetch;
      // @ts-ignore
      global.fetch = mock(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(10),
      }));

      // Mock execCommand for version check after install
      mockExecCommand.mockResolvedValue({
        success: true,
        stdout: 'Google Cloud SDK 1.0.0',
        stderr: '',
        exitCode: 0
      });

      try {
        await handler.ensureInstalled({ forceLocal: true });

        // Verify AdmZip was instantiated
        expect(mockAdmZip).toHaveBeenCalled();

        // Verify extractAllToAsync was called
        expect(mockExtractAllToAsync).toHaveBeenCalled();

        // Verify it was called with correct arguments
        expect(mockExtractAllToAsync.mock.calls[0][0]).toContain('/mock/stitch');
        expect(mockExtractAllToAsync.mock.calls[0][1]).toBe(true);
        expect(mockExtractAllToAsync.mock.calls[0][2]).toBe(false);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('Async File Check Regression', () => {
    test('should uses fs.promises.access for checking local binary', async () => {
      // Clear the pre-set path to force resolution
      (handler as any).gcloudPath = null;

      // Setup successful access call to simulate local binary existing
      (fs.promises.access as any).mockResolvedValue(undefined);

      // Mock exec command for the subsequent call in getActiveAccount
      mockExecCommand.mockResolvedValue({ success: true, stdout: 'test@example.com', stderr: '', exitCode: 0 });

      await handler.getActiveAccount();

      expect(fs.promises.access).toHaveBeenCalled();
    });

     test('should fallback to system command if access fails', async () => {
      // Clear the pre-set path to force resolution
      (handler as any).gcloudPath = null;

      // Setup failed access call
      (fs.promises.access as any).mockRejectedValue(new Error('ENOENT'));

      mockExecCommand.mockResolvedValue({ success: true, stdout: 'test@example.com', stderr: '', exitCode: 0 });

      await handler.getActiveAccount();

      expect(fs.promises.access).toHaveBeenCalled();

      const calls = mockExecCommand.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0][0]).toBe('gcloud');
    });
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
    test('should return true if ADC file exists and token is valid', async () => {
      (fs.promises.access as any).mockResolvedValue(undefined);
      mockExecCommand.mockResolvedValue({ success: true, stdout: 'ya29.token', stderr: '', exitCode: 0 });
      const result = await handler.hasADC();
      expect(result).toBe(true);
    });

    test('should return false if ADC file exists but token is expired', async () => {
      (fs.promises.access as any).mockResolvedValue(undefined);
      mockExecCommand.mockResolvedValue({ success: false, stdout: '', stderr: 'Token expired', exitCode: 1 });
      const result = await handler.hasADC();
      expect(result).toBe(false);
    });

    test('should return false if ADC file does not exist', async () => {
      (fs.promises.access as any).mockRejectedValue(new Error('ENOENT'));
      const result = await handler.hasADC();
      expect(result).toBe(false);
    });
  });

  describe('Environment Configuration', () => {
    beforeEach(() => {
      delete process.env.CLOUDSDK_CONFIG;
      delete process.env.STITCH_USE_SYSTEM_GCLOUD;
      // We need to test installation/setup flow, so clear the pre-set path
      (handler as any).gcloudPath = null;
    });

    test('should use isolated environment by default', async () => {
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

      await handler.ensureInstalled({ minVersion: '0.0.0', useSystemGcloud: true } as any);

      await handler.authenticate({ skipIfActive: false });

      const calls = mockExecCommand.mock.calls;
      const authCall = calls.find((call: any[]) => call[0].includes('auth') && call[0].includes('login'));
      if (!authCall) throw new Error('Auth call not found');
      const env = authCall[1].env;

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
