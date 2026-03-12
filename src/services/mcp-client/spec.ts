import { z } from 'zod';

export const StitchConfigSchema = z.object({
  accessToken: z.string().optional(),
  apiKey: z.string().optional(),
  projectId: z.string().optional(),
  baseUrl: z.string().optional().transform(v => v ?? process.env.STITCH_HOST ?? 'https://stitch.googleapis.com/mcp'),
  timeout: z.number().optional(),
});

export type StitchConfig = z.infer<typeof StitchConfigSchema>;

export interface StitchMCPClientSpec {
  connect(): Promise<void>;
  callTool<T>(name: string, args: Record<string, any>): Promise<T>;
  getCapabilities(): Promise<any>;
  close(): Promise<void>;
}
