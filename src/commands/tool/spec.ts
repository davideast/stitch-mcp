import { z } from 'zod';
import type { StitchToolClient, Stitch } from '@google/stitch-sdk';

export const ToolCommandInputSchema = z.object({
  toolName: z.string().optional(),   // undefined = list tools
  showSchema: z.boolean().default(false), // --schema flag
  data: z.string().optional(),       // JSON string like curl -d
  dataFile: z.string().optional(),   // @file.json like curl
  output: z.enum(['json', 'pretty', 'raw']).default('pretty'),
});

export type ToolCommandInput = z.infer<typeof ToolCommandInputSchema>;

export interface ToolInfo {
  name: string;
  description?: string;
  virtual?: boolean;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface ToolCommandResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface VirtualTool extends ToolInfo {
  execute: (client: StitchToolClient, args: any, stitch?: Stitch) => Promise<any>;
}

// Added for CLI validation
export const ToolOptionsSchema = z.object({
  schema: z.boolean().default(false),
  data: z.string().optional(),
  dataFile: z.string().optional(),
  output: z.enum(['json', 'pretty', 'raw']).default('pretty'),
});

export type ToolOptions = z.infer<typeof ToolOptionsSchema>;
