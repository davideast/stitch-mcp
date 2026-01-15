import { type McpConfigService, type GenerateConfigInput, type McpConfigResult, type McpClient } from './spec.js';
import { theme } from '../../ui/theme.js';

export class McpConfigHandler implements McpConfigService {
  async generateConfig(input: GenerateConfigInput): Promise<McpConfigResult> {
    try {
      const url = input.staging
        ? 'https://staging-stitch.sandbox.googleapis.com/mcp'
        : 'https://stitch.googleapis.com/mcp';

      const config = {
        mcpServers: {
          stitch: {
            type: 'http',
            url,
            headers: {
              Authorization: `Bearer ${input.accessToken}`,
              'X-Goog-User-Project': input.projectId,
            },
          },
        },
      };

      const configString = JSON.stringify(config, null, 2);
      const instructions = this.getInstructionsForClient(input.client, configString);

      return {
        success: true,
        data: {
          config: configString,
          instructions,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONFIG_GENERATION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  private getInstructionsForClient(client: McpClient, config: string): string {
    const baseInstructions = `\n${theme.blue('MCP Configuration Generated')}\n\n${config}\n`;

    switch (client) {
      case 'antigravity':
        return (
          baseInstructions +
          `\n${theme.green('Next Steps for Antigravity:')}\n` +
          `1. Open your Antigravity settings\n` +
          `2. Add the above configuration to your MCP servers section\n` +
          `3. Restart Antigravity to load the configuration\n`
        );

      case 'vscode':
        return (
          baseInstructions +
          `\n${theme.green('Next Steps for VSCode:')}\n` +
          `1. Open VSCode settings (Cmd+, or Ctrl+,)\n` +
          `2. Search for "MCP" in settings\n` +
          `3. Add the above configuration to your MCP servers\n` +
          `4. Reload VSCode window\n`
        );

      case 'cursor':
        return (
          baseInstructions +
          `\n${theme.green('Next Steps for Cursor:')}\n` +
          `1. Open Cursor settings\n` +
          `2. Navigate to MCP configuration section\n` +
          `3. Add the above configuration\n` +
          `4. Restart Cursor\n`
        );

      case 'claude-code':
        return (
          baseInstructions +
          `\n${theme.green('Next Steps for Claude Code:')}\n` +
          `1. Open your Claude Code configuration\n` +
          `2. Add the above MCP server configuration\n` +
          `3. Restart the application\n`
        );

      case 'gemini-cli':
        return (
          baseInstructions +
          `\n${theme.green('Next Steps for Gemini CLI:')}\n` +
          `1. Save the configuration to a file (e.g., ~/.config/gemini/mcp.json)\n` +
          `2. Ensure your CLI is configured to read from this location\n` +
          `3. Run your Gemini CLI with MCP support enabled\n`
        );

      default:
        return baseInstructions + `\n${theme.yellow('Add this configuration to your MCP client.')}\n`;
    }
  }
}
