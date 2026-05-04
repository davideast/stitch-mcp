import { z } from 'zod';
import { BlobRefSchema } from '../blob-store/spec.js';

// --- tool taxonomy ----------------------------------------------------------

export const GENERATIVE_TOOLS = new Set([
  'generate_screen_from_text',
  'edit_screens',
  'generate_variants',
] as const);

export const READ_TOOLS = new Set([
  'get_screen',
  'list_screens',
  'list_projects',
  'get_project',
  'create_project',
] as const);

export type ToolKind = 'generative' | 'read' | 'unknown';

export function kindOf(tool: string): ToolKind {
  if (GENERATIVE_TOOLS.has(tool as any)) return 'generative';
  if (READ_TOOLS.has(tool as any)) return 'read';
  return 'unknown';
}

// --- per-screen artifact -----------------------------------------------------

export const ProducedScreenSchema = z.object({
  project_id: z.string(),
  screen_id: z.string(),
  name: z.string(),
  parent_screen_id: z.string().nullable(),
  sibling_screen_ids: z.array(z.string()),
  effective_prompt: z.string(),
  // null when a fetch failed (warning recorded) or absent on the response (variants)
  html_blob: BlobRefSchema.nullable(),
  screenshot_blob: BlobRefSchema.nullable(),
  theme_blob: BlobRefSchema.nullable(),
  design_system_blob: BlobRefSchema.nullable(),
});
export type ProducedScreen = z.infer<typeof ProducedScreenSchema>;

// --- event payloads ---------------------------------------------------------

export const RequestedPayloadSchema = z.object({
  tool: z.string(),
  project_id: z.string().optional(),
  selected_screen_ids: z.array(z.string()).optional(),
  user_prompt: z.string().optional(),
  variant_options: z.record(z.string(), z.unknown()).optional(),
  device_type: z.string().optional(),
  model_id: z.string().optional(),
  args_blob: BlobRefSchema,
});

export const CompletedGenerativePayloadSchema = z.object({
  tool: z.string(),
  duration_ms: z.number().int().nonnegative(),
  kind: z.literal('generative'),
  stitch_session_id: z.string().optional(),
  structured_content_blob: BlobRefSchema,
  produced_screens: z.array(ProducedScreenSchema),
});

export const CompletedReadPayloadSchema = z.object({
  tool: z.string(),
  duration_ms: z.number().int().nonnegative(),
  kind: z.literal('read'),
  project_id: z.string().optional(),
  screen_ids: z.array(z.string()).optional(),
  returned_project_ids: z.array(z.string()).optional(),
  returned_screen_ids: z.array(z.string()).optional(),
  result_blob: BlobRefSchema,
});

export const CompletedUnknownPayloadSchema = z.object({
  tool: z.string(),
  duration_ms: z.number().int().nonnegative(),
  kind: z.literal('unknown'),
  project_id: z.string().optional(),
  result_blob: BlobRefSchema,
});

export const CompletedPayloadSchema = z.discriminatedUnion('kind', [
  CompletedGenerativePayloadSchema,
  CompletedReadPayloadSchema,
  CompletedUnknownPayloadSchema,
]);

export const FailedPayloadSchema = z.object({
  tool: z.string(),
  duration_ms: z.number().int().nonnegative(),
  is_error: z.union([z.literal(true), z.literal('empty')]),
  error_text: z.string().optional(),
  raw_blob: BlobRefSchema.optional(),
});

// --- envelope + event union --------------------------------------------------

const baseEnvelope = {
  id: z.string().min(1),
  time: z.string().min(1),
  trace_id: z.string().min(1),
  schema_version: z.literal(1),
};

export const EventSchema = z.discriminatedUnion('type', [
  z.object({ ...baseEnvelope, type: z.literal('call.requested'), payload: RequestedPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal('call.completed'), payload: CompletedPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal('call.failed'), payload: FailedPayloadSchema }),
]);
export type Event = z.infer<typeof EventSchema>;

// --- capture I/O ------------------------------------------------------------

export const CaptureInputSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  result: z.unknown(),         // raw MCP CallToolResult
  duration_ms: z.number().int().nonnegative(),
  started_at: z.string().min(1),
  finished_at: z.string().min(1),
});
export type CaptureInput = z.infer<typeof CaptureInputSchema>;

export const CaptureErrorCodeSchema = z.enum([
  'CAPTURE_UNKNOWN_TOOL',     // tool isn't in either taxonomy set
  'CAPTURE_APPEND_FAILED',    // appendEvent rejected
  'CAPTURE_BLOB_FATAL',       // critical blob (args/result) failed; can't proceed
  'CAPTURE_INVALID_INPUT',
]);

const CaptureFailure = z.object({
  success: z.literal(false),
  error: z.object({
    code: CaptureErrorCodeSchema,
    message: z.string(),
    recoverable: z.boolean(),
  }),
});
const CaptureSuccess = z.object({
  success: z.literal(true),
  data: z.object({
    trace_id: z.string(),
    produced_screen_ids: z.array(z.string()),
    warnings: z.array(z.string()),     // soft-failures (one blob fetch died, etc.)
  }),
});
export const CaptureResultSchema = z.union([CaptureSuccess, CaptureFailure]);
export type CaptureResult = z.infer<typeof CaptureResultSchema>;

// --- dependency contracts (for testability) ---------------------------------

import type { BlobStoreSpec } from '../blob-store/spec.js';
import type { AppendResult } from '../append.js';

export type AppendFn = (event: Event) => Promise<AppendResult>;

export interface CaptureSpec {
  capture(input: CaptureInput): Promise<CaptureResult>;
}

export interface CaptureDeps {
  blobs: BlobStoreSpec;
  append: AppendFn;
  now?: () => Date;          // injectable for deterministic tests
  newId?: () => string;
}
