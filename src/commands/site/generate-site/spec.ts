import { z } from 'zod';

// ── Validation Helpers ─────────────────────────────────────────────────────────

const RouteEntrySchema = z.object({
  screenId: z.string().min(1, 'screenId is required'),
  route: z.string().startsWith('/', 'route must start with /'),
});

// ── Input ──────────────────────────────────────────────────────────────────────

export const GenerateSiteInputSchema = z.object({
  /** The Stitch project ID to generate a site for. */
  projectId: z.string().min(1, 'projectId is required'),
  /** Absolute path to the output directory for the generated Astro site. */
  outputDir: z.string().min(1, 'outputDir is required'),
  /** Route mapping: which screens to include and at what URL path. */
  routes: z.array(RouteEntrySchema).min(1, 'at least one route is required'),
  /**
   * Unix file-permission bits for all written files.
   * Defaults to 0o600 (owner read/write only).
   * Set to 0o644 when serving files via a web server (e.g. nginx).
   */
  fileMode: z.number().int().optional().default(0o600),
  /**
   * Directory used for atomic temp files before rename.
   * Must be on the same filesystem as outputDir.
   */
  tempDir: z.string().optional(),
  /**
   * Name of the subdirectory inside outputDir where downloaded assets are saved.
   * Defaults to 'assets'.
   */
  assetsSubdir: z.string().default('assets'),
});

export type GenerateSiteInput = z.input<typeof GenerateSiteInputSchema>;
export type GenerateSiteInputParsed = z.infer<typeof GenerateSiteInputSchema>;

// ── Error Codes ────────────────────────────────────────────────────────────────

export const GenerateSiteErrorCode = z.enum([
  'DOWNLOAD_FAILED',
  'ASTRO_REWRITE_FAILED',
  'WRITE_FAILED',
  'VALIDATION_ERROR',
  'NETWORK_ERROR',
  'RATE_LIMITED',
  'NOT_FOUND',
  'UNKNOWN_ERROR',
]);
export type GenerateSiteErrorCode = z.infer<typeof GenerateSiteErrorCode>;

// ── Result ─────────────────────────────────────────────────────────────────────

export type GenerateSiteResult =
  | { success: true; outputDir: string; pages: { screenId: string; route: string }[] }
  | {
      success: false;
      error: {
        code: GenerateSiteErrorCode;
        message: string;
        recoverable: boolean;
      };
    };

// ── Interface ──────────────────────────────────────────────────────────────────

export interface GenerateSiteSpec {
  execute(input: GenerateSiteInput): Promise<GenerateSiteResult>;
}
