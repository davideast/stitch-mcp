import { z } from 'zod';

export const SnapshotInputSchema = z.object({
  command: z.string().optional(),
  data: z.string().optional(),
  schema: z.boolean().default(false),
});

export type SnapshotInput = z.infer<typeof SnapshotInputSchema>;

export const SnapshotResultSchema = z.object({
  success: z.boolean(),
  error: z.object({
    message: z.string(),
  }).optional(),
});

export type SnapshotResult = z.infer<typeof SnapshotResultSchema>;

export interface SnapshotCommand {
  execute(input: SnapshotInput): Promise<SnapshotResult>;
}
