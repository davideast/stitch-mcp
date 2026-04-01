import { StitchProxy } from '@google/stitch-sdk';
import type { StitchProxy as StitchProxyType } from '@google/stitch-sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ProxySpec, ProxyInput, ProxyResult } from './spec.js';

export class ProxyCommandHandler implements ProxySpec {
  private createProxy: (opts: { apiKey?: string }) => StitchProxyType;
  private createTransport: () => StdioServerTransport;

  constructor(deps?: {
    createProxy?: (opts: { apiKey?: string }) => StitchProxyType;
    createTransport?: () => StdioServerTransport;
  }) {
    this.createProxy = deps?.createProxy ?? ((opts) => new StitchProxy(opts));
    this.createTransport = deps?.createTransport ?? (() => new StdioServerTransport());
  }

  async execute(input: ProxyInput): Promise<ProxyResult> {
    try {
      const proxy = this.createProxy({
        apiKey: process.env.STITCH_API_KEY,
      });
      const transport = this.createTransport();

      // Wait for transport to close before resolving.
      // This keeps the process alive for the lifetime of the MCP connection.
      const closed = new Promise<void>((resolve) => {
        const originalOnClose = transport.onclose;
        transport.onclose = () => {
          originalOnClose?.();
          resolve();
        };
      });

      await proxy.start(transport);
      await closed;

      return { success: true, data: { status: 'stopped' } };
    } catch (e: unknown) {
      return {
        success: false,
        error: {
          code: 'PROXY_START_ERROR',
          message: e instanceof Error ? e.message : String(e),
          recoverable: false,
        },
      };
    }
  }
}
