import { z } from 'zod';

export const ProxyOptionsSchema = z.object({
  transport: z.enum(['stdio', 'sse']).default('stdio'),
  port: z.number().optional(),
  debug: z.boolean().default(false),
});

export type ProxyOptions = z.infer<typeof ProxyOptionsSchema>;
