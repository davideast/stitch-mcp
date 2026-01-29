import { expect, test, mock, beforeEach, describe, jest, afterEach } from 'bun:test';
import { ProxyHandler } from './handler.js';
import { GcloudHandler } from '../gcloud/handler.js';
import { type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

// Mock StdioServerTransport
const mockStdioTransport: any = {
  start: mock(async () => { }),
  send: mock(async (message: any) => { }),
  onmessage: (message: any) => { },
  onclose: () => { },
};

// Mock global fetch
global.fetch = mock(async () => new Response('{}', { status: 200 })) as any;

describe('ProxyHandler', () => {
  let proxyHandler: ProxyHandler;
  let mockGcloudHandler: any;

  beforeEach(() => {
    // Reset mocks for every test
    (global.fetch as any).mockClear();

    mockGcloudHandler = {
      getAccessToken: mock(async () => 'test-token'),
      getProjectId: mock(async () => 'test-project'),
    };

    mockStdioTransport.start.mockClear();
    mockStdioTransport.send.mockClear();
    jest.restoreAllMocks(); // Restore any spies

    proxyHandler = new ProxyHandler(mockGcloudHandler, () => mockStdioTransport);

    // Update the shared mock instance reference if tests rely on it (they do)
    // Object.assign(mockGcloudHandlerInstance, mockGcloudHandler); // Removed this line

    delete process.env.STITCH_API_KEY;
  });

  afterEach(() => {
    delete process.env.STITCH_API_KEY;
  });

  test('start should fail if initial token refresh fails', async () => {
    mockGcloudHandler.getAccessToken.mockResolvedValue(null);

    const result = await proxyHandler.start({ transport: 'stdio' });

    expect(mockGcloudHandler.getAccessToken).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('AUTH_REFRESH_FAILED');
    }
  });

  test('start should initialize and run the proxy', async () => {
    const startPromise = proxyHandler.start({ transport: 'stdio' });
    await new Promise(resolve => setTimeout(resolve, 10));
    mockStdioTransport.onclose();
    const result = await startPromise;

    expect(result.success).toBe(true);
    expect(mockGcloudHandler.getAccessToken).toHaveBeenCalledTimes(1);
    expect(mockGcloudHandler.getProjectId).toHaveBeenCalledTimes(1);
    expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
  });

  test('should periodically refresh the token', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const startPromise = proxyHandler.start({ transport: 'stdio' });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockGcloudHandler.getAccessToken).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    // Manually trigger the refresh callback
    const refreshCallback = setIntervalSpy.mock.calls[0]?.[0] as Function | undefined;
    if (refreshCallback) {
      await refreshCallback();
      expect(mockGcloudHandler.getAccessToken).toHaveBeenCalledTimes(2);

      // Trigger it again
      await refreshCallback();
      expect(mockGcloudHandler.getAccessToken).toHaveBeenCalledTimes(3);
    }

    // Stop the server and check that the timer is cleared
    mockStdioTransport.onclose();
    await startPromise;
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    // jest.useRealTimers(); // Not needed if we don't use fake timers
  });

  test('should forward messages from local to remote', async () => {
    const startPromise = proxyHandler.start({ transport: 'stdio' });
    await new Promise(resolve => setTimeout(resolve, 10));

    const message: JSONRPCMessage = { jsonrpc: '2.0', id: 1, method: 'test' };
    mockStdioTransport.onmessage(message);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect((global.fetch as any)).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('https://stitch.googleapis.com/mcp');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe('Bearer test-token');
    expect(options.headers['x-goog-user-project']).toBe('test-project');
    expect((options.body as string)).toBe(JSON.stringify(message));

    mockStdioTransport.onclose();
    await startPromise;
  });

  test('start should use API Key if STITCH_API_KEY is present', async () => {
    process.env.STITCH_API_KEY = 'test-api-key';

    const startPromise = proxyHandler.start({ transport: 'stdio' });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Check that gcloud was NOT called
    expect(mockGcloudHandler.getAccessToken).toHaveBeenCalledTimes(0);
    expect(mockGcloudHandler.getProjectId).toHaveBeenCalledTimes(0);

    // Send a message to trigger fetch
    const message: JSONRPCMessage = { jsonrpc: '2.0', id: 1, method: 'test' };
    mockStdioTransport.onmessage(message);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect((global.fetch as any)).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(options.headers['X-Goog-Api-Key']).toBe('test-api-key');
    expect(options.headers['Authorization']).toBeUndefined();
    expect(options.headers['x-goog-user-project']).toBeUndefined();

    mockStdioTransport.onclose();
    await startPromise;
  });

  test('should forward messages from remote to local', async () => {
    const message: JSONRPCMessage = { jsonrpc: '2.0', id: 1, result: { status: 'test' } };
    (global.fetch as any).mockResolvedValue(new Response(JSON.stringify(message)));

    const startPromise = proxyHandler.start({ transport: 'stdio' });
    await new Promise(resolve => setTimeout(resolve, 10));

    const request: JSONRPCMessage = { jsonrpc: '2.0', id: 1, method: 'test' };
    mockStdioTransport.onmessage(request);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockStdioTransport.send).toHaveBeenCalledTimes(1);
    // Loose check for message content
    expect(mockStdioTransport.send).toHaveBeenCalledWith(expect.objectContaining({ result: { status: 'test' } }));

    mockStdioTransport.onclose();
    await startPromise;
  });

  test('should handle http error and forward JSON-RPC error response', async () => {
    const errorMessage: JSONRPCMessage = {
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32000, message: 'Test error' },
    };
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(errorMessage), { status: 403 })
    );

    const startPromise = proxyHandler.start({ transport: 'stdio' });
    await new Promise(resolve => setTimeout(resolve, 10));

    const request: JSONRPCMessage = { jsonrpc: '2.0', id: 1, method: 'test' };
    mockStdioTransport.onmessage(request);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockStdioTransport.send).toHaveBeenCalledTimes(1);
    expect(mockStdioTransport.send).toHaveBeenCalledWith(errorMessage);

    mockStdioTransport.onclose();
    await startPromise;
  });
});
