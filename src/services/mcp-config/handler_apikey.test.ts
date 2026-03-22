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

  it('should generate Claude Code STDIO instructions with API key', async () => {
    const input = {
      client: 'claude-code' as const,
      projectId: 'test-project',
      accessToken: 'ignored',
      transport: 'stdio' as const,
      apiKey: 'test-api-key',
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instructions).toContain('-e STITCH_API_KEY=test-api-key');
      expect(result.data.instructions).not.toContain('STITCH_PROJECT_ID');
    }
  });

  it('should generate Antigravity configuration with API key', async () => {
    const input = {
      client: 'antigravity' as const,
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
    }
  });

  it('should generate OpenCode HTTP configuration with API key', async () => {
    const input = {
      client: 'opencode' as const,
      projectId: 'test-project',
      accessToken: 'ignored',
      transport: 'http' as const,
      apiKey: 'test-api-key',
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      const config = JSON.parse(result.data.config);
      expect(config.mcp.stitch.headers['X-Goog-Api-Key']).toBe('test-api-key');
      expect(config.mcp.stitch.headers.Authorization).toBeUndefined();
    }
  });

  it('should generate OpenCode STDIO configuration with API key', async () => {
    const input = {
      client: 'opencode' as const,
      projectId: 'test-project',
      accessToken: 'ignored',
      transport: 'stdio' as const,
      apiKey: 'test-api-key',
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      const config = JSON.parse(result.data.config);
      expect(config.mcp.stitch.environment.STITCH_API_KEY).toBe('test-api-key');
      expect(config.mcp.stitch.environment.STITCH_PROJECT_ID).toBeUndefined();
    }
  });

  it('should generate Codex CLI HTTP configuration with API key', async () => {
    const input = {
      client: 'codex' as const,
      projectId: 'test-project',
      accessToken: 'ignored',
      transport: 'http' as const,
      apiKey: 'test-api-key',
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instructions).toContain('X-Goog-Api-Key = "test-api-key"');
      expect(result.data.instructions).not.toContain('STITCH_ACCESS_TOKEN');
    }
  });

  it('should generate Codex CLI STDIO configuration with API key', async () => {
    const input = {
      client: 'codex' as const,
      projectId: 'test-project',
      accessToken: 'ignored',
      transport: 'stdio' as const,
      apiKey: 'test-api-key',
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instructions).toContain('STITCH_API_KEY = "test-api-key"');
      expect(result.data.instructions).not.toContain('STITCH_PROJECT_ID');
    }
  });

  it('should generate STDIO configuration with API key for JSON-based clients', async () => {
    const jsonBasedClients = ['cursor', 'antigravity', 'vscode'] as const;

    for (const client of jsonBasedClients) {
      const input = {
        client,
        projectId: 'test-project',
        accessToken: 'ignored',
        transport: 'stdio' as const,
        apiKey: 'test-api-key',
      };

      const result = await handler.generateConfig(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const config = JSON.parse(result.data.config);
        const serverConfig = client === 'vscode' ? config.servers.stitch : config.mcpServers.stitch;
        expect(serverConfig.env.STITCH_API_KEY).toBe('test-api-key');
        expect(serverConfig.env.STITCH_PROJECT_ID).toBeUndefined();
      }
    }
  });
});
