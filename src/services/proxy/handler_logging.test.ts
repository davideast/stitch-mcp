import { expect, test, mock, beforeEach, describe, jest } from 'bun:test';
import { ProxyHandler } from './handler.js';
import { type WriteStream } from 'node:fs';

// Mock dependencies
const mockStdioTransport: any = {
  start: mock(async () => { }),
  send: mock(async (message: any) => { }),
  onmessage: (message: any) => { },
  onclose: () => { },
};

// Mock GcloudHandler
const mockGcloudHandler: any = {
  getAccessToken: mock(async () => 'test-token'),
  getProjectId: mock(async () => 'test-project'),
};

// Mock global fetch
global.fetch = mock(async () => new Response('{}', { status: 200 })) as any;

// Mock WriteStream
const mockWriteStream = {
  write: mock((chunk: any) => true),
  end: mock((cb: any) => { if (cb) cb(); }),
  on: mock((event: string, cb: any) => { }),
} as unknown as WriteStream;

// Mock node:fs
mock.module('node:fs', () => ({
  createWriteStream: mock(() => mockWriteStream),
  appendFileSync: mock(() => { }),
}));

// Mock dotenv
mock.module('dotenv', () => ({
  default: {
    config: mock(() => ({})),
  },
  config: mock(() => ({})),
}));

describe('ProxyHandler Logging', () => {
  let proxyHandler: ProxyHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as any).mockClear();

    // Clear specific mocks
    (mockWriteStream.write as any).mockClear();
    (mockWriteStream.end as any).mockClear();

    proxyHandler = new ProxyHandler(mockGcloudHandler, () => mockStdioTransport);
    delete process.env.STITCH_API_KEY;
  });

  test('should use createWriteStream when debug is enabled', async () => {
    const fs = await import('node:fs');

    // Start proxy but don't await completion yet
    const startPromise = proxyHandler.start({ transport: 'stdio', debug: true });

    // Allow time for initialization
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(fs.createWriteStream).toHaveBeenCalledTimes(1);
    expect(fs.createWriteStream).toHaveBeenCalledWith('/tmp/stitch-proxy-debug.log', { flags: 'a' });

    // Stop proxy to cleanup
    mockStdioTransport.onclose();
    await startPromise;
  });

  test('should not use createWriteStream when debug is disabled', async () => {
    const fs = await import('node:fs');

    const startPromise = proxyHandler.start({ transport: 'stdio', debug: false });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(fs.createWriteStream).toHaveBeenCalledTimes(0);

    mockStdioTransport.onclose();
    await startPromise;
  });

  test('should write to stream when logging', async () => {
    const startPromise = proxyHandler.start({ transport: 'stdio', debug: true });

    await new Promise(resolve => setTimeout(resolve, 50));

    // The start method logs some messages
    expect(mockWriteStream.write).toHaveBeenCalled();

    // Check for a specific log message that happens during start
    const calls = (mockWriteStream.write as any).mock.calls;
    const initialLog = calls.some((args: any[]) => args[0].includes('Starting ProxyHandler'));
    expect(initialLog).toBe(true);

    mockStdioTransport.onclose();
    await startPromise;
  });

  test('should close stream when proxy stops', async () => {
    const startPromise = proxyHandler.start({ transport: 'stdio', debug: true });
    await new Promise(resolve => setTimeout(resolve, 50));

    mockStdioTransport.onclose();
    await startPromise;

    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
  });
});
