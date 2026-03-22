import { z } from 'zod';

// 1. VALIDATION HELPERS
const RouteEntrySchema = z.object({
  screenId: z.string().min(1, 'screenId is required'),
  route: z.string().startsWith('/', 'route must start with /'),
});

const RoutesJsonSchema = z.string().transform((str, ctx) => {
  try {
    const parsed = JSON.parse(str);
    const result = z.array(RouteEntrySchema).safeParse(parsed);
    if (!result.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error.issues[0]?.message ?? 'Invalid routes array' });
      return z.NEVER;
    }
    return result.data;
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'routes must be valid JSON' });
    return z.NEVER;
  }
});

// 2. INPUT
export const GenerateInputSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  routesJson: RoutesJsonSchema,
  outputDir: z.string().default('.'),
});
export type GenerateInput = z.infer<typeof GenerateInputSchema>;

// 3. ERROR CODES
export const GenerateErrorCode = z.enum([
  'INVALID_ROUTES',
  'SCREEN_NOT_FOUND',
  'HTML_FETCH_FAILED',
  'GENERATE_FAILED',
]);
export type GenerateErrorCode = z.infer<typeof GenerateErrorCode>;

// 4. RESULT
export type GenerateSuccess = {
  success: true;
  outputDir: string;
  pages: Array<{ screenId: string; route: string }>;
};

export type GenerateFailure = {
  success: false;
  error: {
    code: GenerateErrorCode;
    message: string;
    hint?: string;
    recoverable: boolean;
  };
};

export type GenerateResult = GenerateSuccess | GenerateFailure;

// 5. INTERFACE
export interface GenerateSpec {
  execute(input: GenerateInput): Promise<GenerateResult>;
}
