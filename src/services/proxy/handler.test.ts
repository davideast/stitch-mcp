import { expect, test, mock, beforeEach, describe, jest, afterEach } from 'bun:test';
import { ProxyHandler } from './handler.js';
import { GcloudHandler } from '../gcloud/handler.js';
import { type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

// Shared mock instance for GcloudHandler
const mockGcloudHandlerInstance = {
  getAccessToken: mock(async () => 'test-token'),
  getProjectId: mock(async () => 'test-project'),
};
mock.module('../gcloud/handler.js', () => {
  return {
    GcloudHandler: mock(() => mockGcloudHandlerInstance),
  };
});

// Mock StdioServerTransport
const mockStdioTransport = {
  start: mock(async () => {}),
  send: mock(async (message: JSONRPCMessage) => {}),
  onmessage: (message: JSONRPCMessage) => {},
  onclose: () => {},
};
mock.module('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: mock(() => mockStdioTransport),
  };
});

// Mock global fetch
global.fetch = mock(async () => new Response('{}', { status: 200 }));

describe('ProxyHandler', () => {
  let proxyHandler: ProxyHandler;

  beforeEach(() => {
    // Reset mocks for every test
    (global.fetch as any).mockClear();
    mockGcloudHandlerInstance.getAccessToken.mockClear();
    mockGcloudHandlerInstance.getAccessToken.mockResolvedValue('test-token');
    mockGcloudHandlerInstance.getProjectId.mockClear();
    mockGcloudHandlerInstance.getProjectId.mockResolvedValue('test-project');
    mockStdioTransport.start.mockClear();
    mockStdioTransport.send.mockClear();
    jest.restoreAllMocks(); // Restore any spies

    proxyHandler = new ProxyHandler();
  });

  test('start should fail if initial token refresh fails', async () => {
    mockGcloudHandlerInstance.getAccessToken.mockResolvedValue(null);

    const result = await proxyHandler.start({ transport: 'stdio' });

    expect(mockGcloudHandlerInstance.getAccessToken).toHaveBeenCalledTimes(1);
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
    expect(mockGcloudHandlerInstance.getAccessToken).toHaveBeenCalledTimes(1);
    expect(mockGcloudHandlerInstance.getProjectId).toHaveBeenCalledTimes(1);
    expect(mockStdioTransport.start).toHaveBeenCalledTimes(1);
  });

  test('should periodically refresh the token', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const startPromise = proxyHandler.start({ transport: 'stdio' });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockGcloudHandlerInstance.getAccessToken).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    // Manually trigger the refresh callback
    const refreshCallback = setIntervalSpy.mock.calls[0][0];
    await refreshCallback();
    expect(mockGcloudHandlerInstance.getAccessToken).toHaveBeenCalledTimes(2);

    // Trigger it again
    await refreshCallback();
    expect(mockGcloudHandlerInstance.getAccessToken).toHaveBeenCalledTimes(3);

    // Stop the server and check that the timer is cleared
    mockStdioTransport.onclose();
    await startPromise;
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
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
    expect(options.body).toBe(JSON.stringify(message));

    mockStdioTransport.onclose();
    await startPromise;
  });

  test('should forward messages from remote to local', async () => {
    const message: JSONRPCMessage = { jsonrpc: '2.0', id: 1, result: 'test' };
    (global.fetch as any).mockResolvedValue(new Response(JSON.stringify(message)));

    const startPromise = proxyHandler.start({ transport: 'stdio' });
    await new Promise(resolve => setTimeout(resolve, 10));

    const request: JSONRPCMessage = { jsonrpc: '2.0', id: 1, method: 'test' };
    mockStdioTransport.onmessage(request);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockStdioTransport.send).toHaveBeenCalledTimes(1);
    expect(mockStdioTransport.send).toHaveBeenCalledWith(message);

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
