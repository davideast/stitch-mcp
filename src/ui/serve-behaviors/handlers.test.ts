import { test, expect, describe, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { htmlCodeServeHandler, deps } from './handlers.js';
import type { ServeContext } from './types.js';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mock(() => Promise.resolve({ ok: true, text: () => Promise.resolve('<html></html>') } as Response));

  // Spy on the dependency
  spyOn(deps, 'serveHtmlInMemory').mockImplementation(
    () => Promise.resolve({ url: 'http://127.0.0.1:3456', stop: () => {} })
  );
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  // Restore all mocks
  mock.restore();
});

describe('htmlCodeServeHandler', () => {
  test('returns success with URL', async () => {
    const ctx: ServeContext = { key: 'downloadUrl', value: 'https://example.com/code.html', path: 'screen.htmlCode.downloadUrl' };
    const result = await htmlCodeServeHandler.serve(ctx);
    expect(result.success).toBe(true);
    expect(result.url).toBeDefined();
    expect(deps.serveHtmlInMemory).toHaveBeenCalled();
  });

  test('extracts URL from object with downloadUrl', async () => {
    const ctx: ServeContext = { key: 'htmlCode', value: { downloadUrl: 'https://example.com/code.html' }, path: 'screen.htmlCode' };
    const result = await htmlCodeServeHandler.serve(ctx);
    expect(result.success).toBe(true);
  });

  test('fails if no URL found', async () => {
    const ctx: ServeContext = { key: 'htmlCode', value: 12345, path: 'screen.htmlCode' };
    const result = await htmlCodeServeHandler.serve(ctx);
    expect(result.success).toBe(false);
  });
});
