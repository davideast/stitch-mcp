import { z } from 'zod';

// ── Validation helpers ─────────────────────────────────────────────────────────

/** Rejects path traversal attempts (e.g. ../secret.png). */
const SafeFilePathSchema = z
  .string()
  .min(1, 'File path is required')
  .refine((p) => !p.includes('..'), 'Path traversal is not allowed');

// ── Input (The Command) ────────────────────────────────────────────────────────

export const UploadImageInputSchema = z.object({
  /** The project to upload the image into. */
  projectId: z.string().min(1, 'Project ID is required'),
  /** Absolute or relative path to the image file on disk. */
  filePath: SafeFilePathSchema,
  /** Optional display title for the created screen. */
  title: z.string().optional(),
});

export type UploadImageInput = z.infer<typeof UploadImageInputSchema>;

// ── Error codes (Exhaustive) ───────────────────────────────────────────────────

export const UploadImageErrorCode = z.enum([
  'FILE_NOT_FOUND',
  'UNSUPPORTED_FORMAT',
  'AUTH_FAILED',
  'UPLOAD_FAILED',
  'UNKNOWN_ERROR',
]);

export type UploadImageErrorCode = z.infer<typeof UploadImageErrorCode>;

// ── Result (Discriminated union) ───────────────────────────────────────────────

export type UploadedScreen = {
  screenId: string;
  projectId: string;
};

export type UploadImageResult =
  | { success: true; screens: UploadedScreen[] }
  | {
      success: false;
      error: {
        code: UploadImageErrorCode;
        message: string;
        recoverable: boolean;
      };
    };

// ── Interface (The Capability) ─────────────────────────────────────────────────

export interface UploadImageSpec {
  execute(input: UploadImageInput): Promise<UploadImageResult>;
}
