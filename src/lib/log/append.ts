import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';

const EnvelopeSchema = z.object({
  id: z.string().min(1),
  time: z.string().min(1),
  trace_id: z.string().min(1),
  schema_version: z.literal(1),
  type: z.string().min(1),
  payload: z.unknown(),
});

export type AppendResult =
  | { success: true }
  | {
      success: false;
      error: {
        code: 'EVENT_VALIDATION_FAILED' | 'EVENT_WRITE_FAILED';
        message: string;
        recoverable: boolean;
      };
    };

/** Validate envelope shape and append exactly one JSON line, ending in `\n`. */
export async function appendEvent(eventsPath: string, event: unknown): Promise<AppendResult> {
  const parsed = EnvelopeSchema.safeParse(event);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: 'EVENT_VALIDATION_FAILED',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        recoverable: false,
      },
    };
  }
  try {
    await mkdir(dirname(eventsPath), { recursive: true });
    await appendFile(eventsPath, JSON.stringify(parsed.data) + '\n', 'utf8');
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: {
        code: 'EVENT_WRITE_FAILED',
        message: e instanceof Error ? e.message : String(e),
        recoverable: false,
      },
    };
  }
}
