import { z } from 'zod';

export const ViewOptionsSchema = z.object({
  projects: z.boolean().default(false),
  name: z.string().optional(),
  sourceScreen: z.string().optional(),
  project: z.string().optional(),
  screen: z.string().optional(),
  serve: z.boolean().default(false),
});

export type ViewOptions = z.infer<typeof ViewOptionsSchema>;
