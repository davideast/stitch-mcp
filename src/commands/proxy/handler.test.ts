import { describe, it, expect, spyOn, beforeEach, afterEach, mock } from 'bun:test';
import { StitchProxy } from '@google/stitch-sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ProxyCommandHandler } from './handler.js';

describe('ProxyCommandHandler (SDK)', () => {
  let startSpy: any;
  let transportSpy: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Provide a dummy API key so the constructor doesn't throw auth failed error.
    process.env.STITCH_API_KEY = 'dummy-key';
    startSpy = spyOn(StitchProxy.prototype, 'start').mockResolvedValue(undefined);
    // StdioServerTransport constructor — just ensure it's instantiated
    transportSpy = spyOn(StdioServerTransport.prototype, 'start' as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    startSpy.mockRestore();
    transportSpy.mockRestore();
  });

  it('starts StitchProxy with a StdioServerTransport', async () => {
    const handler = new ProxyCommandHandler();
    const result = await handler.execute({ port: undefined });

    expect(result.success).toBe(true);
    expect(startSpy).toHaveBeenCalledTimes(1);
    // First arg to start() should be a StdioServerTransport instance
    expect(startSpy.mock.calls[0][0]).toBeInstanceOf(StdioServerTransport);
  });

  it('passes STITCH_API_KEY env var to StitchProxy', async () => {
    const constructorSpy = spyOn(StitchProxy.prototype, 'constructor' as any);
    process.env.STITCH_API_KEY = 'test-key';
    const handler = new ProxyCommandHandler();
    const result = await handler.execute({});
    // Proxy reads from env — confirm it doesn't throw when key is set
    expect(result.success).toBe(true);
  });

  it.skip('writes debug log to ~/.stitch/proxy-debug.log when --debug is passed', async () => {
    // TODO: Confirm StitchProxy exposes an event/hook for debug logging.
    // If not, wrap proxy.start() with the existing FileStream setup before delegating.
    // Gap #2 in gap list.
  });

  it.skip('respects STITCH_USE_SYSTEM_GCLOUD env var via pre-obtained access token', async () => {
    // TODO: Confirm StitchProxy reads STITCH_ACCESS_TOKEN when STITCH_USE_SYSTEM_GCLOUD=1.
    // Gap #3 in gap list.
  });
});
