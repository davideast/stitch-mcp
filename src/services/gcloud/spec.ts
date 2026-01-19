import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const EnsureGcloudInputSchema = z.object({
  minVersion: z.string().default('400.0.0'),
  forceLocal: z.boolean().default(false),
  useSystemGcloud: z.boolean().default(false).optional(),
});
export type EnsureGcloudInput = z.infer<typeof EnsureGcloudInputSchema>;

export const AuthenticateInputSchema = z.object({
  skipIfActive: z.boolean().default(true),
});
export type AuthenticateInput = z.infer<typeof AuthenticateInputSchema>;

export const ListProjectsInputSchema = z.object({
  limit: z.number().optional(),
  filter: z.string().optional(),
  sortBy: z.string().optional(),
});
export type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;

export const SetProjectInputSchema = z.object({
  projectId: z.string().min(1),
});
export type SetProjectInput = z.infer<typeof SetProjectInputSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const GcloudErrorCode = z.enum([
  'DOWNLOAD_FAILED',
  'EXTRACTION_FAILED',
  'VERSION_CHECK_FAILED',
  'INVALID_VERSION',
  'AUTH_FAILED',
  'ADC_FAILED',
  'PROJECT_LIST_FAILED',
  'PROJECT_SET_FAILED',
  'COMMAND_NOT_FOUND',
  'UNKNOWN_ERROR',
]);
export type GcloudErrorCodeType = z.infer<typeof GcloudErrorCode>;

// ============================================================================
// RESULT TYPES
// ============================================================================

// Ensure gcloud installation
export const GcloudInstallDataSchema = z.object({
  version: z.string(),
  location: z.enum(['system', 'bundled']),
  path: z.string(),
});

export const GcloudSuccess = z.object({
  success: z.literal(true),
  data: GcloudInstallDataSchema,
});

export const GcloudFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: GcloudErrorCode,
    message: z.string(),
    suggestion: z.string().optional(),
    recoverable: z.boolean(),
  }),
});

export type GcloudResult = z.infer<typeof GcloudSuccess> | z.infer<typeof GcloudFailure>;

// Authentication
export const AuthDataSchema = z.object({
  account: z.string(),
  type: z.enum(['user', 'adc']),
});

export const AuthSuccess = z.object({
  success: z.literal(true),
  data: AuthDataSchema,
});

export const AuthFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: GcloudErrorCode,
    message: z.string(),
    suggestion: z.string().optional(),
    recoverable: z.boolean(),
  }),
});

export type AuthResult = z.infer<typeof AuthSuccess> | z.infer<typeof AuthFailure>;

// Project listing
export const ProjectSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  projectNumber: z.string().optional(),
  createTime: z.string().optional(),
});

export const ProjectListSuccess = z.object({
  success: z.literal(true),
  data: z.object({
    projects: z.array(ProjectSchema),
  }),
});

export const ProjectListFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: GcloudErrorCode,
    message: z.string(),
    suggestion: z.string().optional(),
    recoverable: z.boolean(),
  }),
});

export type ProjectListResult = z.infer<typeof ProjectListSuccess> | z.infer<typeof ProjectListFailure>;

// Project set
export const ProjectSetSuccess = z.object({
  success: z.literal(true),
  data: z.object({
    projectId: z.string(),
  }),
});

export const ProjectSetFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: GcloudErrorCode,
    message: z.string(),
    suggestion: z.string().optional(),
    recoverable: z.boolean(),
  }),
});

export type ProjectSetResult = z.infer<typeof ProjectSetSuccess> | z.infer<typeof ProjectSetFailure>;

// ============================================================================
// INTERFACE
// ============================================================================

export interface GcloudService {
  /**
   * Ensure gcloud is installed and meets minimum version requirements
   */
  ensureInstalled(input: EnsureGcloudInput): Promise<GcloudResult>;

  /**
   * Authenticate user with gcloud
   */
  authenticate(input: AuthenticateInput): Promise<AuthResult>;

  /**
   * Authenticate application default credentials
   */
  authenticateADC(input: AuthenticateInput): Promise<AuthResult>;

  /**
   * List user's projects
   */
  listProjects(input: ListProjectsInput): Promise<ProjectListResult>;

  /**
   * Set the active project
   */
  setProject(input: SetProjectInput): Promise<ProjectSetResult>;

  /**
   * Get access token for API requests
   */
  getAccessToken(): Promise<string | null>;

  /**
   * Install beta components
   */
  installBetaComponents(): Promise<{ success: boolean; error?: { message: string } }>;

  /**
   * Check if Application Default Credentials (ADC) exist.
   */
  hasADC(): Promise<boolean>;

  /**
  /**
   * Get the active project ID.
   */
  getProjectId(): Promise<string | null>;

  /**
   * Get the active user account.
   */
  getActiveAccount(): Promise<string | null>;
}
