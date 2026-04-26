import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { installLoggingCallToolHandler } from './LoggingCallToolHandler.js';
import type { CaptureInput, CaptureResult, CaptureSpec } from '../../lib/log/capture/spec.js';

class RecordingCapture implements CaptureSpec {
  inputs: CaptureInput[] = [];
  async capture(input: CaptureInput): Promise<CaptureResult> {
    this.inputs.push(input);
    return { success: true, data: { trace_id: 't', produced_screen_ids: [], warnings: [] } };
  }
}

interface FakeProxy {
  registered: { schema: any; handler: any } | null;
  server: { server: { setRequestHandler: (schema: any, handler: any) => void } };
}

function makeFakeProxy(): FakeProxy {
  const proxy: FakeProxy = {
    registered: null,
    server: {
      server: {
        setRequestHandler: (schema: any, handler: any) => {
          proxy.registered = { schema, handler };
        },
      },
    },
  };
  return proxy;
}

let originalFetch: typeof globalThis.fetch;
beforeEach(() => { originalFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = originalFetch; });

describe('installLoggingCallToolHandler', () => {
  test('registers a handler that forwards to Stitch and captures the result', async () => {
    const cap = new RecordingCapture();
    const proxy = makeFakeProxy();
    let postedUrl = '';
    let postedHeaders: Record<string, string> = {};
    let postedBody: any = null;
    globalThis.fetch = (async (url: any, init?: any) => {
      postedUrl = String(url);
      postedHeaders = (init?.headers as any) ?? {};
      postedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: postedBody.id, result: { structuredContent: { ok: true } } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    installLoggingCallToolHandler(proxy, cap, { apiKey: 'KEY', url: 'https://stitch.test/mcp' });
    expect(proxy.registered).not.toBeNull();

    const result = await proxy.registered!.handler({ params: { name: 'list_projects', arguments: {} } });
    expect(result).toEqual({ structuredContent: { ok: true } });

    // forwarded with right headers
    expect(postedUrl).toBe('https://stitch.test/mcp');
    expect(postedHeaders['X-Goog-Api-Key']).toBe('KEY');
    expect(postedBody).toMatchObject({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'list_projects', arguments: {} } });

    // capture invoked
    expect(cap.inputs).toHaveLength(1);
    expect(cap.inputs[0]!.tool).toBe('list_projects');
    expect(cap.inputs[0]!.result).toEqual({ structuredContent: { ok: true } });
  });

  test('on Stitch HTTP error: returns isError envelope to client + captures the failure', async () => {
    const cap = new RecordingCapture();
    const proxy = makeFakeProxy();
    globalThis.fetch = (async () => new Response('upstream boom', { status: 500 })) as any;

    installLoggingCallToolHandler(proxy, cap, { apiKey: 'KEY', url: 'https://stitch.test/mcp' });
    const result = await proxy.registered!.handler({ params: { name: 'get_screen', arguments: { projectId: 'p', screenId: 's' } } });

    expect(result).toMatchObject({ isError: true });
    expect(result.content?.[0]?.text).toContain('Error calling get_screen');
    expect(cap.inputs).toHaveLength(1);
    expect((cap.inputs[0]!.result as any).isError).toBe(true);
  });

  test('on Stitch RPC-level error: same — surfaces as isError + captures', async () => {
    const cap = new RecordingCapture();
    const proxy = makeFakeProxy();
    globalThis.fetch = (async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -1, message: 'permission denied' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as any;

    installLoggingCallToolHandler(proxy, cap, { apiKey: 'KEY', url: 'https://stitch.test/mcp' });
    const result = await proxy.registered!.handler({ params: { name: 'list_projects', arguments: {} } });
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toContain('permission denied');
    expect(cap.inputs).toHaveLength(1);
  });

  test('throws if proxy.server.server.setRequestHandler is missing', () => {
    const cap = new RecordingCapture();
    expect(() => installLoggingCallToolHandler({}, cap, { apiKey: 'K', url: 'u' })).toThrow();
  });

  test('throws if no apiKey available', () => {
    const cap = new RecordingCapture();
    const proxy = makeFakeProxy();
    expect(() => installLoggingCallToolHandler(proxy, cap, { apiKey: '', url: 'u' })).toThrow(/STITCH_API_KEY/);
  });

  test('capture failure does not propagate; client still gets the result', async () => {
    const proxy = makeFakeProxy();
    globalThis.fetch = (async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: 1 } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })) as any;
    const flakey: CaptureSpec = { capture: async () => { throw new Error('flake'); } };

    installLoggingCallToolHandler(proxy, flakey, { apiKey: 'K', url: 'u' });
    const r = await proxy.registered!.handler({ params: { name: 'list_projects', arguments: {} } });
    expect(r).toEqual({ ok: 1 });
  });
});
