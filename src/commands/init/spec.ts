import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const InitInputSchema = z.object({
  local: z.boolean().default(false),
  staging: z.boolean().default(false),
});
export type InitInput = z.infer<typeof InitInputSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const InitErrorCode = z.enum([
  'GCLOUD_SETUP_FAILED',
  'AUTH_FAILED',
  'PROJECT_SELECTION_FAILED',
  'API_CONFIG_FAILED',
  'CONFIG_GENERATION_FAILED',
  'USER_CANCELLED',
  'UNKNOWN_ERROR',
]);

// ============================================================================
// RESULT TYPES
// ============================================================================

export const InitSuccess = z.object({
  success: z.literal(true),
  data: z.object({
    projectId: z.string(),
    mcpConfig: z.string(),
    instructions: z.string(),
  }),
});

export const InitFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: InitErrorCode,
    message: z.string(),
    suggestion: z.string().optional(),
    recoverable: z.boolean(),
  }),
});

export type InitResult = z.infer<typeof InitSuccess> | z.infer<typeof InitFailure>;

// ============================================================================
// INTERFACE
// ============================================================================

export interface InitCommand {
  execute(input: InitInput): Promise<InitResult>;
}
