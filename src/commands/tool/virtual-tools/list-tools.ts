import type { VirtualTool } from '../spec.js';
import type { StitchMCPClient } from '../../../services/mcp-client/client.js';

export const listToolsTool: VirtualTool = {
  name: 'list_tools',
  description: 'List all available tools with their descriptions and schemas.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  execute: async (client: StitchMCPClient, _args: any) => {
    const result = await client.getCapabilities();
    return result.tools || [];
  },
};
