import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================
// ============================================================================

export type McpClient = 'antigravity' | 'vscode' | 'cursor' | 'claude-code' | 'gemini-cli' | 'codex' | 'opencode';
export type TransportType = 'http' | 'stdio';

export const GenerateConfigInputSchema = z.object({
  client: z.enum(['antigravity', 'vscode', 'cursor', 'claude-code', 'gemini-cli', 'codex', 'opencode']),
  projectId: z.string().min(1),
  accessToken: z.string().min(1),
  transport: z.enum(['http', 'stdio']).default('http'),
});
export type GenerateConfigInput = z.infer<typeof GenerateConfigInputSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const McpConfigErrorCode = z.enum(['INVALID_CLIENT', 'CONFIG_GENERATION_FAILED', 'UNKNOWN_ERROR']);

// ============================================================================
// RESULT TYPES
// ============================================================================

export const McpConfigSuccess = z.object({
  success: z.literal(true),
  data: z.object({
    config: z.string(),
    instructions: z.string(),
    filePath: z.string().optional(),
  }),
});

export const McpConfigFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: McpConfigErrorCode,
    message: z.string(),
    recoverable: z.boolean(),
  }),
});

export type McpConfigResult = z.infer<typeof McpConfigSuccess> | z.infer<typeof McpConfigFailure>;

// ============================================================================
// INTERFACE
// ============================================================================

export interface McpConfigService {
  /**
   * Generate MCP configuration for specified client
   */
  generateConfig(input: GenerateConfigInput): Promise<McpConfigResult>;
}
