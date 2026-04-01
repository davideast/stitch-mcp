import { describe, it, expect, spyOn, beforeEach, afterEach } from 'bun:test';
import { StitchProxy } from '@google/stitch-sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ProxyCommandHandler } from './handler.js';

describe('ProxyCommandHandler', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.STITCH_API_KEY = 'dummy-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('starts StitchProxy and waits for transport close', async () => {
    let transportOnClose: (() => void) | undefined;
    const mockTransport = {
      set onclose(fn: () => void) { transportOnClose = fn; },
      get onclose() { return transportOnClose; },
    };

    const handler = new ProxyCommandHandler({
      createProxy: () => ({
        start: async () => {},
        close: async () => {},
      } as any),
      createTransport: () => mockTransport as any,
    });

    // Execute should not resolve until transport closes
    let resolved = false;
    const resultPromise = handler.execute({}).then((r) => { resolved = true; return r; });

    // Give event loop a tick
    await new Promise(r => setTimeout(r, 10));
    expect(resolved).toBe(false);

    // Simulate transport close
    transportOnClose?.();
    const result = await resultPromise;

    expect(resolved).toBe(true);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('stopped');
    }
  });

  it('passes STITCH_API_KEY env var to StitchProxy', async () => {
    process.env.STITCH_API_KEY = 'test-key';
    let receivedApiKey: string | undefined;
    let transportOnClose: (() => void) | undefined;

    const handler = new ProxyCommandHandler({
      createProxy: (opts) => {
        receivedApiKey = opts.apiKey;
        return { start: async () => {}, close: async () => {} } as any;
      },
      createTransport: () => {
        const t = {
          set onclose(fn: () => void) { transportOnClose = fn; },
          get onclose() { return transportOnClose; },
        };
        // Auto-close after start
        setTimeout(() => transportOnClose?.(), 0);
        return t as any;
      },
    });

    const result = await handler.execute({});
    expect(result.success).toBe(true);
    expect(receivedApiKey).toBe('test-key');
  });

  it('returns error when proxy start fails', async () => {
    const handler = new ProxyCommandHandler({
      createProxy: () => ({
        start: async () => { throw new Error('Connection refused'); },
        close: async () => {},
      } as any),
      createTransport: () => ({
        set onclose(_fn: any) {},
        get onclose() { return undefined; },
      } as any),
    });

    const result = await handler.execute({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('PROXY_START_ERROR');
      expect(result.error.message).toBe('Connection refused');
    }
  });
});
