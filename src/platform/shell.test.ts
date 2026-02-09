import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { getSpawnArgs } from './shell';

describe('execCommand security', () => {
  let originalPlatform: string;

  beforeEach(() => {
    originalPlatform = process.platform;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  test('should use safe shell execution on Linux', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });

    const result = getSpawnArgs('ls', ['-la']);

    expect(result.cmd).toBe('ls');
    expect(result.args).toEqual(['-la']);
  });

  test('should use safe cmd.exe invocation on Windows', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    const result = getSpawnArgs('echo', ['hello']);

    // We expect the safe implementation:
    // cmd.exe /d /s /c echo hello
    expect(result.cmd).toBe('cmd.exe');
    expect(result.args).toEqual(['/d', '/s', '/c', 'echo', 'hello']);
  });

  test('should use safe cmd.exe invocation on Windows (streaming)', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    const result = getSpawnArgs('echo', ['hello']);

    expect(result.cmd).toBe('cmd.exe');
    expect(result.args).toEqual(['/d', '/s', '/c', 'echo', 'hello']);
  });
});
