import { z } from 'zod';

export const SiteOptionsSchema = z.object({
  project: z.string(),
  output: z.string().default('.'),
  export: z.boolean().default(false),
});

export type SiteOptions = z.infer<typeof SiteOptionsSchema>;
