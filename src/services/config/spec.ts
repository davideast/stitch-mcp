import { z } from 'zod';

export const ConfigErrorCode = z.enum(['INVALID_CONFIG', 'MISSING_PROJECT_ID', 'UNKNOWN_ERROR']);

export const ProjectContextSchema = z.object({
  projectId: z.string(),
  source: z.enum(['env', 'package.json', 'gcloud']),
  gcloudMode: z.enum(['bundled', 'system']).optional(), // informative
});

export const ResolveContextSuccess = z.object({
  success: z.literal(true),
  data: ProjectContextSchema,
});

export const ResolveContextFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: ConfigErrorCode,
    message: z.string(),
    recoverable: z.boolean(),
  })
});

export type ResolveContextResult = z.infer<typeof ResolveContextSuccess> | z.infer<typeof ResolveContextFailure>;

export interface ConfigService {
  /**
   * Resolves the project context based on the cascade: Env > Valid Package.json > Active Gcloud Project
   */
  resolveContext(): Promise<ResolveContextResult>;
}
