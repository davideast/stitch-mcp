import { describe, test, expect } from 'bun:test';
import { LogExecuteToolStep } from './LogExecuteToolStep.js';
import type { CaptureInput, CaptureResult, CaptureSpec } from '../../../lib/log/capture/spec.js';
import type { ToolContext } from '../context.js';

class RecordingCapture implements CaptureSpec {
  inputs: CaptureInput[] = [];
  async capture(input: CaptureInput): Promise<CaptureResult> {
    this.inputs.push(input);
    return { success: true, data: { trace_id: 't', produced_screen_ids: [], warnings: [] } };
  }
}

function makeContext(opts: {
  toolName: string;
  parsedArgs: Record<string, any>;
  rawResult?: any;
  rawThrows?: Error;
  isConnected?: boolean;
}): ToolContext {
  // Build a fake StitchToolClient-shaped object whose private `client` calls our stub.
  const inner = {
    callTool: async () => {
      if (opts.rawThrows) throw opts.rawThrows;
      return opts.rawResult;
    },
  };
  const fakeStitchClient: any = {
    isConnected: opts.isConnected ?? true,
    connect: async () => { fakeStitchClient.isConnected = true; },
    client: inner,
    callTool: async () => { throw new Error('should not be called by LogExecuteToolStep'); },
    listTools: async () => ({ tools: [] }),
    close: async () => {},
  };
  return {
    input: { toolName: opts.toolName, output: 'json', showSchema: false },
    client: fakeStitchClient,
    stitch: {} as any,
    virtualTools: [],
    parsedArgs: opts.parsedArgs,
  } as unknown as ToolContext;
}

describe('LogExecuteToolStep', () => {
  test('makes the raw call, captures the envelope, and sets context.result from structuredContent', async () => {
    const cap = new RecordingCapture();
    const step = new LogExecuteToolStep(cap);
    const raw = { structuredContent: { hello: 'world', sessionId: 'sess1' } };
    const ctx = makeContext({ toolName: 'list_projects', parsedArgs: {}, rawResult: raw });

    const r = await step.run(ctx);
    expect(r.success).toBe(true);
    expect(cap.inputs).toHaveLength(1);
    expect(cap.inputs[0]!.tool).toBe('list_projects');
    expect(cap.inputs[0]!.result).toEqual(raw);
    expect(typeof cap.inputs[0]!.duration_ms).toBe('number');
    expect(ctx.result).toEqual({ success: true, data: { hello: 'world', sessionId: 'sess1' } });
  });

  test('on isError envelope: sets context.result.success=false and still captures', async () => {
    const cap = new RecordingCapture();
    const step = new LogExecuteToolStep(cap);
    const raw = { isError: true, content: [{ type: 'text', text: 'Requested entity was not found.' }] };
    const ctx = makeContext({ toolName: 'get_screen', parsedArgs: { projectId: '0', screenId: 'x' }, rawResult: raw });

    const r = await step.run(ctx);
    expect(r.success).toBe(true);
    expect(ctx.result).toMatchObject({ success: false });
    if (ctx.result?.success) throw new Error();
    expect(ctx.result?.error).toContain('Requested entity was not found.');
    expect(cap.inputs).toHaveLength(1);
  });

  test('connect() is called when not yet connected', async () => {
    const cap = new RecordingCapture();
    const step = new LogExecuteToolStep(cap);
    const raw = { structuredContent: { ok: true } };
    const ctx = makeContext({ toolName: 'list_projects', parsedArgs: {}, rawResult: raw, isConnected: false });

    expect((ctx.client as any).isConnected).toBe(false);
    await step.run(ctx);
    expect((ctx.client as any).isConnected).toBe(true);
  });

  test('virtual tools bypass capture and use the original execute path', async () => {
    const cap = new RecordingCapture();
    const step = new LogExecuteToolStep(cap);
    const ctx = makeContext({ toolName: 'list-tools-virtual', parsedArgs: {} });
    (ctx as any).virtualTools = [{
      name: 'list-tools-virtual',
      description: '',
      execute: async () => ({ stub: true }),
    }];

    const r = await step.run(ctx);
    expect(r.success).toBe(true);
    expect(ctx.result).toEqual({ success: true, data: { stub: true } });
    expect(cap.inputs).toHaveLength(0); // no capture for virtual tools
  });

  test('parseToolResponse fallback: parses content[0].text as JSON', async () => {
    const cap = new RecordingCapture();
    const step = new LogExecuteToolStep(cap);
    const raw = { content: [{ type: 'text', text: '{"a":1}' }] };
    const ctx = makeContext({ toolName: 'list_projects', parsedArgs: {}, rawResult: raw });

    await step.run(ctx);
    expect(ctx.result).toEqual({ success: true, data: { a: 1 } });
    expect(cap.inputs).toHaveLength(1);
  });

  test('underlying call throws → step returns failure AND still captures as isError envelope', async () => {
    const cap = new RecordingCapture();
    const step = new LogExecuteToolStep(cap);
    const ctx = makeContext({ toolName: 'list_projects', parsedArgs: {}, rawThrows: new Error('boom') });

    const r = await step.run(ctx);
    expect(r.success).toBe(false);
    expect(ctx.result).toMatchObject({ success: false, error: 'boom' });

    // Per Bug #2: transport-level throws must still capture so we don't lose the attempt.
    expect(cap.inputs).toHaveLength(1);
    const passed = cap.inputs[0]!;
    expect(passed.tool).toBe('list_projects');
    expect((passed.result as any).isError).toBe(true);
    expect((passed.result as any).content[0].text).toBe('boom');
  });
});
