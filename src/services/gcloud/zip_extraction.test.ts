import { describe, test, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { GcloudHandler } from './handler';
import { mockExecCommand } from '../../../tests/mocks/shell.js';
import fs from 'node:fs';

// Mock external dependencies
mock.module('../../platform/shell.js', () => ({
  execCommand: mockExecCommand,
  commandExists: mock(() => Promise.resolve(false)),
}));

// Mock detectPlatform to force Windows
mock.module('../../platform/detector.js', () => {
    return {
        detectPlatform: () => ({
            isWindows: true, // Force Windows for Zip path
            gcloudBinaryName: 'gcloud.exe',
            gcloudDownloadUrl: 'http://example.com/gcloud.zip'
        }),
        getGcloudSdkPath: () => '/mock/sdk/path',
        getGcloudConfigPath: () => '/mock/config/path',
        getStitchDir: () => '/mock/stitch/dir',
    };
});

// Mock AdmZip
const mockExtractAllTo = mock();
const mockExtractAllToAsync = mock((target, overwrite, perms, callback) => {
    // Be async
    if (callback) setTimeout(() => callback(null), 10);
});

class MockAdmZip {
  constructor(filePath: string) {
  }
  extractAllTo = mockExtractAllTo;
  extractAllToAsync = mockExtractAllToAsync;
}

mock.module('adm-zip', () => ({
  default: MockAdmZip
}));

// Mock node:fs
mock.module('node:fs', () => ({
  default: {
    existsSync: mock(() => false),
    mkdirSync: mock(() => undefined),
    unlinkSync: mock(() => undefined),
    promises: {
      access: mock(() => Promise.reject(new Error('ENOENT'))),
      writeFile: mock(() => Promise.resolve()),
    },
    constants: {
      F_OK: 0,
    }
  },
}));

const originalFetch = global.fetch;

describe('GcloudHandler Zip Extraction', () => {
  let handler: GcloudHandler;

  beforeEach(() => {
    mockExecCommand.mockClear();
    mockExtractAllTo.mockClear();
    mockExtractAllToAsync.mockClear();

    // Reset fs mocks
    (fs.existsSync as any).mockImplementation(() => false);

    // Mock fetch
    global.fetch = mock(() => Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    } as any));

    handler = new GcloudHandler();
  });

  afterEach(() => {
      global.fetch = originalFetch;
  });

  test('should call extractAllToAsync and not extractAllTo', async () => {
    await handler.ensureInstalled({ minVersion: '0.0.0' } as any);
    expect(mockExtractAllToAsync).toHaveBeenCalled();
    expect(mockExtractAllTo).not.toHaveBeenCalled();
  });
});
