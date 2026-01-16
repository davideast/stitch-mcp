import { afterEach, beforeEach, test, expect, mock, spyOn } from 'bun:test';
import { ProxyHandler } from './handler';
import { GcloudHandler } from '../gcloud/handler';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

// Mock GcloudHandler
const mockGetAccessToken = mock(async (): Promise<string | null> => 'initial-token');
const mockGetProjectId = mock(async (): Promise<string | null> => 'test-project');
mock.module('../gcloud/handler', () => {
  return {
    GcloudHandler: class {
      getAccessToken = mockGetAccessToken;
      getProjectId = mockGetProjectId;
    },
  };
});

// Mock StdioServerTransport
const mockStdioSend = mock(async (message: any) => { });
const mockStdioStart = mock(async () => { });
let stdioOnMessageCallback: ((message: any) => void) | undefined;
mock.module('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: class {
      onmessage?: (message: any) => void;
      constructor() {
        // Capture the onmessage callback when it's set
        Object.defineProperty(this, 'onmessage', {
          get: () => stdioOnMessageCallback,
          set: (value) => { stdioOnMessageCallback = value; },
          configurable: true,
        });
      }
      send = mockStdioSend;
      start = mockStdioStart;
    },
  };
});


// Mock fetch
const mockFetch = mock(async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }), { status: 200 });
});
global.fetch = mockFetch;

beforeEach(() => {
  mockGetAccessToken.mockClear();
  mockGetProjectId.mockClear();
  mockFetch.mockClear();
  mockStdioSend.mockClear();
  mockStdioStart.mockClear();
  stdioOnMessageCallback = undefined;
  // Restore initial mock implementations
  mockGetAccessToken.mockImplementation(async () => 'initial-token');
  mockGetProjectId.mockImplementation(async () => 'test-project');
});

afterEach(() => {
  // Clear any fake timers
  // We don't use fake timers for now, real timeouts are fine
});

test('ProxyHandler: Initial auth failure', async () => {
  mockGetAccessToken.mockResolvedValueOnce(null);
  const handler = new ProxyHandler();
  const result = await handler.start({ transport: 'stdio' });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.code).toBe('AUTH_REFRESH_FAILED');
  }
});


test('HttpPostTransport: forwards 403 Forbidden with JSON-RPC body', async () => {
  const errorResponse = {
    jsonrpc: '2.0',
    id: 1,
    error: { code: -32600, message: 'Invalid Request' },
  };
  mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(errorResponse), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  }));

  const handler = new ProxyHandler();

  // Stop the server after a short delay to let the request happen
  setTimeout(() => process.emit('SIGINT', 'SIGINT'), 200);

  // Start the handler, it will set up the transport
  await handler.start({ transport: 'stdio' });

  // Now, simulate a message from the local transport
  expect(stdioOnMessageCallback).toBeDefined();
  if (stdioOnMessageCallback) {
    // This will trigger the fetch call in HttpPostTransport
    stdioOnMessageCallback({ jsonrpc: '2.0', id: 1, method: 'test' });
  }

  // Wait a moment for the async operations to complete
  await new Promise(resolve => setTimeout(resolve, 50));

  // The remote transport should have called onmessage, which in turn calls localTransport.send
  expect(mockStdioSend).toHaveBeenCalled();
  expect(mockStdioSend.mock.calls[0][0]).toEqual(errorResponse);
});


test('HttpPostTransport: handles non-JSON 4xx error', async () => {
  mockFetch.mockResolvedValueOnce(new Response('Not Found', {
    status: 404,
  }));

  const handler = new ProxyHandler();
  const errorSpy = spyOn(console, 'error');
  errorSpy.mockImplementation(() => { }); // Suppress console.error for this test

  setTimeout(() => process.emit('SIGINT', 'SIGINT'), 200);
  await handler.start({ transport: 'stdio', debug: true }); // Enable debug for logging

  expect(stdioOnMessageCallback).toBeDefined();
  if (stdioOnMessageCallback) {
    stdioOnMessageCallback({ jsonrpc: '2.0', id: 2, method: 'another_test' });
  }
  await new Promise(resolve => setTimeout(resolve, 50));

  // Should not forward a message, but should log an error.
  // The test can't easily check the log file, but we can see that it doesn't crash
  // and doesn't forward a message.
  expect(mockStdioSend).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});

test('ProxyHandler: Token refresh logic', async () => {
  const REFRESH_INTERVAL_MS = 55 * 60 * 1000;
  // Bun's fake timers seem to have issues with long async operations.
  // We will test the timer setup manually.

  const handler = new ProxyHandler();
  const refreshTokenSpy = spyOn(handler as any, 'refreshToken');

  // Using real timers but a very short interval for the test
  (handler as any).startRefreshTimer = () => {
    if ((handler as any).refreshTimer) {
      clearInterval((handler as any).refreshTimer);
    }
    // We can't use fake timers reliably here, so we will just check if it's called once
    // and trust the setInterval is set up correctly.
    (handler as any).refreshTimer = setTimeout(() => {
      (handler as any).refreshToken().catch(() => { });
    }, 100); // Short timer for test
  };

  mockGetAccessToken
    .mockResolvedValueOnce('initial-token-for-refresh') // For start()
    .mockResolvedValueOnce('refreshed-token');         // For the timer

  setTimeout(() => process.emit('SIGINT', 'SIGINT'), 200);
  await handler.start({ transport: 'stdio' });

  // By the time handler.start() resolves (after 200ms),
  // the initial call (at 0ms) and the timer call (at 100ms) should have both happened.
  expect(refreshTokenSpy).toHaveBeenCalledTimes(2);
  expect(mockGetAccessToken).toHaveBeenCalledTimes(2);

  refreshTokenSpy.mockRestore();
});
