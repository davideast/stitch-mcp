import { describe, test, expect, beforeEach } from 'bun:test';
import { ClientSelectionStep } from '../../../../src/commands/init/steps/ClientSelectionStep.js';
import { MockUI } from '../../../../src/framework/MockUI.js';
import type { InitContext } from '../../../../src/commands/init/context.js';
import type { InitInput } from '../../../../src/commands/init/spec.js';
import type { McpClient } from '../../../../src/ui/wizard.js';

describe('ClientSelectionStep', () => {
  let step: ClientSelectionStep;
  let mockContext: InitContext;

  beforeEach(() => {
    step = new ClientSelectionStep();

    mockContext = {
      input: {} as InitInput,
      ui: new MockUI({
        mcpClient: 'cursor' as McpClient
      }),
      gcloudService: {} as any,
      mcpConfigService: {} as any,
      projectService: {} as any,
      stitchService: {} as any,
    };
  });

  describe('shouldRun', () => {
    test('should always return true', async () => {
      const result = await step.shouldRun(mockContext);
      expect(result).toBe(true);
    });
  });

  describe('run', () => {
    test('should prompt for client if not provided via input', async () => {
      const result = await step.run(mockContext);

      expect(result).toEqual({
        success: true,
        detail: 'cursor'
      });
      expect(mockContext.mcpClient).toBe('cursor');
    });

    test('should resolve client from input and skip prompt if valid', async () => {
      mockContext.input.client = 'vsc';

      const result = await step.run(mockContext);

      expect(result).toEqual({
        success: true,
        detail: 'vscode',
        status: 'SKIPPED',
        reason: 'Set via --client flag'
      });
      expect(mockContext.mcpClient).toBe('vscode');
    });

    test('should resolve client from full name', async () => {
      mockContext.input.client = 'gemini-cli';

      const result = await step.run(mockContext);

      expect(result).toEqual({
        success: true,
        detail: 'gemini-cli',
        status: 'SKIPPED',
        reason: 'Set via --client flag'
      });
      expect(mockContext.mcpClient).toBe('gemini-cli');
    });

    test('should return error result if invalid client provided', async () => {
      mockContext.input.client = 'invalid-client';

      const result = await step.run(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toContain("Invalid client 'invalid-client'");
      // Ensure state is not partially set
      expect(mockContext.mcpClient).toBeUndefined();
    });

    test('should handle non-Error throw correctly', async () => {
      // Create a subclass that explicitly throws a string
      class ThrowingStep extends ClientSelectionStep {
        // @ts-ignore
        resolveMcpClient(input: string) {
          throw 'A string error';
        }
      }
      const throwingStep = new ThrowingStep();
      mockContext.input.client = 'anything';

      const result = await throwingStep.run(mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toBe('A string error');
    });
  });
});
