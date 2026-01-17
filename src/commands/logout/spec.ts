import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const LogoutInputSchema = z.object({
  force: z.boolean().default(false),
  clearConfig: z.boolean().default(false),
});
export type LogoutInput = z.infer<typeof LogoutInputSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const LogoutErrorCode = z.enum([
  'GCLOUD_NOT_FOUND',
  'REVOKE_FAILED',
  'CONFIG_CLEAR_FAILED',
  'UNKNOWN_ERROR',
]);

// ============================================================================
// RESULT TYPES
// ============================================================================

export const LogoutSuccess = z.object({
  success: z.literal(true),
  data: z.object({
    userRevoked: z.boolean(),
    adcRevoked: z.boolean(),
    configCleared: z.boolean(),
  }),
});

export const LogoutFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.enum(['GCLOUD_NOT_FOUND', 'REVOKE_FAILED', 'CONFIG_CLEAR_FAILED', 'UNKNOWN_ERROR']),
    message: z.string(),
    recoverable: z.boolean(),
  }),
});

export type LogoutResult = z.infer<typeof LogoutSuccess> | z.infer<typeof LogoutFailure>;

// ============================================================================
// INTERFACE
// ============================================================================

export interface LogoutCommand {
  execute(input: LogoutInput): Promise<LogoutResult>;
}
