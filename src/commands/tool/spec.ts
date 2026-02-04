import { z } from 'zod';

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
