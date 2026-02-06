import { type UserInterface } from './UserInterface.js';
import * as wizard from '../ui/wizard.js';
import { theme } from '../ui/theme.js';
import type { McpClient } from '../ui/wizard.js';

export class ConsoleUI implements UserInterface {
  async promptMcpClient(): Promise<McpClient> {
    return wizard.promptMcpClient();
  }
  async promptAuthMode(): Promise<'apiKey' | 'oauth'> {
    return wizard.promptAuthMode();
  }
  async promptTransportType(authMode?: 'apiKey' | 'oauth'): Promise<'http' | 'stdio'> {
    return wizard.promptTransportType(authMode);
  }
  async promptApiKeyStorage(): Promise<'config' | 'skip' | '.env'> {
    return wizard.promptApiKeyStorage();
  }
  async promptApiKey(): Promise<string> {
    return wizard.promptApiKey();
  }
  async promptConfirm(message: string, defaultYes?: boolean): Promise<boolean> {
    return wizard.promptConfirm(message, defaultYes);
  }
  log(message: string): void {
    console.log(message);
  }
  warn(message: string): void {
    console.log(theme.yellow(message));
  }
  error(message: string): void {
    console.error(theme.red(message));
  }
  success(message: string): void {
    console.log(theme.green(message));
  }
}
