import { describe, test, expect, spyOn, beforeEach, afterEach } from 'bun:test';
import { execCommand } from './shell';
import * as childProcess from 'node:child_process';
import { EventEmitter } from 'events';

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill() {}
}

describe('execCommand security', () => {
  let originalPlatform: string;
  let spawnSpy: any;

  beforeEach(() => {
    originalPlatform = process.platform;
    // Mock spawn to return a fake process and capture arguments
    spawnSpy = spyOn(childProcess, 'spawn').mockImplementation((cmd, args, opts) => {
        const child = new MockChildProcess();
        setTimeout(() => {
            child.emit('close', 0);
        }, 1);
        return child as any;
    });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    spawnSpy.mockRestore();
  });

  test('should use safe shell execution on Linux', async () => {
    // Force Linux platform
    Object.defineProperty(process, 'platform', { value: 'linux' });

    await execCommand(['ls', '-la']);

    expect(spawnSpy).toHaveBeenCalled();
    const [cmd, args, opts] = spawnSpy.mock.calls[0];
    expect(cmd).toBe('ls');
    expect(args).toEqual(['-la']);
    expect(opts.shell).toBe(false);
  });

  test('should use safe cmd.exe invocation on Windows', async () => {
    // Force Windows platform
    Object.defineProperty(process, 'platform', { value: 'win32' });

    await execCommand(['echo', 'hello']);

    expect(spawnSpy).toHaveBeenCalled();
    const [cmd, args, opts] = spawnSpy.mock.calls[0];

    // We expect the safe implementation:
    // cmd.exe /d /s /c echo hello
    // with shell: false
    expect(cmd).toBe('cmd.exe');
    expect(args).toEqual(['/d', '/s', '/c', 'echo', 'hello']);
    expect(opts.shell).toBe(false);
  });

  test('should use safe cmd.exe invocation on Windows (streaming)', async () => {
    // Force Windows platform
    Object.defineProperty(process, 'platform', { value: 'win32' });

    // We need to import execCommandStreaming but I didn't import it yet.
    // I will fix imports.
    const { execCommandStreaming } = await import('./shell');

    await execCommandStreaming(['echo', 'hello']);

    expect(spawnSpy).toHaveBeenCalled();
    const [cmd, args, opts] = spawnSpy.mock.calls[0];

    expect(cmd).toBe('cmd.exe');
    expect(args).toEqual(['/d', '/s', '/c', 'echo', 'hello']);
    expect(opts.shell).toBe(false);
  });
});
