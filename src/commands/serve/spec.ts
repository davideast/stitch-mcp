import { z } from 'zod';

// 1. INPUT
export const ServeOptionsSchema = z.object({
  project: z.string(),
  listScreens: z.boolean().default(false),
  json: z.boolean().default(false),
});
export type ServeOptions = z.infer<typeof ServeOptionsSchema>;

// 2. ERROR CODES
export const ServeErrorCode = z.enum([
  'SCREENS_FETCH_FAILED',
]);
export type ServeErrorCode = z.infer<typeof ServeErrorCode>;

// 3. RESULT
export type ServeSuccess = {
  success: true;
  projectId: string;
  projectTitle: string;
  screens: Array<{ screenId: string; title: string; codeUrl: string }>;
};

export type ServeFailure = {
  success: false;
  error: {
    code: ServeErrorCode;
    message: string;
    recoverable: boolean;
  };
};

export type ServeResult = ServeSuccess | ServeFailure;

// 4. INTERFACE
export interface ServeSpec {
  execute(projectId: string): Promise<ServeResult>;
}
