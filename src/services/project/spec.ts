import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const SelectProjectInputSchema = z.object({
  allowSearch: z.boolean().default(true),
  limit: z.number().default(5),
});
export type SelectProjectInput = z.infer<typeof SelectProjectInputSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const ProjectErrorCode = z.enum([
  'NO_PROJECTS_FOUND',
  'SELECTION_CANCELLED',
  'SEARCH_FAILED',
  'UNKNOWN_ERROR',
]);

// ============================================================================
// RESULT TYPES
// ============================================================================

export const ProjectSelectionSuccess = z.object({
  success: z.literal(true),
  data: z.object({
    projectId: z.string(),
    name: z.string(),
  }),
});

export const ProjectSelectionFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: ProjectErrorCode,
    message: z.string(),
    suggestion: z.string().optional(),
    recoverable: z.boolean(),
  }),
});

export type ProjectSelectionResult =
  | z.infer<typeof ProjectSelectionSuccess>
  | z.infer<typeof ProjectSelectionFailure>;

// ============================================================================
// INTERFACE
// ============================================================================

export interface ProjectService {
  /**
   * Prompt user to select a project
   */
  selectProject(input: SelectProjectInput): Promise<ProjectSelectionResult>;
}
