import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { appendFileSync } from 'node:fs';
import dotenv from 'dotenv';
import {
  type ProxyService,
  type StartProxyInput,
  type ProxyResult,
} from './spec.js';
import { GcloudHandler } from '../gcloud/handler.js';

const REFRESH_INTERVAL_MS = 55 * 60 * 1000; // 55 minutes
const LOG_FILE = '/tmp/stitch-proxy-debug.log';

type Logger = (message: string) => void;

type AuthConfig =
  | { type: 'bearer'; token: string; projectId?: string }
  | { type: 'apiKey'; key: string };

class HttpPostTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(
    private url: string,
    private auth: AuthConfig,
    private logger: Logger
  ) { }

  async start(): Promise<void> {
    // No connection to establish for HTTP POST
    const project = this.auth.type === 'bearer' ? this.auth.projectId : 'N/A';
    this.logger(`HttpPostTransport started for ${this.url} (Auth: ${this.auth.type}, Project: ${project || 'none'})`);
  }

  async send(message: JSONRPCMessage): Promise<void> {
    try {
      const msgId = (message as any).id || 'notification';
      const method = (message as any).method || 'response';
      this.logger(`Sending JSON-RPC message ID: ${msgId} Method: ${method}`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.auth.type === 'bearer') {
        headers['Authorization'] = `Bearer ${this.auth.token}`;
        if (this.auth.projectId) {
          headers['x-goog-user-project'] = this.auth.projectId;
        }
      } else {
        headers['X-Goog-Api-Key'] = this.auth.key;
      }

      const start = Date.now();
      const response = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(message)
      });
      const duration = Date.now() - start;
      this.logger(`Response Status: ${response.status} (${duration}ms)`);

      if (!response.ok) {
        const text = await response.text();
        this.logger(`HTTP Error Body: ${text}`);
        // Check if the error body is actually a valid JSON-RPC response.
        // The Stitch API sometimes returns 403/4xx errors with a JSON-RPC body containing the error details.
        // We should forward these to the client instead of throwing a transport error.
        try {
          const errorJson = JSON.parse(text);
          if (errorJson.jsonrpc === '2.0' && (errorJson.result || errorJson.error)) {
            this.logger('Forwarding error response as valid JSON-RPC');
            if (this.onmessage) {
              this.onmessage(errorJson as JSONRPCMessage);
            }
            return;
          }
        } catch (e) {
          // Not JSON or not JSON-RPC, throw as transport error
        }
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const text = await response.text();
      this.logger(`Response Length: ${text.length}`);

      if (!text) {
        this.logger('Empty response body received');
        return;
      }

      const data = JSON.parse(text) as JSONRPCMessage;
      if (this.onmessage) {
        const respId = (data as any).id || 'notification';
        this.logger(`Forwarding response ID: ${respId} to local transport`);
        this.onmessage(data);
      }
    } catch (error) {
      this.logger(`Transport send error: ${error}`);
      if (this.onerror) {
        this.onerror(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
}

export class ProxyHandler implements ProxyService {
  private currentToken: string | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private pendingToolListIds = new Set<string | number>();

  constructor(
    private gcloud: GcloudHandler = new GcloudHandler(),
    private transportFactory: () => StdioServerTransport = () => new StdioServerTransport()
  ) { }

  async start(input: StartProxyInput): Promise<ProxyResult> {
    // Setup logger based on debug flag
    const log: Logger = (message: string) => {
      if (input.debug) {
        try {
          appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
        } catch (e) {
          // ignore
        }
      }
    };

    if (input.debug) {
      log(`Starting ProxyHandler with debug logging enabled (File: ${LOG_FILE})`);
    }

    try {
      dotenv.config();
      const apiKey = process.env.STITCH_API_KEY;
      let authConfig: AuthConfig;

      if (apiKey) {
        log('Found STITCH_API_KEY in environment, using API Key authentication');
        authConfig = { type: 'apiKey', key: apiKey };
      } else {
        // Initial Token Fetch
        await this.refreshToken();
        if (!this.currentToken) {
          log('Failed to get initial token');
          return {
            success: false,
            error: {
              code: 'AUTH_REFRESH_FAILED',
              message: 'Failed to retrieve initial access token',
              suggestion: 'Run "stitch-mcp init" to authenticate first',
              recoverable: false,
            },
          };
        }

        // Get Project ID
        const projectId = await this.gcloud.getProjectId();
        log(`Using Project ID: ${projectId}`);

        // Start Refresh Timer
        this.startRefreshTimer();

        authConfig = {
          type: 'bearer',
          token: this.currentToken,
          projectId: projectId ?? undefined
        };
      }

      // Setup Remote Transport (HTTP POST)
      const stitchUrl = process.env.STITCH_HOST || 'https://stitch.googleapis.com/mcp';
      log(`Connecting to ${stitchUrl}`);
      const remoteTransport = new HttpPostTransport(stitchUrl, authConfig, log);

      // Initialize Local Transport
      if (input.transport !== 'stdio') {
        throw new Error('Only stdio transport is supported for proxy mode currently');
      }
      const localTransport = this.transportFactory();

      // Bridge Transports

      // Local -> Remote
      localTransport.onmessage = async (message) => {
        // log(`Local -> Remote: ${(message as any).method || 'response'}`);
        try {
          await remoteTransport.send(message);
        } catch (e) {
          log(`Request handling error: ${e}`);
        }
      };

      // Remote -> Local
      remoteTransport.onmessage = async (message) => {
        // log(`Remote -> Local: ${(message as any).method || 'response'}`);
        try {
          await localTransport.send(message);
        } catch (e) {
          log(`Response handling error: ${e}`);
        }
      };

      remoteTransport.onerror = (error) => {
        log(`Remote transport error: ${error}`);
      };

      // Start transports
      await remoteTransport.start();
      await localTransport.start();

      log('Access token retrieved and bridge established. Ready.');

      // Keep alive
      await new Promise((resolve) => {
        process.on('SIGINT', resolve);
        process.on('SIGTERM', resolve);

        // Handle close events if transports expose them
        localTransport.onclose = () => {
          log('Local connection closed');
          resolve(undefined);
        };
      });

      this.stopRefreshTimer();
      log('Proxy stopped');

      return {
        success: true,
        data: {
          status: 'stopped',
        },
      };

    } catch (error) {
      this.stopRefreshTimer();
      log(`Startup failed: ${error}`);
      console.error('[Proxy] Startup failed:', error); // Keep console.error for critical startup failures
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  private async refreshToken(): Promise<void> {
    const token = await this.gcloud.getAccessToken();
    if (token) {
      this.currentToken = token;
      // Ideally we should reconnect or update headers here if possible
    } else {
      console.error('Failed to refresh access token');
    }
  }

  private startRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.refreshTimer = setInterval(() => {
      this.refreshToken().catch(err => console.error('Error in refresh timer:', err));
    }, REFRESH_INTERVAL_MS);
  }

  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
