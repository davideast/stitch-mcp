import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type InitContext } from '../context.js';
import { type McpClient } from '../../../ui/wizard.js';

export class ClientSelectionStep implements CommandStep<InitContext> {
  id = 'mcp-client';
  name = 'Select MCP client';

  async shouldRun(context: InitContext): Promise<boolean> {
    return true;
  }

  async run(context: InitContext): Promise<StepResult> {
    if (context.input.client) {
      try {
        context.mcpClient = this.resolveMcpClient(context.input.client);
        return {
          success: true,
          detail: context.mcpClient,
          status: 'SKIPPED',
          reason: 'Set via --client flag'
        };
      } catch (e) {
        return {
           success: false,
           error: e instanceof Error ? e : new Error(String(e))
        };
      }
    }

    context.mcpClient = await context.ui.promptMcpClient();
    return {
      success: true,
      detail: context.mcpClient
    };
  }

  private resolveMcpClient(input: string): McpClient {
    const map: Record<string, McpClient> = {
      'antigravity': 'antigravity', 'agy': 'antigravity',
      'vscode': 'vscode', 'vsc': 'vscode',
      'cursor': 'cursor', 'cur': 'cursor',
      'claude-code': 'claude-code', 'cc': 'claude-code',
      'gemini-cli': 'gemini-cli', 'gcli': 'gemini-cli',
      'codex': 'codex', 'cdx': 'codex',
      'opencode': 'opencode', 'opc': 'opencode'
    };

    const normalized = input.trim().toLowerCase();
    const client = map[normalized];
    if (!client) {
      throw new Error(`Invalid client '${input}'. Supported: antigravity (agy), vscode (vsc), cursor (cur), claude-code (cc), gemini-cli (gcli), codex (cdx), opencode (opc)`);
    }
    return client;
  }
}
