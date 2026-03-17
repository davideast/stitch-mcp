import { StitchProxy } from '@google/stitch-sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { StartProxyInput, ProxyResult } from '../../services/proxy/spec.js';

export class ProxyCommandHandler {
  async execute(input: StartProxyInput): Promise<ProxyResult> {
    try {
      const proxy = new StitchProxy({
        apiKey: process.env.STITCH_API_KEY,
        // STITCH_ACCESS_TOKEN + GOOGLE_CLOUD_PROJECT read automatically
      });
      const transport = new StdioServerTransport();
      await proxy.start(transport);
      return { success: true, data: { status: 'stopped' } };
    } catch (e: any) {
      return { success: false, error: { code: 'PROXY_START_ERROR', message: e.message, recoverable: false } };
    }
  }
}
