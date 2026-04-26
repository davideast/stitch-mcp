import { StitchProxy } from '@google/stitch-sdk';
import type { StitchProxy as StitchProxyType } from '@google/stitch-sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCaptureHandler, isLogEnabled } from '../../lib/log/factory.js';
import { installLoggingCallToolHandler } from './LoggingCallToolHandler.js';

interface ProxyCommandInput {
  port?: number;
  debug?: boolean;
}

interface ProxyCommandResult {
  success: boolean;
  data?: { status: string };
  error?: { code: string; message: string; recoverable: boolean };
}

export class ProxyCommandHandler {
  private createProxy: (opts: { apiKey?: string }) => StitchProxyType;
  private createTransport: () => StdioServerTransport;

  constructor(deps?: {
    createProxy?: (opts: { apiKey?: string }) => StitchProxyType;
    createTransport?: () => StdioServerTransport;
  }) {
    this.createProxy = deps?.createProxy ?? ((opts) => new StitchProxy(opts));
    this.createTransport = deps?.createTransport ?? (() => new StdioServerTransport());
  }

  async execute(input: ProxyCommandInput): Promise<ProxyCommandResult> {
    try {
      const proxy = this.createProxy({
        apiKey: process.env.STITCH_API_KEY,
      });
      const transport = this.createTransport();
      await proxy.start(transport);

      // Override the SDK's tools/call handler with a capture-wrapped variant.
      // Must run AFTER proxy.start() (which registers the original handler).
      if (isLogEnabled()) {
        try {
          installLoggingCallToolHandler(proxy, createCaptureHandler());
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // eslint-disable-next-line no-console
          console.error(`[stitch-mcp log] failed to install capture handler: ${msg}`);
        }
      }

      await transport.onclose;
      return { success: true, data: { status: 'running' } };
    } catch (e: any) {
      return { success: false, error: { code: 'PROXY_START_ERROR', message: e.message, recoverable: false } };
    }
  }
}
