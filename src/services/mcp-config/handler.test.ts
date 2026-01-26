import { describe, it, expect } from 'bun:test';
import { McpConfigHandler } from './handler';
import type { McpClient } from './spec';

describe('McpConfigHandler', () => {
  const handler = new McpConfigHandler();

  const clients: McpClient[] = ['antigravity', 'vscode', 'cursor', 'claude-code', 'gemini-cli', 'codex', 'opencode'];

  const clientDisplayNames: Record<McpClient, string> = {
    antigravity: 'Antigravity',
    vscode: 'VSCode',
    cursor: 'Cursor',
    'claude-code': 'Claude Code',
    'gemini-cli': 'Gemini CLI',
    codex: 'Codex CLI',
    opencode: 'OpenCode',
  };

  it('should generate Cursor configuration with correct format', async () => {
    const input = {
      client: 'cursor' as const,
      projectId: 'test-project',
      accessToken: 'test-token',
      transport: 'http' as const,
    };

    const result = await handler.generateConfig(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const config = JSON.parse(result.data.config);
        expect(config.mcpServers).toBeDefined();
        expect(config.mcpServers.stitch.url).toBe('https://stitch.googleapis.com/mcp');
        expect(config.mcpServers.stitch.headers.Authorization).toBe('Bearer <YOUR_ACCESS_TOKEN>');
        expect(config.mcpServers.stitch.headers['X-Goog-User-Project']).toBe('test-project');
        expect(config.mcpServers.stitch.type).toBeUndefined(); // Cursor doesn't use type field
        expect(result.data.instructions).toContain('Cursor');
        expect(result.data.instructions).toContain('.cursor/mcp.json');
      }
  });

  it('should generate Antigravity configuration with serverUrl', async () => {
    const input = {
      client: 'antigravity' as const,
      projectId: 'test-project',
      accessToken: 'test-token',
      transport: 'http' as const,
    };

    const result = await handler.generateConfig(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const config = JSON.parse(result.data.config);
        expect(config.mcpServers).toBeDefined();
        expect(config.mcpServers.stitch.serverUrl).toBe('https://stitch.googleapis.com/mcp'); // serverUrl not url
        expect(config.mcpServers.stitch.url).toBeUndefined();
        expect(config.mcpServers.stitch.headers.Authorization).toBe('Bearer <YOUR_ACCESS_TOKEN>');
        expect(config.mcpServers.stitch.headers['X-Goog-User-Project']).toBe('test-project');
        expect(result.data.instructions).toContain('Antigravity');
        expect(result.data.instructions).toContain('Agent Panel');
      }
  });

  it('should generate VSCode configuration with servers root key', async () => {
    const input = {
      client: 'vscode' as const,
      projectId: 'test-project',
      accessToken: 'test-token',
      transport: 'http' as const,
    };

    const result = await handler.generateConfig(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const config = JSON.parse(result.data.config);
        expect(config.inputs).toBeDefined();
        expect(config.servers).toBeDefined(); // servers not mcpServers
        expect(config.mcpServers).toBeUndefined();
        expect(config.servers.stitch.url).toBe('https://stitch.googleapis.com/mcp');
        expect(config.servers.stitch.type).toBe('http');
        expect(config.servers.stitch.headers.Authorization).toBe('Bearer ${input:stitch-access-token}');
        expect(config.servers.stitch.headers['X-Goog-User-Project']).toBe('test-project');
        expect(result.data.instructions).toContain('VSCode');
        expect(result.data.instructions).toContain('Command Palette');
      }
  });

  it('should generate Claude Code command instead of config', async () => {
    const input = {
      client: 'claude-code' as const,
      projectId: 'test-project',
      accessToken: 'test-token',
      transport: 'http' as const,
    };

    const result = await handler.generateConfig(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config).toBe(''); // No JSON config
        expect(result.data.instructions).toContain('claude mcp add');
        expect(result.data.instructions).toContain('<YOUR_ACCESS_TOKEN>');
        expect(result.data.instructions).toContain('test-project');
        expect(result.data.instructions).toContain('-s user');
      }
  });

  it('should generate Gemini CLI extension command instead of config', async () => {
    const input = {
      client: 'gemini-cli' as const,
      projectId: 'test-project',
      accessToken: 'test-token',
      transport: 'http' as const,
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config).toBe(''); // No JSON config
      expect(result.data.instructions).toContain('gemini extensions install');
      expect(result.data.instructions).toContain('github.com/gemini-cli-extensions/stitch');
    }
  });

  it.each([
    {
      transport: 'stdio' as const,
      expected: [
        'command = "npx"',
        'args = ["@_davideast/stitch-mcp", "proxy"]',
        'STITCH_PROJECT_ID = "test-project"',
        'Proxy mode handles token refresh',
      ],
    },
    {
      transport: 'http' as const,
      expected: [
        'url = "https://stitch.googleapis.com/mcp"',
        'bearer_token_env_var = "STITCH_ACCESS_TOKEN"',
        'env_http_headers',
        'X-Goog-User-Project = "GOOGLE_CLOUD_PROJECT"',
      ],
    },
  ])('should generate Codex CLI $transport config instructions instead of JSON config', async ({ transport, expected }) => {
    const input = {
      client: 'codex' as const,
      projectId: 'test-project',
      accessToken: 'test-token',
      transport,
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config).toBe('');
      expect(result.data.instructions).toContain('Codex CLI');
      expect(result.data.instructions).toContain('~/.codex/config.toml');
      for (const fragment of expected) {
        expect(result.data.instructions).toContain(fragment);
      }
    }
  });

  it('should generate OpenCode HTTP configuration with remote type', async () => {
    const input = {
      client: 'opencode' as const,
      projectId: 'test-project',
      accessToken: 'test-token',
      transport: 'http' as const,
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      const config = JSON.parse(result.data.config);
      expect(config.$schema).toBe('https://opencode.ai/config.json');
      expect(config.mcp).toBeDefined();
      expect(config.mcp.stitch.type).toBe('remote');
      expect(config.mcp.stitch.url).toBe('https://stitch.googleapis.com/mcp');
      expect(config.mcp.stitch.headers.Authorization).toBe('Bearer $STITCH_ACCESS_TOKEN');
      expect(config.mcp.stitch.headers['X-Goog-User-Project']).toBe('$GOOGLE_CLOUD_PROJECT');
      expect(result.data.instructions).toContain('OpenCode');
      expect(result.data.instructions).toContain('opencode.json');
      expect(result.data.instructions).toContain('OAuth');
    }
  });

  it('should generate OpenCode STDIO configuration with local type', async () => {
    const input = {
      client: 'opencode' as const,
      projectId: 'test-project',
      accessToken: 'test-token',
      transport: 'stdio' as const,
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      const config = JSON.parse(result.data.config);
      expect(config.$schema).toBe('https://opencode.ai/config.json');
      expect(config.mcp).toBeDefined();
      expect(config.mcp.stitch.type).toBe('local');
      expect(config.mcp.stitch.command).toEqual(['npx', '@_davideast/stitch-mcp', 'proxy']);
      expect(config.mcp.stitch.environment.STITCH_PROJECT_ID).toBe('test-project');
      expect(result.data.instructions).toContain('OpenCode');
      expect(result.data.instructions).toContain('proxy server');
    }
  });

  it('should generate Claude Code stdio command for proxy transport', async () => {
    const input = {
      client: 'claude-code' as const,
      projectId: 'test-project',
      accessToken: 'test-token',
      transport: 'stdio' as const,
    };

    const result = await handler.generateConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config).toBe(''); // No JSON config for command-based client
      expect(result.data.instructions).toContain('claude mcp add stitch');
      expect(result.data.instructions).toContain('-- npx @_davideast/stitch-mcp proxy');
      expect(result.data.instructions).not.toContain('--transport http'); // Should NOT have HTTP transport
      expect(result.data.instructions).not.toContain('Authorization'); // Should NOT have auth headers for stdio
      expect(result.data.instructions).toContain('proxy server'); // Should mention proxy
    }
  });

  it('should generate a valid STDIO configuration for JSON-based clients', async () => {
    // Skip command-based clients that don't generate JSON configs and opencode which has different structure
    const jsonBasedClients = clients.filter(c => c !== 'claude-code' && c !== 'gemini-cli' && c !== 'codex' && c !== 'opencode');

    for (const client of jsonBasedClients) {
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
          if (client === 'vscode') {
            expect(config.servers.stitch.command).toBe('npx');
            expect(config.servers.stitch.args).toEqual(['@_davideast/stitch-mcp', 'proxy']);
            expect(config.servers.stitch.env.STITCH_PROJECT_ID).toBe('test-project');
          } else {
            expect(config.mcpServers.stitch.command).toBe('npx');
            expect(config.mcpServers.stitch.args).toEqual(['@_davideast/stitch-mcp', 'proxy']);
            expect(config.mcpServers.stitch.env.STITCH_PROJECT_ID).toBe('test-project');
          }
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
