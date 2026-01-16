import { mock } from 'bun:test';
import type { ShellResult } from '../../src/platform/shell.js';

export const mockExecCommand = mock(async (command: string[], options?: any): Promise<ShellResult> => {
  return {
    success: true,
    stdout: '',
    stderr: '',
    exitCode: 0,
  };
});
