import { type McpConfigService, type GenerateConfigInput, type McpConfigResult, type McpClient } from './spec.js';
import { theme } from '../../ui/theme.js';

export class McpConfigHandler implements McpConfigService {
  async generateConfig(input: GenerateConfigInput): Promise<McpConfigResult> {
    try {
      const config = input.transport === 'http'
        ? this.generateHttpConfig(input)
        : this.generateStdioConfig(input);

      // Command-based clients return null
      const configString = config ? JSON.stringify(config, null, 2) : '';
      const instructions = this.getInstructionsForClient(
        input.client,
        configString,
        input.transport,
        input.projectId
      );

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

  private generateHttpConfig(input: GenerateConfigInput) {
    switch (input.client) {
      case 'cursor':
        return this.generateCursorConfig(input.projectId);
      case 'antigravity':
        return this.generateAntigravityConfig(input.projectId);
      case 'vscode':
        return this.generateVSCodeConfig(input.projectId);
      case 'claude-code':
        return this.generateClaudeCodeConfig();
      case 'gemini-cli':
        return this.generateGeminiCliConfig();
      case 'codex':
        return null;
    }
  }

  private generateCursorConfig(projectId: string) {
    return {
      mcpServers: {
        stitch: {
          url: 'https://stitch.googleapis.com/mcp',
          headers: {
            Authorization: 'Bearer <YOUR_ACCESS_TOKEN>',
            'X-Goog-User-Project': projectId,
          },
        },
      },
    };
  }

  private generateAntigravityConfig(projectId: string) {
    return {
      mcpServers: {
        stitch: {
          serverUrl: 'https://stitch.googleapis.com/mcp',
          headers: {
            Authorization: 'Bearer <YOUR_ACCESS_TOKEN>',
            'X-Goog-User-Project': projectId,
          },
        },
      },
    };
  }

  private generateVSCodeConfig(projectId: string) {
    return {
      inputs: [
        {
          type: 'promptString',
          id: 'stitch-access-token',
          description: 'Google Cloud Access Token (run: gcloud auth print-access-token)',
          password: true,
        },
      ],
      servers: {
        stitch: {
          type: 'http',
          url: 'https://stitch.googleapis.com/mcp',
          headers: {
            'Authorization': 'Bearer ${input:stitch-access-token}',
            'X-Goog-User-Project': projectId,
          },
        },
      },
    };
  }

  private generateClaudeCodeConfig() {
    // Claude Code uses CLI command, not JSON config
    return null;
  }

  private generateGeminiCliConfig() {
    // Gemini CLI uses extension install command, not JSON config
    return null;
  }

  private generateStdioConfig(input: GenerateConfigInput) {
    // Command-based clients use CLI commands, not JSON config
    if (input.client === 'claude-code' || input.client === 'gemini-cli' || input.client === 'codex') {
      return null;
    }

    // VS Code uses different format
    if (input.client === 'vscode') {
      return {
        servers: {
          stitch: {
            type: 'stdio',
            command: 'npx',
            args: ['@_davideast/stitch-mcp', 'proxy'],
            env: {
              STITCH_PROJECT_ID: input.projectId,
            },
          },
        },
      };
    }

    // Other clients (Cursor, Antigravity, etc.) use mcpServers format
    return {
      mcpServers: {
        stitch: {
          command: 'npx',
          args: ['@_davideast/stitch-mcp', 'proxy'],
          env: {
            STITCH_PROJECT_ID: input.projectId,
          },
        },
      },
    };
  }

  private getInstructionsForClient(
    client: McpClient,
    config: string,
    transport: 'http' | 'stdio',
    projectId: string
  ): string {
    const baseInstructions = `\n${theme.blue('MCP Configuration Generated')}\n\n${config}\n`;

    const transportNote = transport === 'stdio'
      ? `\n${theme.yellow('Note:')} This uses the proxy server. Keep it running with:\n  npx @_davideast/stitch-mcp proxy\n`
      : '';

    const tokenHint = transport === 'http'
      ? `\n${theme.yellow('To get your access token, run:')}\n` +
        `  CLOUDSDK_CONFIG=~/.stitch-mcp/config ~/.stitch-mcp/google-cloud-sdk/bin/gcloud auth print-access-token\n` +
        `\n${theme.yellow('Important:')} Replace ${theme.blue('<YOUR_ACCESS_TOKEN>')} in the config with the token from the command above.\n` +
        `Access tokens expire after 1 hour. Consider using ${theme.blue('stdio')} transport for automatic refresh.\n`
      : '';

    switch (client) {
      case 'antigravity':
        if (transport === 'stdio') {
          return (
            baseInstructions +
            transportNote +
            `\n${theme.green('Next Steps for Antigravity:')}\n` +
            `1. In the Agent Panel, click the three dots in the top right\n` +
            `2. Select "MCP Servers" → "Manage MCP Servers"\n` +
            `3. Select "View raw config" and add the above configuration\n` +
            `4. Restart Antigravity to load the configuration\n`
          );
        }
        return (
          baseInstructions +
          tokenHint +
          `\n${theme.green('Next Steps for Antigravity:')}\n` +
          `1. In the Agent Panel, click the three dots in the top right\n` +
          `2. Select "MCP Servers" → "Manage MCP Servers"\n` +
          `3. Select "View raw config" and add the above configuration\n` +
          `4. Restart Antigravity to load the configuration\n`
        );

      case 'vscode':
        if (transport === 'stdio') {
          return (
            baseInstructions +
            `\n${theme.green('Next Steps for VSCode:')}\n` +
            `1. Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)\n` +
            `2. Run "MCP: Open User Configuration" or "MCP: Open Workspace Folder Configuration"\n` +
            `3. Add the above configuration to the mcp.json file\n` +
            `4. VS Code will automatically start the proxy server when needed\n`
          );
        }
        return (
          baseInstructions +
          tokenHint +
          `\n${theme.green('Next Steps for VSCode:')}\n` +
          `1. Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)\n` +
          `2. Run "MCP: Open User Configuration" or "MCP: Open Workspace Folder Configuration"\n` +
          `3. Add the above configuration to the mcp.json file\n` +
          `4. When prompted, paste the access token from the command above\n` +
          `5. Restart VS Code or run "MCP: List Servers" to start the server\n`
        );

      case 'cursor':
        if (transport === 'stdio') {
          return (
            baseInstructions +
            transportNote +
            `\n${theme.green('Next Steps for Cursor:')}\n` +
            `1. Create a .cursor/mcp.json file in your project root\n` +
            `2. Add the above configuration to the file\n` +
            `3. Restart Cursor to load the configuration\n`
          );
        }
        return (
          baseInstructions +
          tokenHint +
          `\n${theme.green('Next Steps for Cursor:')}\n` +
          `1. Create a .cursor/mcp.json file in your project root\n` +
          `2. Add the above configuration to the file\n` +
          `3. Restart Cursor to load the configuration\n`
        );

      case 'claude-code':
        if (transport === 'stdio') {
          return (
            transportNote +
            `\n${theme.green('Setup Claude Code:')}\n\n` +
            `Run the following command to add the Stitch MCP server:\n\n` +
            `${theme.blue('claude mcp add stitch \\')}\n` +
            `${theme.blue('  --command npx @_davideast/stitch-mcp proxy \\')}\n` +
            `${theme.blue('  -s user')}\n\n` +
            `${theme.yellow('Note:')} -s user saves to $HOME/.claude.json, use -s project for ./.mcp.json\n`
          );
        } else {
          return (
            tokenHint +
            `\n${theme.green('Setup Claude Code:')}\n\n` +
            `Run the following command to add the Stitch MCP server:\n\n` +
            `${theme.blue('claude mcp add stitch \\')}\n` +
            `${theme.blue('  --transport http https://stitch.googleapis.com/mcp \\')}\n` +
            `${theme.blue('  --header "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \\')}\n` +
            `${theme.blue(`  --header "X-Goog-User-Project: ${projectId}" \\`)}\n` +
            `${theme.blue('  -s user')}\n\n` +
            `${theme.yellow('Note:')} -s user saves to $HOME/.claude.json, use -s project for ./.mcp.json\n`
          );
        }

      case 'gemini-cli':
        return (
          transportNote +
          `\n${theme.green('Setup Gemini CLI:')}\n\n` +
          `Install the Stitch extension for the Gemini CLI:\n\n` +
          `${theme.blue('gemini extensions install https://github.com/gemini-cli-extensions/stitch')}\n`
        );

      case 'codex': {
        const transportWarning = transport === 'http'
          ? `${theme.yellow('Note:')} Codex CLI uses the proxy (stdio) transport. Re-run init and choose "Proxy (Recommended for Dev)".\n`
          : '';

        const configBlock = [
          '[mcp_servers.stitch]',
          'command = "npx"',
          'args = ["@_davideast/stitch-mcp", "proxy"]',
          'enabled = false',
          '',
          '[mcp_servers.stitch.env]',
          `STITCH_PROJECT_ID = "${projectId}"`,
        ].join('\n');

        return (
          transportWarning +
          `\n${theme.green('Setup Codex CLI:')}\n\n` +
          `Add this to ${theme.blue('~/.codex/config.toml')}:\n\n` +
          `${configBlock}\n` +
          transportNote +
          `\n${theme.green('Next Steps:')}\n` +
          `1. Enable per run:\n` +
          `   ${theme.blue("codex exec -c 'mcp_servers.stitch.enabled=true' \"Use the stitch MCP server\"")}\n` +
          `2. Or set ${theme.blue('enabled = true')} in the config to always enable it.\n`
        );
      }

      default:
        return baseInstructions + transportNote + `\n${theme.yellow('Add this configuration to your MCP client.')}\n`;
    }
  }
}
