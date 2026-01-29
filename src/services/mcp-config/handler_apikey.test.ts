import { describe, it, expect } from 'bun:test';
import { McpConfigHandler } from './handler';

describe('McpConfigHandler (API Key)', () => {
  const handler = new McpConfigHandler();

  it('should generate Cursor configuration with API key', async () => {
    const input = {
      client: 'cursor' as const,
      projectId: 'test-project',
      accessToken: 'ignored',
      transport: 'http' as const,
      apiKey: 'test-api-key',
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      const config = JSON.parse(result.data.config);
      expect(config.mcpServers.stitch.headers['X-Goog-Api-Key']).toBe('test-api-key');
      expect(config.mcpServers.stitch.headers.Authorization).toBeUndefined();
      expect(config.mcpServers.stitch.headers['X-Goog-User-Project']).toBeUndefined();
    }
  });

  it('should generate VSCode configuration with API key', async () => {
    const input = {
      client: 'vscode' as const,
      projectId: 'test-project',
      accessToken: 'ignored',
      transport: 'http' as const,
      apiKey: 'test-api-key',
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      const config = JSON.parse(result.data.config);
      // VSCode with API key does NOT have inputs
      expect(config.inputs).toBeUndefined();
      expect(config.servers.stitch.headers['X-Goog-Api-Key']).toBe('test-api-key');
      expect(config.servers.stitch.headers.Authorization).toBeUndefined();
    }
  });

  it('should generate Claude Code instructions with API key', async () => {
    const input = {
      client: 'claude-code' as const,
      projectId: 'test-project',
      accessToken: 'ignored',
      transport: 'http' as const,
      apiKey: 'test-api-key',
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instructions).toContain('--header "X-Goog-Api-Key: test-api-key"');
      expect(result.data.instructions).not.toContain('Authorization');
    }
  });
});
