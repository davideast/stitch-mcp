import { z } from 'zod';

// --- shared schemas ---------------------------------------------------------

export const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, 'must be 64-char lowercase hex');
export const MimeSchema = z.string().min(1);

export const BlobRefSchema = z.object({
  sha256: Sha256Schema,
  size: z.number().int().nonnegative(),
  mime: MimeSchema,
});
export type BlobRef = z.infer<typeof BlobRefSchema>;

// --- error union ------------------------------------------------------------

export const BlobStoreErrorCodeSchema = z.enum([
  'BLOB_FETCH_NETWORK',
  'BLOB_FETCH_HTTP_ERROR',
  'BLOB_WRITE_FAILED',
  'BLOB_READ_FAILED',
  'BLOB_INVALID_INPUT',
]);
export type BlobStoreErrorCode = z.infer<typeof BlobStoreErrorCodeSchema>;

export const BlobStoreErrorSchema = z.object({
  code: BlobStoreErrorCodeSchema,
  message: z.string(),
  suggestion: z.string().optional(),
  recoverable: z.boolean(),
});
export type BlobStoreError = z.infer<typeof BlobStoreErrorSchema>;

const FailureSchema = z.object({
  success: z.literal(false),
  error: BlobStoreErrorSchema,
});

// --- per-method result schemas ---------------------------------------------

export const PutSuccessSchema = z.object({
  success: z.literal(true),
  data: BlobRefSchema,
});
export const PutResultSchema = z.union([PutSuccessSchema, FailureSchema]);
export type PutResult = z.infer<typeof PutResultSchema>;

export const HasSuccessSchema = z.object({
  success: z.literal(true),
  data: z.boolean(),
});
export const HasResultSchema = z.union([HasSuccessSchema, FailureSchema]);
export type HasResult = z.infer<typeof HasResultSchema>;

export const GetSuccessSchema = z.object({
  success: z.literal(true),
  // null = not found; success=true because "absent" is a valid answer, not an error
  data: z.instanceof(Buffer).nullable(),
});
export const GetResultSchema = z.union([GetSuccessSchema, FailureSchema]);
export type GetResult = z.infer<typeof GetResultSchema>;

// --- capability -------------------------------------------------------------

export interface BlobStoreSpec {
  /** Hash, dedupe, and persist a buffer. Returns a content-addressed BlobRef. */
  put(buffer: Buffer, mime: string): Promise<PutResult>;

  /** Fetch a URL (following redirects) and persist the bytes. */
  fetch(url: string, mimeHint?: string): Promise<PutResult>;

  /** Cheap existence check by sha256. */
  has(sha256: string): Promise<HasResult>;

  /** Read bytes by sha256. data === null when absent. */
  get(sha256: string): Promise<GetResult>;
}
