import { type UserInterface } from './UserInterface.js';
import type { McpClient } from '../ui/wizard.js';

export class MockUI implements UserInterface {
  constructor(private readonly data: Record<string, any>) {}

  async promptMcpClient(): Promise<McpClient> {
    if (!this.data.mcpClient) {
      throw new Error('MockUI: Missing data for mcpClient');
    }
    return this.data.mcpClient;
  }

  async promptAuthMode(): Promise<'apiKey' | 'oauth'> {
    if (!this.data.authMode) {
      throw new Error('MockUI: Missing data for authMode');
    }
    return this.data.authMode;
  }

  async promptTransportType(authMode?: 'apiKey' | 'oauth'): Promise<'http' | 'stdio'> {
    if (this.data.transportType) {
      return this.data.transportType;
    }
    throw new Error('MockUI: Missing data for transportType');
  }

  async promptApiKeyStorage(): Promise<'config' | 'skip' | '.env'> {
    if (!this.data.apiKeyStorage) {
      throw new Error('MockUI: Missing data for apiKeyStorage');
    }
    return this.data.apiKeyStorage;
  }

  async promptApiKey(): Promise<string> {
    if (!this.data.apiKey) {
      throw new Error('MockUI: Missing data for apiKey');
    }
    return this.data.apiKey;
  }

  async promptConfirm(message: string, defaultYes?: boolean): Promise<boolean> {
    if (typeof this.data.confirm === 'boolean') {
      return this.data.confirm;
    }
    // If specific confirm keys are provided in data, could use that too.
    // For now, default to defaultYes or false.
    return defaultYes ?? false;
  }

  log(message: string): void {
    console.log(message);
  }

  warn(message: string): void {
    console.log(`WARN: ${message}`);
  }

  error(message: string): void {
    console.error(`ERROR: ${message}`);
  }

  success(message: string): void {
    console.log(`SUCCESS: ${message}`);
  }
}
