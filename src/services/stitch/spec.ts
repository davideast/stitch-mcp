import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const ConfigureIAMInputSchema = z.object({
  projectId: z.string().min(1),
  userEmail: z.string().email(),
});
export type ConfigureIAMInput = z.infer<typeof ConfigureIAMInputSchema>;

export const EnableAPIInputSchema = z.object({
  projectId: z.string().min(1),
});
export type EnableAPIInput = z.infer<typeof EnableAPIInputSchema>;

export const TestConnectionInputSchema = z.object({
  projectId: z.string().min(1),
  accessToken: z.string().min(1),
});
export type TestConnectionInput = z.infer<typeof TestConnectionInputSchema>;

export const TestConnectionWithApiKeyInputSchema = z.object({
  apiKey: z.string().min(1),
});
export type TestConnectionWithApiKeyInput = z.infer<typeof TestConnectionWithApiKeyInputSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const StitchErrorCode = z.enum([
  'IAM_CONFIG_FAILED',
  'API_ENABLE_FAILED',
  'CONNECTION_TEST_FAILED',
  'PERMISSION_DENIED',
  'UNKNOWN_ERROR',
]);

// ============================================================================
// RESULT TYPES
// ============================================================================

export const IAMConfigSuccess = z.object({
  success: z.literal(true),
  data: z.object({
    role: z.string(),
    member: z.string(),
  }),
});

export const IAMConfigFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: StitchErrorCode,
    message: z.string(),
    suggestion: z.string().optional(),
    recoverable: z.boolean(),
    details: z.string().optional(),
  }),
});

export type IAMConfigResult = z.infer<typeof IAMConfigSuccess> | z.infer<typeof IAMConfigFailure>;

export const APIEnableSuccess = z.object({
  success: z.literal(true),
  data: z.object({
    api: z.string(),
    enabled: z.boolean(),
  }),
});

export const APIEnableFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: StitchErrorCode,
    message: z.string(),
    suggestion: z.string().optional(),
    recoverable: z.boolean(),
    details: z.string().optional(),
  }),
});

export type APIEnableResult = z.infer<typeof APIEnableSuccess> | z.infer<typeof APIEnableFailure>;

export const ConnectionTestSuccess = z.object({
  success: z.literal(true),
  data: z.object({
    connected: z.boolean(),
    statusCode: z.number(),
    url: z.string(),
    response: z.any().optional(),
  }),
});

export const ConnectionTestFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: StitchErrorCode,
    message: z.string(),
    suggestion: z.string().optional(),
    recoverable: z.boolean(),
    details: z.string().optional(),
  }),
});

export type ConnectionTestResult = z.infer<typeof ConnectionTestSuccess> | z.infer<typeof ConnectionTestFailure>;

// ============================================================================
// INTERFACE
// ============================================================================

export interface StitchService {
  /**
   * Configure IAM permissions for Stitch API
   */
  configureIAM(input: ConfigureIAMInput): Promise<IAMConfigResult>;

  /**
   * Enable Stitch API for the project
   */
  enableAPI(input: EnableAPIInput): Promise<APIEnableResult>;

  /**
  * Test the connection to the Stitch API
   */
  testConnection(input: TestConnectionInput): Promise<ConnectionTestResult>;

  /**
   * Test the connection to the Stitch API using an API key
   */
  testConnectionWithApiKey(input: TestConnectionWithApiKeyInput): Promise<ConnectionTestResult>;

  /**
   * Check if a user has a specific IAM role on a project
   */
  checkIAMRole(input: { projectId: string; userEmail: string }): Promise<boolean>;

  /**
   * Check if the Stitch API is enabled for a project
   */
  checkAPIEnabled(input: { projectId: string }): Promise<boolean>;
}
