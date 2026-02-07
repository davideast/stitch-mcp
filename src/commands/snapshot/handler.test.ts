import { expect, test, describe, spyOn, mock, afterEach } from 'bun:test';
import { SnapshotHandler } from './handler.js';
import path from 'path';
import fs from 'fs-extra';

// Spy on fs-extra methods instead of using mock.module
// This avoids polluting the global module registry which affects other tests
const pathExistsSpy = spyOn(fs, 'pathExists');
const readJsonSpy = spyOn(fs, 'readJson');

const mockExecute = mock(async () => ({ success: true }));

// Mock InitHandler
// Use absolute path resolved from current directory to be safe
const initHandlerPath = path.resolve(import.meta.dir, '../init/handler.js');
mock.module(initHandlerPath, () => ({
  InitHandler: class {
    execute = mockExecute;
    constructor() {}
  }
}));

// Also mock the .ts version just in case (bun resolves .ts)
const initHandlerPathTs = path.resolve(import.meta.dir, '../init/handler.ts');
mock.module(initHandlerPathTs, () => ({
  InitHandler: class {
    execute = mockExecute;
    constructor() {}
  }
}));

describe('SnapshotHandler', () => {
  afterEach(() => {
    // Restore spies to avoid side effects
    pathExistsSpy.mockRestore();
    readJsonSpy.mockRestore();
  });

  test('should execute init command with data', async () => {
    // Setup spies
    pathExistsSpy.mockResolvedValue(true);
    readJsonSpy.mockResolvedValue({
        mcpClient: 'vscode',
        authMode: 'oauth',
        inputArgs: {}
    });

    const handler = new SnapshotHandler();
    const result = await handler.execute({ command: 'init', data: 'test.json' });
    expect(result.success).toBe(true);
  });
});
