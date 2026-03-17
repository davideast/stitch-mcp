import type { VirtualTool } from '../spec.js';
import type { StitchToolClient } from '@google/stitch-sdk';

export const listToolsTool: VirtualTool = {
  name: 'list_tools',
  description: 'List all available tools with their descriptions and schemas.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  execute: async (client: StitchToolClient, _args: any) => {
    const result = await client.listTools();
    return result.tools || [];
  },
};
