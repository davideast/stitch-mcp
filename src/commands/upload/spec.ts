import { z } from 'zod';

// ── Validation helpers ─────────────────────────────────────────────────────────

/** Rejects path traversal attempts (e.g. ../secret.png). */
const SafeFilePathSchema = z
  .string()
  .min(1, 'File path is required')
  .refine((p) => !p.includes('..'), 'Path traversal is not allowed');

// ── Input (The Command) ────────────────────────────────────────────────────────

export const UploadInputSchema = z.object({
  /** The project to upload the asset into. */
  projectId: z.string().min(1, 'Project ID is required'),
  /** Absolute or relative path to the asset file on disk. */
  filePath: SafeFilePathSchema,
  /** Optional display title for the created screen. */
  title: z.string().optional(),
});

export type UploadInput = z.infer<typeof UploadInputSchema>;

// ── Error codes (Exhaustive) ───────────────────────────────────────────────────

export const UploadErrorCode = z.enum([
  'FILE_NOT_FOUND',
  'UNSUPPORTED_FORMAT',
  'AUTH_FAILED',
  'UPLOAD_FAILED',
  'UNKNOWN_ERROR',
]);

export type UploadErrorCode = z.infer<typeof UploadErrorCode>;

// ── Result (Discriminated union) ───────────────────────────────────────────────

export type UploadedScreen = {
  screenId: string;
  projectId: string;
};

export type UploadResult =
  | { success: true; screens: UploadedScreen[] }
  | {
      success: false;
      error: {
        code: UploadErrorCode;
        message: string;
        recoverable: boolean;
      };
    };

// ── Interface (The Capability) ─────────────────────────────────────────────────

export interface UploadSpec {
  execute(input: UploadInput): Promise<UploadResult>;
}

