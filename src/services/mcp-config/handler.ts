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
        return this.generateCursorConfig();
      case 'antigravity':
        return this.generateAntigravityConfig();
      case 'vscode':
        return this.generateVSCodeConfig();
      case 'claude-code':
        return this.generateClaudeCodeConfig();
      case 'gemini-cli':
        return this.generateGeminiCliConfig();
      case 'codex':
        return null;
      case 'opencode':
        return this.generateOpencodeConfig();
    }
  }

  private generateCursorConfig() {
    return {
      mcpServers: {
        stitch: {
          url: 'https://stitch.googleapis.com/mcp',
          headers: {
            Authorization: 'Bearer $STITCH_ACCESS_TOKEN',
            'X-Goog-User-Project': '$GOOGLE_CLOUD_PROJECT',
          },
        },
      },
    };
  }

  private generateAntigravityConfig() {
    return {
      mcpServers: {
        stitch: {
          serverUrl: 'https://stitch.googleapis.com/mcp',
          headers: {
            Authorization: 'Bearer $STITCH_ACCESS_TOKEN',
            'X-Goog-User-Project': '$GOOGLE_CLOUD_PROJECT',
          },
        },
      },
    };
  }

  private generateVSCodeConfig() {
    return {
      servers: {
        stitch: {
          url: 'https://stitch.googleapis.com/mcp',
          type: 'http',
          headers: {
            Accept: 'application/json',
            Authorization: 'Bearer $STITCH_ACCESS_TOKEN',
            'X-Goog-User-Project': '$GOOGLE_CLOUD_PROJECT',
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

  private generateOpencodeConfig() {
    return {
      "$schema": "https://opencode.ai/config.json",
      mcp: {
        stitch: {
          type: "remote",
          url: "https://stitch.googleapis.com/mcp",
          headers: {
            Authorization: "Bearer $STITCH_ACCESS_TOKEN",
            "X-Goog-User-Project": "$GOOGLE_CLOUD_PROJECT",
          },
        },
      },
    };
  }

  private generateStdioConfig(input: GenerateConfigInput) {
    // Command-based clients use CLI commands, not JSON config
    if (input.client === 'claude-code' || input.client === 'gemini-cli' || input.client === 'codex') {
      return null;
    }

    if (input.client === 'opencode') {
      return {
        "$schema": "https://opencode.ai/config.json",
        mcp: {
          stitch: {
            type: "local",
            command: ["npx", "@_davideast/stitch-mcp", "proxy"],
            environment: {
              STITCH_PROJECT_ID: input.projectId,
            },
          },
        },
      };
    }

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

    switch (client) {
      case 'antigravity':
        return (
          baseInstructions +
          transportNote +
          `\n${theme.green('Next Steps for Antigravity:')}\n` +
          `1. In the Agent Panel, click the three dots in the top right\n` +
          `2. Select "MCP Servers" → "Manage MCP Servers"\n` +
          `3. Select "View raw config" and add the above configuration\n` +
          `4. Restart Antigravity to load the configuration\n`
        );

      case 'vscode':
        return (
          baseInstructions +
          transportNote +
          `\n${theme.green('Next Steps for VSCode:')}\n` +
          `1. Open the Command Palette (Cmd+Shift+P)\n` +
          `2. Type "MCP: Add Server" and select it\n` +
          `3. Select "HTTP" to add a remote MCP server\n` +
          `4. Enter the URL: https://stitch.googleapis.com/mcp\n` +
          `5. Set the name to "stitch" and confirm\n` +
          `6. Modify the generated mcp.json file to add the headers shown above\n`
        );

      case 'cursor':
        return (
          baseInstructions +
          transportNote +
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
            transportNote +
            `\n${theme.green('Setup Claude Code:')}\n\n` +
            `Run the following command to add the Stitch MCP server:\n\n` +
            `${theme.blue('claude mcp add stitch \\')}\n` +
            `${theme.blue('  --transport http https://stitch.googleapis.com/mcp \\')}\n` +
            `${theme.blue('  --header "Authorization: Bearer $STITCH_ACCESS_TOKEN" \\')}\n` +
            `${theme.blue('  --header "X-Goog-User-Project: $GOOGLE_CLOUD_PROJECT" \\')}\n` +
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

      case 'opencode': {
        const fileName = transport === 'http' ? 'opencode.json' : 'opencode.json';
        return (
          baseInstructions +
          transportNote +
          `\n${theme.green('Setup OpenCode:')}\n\n` +
          `1. Add the above configuration to ${theme.blue(fileName)} in your project root\n` +
          `2. If using HTTP transport, OpenCode will automatically handle OAuth when you first use the MCP server\n` +
          `3. If using STDIO transport, make sure the proxy server is running with:\n` +
          `   ${theme.blue('npx @_davideast/stitch-mcp proxy')}\n\n` +
          `${theme.gray('Note:')} You can now use Stitch tools by adding "use the stitch tool" to your prompts.\n`
        );
      }

      default:
        return baseInstructions + transportNote + `\n${theme.yellow('Add this configuration to your MCP client.')}\n`;
    }
  }
}
