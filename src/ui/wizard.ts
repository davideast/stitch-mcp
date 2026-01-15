import { select, input, confirm } from '@inquirer/prompts';

export type McpClient = 'antigravity' | 'vscode' | 'cursor' | 'claude-code' | 'gemini-cli';

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
    ],
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
