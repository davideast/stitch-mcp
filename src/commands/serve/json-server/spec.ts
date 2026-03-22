import { z } from 'zod';

// 1. INPUT
export const JsonServerInputSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
});
export type JsonServerInput = z.infer<typeof JsonServerInputSchema>;

// 2. ERROR CODES
export const JsonServerErrorCode = z.enum([
  'SCREENS_FETCH_FAILED',
  'SERVER_START_FAILED',
]);
export type JsonServerErrorCode = z.infer<typeof JsonServerErrorCode>;

// 3. RESULT — emitted once to stdout when server is ready
export type JsonServerReady = {
  success: true;
  url: string;
  screens: Array<{ screenId: string; title: string; url: string }>;
};

export type JsonServerFailure = {
  success: false;
  error: {
    code: JsonServerErrorCode;
    message: string;
    recoverable: boolean;
  };
};

export type JsonServerResult = JsonServerReady | JsonServerFailure;

// 4. INTERFACE
export interface JsonServerSpec {
  execute(input: JsonServerInput): Promise<JsonServerResult>;
}
