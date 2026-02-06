import type { McpClient } from '../ui/wizard.js';

export interface UserInterface {
  promptMcpClient(): Promise<McpClient>;
  promptAuthMode(): Promise<'apiKey' | 'oauth'>;
  promptTransportType(authMode?: 'apiKey' | 'oauth'): Promise<'http' | 'stdio'>;
  promptApiKeyStorage(): Promise<'config' | 'skip' | '.env'>;
  promptApiKey(): Promise<string>;
  promptConfirm(message: string, defaultYes?: boolean): Promise<boolean>;
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
}
