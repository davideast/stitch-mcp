import { z } from 'zod';

export const ViewInputSchema = z.object({
  projects: z.boolean().default(false),
  name: z.string().optional(),
  sourceScreen: z.string().optional(),
  project: z.string().optional(),
  screen: z.string().optional(),
});

export type ViewInput = z.infer<typeof ViewInputSchema>;

export const ViewErrorCode = z.enum(['INVALID_ARGS', 'FETCH_FAILED', 'UNKNOWN_ERROR']);

export const ViewSuccess = z.object({
  success: z.literal(true),
  data: z.any(),
});

export const ViewFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: ViewErrorCode,
    message: z.string(),
    recoverable: z.boolean(),
  }),
});

export type ViewResult = z.infer<typeof ViewSuccess> | z.infer<typeof ViewFailure>;

export interface ViewSpec {
  execute(input: ViewInput): Promise<ViewResult>;
}
