import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CaptureSpec } from '../../lib/log/capture/spec.js';

const DEFAULT_STITCH_MCP_URL = 'https://stitch.googleapis.com/mcp';

interface ForwardOptions {
  apiKey: string;
  url: string;
}

/**
 * Replace the SDK proxy's tools/call handler with a capture-wrapped variant.
 * Must be called AFTER {@link StitchProxy.start} (which registers the original).
 */
export function installLoggingCallToolHandler(proxy: any, capture: CaptureSpec, opts?: Partial<ForwardOptions>): void {
  const apiKey = opts?.apiKey ?? process.env.STITCH_API_KEY;
  const url = opts?.url ?? process.env.STITCH_MCP_URL ?? DEFAULT_STITCH_MCP_URL;
  if (!apiKey) throw new Error('logging proxy requires STITCH_API_KEY');

  // The SDK exposes McpServer at proxy.server, whose underlying Server is at .server.
  const server = proxy?.server?.server;
  if (!server || typeof server.setRequestHandler !== 'function') {
    throw new Error('cannot install logging handler: proxy.server.server.setRequestHandler missing');
  }

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { name, arguments: args } = request.params;
    const startedAt = new Date().toISOString();
    const t0 = Date.now();

    let result: any;
    try {
      result = await forwardToStitch({ apiKey, url }, name, args ?? {});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result = { content: [{ type: 'text', text: `Error calling ${name}: ${message}` }], isError: true };
    }
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - t0;

    // best-effort capture — never propagate failures to the MCP client
    try {
      await capture.capture({
        tool: name,
        args: (args ?? {}) as Record<string, unknown>,
        result,
        duration_ms: durationMs,
        started_at: startedAt,
        finished_at: finishedAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error(`[stitch-mcp log] capture failed: ${msg}`);
    }

    return result;
  });
}

/** Minimal JSON-RPC forwarder, mirroring the SDK's private forwardToStitch. */
async function forwardToStitch(opts: ForwardOptions, name: string, args: Record<string, unknown>): Promise<any> {
  const body = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name, arguments: args },
    id: Date.now(),
  };
  const res = await globalThis.fetch(opts.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Goog-Api-Key': opts.apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Stitch API error (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`Stitch RPC error: ${json.error.message}`);
  return json.result;
}
