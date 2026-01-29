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
        input.projectId,
        input.apiKey
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
        return this.generateCursorConfig(input.projectId, input.apiKey);
      case 'antigravity':
        return this.generateAntigravityConfig(input.projectId, input.apiKey);
      case 'vscode':
        return this.generateVSCodeConfig(input.projectId, input.apiKey);
      case 'claude-code':
        return this.generateClaudeCodeConfig();
      case 'gemini-cli':
        return this.generateGeminiCliConfig();
      case 'codex':
        return null;
      case 'opencode':
        return this.generateOpencodeConfig(input.apiKey);
    }
  }

  private generateCursorConfig(projectId: string, apiKey?: string) {
    const headers: Record<string, string> = apiKey
      ? { 'X-Goog-Api-Key': apiKey }
      : {
          Authorization: 'Bearer <YOUR_ACCESS_TOKEN>',
          'X-Goog-User-Project': projectId,
        };

    return {
      mcpServers: {
        stitch: {
          url: 'https://stitch.googleapis.com/mcp',
          headers,
        },
      },
    };
  }

  private generateAntigravityConfig(projectId: string, apiKey?: string) {
    const headers: Record<string, string> = apiKey
      ? { 'X-Goog-Api-Key': apiKey }
      : {
          Authorization: 'Bearer <YOUR_ACCESS_TOKEN>',
          'X-Goog-User-Project': projectId,
        };

    return {
      mcpServers: {
        stitch: {
          serverUrl: 'https://stitch.googleapis.com/mcp',
          headers,
        },
      },
    };
  }

  private generateVSCodeConfig(projectId: string, apiKey?: string) {
    if (apiKey) {
      return {
        servers: {
          stitch: {
            type: 'http',
            url: 'https://stitch.googleapis.com/mcp',
            headers: {
              Accept: 'application/json',
              'X-Goog-Api-Key': apiKey,
            },
          },
        },
      };
    }

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

  private generateOpencodeConfig(apiKey?: string) {
    const headers = apiKey
      ? { "X-Goog-Api-Key": apiKey }
      : {
          Authorization: "Bearer $STITCH_ACCESS_TOKEN",
          "X-Goog-User-Project": "$GOOGLE_CLOUD_PROJECT",
        };

    return {
      "$schema": "https://opencode.ai/config.json",
      mcp: {
        stitch: {
          type: "remote",
          url: "https://stitch.googleapis.com/mcp",
          headers,
        },
      },
    };
  }

  private generateStdioConfig(input: GenerateConfigInput) {
    // Command-based clients use CLI commands, not JSON config
    if (input.client === 'claude-code' || input.client === 'gemini-cli' || input.client === 'codex') {
      return null;
    }

    const env: Record<string, string> = {
      STITCH_PROJECT_ID: input.projectId,
    };

    if (input.apiKey) {
      env.STITCH_API_KEY = input.apiKey;
    }

// VS Code uses different format
    if (input.client === 'vscode') {
      return {
        servers: {
          stitch: {
            type: 'stdio',
            command: 'npx',
            args: ['@_davideast/stitch-mcp', 'proxy'],
            env,
          },
        },
      };
    }

    if (input.client === 'opencode') {
      return {
        "$schema": "https://opencode.ai/config.json",
        mcp: {
          stitch: {
            type: "local",
            command: ["npx", "@_davideast/stitch-mcp", "proxy"],
            environment: env,
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
          env,
        },
      },
    };
  }

  private getInstructionsForClient(
    client: McpClient,
    config: string,
    transport: 'http' | 'stdio',
    projectId: string,
    apiKey?: string
  ): string {
    const baseInstructions = `\n${theme.blue('MCP Configuration Generated')}\n\n${config}\n`;

    const transportNote = transport === 'stdio'
      ? `\n${theme.yellow('Note:')} This uses the proxy server. Keep it running with:\n  npx @_davideast/stitch-mcp proxy\n`
      : '';

    const tokenHint = (transport === 'http' && !apiKey)
      ? `\n${theme.yellow('To get your access token, run:')}\n` +
        `  CLOUDSDK_CONFIG=~/.stitch-mcp/config ~/.stitch-mcp/google-cloud-sdk/bin/gcloud auth print-access-token\n` +
        `\n${theme.yellow('Important:')} Replace ${theme.blue('<YOUR_ACCESS_TOKEN>')} in the config with the token from the command above.\n` +
        `Access tokens expire after 1 hour. Consider using ${theme.blue('stdio')} transport for automatic refresh.\n`
      : '';

    const vscodeTokenHint = (transport === 'http' && !apiKey)
      ? `\n${theme.yellow('To get your access token, run:')}\n` +
        `  CLOUDSDK_CONFIG=~/.stitch-mcp/config ~/.stitch-mcp/google-cloud-sdk/bin/gcloud auth print-access-token\n` +
        `\n${theme.yellow('Important:')} When prompted, paste the token from the command above.\n` +
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
          vscodeTokenHint +
          `\n${theme.green('Next Steps for VSCode:')}\n` +
          `1. Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)\n` +
          `2. Run "MCP: Open User Configuration" or "MCP: Open Workspace Folder Configuration"\n` +
          `3. Add the above configuration to the mcp.json file\n` +
          (apiKey ? '' : `4. When prompted, paste the access token from the command above\n`) +
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
            `${theme.blue('  -- npx @_davideast/stitch-mcp proxy')}`
          );
        } else {
          if (apiKey) {
             return (
              `\n${theme.green('Setup Claude Code:')}\n\n` +
              `Run the following command to add the Stitch MCP server:\n\n` +
              `${theme.blue('claude mcp add stitch \\')}\n` +
              `${theme.blue('  --transport http https://stitch.googleapis.com/mcp \\')}\n` +
              `${theme.blue(`  --header "X-Goog-Api-Key: ${apiKey}" \\`)}\n` +
              `${theme.blue('  -s user')}\n\n` +
              `${theme.yellow('Note:')} -s user saves to $HOME/.claude.json, use -s project for ./.mcp.json\n`
            );
          }
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
        const isHttp = transport === 'http';
        const configBlock = isHttp
          ? [
              '[mcp_servers.stitch]',
              'url = "https://stitch.googleapis.com/mcp"',
              'bearer_token_env_var = "STITCH_ACCESS_TOKEN"',
              '',
              '[mcp_servers.stitch.env_http_headers]',
              'X-Goog-User-Project = "GOOGLE_CLOUD_PROJECT"',
            ].join('\n')
          : [
              '[mcp_servers.stitch]',
              'command = "npx"',
              'args = ["@_davideast/stitch-mcp", "proxy"]',
              '',
              '[mcp_servers.stitch.env]',
              `STITCH_PROJECT_ID = "${projectId}"`,
            ].join('\n');

        const note = isHttp
          ? `${theme.yellow('Note:')} Direct mode requires a valid access token in ${theme.blue('STITCH_ACCESS_TOKEN')} and a project id in ${theme.blue('GOOGLE_CLOUD_PROJECT')}.\n`
          : `${theme.yellow('Note:')} Proxy mode handles token refresh automatically.\n`;

        return (
          `\n${theme.green('Setup Codex CLI:')}\n\n` +
          `Add this to ${theme.blue('~/.codex/config.toml')}:\n\n` +
          `${configBlock}\n\n` +
          note
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
