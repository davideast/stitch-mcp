import { z } from 'zod';

export const ScreensOptionsSchema = z.object({
  project: z.string(),
});

export type ScreensOptions = z.infer<typeof ScreensOptionsSchema>;
