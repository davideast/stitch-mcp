import { StitchProxy } from '@google/stitch-sdk';
import type { StitchProxy as StitchProxyType } from '@google/stitch-sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { GcloudService } from '../../services/gcloud/spec.js';

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
  private createProxy: (opts: { apiKey?: string; accessToken?: string }) => StitchProxyType;
  private createTransport: () => StdioServerTransport;
  private gcloudService?: GcloudService;

  constructor(deps?: {
    createProxy?: (opts: { apiKey?: string; accessToken?: string }) => StitchProxyType;
    createTransport?: () => StdioServerTransport;
    gcloudService?: GcloudService;
  }) {
    this.createProxy = deps?.createProxy ?? ((opts) => new StitchProxy(opts));
    this.createTransport = deps?.createTransport ?? (() => new StdioServerTransport());
    this.gcloudService = deps?.gcloudService;
  }

  async execute(input: ProxyCommandInput): Promise<ProxyCommandResult> {
    try {
      const apiKey = process.env.STITCH_API_KEY;
      let accessToken: string | undefined;

      // When no API key is set, try to get an access token via ADC / gcloud
      if (!apiKey && this.gcloudService) {
        // Ensure gcloud is discovered before attempting token fetch
        await this.gcloudService.ensureInstalled({ useSystemGcloud: !!process.env.STITCH_USE_SYSTEM_GCLOUD });
        const token = await this.gcloudService.getAccessToken();
        if (token) {
          accessToken = token;
        }
      }

      const proxy = this.createProxy({
        apiKey,
        accessToken,
      });
      const transport = this.createTransport();
      await proxy.start(transport);
      await transport.onclose;
      return { success: true, data: { status: 'running' } };
    } catch (e: any) {
      return { success: false, error: { code: 'PROXY_START_ERROR', message: e.message, recoverable: false } };
    }
  }
}
