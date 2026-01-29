import { select, input, confirm, password } from '@inquirer/prompts';

export type McpClient = 'antigravity' | 'vscode' | 'cursor' | 'claude-code' | 'gemini-cli' | 'codex' | 'opencode';

/**
 * Prompt user to select their MCP client
 */
export async function promptMcpClient(): Promise<McpClient> {
  return await select({
    message: 'Which MCP client are you using?',
    choices: [
      { name: 'Antigravity', value: 'antigravity' as McpClient },
      { name: 'VSCode', value: 'vscode' as McpClient },
      { name: 'Cursor', value: 'cursor' as McpClient },
      { name: 'Claude Code', value: 'claude-code' as McpClient },
      { name: 'Gemini CLI', value: 'gemini-cli' as McpClient },
      { name: 'Codex CLI', value: 'codex' as McpClient },
      { name: 'OpenCode', value: 'opencode' as McpClient },
    ],
  });
}

/**
 * Prompt user to select Authentication Mode
 */
export async function promptAuthMode(): Promise<'apiKey' | 'oauth'> {
  return await select({
    message: 'Select Authentication Mode:',
    choices: [
      {
        name: 'API Key',
        value: 'apiKey' as const,
        description: 'Persistent keys generated in the Stitch Settings page.',
      },
      {
        name: 'OAuth',
        value: 'oauth' as const,
        description: 'A browser-based authentication flow required by specific AI clients that do not support manual key entry, or for environments where storing persistent secrets on disk is restricted.',
      },
    ],
  });
}

/**
 * Prompt user to select API Key storage
 */
export async function promptApiKeyStorage(): Promise<'.env' | 'config' | 'skip'> {
  return await select({
    message: 'Where would you like to store your API Key?',
    choices: [
      {
        name: '.env file',
        value: '.env' as const,
        description: 'Use the current working directory. Append if existing, create if not.',
      },
      {
        name: 'MCP config',
        value: 'config' as const,
        description: 'Add it to the final MCP config to copy and paste.',
      },
      {
        name: 'Skip',
        value: 'skip' as const,
        description: 'Use a placeholder in the final config.',
      },
    ],
  });
}

/**
 * Prompt user to enter API Key
 */
export async function promptApiKey(): Promise<string> {
  return await password({
    message: 'Enter your Stitch API Key:',
    mask: '*',
  });
}

/**
 * Prompt user to select from a list of options
 */
export async function promptSelect<T extends string>(
  message: string,
  choices: Array<{ name: string; value: T }>
): Promise<T> {
  return await select({ message, choices });
}

/**
 * Prompt user to enter text
 */
export async function promptInput(message: string, defaultValue?: string): Promise<string> {
  return await input({ message, default: defaultValue });
}

/**
 * Prompt user for confirmation
 */
export async function promptConfirm(message: string, defaultValue = true): Promise<boolean> {
  return await confirm({ message, default: defaultValue });
}

/**
 * Prompt user to select transport type
 */
export async function promptTransportType(authMode: 'apiKey' | 'oauth' = 'oauth'): Promise<'http' | 'stdio'> {
  const isApiKey = authMode === 'apiKey';
  return await select({
    message: 'How would you like to connect to Stitch?',
    choices: [
      {
        name: 'Direct (Standard)',
        value: 'http' as const,
        description: isApiKey
          ? 'You or the IDE/CLI handles the loading of the API key.'
          : 'Standard HTTP. Production-ready. Requires manual OAuth token management.',
      },
      {
        name: 'Proxy (Recommended for Dev)',
        value: 'stdio' as const,
        description: isApiKey
          ? 'stitch-mcp will manage the loading of the API key.'
          : 'Zero-config. Uses a local bridge to auto-refresh gcloud credentials.',
      },
    ],
  });
}
