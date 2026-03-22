import { z } from 'zod';

export const SiteOptionsSchema = z.object({
  project: z.string(),
  output: z.string().default('.'),
  export: z.boolean().default(false),
  listScreens: z.boolean().default(false),
  routes: z.string().optional(),
});

export type SiteOptions = z.infer<typeof SiteOptionsSchema>;
