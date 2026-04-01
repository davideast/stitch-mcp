import { z } from 'zod';

// INPUT
export const ProxyOptionsSchema = z.object({
  transport: z.enum(['stdio', 'sse']).default('stdio'),
  port: z.number().optional(),
  debug: z.boolean().default(false),
});
export type ProxyOptions = z.infer<typeof ProxyOptionsSchema>;

export const ProxyInputSchema = z.object({
  port: z.number().optional(),
  debug: z.boolean().default(false),
});
export type ProxyInput = z.infer<typeof ProxyInputSchema>;

// ERROR CODES
export const ProxyErrorCode = z.enum([
  'PROXY_START_ERROR',
  'TRANSPORT_ERROR',
  'UNKNOWN_ERROR',
]);

// RESULT
export const ProxySuccess = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.enum(['running', 'stopped']),
  }),
});

export const ProxyFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: ProxyErrorCode,
    message: z.string(),
    recoverable: z.boolean(),
  }),
});

export type ProxyResult = z.infer<typeof ProxySuccess> | z.infer<typeof ProxyFailure>;

// INTERFACE
export interface ProxySpec {
  execute(input: ProxyInput): Promise<ProxyResult>;
}
