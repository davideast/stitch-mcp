import { describe, it, expect } from 'bun:test';
import { McpConfigHandler } from './handler';
import type { McpClient } from './spec';

describe('McpConfigHandler', () => {
  const handler = new McpConfigHandler();

  const clients: McpClient[] = ['antigravity', 'vscode', 'cursor', 'claude-code', 'gemini-cli'];

  const clientDisplayNames: Record<McpClient, string> = {
    antigravity: 'Antigravity',
    vscode: 'VSCode',
    cursor: 'Cursor',
    'claude-code': 'Claude Code',
    'gemini-cli': 'Gemini CLI',
  };

  it('should generate a valid HTTP configuration for all clients', async () => {
    for (const client of clients) {
      const input = {
        client,
        projectId: 'test-project',
        accessToken: 'test-token',
        transport: 'http' as const,
      };

      const result = await handler.generateConfig(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const config = JSON.parse(result.data.config);
        expect(config.mcpServers.stitch.type).toBe('http');
        expect(config.mcpServers.stitch.headers.Authorization).toBe('Bearer test-token');
        expect(config.mcpServers.stitch.headers['X-Goog-User-Project']).toBe('test-project');
        expect(result.data.instructions).toContain(clientDisplayNames[client]);
      }
    }
  });

  it('should generate a valid STDIO configuration for all clients', async () => {
    for (const client of clients) {
      const input = {
        client,
        projectId: 'test-project',
        accessToken: 'test-token',
        transport: 'stdio' as const,
      };

      const result = await handler.generateConfig(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const config = JSON.parse(result.data.config);
        expect(config.mcpServers.stitch.command).toBe('npx');
        expect(config.mcpServers.stitch.args).toEqual(['@_davideast/stitch-mcp', 'proxy']);
        expect(config.mcpServers.stitch.env.STITCH_PROJECT_ID).toBe('test-project');
        expect(result.data.instructions).toContain(clientDisplayNames[client]);
        expect(result.data.instructions).toContain('proxy server'); // Should mention proxy
      }
    }
  });

  it('should return an error if config generation fails', async () => {
    const originalStringify = JSON.stringify;
    JSON.stringify = () => {
      throw new Error('Test error');
    };

    const input = {
      client: 'vscode' as McpClient,
      projectId: 'test-project',
      accessToken: 'test-token',
      transport: 'http' as const,
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFIG_GENERATION_FAILED');
      expect(result.error.message).toBe('Test error');
    }

    JSON.stringify = originalStringify;
  });
});
