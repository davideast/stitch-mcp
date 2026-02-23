import { z } from 'zod';

export const ServeOptionsSchema = z.object({
  project: z.string(),
});

export type ServeOptions = z.infer<typeof ServeOptionsSchema>;
