import { describe, it, expect, spyOn, beforeEach, afterEach } from 'bun:test';
import { StitchProxy } from '@google/stitch-sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ProxyCommandHandler } from './handler.js';

describe('ProxyCommandHandler (SDK)', () => {
  let startSpy: any;
  let oncloseSpy: any;
  let transportSpy: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.STITCH_API_KEY = 'dummy-key';
    startSpy = spyOn(StitchProxy.prototype, 'start').mockResolvedValue(undefined);
    transportSpy = spyOn(StdioServerTransport.prototype, 'start' as any).mockResolvedValue(undefined);
    // Mock onclose as a resolved promise so execute() returns in tests
    Object.defineProperty(StdioServerTransport.prototype, 'onclose', {
      get: () => Promise.resolve(),
      configurable: true,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    startSpy.mockRestore();
    transportSpy.mockRestore();
    delete (StdioServerTransport.prototype as any).onclose;
  });

  it('starts StitchProxy with a StdioServerTransport', async () => {
    const handler = new ProxyCommandHandler();
    const result = await handler.execute({});

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('stopped');
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy.mock.calls[0][0]).toBeInstanceOf(StdioServerTransport);
  });

  it('passes STITCH_API_KEY env var to StitchProxy', async () => {
    process.env.STITCH_API_KEY = 'test-key';
    let receivedApiKey: string | undefined;

    const handler = new ProxyCommandHandler({
      createProxy: (opts) => {
        receivedApiKey = opts.apiKey;
        return { start: async () => {}, close: async () => {} } as any;
      },
      createTransport: () => {
        const t = { onclose: Promise.resolve() } as any;
        return t;
      },
    });

    const result = await handler.execute({});
    expect(result.success).toBe(true);
    expect(receivedApiKey).toBe('test-key');
  });

  it('exits gracefully when transport closes', async () => {
    const handler = new ProxyCommandHandler();
    const result = await handler.execute({});
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('stopped');
  });

  it('returns error when proxy start fails', async () => {
    startSpy.mockRejectedValue(new Error('Connection refused'));
    const handler = new ProxyCommandHandler();
    const result = await handler.execute({});
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('PROXY_START_ERROR');
    expect(result.error?.message).toBe('Connection refused');
  });

  it.skip('writes debug log to ~/.stitch/proxy-debug.log when --debug is passed', async () => {
    // TODO: Confirm StitchProxy exposes an event/hook for debug logging.
  });

  it.skip('respects STITCH_USE_SYSTEM_GCLOUD env var via pre-obtained access token', async () => {
    // TODO: Confirm StitchProxy reads STITCH_ACCESS_TOKEN when STITCH_USE_SYSTEM_GCLOUD=1.
  });
});
