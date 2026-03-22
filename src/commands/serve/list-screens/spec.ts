import { z } from 'zod';

// 1. INPUT
export const ListScreensInputSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
});
export type ListScreensInput = z.infer<typeof ListScreensInputSchema>;

// 2. ERROR CODES
export const ListScreensErrorCode = z.enum([
  'SCREENS_FETCH_FAILED',
]);
export type ListScreensErrorCode = z.infer<typeof ListScreensErrorCode>;

// 3. RESULT
export type ListScreensSuccess = {
  success: true;
  projectId: string;
  screens: Array<{
    screenId: string;
    title: string;
    path: string;
    hasHtml: boolean;
  }>;
};

export type ListScreensFailure = {
  success: false;
  error: {
    code: ListScreensErrorCode;
    message: string;
    recoverable: boolean;
  };
};

export type ListScreensResult = ListScreensSuccess | ListScreensFailure;

// 4. INTERFACE
export interface ListScreensSpec {
  execute(input: ListScreensInput): Promise<ListScreensResult>;
}
