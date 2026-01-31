import { z } from 'zod';

export const StitchConfigSchema = z.object({
  accessToken: z.string().optional(),
  apiKey: z.string().optional(),
  projectId: z.string().optional(),
  baseUrl: z.string().default('https://stitch.googleapis.com/mcp'),
  timeout: z.number().optional(),
});

export type StitchConfig = z.infer<typeof StitchConfigSchema>;

export interface StitchMCPClientSpec {
  connect(): Promise<void>;
  callTool<T>(name: string, args: Record<string, any>): Promise<T>;
  readResource(uri: string): Promise<any>;
  listResources(): Promise<any>;
  getCapabilities(): Promise<any>;
  close(): Promise<void>;
}
