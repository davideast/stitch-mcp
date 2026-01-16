import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const DoctorInputSchema = z.object({
  verbose: z.boolean().default(false),
});
export type DoctorInput = z.infer<typeof DoctorInputSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const DoctorErrorCode = z.enum([
  'CHECKS_FAILED',
  'UNKNOWN_ERROR',
]);

// ============================================================================
// RESULT TYPES
// ============================================================================

export const HealthCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  message: z.string(),
  suggestion: z.string().optional(),
  details: z.string().optional(),
});

export const DoctorSuccess = z.object({
  success: z.literal(true),
  data: z.object({
    checks: z.array(HealthCheckSchema),
    allPassed: z.boolean(),
  }),
});

export const DoctorFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: DoctorErrorCode,
    message: z.string(),
    recoverable: z.boolean(),
  }),
});

export type DoctorResult = z.infer<typeof DoctorSuccess> | z.infer<typeof DoctorFailure>;

// ============================================================================
// INTERFACE
// ============================================================================

export interface DoctorCommand {
  execute(input: DoctorInput): Promise<DoctorResult>;
}
