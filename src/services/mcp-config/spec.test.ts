import { describe, it, expect } from 'bun:test';
import { GenerateConfigInputSchema } from './spec';

describe('McpConfig Service Spec', () => {
  describe('GenerateConfigInputSchema', () => {
    it('should validate a correct input', () => {
      const input = {
        client: 'vscode',
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
  });
});
