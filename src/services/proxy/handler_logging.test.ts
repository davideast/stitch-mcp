import { expect, test, mock, beforeEach, describe, jest, spyOn, afterEach } from 'bun:test';

// Mock MCP SDK before importing anything that uses it
mock.module('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class {
    start = mock(async () => { });
    send = mock(async () => { });
  },
}));

mock.module('@modelcontextprotocol/sdk/types.js', () => ({}));

import { ProxyHandler, deps } from './handler.js';
import { type WriteStream } from 'node:fs';

describe('ProxyHandler Logging', () => {
  let proxyHandler: ProxyHandler;

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

  // Mock WriteStream
  const mockWriteStream = {
    write: mock((chunk: any) => true),
    end: mock((cb: any) => { if (cb) cb(); }),
    on: mock((event: string, cb: any) => { }),
  } as unknown as WriteStream;

  let originalFetch: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock global fetch
    originalFetch = global.fetch;
    global.fetch = mock(async () => new Response('{}', { status: 200 })) as any;

    // Spies on internal deps object to avoid module mocking leakage
    spyOn(deps, 'createWriteStream').mockReturnValue(mockWriteStream as any);
    spyOn(deps, 'existsSync').mockReturnValue(true);
    spyOn(deps, 'mkdirSync').mockReturnValue(undefined as any);
    spyOn(deps, 'getStitchDir').mockReturnValue('/mock/stitch');

    // Clear specific mocks
    (mockWriteStream.write as any).mockClear();
    (mockWriteStream.end as any).mockClear();

    proxyHandler = new ProxyHandler(mockGcloudHandler, () => mockStdioTransport);
    delete process.env.STITCH_API_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('should use createWriteStream when debug is enabled', async () => {
    // Start proxy but don't await completion yet
    const startPromise = proxyHandler.start({ transport: 'stdio', debug: true });

    // Allow time for initialization
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(deps.createWriteStream).toHaveBeenCalledTimes(1);
    expect(deps.createWriteStream).toHaveBeenCalledWith('/mock/stitch/proxy-debug.log', { flags: 'a', mode: 0o600 });

    // Stop proxy to cleanup
    mockStdioTransport.onclose();
    await startPromise;
  });

  test('should not use createWriteStream when debug is disabled', async () => {
    const startPromise = proxyHandler.start({ transport: 'stdio', debug: false });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(deps.createWriteStream).toHaveBeenCalledTimes(0);

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
