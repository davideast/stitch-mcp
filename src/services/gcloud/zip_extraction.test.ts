import { describe, test, expect, mock, beforeEach, spyOn } from 'bun:test';
import { GcloudHandler } from './handler.js';
import fs from 'node:fs';

// Mock dependencies
const mockExtractAllToAsync = mock((path: string, overwrite: boolean, cb: (err?: Error) => void) => {
  cb(); // Call callback immediately
});

const mockAdmZip = mock(() => ({
  extractAllTo: mock(),
  extractAllToAsync: mockExtractAllToAsync,
}));

mock.module('adm-zip', () => ({
  default: mockAdmZip
}));

// Mock platform detector to simulate Windows
mock.module('../../platform/detector.js', () => ({
  detectPlatform: () => ({
    os: 'windows',
    arch: 'x86_64',
    gcloudDownloadUrl: 'http://example.com/gcloud.zip',
    gcloudBinaryName: 'gcloud.cmd',
    isWindows: true,
  }),
  getGcloudSdkPath: () => '/mock/stitch/google-cloud-sdk',
  getGcloudConfigPath: () => '/mock/stitch/config',
  getStitchDir: () => '/mock/stitch',
}));

// Mock shell
mock.module('../../platform/shell.js', () => ({
  execCommand: mock(async () => ({ success: true, stdout: '', stderr: '', exitCode: 0 })),
  commandExists: mock(async () => false),
}));

// Mock fs
mock.module('node:fs', () => ({
  default: {
    existsSync: mock(() => false),
    mkdirSync: mock(),
    unlinkSync: mock(),
    promises: {
      writeFile: mock(async () => {}),
      access: mock(async () => { throw new Error('ENOENT'); }),
    },
    constants: {
      F_OK: 0,
    }
  },
}));

// Mock global fetch
// @ts-ignore
global.fetch = mock(async () => ({
  ok: true,
  arrayBuffer: async () => new ArrayBuffer(10),
}));

describe('GcloudHandler Zip Extraction', () => {
  let handler: GcloudHandler;

  beforeEach(() => {
    mockAdmZip.mockClear();
    mockExtractAllToAsync.mockClear();
    handler = new GcloudHandler();
  });

  test('should use async zip extraction on Windows', async () => {
    // We need to trigger installLocal.
    // ensureInstalled calling installLocal requires:
    // 1. system gcloud not found (mocked via commandExists -> false)
    // 2. local gcloud not found (fs.existsSync -> false)
    // 3. fetch succeeds (mocked)

    // We also need getVersionFromPath to succeed after install to complete ensureInstalled
    const shellModule = await import('../../platform/shell.js');
    (shellModule.execCommand as any).mockResolvedValue({
      success: true,
      stdout: 'Google Cloud SDK 1.0.0',
      stderr: '',
      exitCode: 0
    });

    await handler.ensureInstalled({ forceLocal: true });

    // Verify AdmZip was instantiated
    expect(mockAdmZip).toHaveBeenCalled();

    // Verify extractAllToAsync was called
    expect(mockExtractAllToAsync).toHaveBeenCalled();

    // Verify it was called with correct arguments
    // First arg is path, second is overwrite
    expect(mockExtractAllToAsync.mock.calls[0][0]).toContain('/mock/stitch');
    expect(mockExtractAllToAsync.mock.calls[0][1]).toBe(true);
  });
});
