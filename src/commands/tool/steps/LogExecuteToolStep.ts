import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CommandStep, StepResult } from '../../../framework/CommandStep.js';
import type { CaptureSpec } from '../../../lib/log/capture/spec.js';
import type { ToolContext } from '../context.js';

/**
 * Execute step variant that captures the raw MCP envelope before parsing.
 * Used in place of {@link ExecuteToolStep} when STITCH_MCP_LOG=1.
 *
 * Reaches through the {@link StitchToolClient} into its underlying MCP `Client`
 * so the raw {@link CallToolResult} is observable (the public callTool() throws
 * on isError, losing the envelope).
 */
export class LogExecuteToolStep implements CommandStep<ToolContext> {
  id = 'execute-tool';
  name = 'Execute tool (with capture)';

  constructor(private readonly capture: CaptureSpec) {}

  async shouldRun(context: ToolContext): Promise<boolean> {
    return context.parsedArgs !== undefined;
  }

  async run(context: ToolContext): Promise<StepResult> {
    const tool = context.input.toolName!;
    const args = context.parsedArgs!;

    // Virtual tools have no MCP envelope to capture; behave exactly as ExecuteToolStep.
    const virtualTool = context.virtualTools.find((t) => t.name === tool);
    if (virtualTool) {
      try {
        const result = await virtualTool.execute(context.client, args, context.stitch);
        context.result = { success: true, data: result };
        return { success: true };
      } catch (e: any) {
        context.result = { success: false, error: `Virtual tool execution failed: ${e.message || String(e)}` };
        return { success: false, error: e };
      }
    }

    // Ensure connected via the public surface (StitchToolClient handles auth + transport).
    const stitch = context.client as any;
    if (!stitch.isConnected) {
      await stitch.connect();
    }
    const rawClient = stitch.client; // the underlying MCP SDK Client
    if (!rawClient) {
      context.result = { success: false, error: 'logging path requires a connected StitchToolClient' };
      return { success: false };
    }

    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    let raw: any = null;
    let threw: Error | null = null;
    try {
      // Stitch generations can take minutes; the MCP SDK default (60s) is too short.
      raw = await rawClient.callTool({ name: tool, arguments: args }, CallToolResultSchema, { timeout: 600_000 });
    } catch (e: any) {
      threw = e instanceof Error ? e : new Error(String(e));
    }
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - t0;

    // Always capture — including transport-level throws — so we don't lose the attempt.
    try {
      await this.capture.capture({
        tool, args,
        result: threw
          ? { isError: true, content: [{ type: 'text', text: threw.message }] }
          : raw,
        duration_ms: durationMs,
        started_at: startedAt, finished_at: finishedAt,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error(`[stitch-mcp log] capture failed: ${msg}`);
    }

    if (threw) {
      context.result = { success: false, error: threw.message };
      return { success: false, error: threw };
    }
    context.result = parseToolResponse(raw);
    return { success: true };
  }
}

/** Mirrors {@link StitchToolClient}'s parseToolResponse for context.result shape. */
function parseToolResponse(raw: any): { success: boolean; data?: any; error?: string } {
  if (raw?.isError) {
    const errorText = (raw.content ?? [])
      .map((c: any) => (c.type === 'text' ? c.text : ''))
      .join('');
    return { success: false, error: errorText };
  }
  if (raw?.structuredContent) {
    return { success: true, data: raw.structuredContent };
  }
  const textContent = raw?.content?.find((c: any) => c.type === 'text');
  if (textContent?.text) {
    try { return { success: true, data: JSON.parse(textContent.text) }; }
    catch { return { success: true, data: textContent.text }; }
  }
  return { success: true, data: raw };
}
