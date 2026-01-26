import { describe, it, expect } from 'bun:test';
import { GenerateConfigInputSchema } from './spec';

describe('McpConfig Service Spec', () => {
  describe('GenerateConfigInputSchema', () => {
    it.each(['vscode', 'codex'])('should validate a %s client input', (client) => {
      const input = {
        client,
        projectId: 'test-project',
        accessToken: 'test-token',
      };
      const result = GenerateConfigInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate opencode as a valid client', () => {
      const input = {
        client: 'opencode',
        projectId: 'test-project',
        accessToken: 'test-token',
      };
      const result = GenerateConfigInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should invalidate an input with an invalid client', () => {
      const input = {
        client: 'invalid-client',
        projectId: 'test-project',
        accessToken: 'test-token',
      };
      const result = GenerateConfigInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should invalidate an input with a missing projectId', () => {
      const input = {
        client: 'vscode',
        accessToken: 'test-token',
      };
      const result = GenerateConfigInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should invalidate an input with a missing accessToken', () => {
      const input = {
        client: 'vscode',
        projectId: 'test-project',
      };
      const result = GenerateConfigInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should invalidate an input with an empty projectId', () => {
      const input = {
        client: 'vscode',
        projectId: '',
        accessToken: 'test-token',
      };
      const result = GenerateConfigInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should invalidate an input with an empty accessToken', () => {
      const input = {
        client: 'vscode',
        projectId: 'test-project',
        accessToken: '',
      };
      const result = GenerateConfigInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should default transport to http when not provided', () => {
      const input = {
        client: 'vscode',
        projectId: 'test-project',
        accessToken: 'test-token',
      };
      const result = GenerateConfigInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transport).toBe('http');
      }
    });

    it('should accept http as transport', () => {
      const input = {
        client: 'vscode',
        projectId: 'test-project',
        accessToken: 'test-token',
        transport: 'http',
      };
      const result = GenerateConfigInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transport).toBe('http');
      }
    });

    it('should accept stdio as transport', () => {
      const input = {
        client: 'vscode',
        projectId: 'test-project',
        accessToken: 'test-token',
        transport: 'stdio',
      };
      const result = GenerateConfigInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transport).toBe('stdio');
      }
    });

    it('should invalidate an input with an invalid transport', () => {
      const input = {
        client: 'vscode',
        projectId: 'test-project',
        accessToken: 'test-token',
        transport: 'websocket',
      };
      const result = GenerateConfigInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
