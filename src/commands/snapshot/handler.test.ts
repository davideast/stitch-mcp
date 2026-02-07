import { expect, test, describe, mock } from 'bun:test';
import { SnapshotHandler } from './handler.js';
import path from 'path';

// Mock fs-extra
mock.module('fs-extra', () => ({
  default: {
    pathExists: async () => true,
    readJson: async () => ({
        mcpClient: 'vscode',
        authMode: 'oauth',
        inputArgs: {}
    }),
  }
}));

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
  test('should execute init command with data', async () => {
    const handler = new SnapshotHandler();
    const result = await handler.execute({ command: 'init', data: 'test.json' });
    expect(result.success).toBe(true);
  });
});
