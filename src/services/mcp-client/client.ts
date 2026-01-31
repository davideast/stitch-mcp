import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ReadResourceResultSchema, ListResourcesResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";
import { StitchConfigSchema, type StitchConfig, type StitchMCPClientSpec } from './spec.js';

/**
 * A robust, authenticated driver for the Stitch MCP Server.
 * Handles auth injection, retries, and transport negotiation.
 */
export class StitchMCPClient implements StitchMCPClientSpec {
  name: 'stitch-mcp-client' = 'stitch-mcp-client';
  description: 'Authenticated driver for Stitch MCP Server' = 'Authenticated driver for Stitch MCP Server';

  private client: Client;
  private transport: StreamableHTTPClientTransport | null = null;
  private config: StitchConfig;
  private isConnected: boolean = false;

  constructor(inputConfig?: Partial<StitchConfig>) {
    const rawConfig = {
      accessToken: inputConfig?.accessToken || process.env.STITCH_ACCESS_TOKEN,
      apiKey: inputConfig?.apiKey || process.env.STITCH_API_KEY,
      projectId: inputConfig?.projectId || process.env.GOOGLE_CLOUD_PROJECT,
      baseUrl: inputConfig?.baseUrl,
      timeout: inputConfig?.timeout,
    };
    this.config = StitchConfigSchema.parse(rawConfig);

    this.client = new Client(
      { name: "stitch-core-client", version: "1.0.0" },
      { capabilities: {} }
    );
  }

  /**
   * Auto-refreshes the Google Access Token via CLI if available.
   */
  private refreshGcloudToken(): string {
    try {
      // Try Application Default Credentials first
      const token = execSync("gcloud auth application-default print-access-token", { encoding: 'utf8' }).trim();
      if (token && !token.includes("ERROR")) return token;
      throw new Error("ADC token empty");
    } catch {
      try {
        // Fallback to User Credentials
        return execSync("gcloud auth print-access-token", { encoding: 'utf8' }).trim();
      } catch (e) {
        throw new Error("Could not refresh token via gcloud. Please check your authentication.");
      }
    }
  }

  /**
   * Validates the token against Google's tokeninfo endpoint.
   */
  private async validateToken() {
    if (!this.config.accessToken) {
         try {
            const newToken = this.refreshGcloudToken();
            this.config.accessToken = newToken;
         } catch (error) {
             // If we can't get a token, we might rely on API Key if present, but here we are in the "no api key" branch likely.
             // If both are missing, we'll fail later.
             return;
         }
    }

    const checkUrl = `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(this.config.accessToken!)}`;
    let response = await fetch(checkUrl);

    if (!response.ok) {
      // console.warn("⚠️ Initial token validation failed. Attempting refresh...");
      try {
        const newToken = this.refreshGcloudToken();
        this.config.accessToken = newToken;
        // Re-validate
        response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(newToken)}`);
        if (!response.ok) throw new Error("Refreshed token is invalid.");
      } catch (error) {
        throw new Error(`Authentication Failed: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Monkey-patches global fetch to ensure headers are ALWAYS present.
   * This fixes issues where SDK layers might drop headers on redirects or retries.
   */
  private installNetworkInterceptor() {
    const originalFetch = globalThis.fetch;
    if ((originalFetch as any).__stitchPatched) return;

    globalThis.fetch = (async (input: any, init?: RequestInit) => {
      let url = input.toString();
      if (input instanceof Request) url = input.url;

      // Only intercept Stitch calls
      if (url.startsWith(this.config.baseUrl)) {
        const newHeaders = new Headers(init?.headers);

        if (this.config.apiKey) {
          newHeaders.set("X-Goog-Api-Key", this.config.apiKey);
          // No X-Goog-User-Project for API key auth
        } else {
          if (this.config.accessToken) {
             newHeaders.set("Authorization", `Bearer ${this.config.accessToken}`);
          }
          if (this.config.projectId) {
             newHeaders.set("X-Goog-User-Project", this.config.projectId);
          }
        }

        newHeaders.set("Accept", "application/json, text/event-stream");

        // Ensure Content-Type for POST
        if (!newHeaders.has("Content-Type") && (init?.method === "POST" || (input instanceof Request && input.method === "POST"))) {
          newHeaders.set("Content-Type", "application/json");
        }

        const newInit: RequestInit = { ...init, headers: newHeaders };

        // Preserve method if it was in the Request object but not in init
        if (input instanceof Request && !newInit.method) {
            newInit.method = input.method;
        }

        return originalFetch(url, newInit);
      }
      return originalFetch(input, init);
    }) as any;
    (globalThis.fetch as any).__stitchPatched = true;
  }

  async connect() {
    if (this.isConnected) return;

    if (!this.config.apiKey) {
      await this.validateToken(); // OAuth only
    }
    this.installNetworkInterceptor();

    // Transport gets the URL; headers are handled by interceptor
    this.transport = new StreamableHTTPClientTransport(new URL(this.config.baseUrl));

    this.transport.onerror = (err) => {
      console.error("Stitch Transport Error:", err);
      this.isConnected = false;
    };

    await this.client.connect(this.transport);
    this.isConnected = true;
  }

  /**
   * Generic tool caller with type support and error parsing.
   */
  async callTool<T>(name: string, args: Record<string, any>): Promise<T> {
    if (!this.isConnected) await this.connect();

    const result = await this.client.callTool(
      { name, arguments: args },
      undefined,
      { timeout: this.config.timeout }
    );

    if (result.isError) {
      const errorText = (result.content as any[]).map(c => (c.type === 'text' ? c.text : '')).join('');
      throw new Error(`Tool Call Failed [${name}]: ${errorText}`);
    }

    // Stitch specific parsing: Check structuredContent first, then JSON in text
    const anyResult = result as any;
    if (anyResult.structuredContent) return anyResult.structuredContent as T;

    const textContent = (result.content as any[]).find((c: any) => c.type === 'text');
    if (textContent && textContent.type === 'text') {
      try {
        return JSON.parse(textContent.text) as T;
      } catch {
        return textContent.text as unknown as T;
      }
    }

    return anyResult as T;
  }

  async readResource(uri: string): Promise<any> {
    if (!this.isConnected) await this.connect();
    const result = await this.client.request(
      { method: "resources/read", params: { uri } },
      ReadResourceResultSchema
    );
    return result;
  }

  async listResources(): Promise<any> {
    if (!this.isConnected) await this.connect();
    const result = await this.client.request(
      { method: "resources/list" },
      ListResourcesResultSchema
    );
    return result;
  }

  async getCapabilities() {
    if (!this.isConnected) await this.connect();
    return this.client.listTools();
  }

  async close() {
    if (this.transport) {
      await this.transport.close();
      this.isConnected = false;
    }
  }
}
