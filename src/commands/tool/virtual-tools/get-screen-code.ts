import type { StitchMCPClient } from '../../../services/mcp-client/client.js';
import { downloadText } from '../../../ui/copy-behaviors/clipboard.js';
import type { VirtualTool } from '../spec.js';

export const getScreenCodeTool: VirtualTool = {
  name: 'get_screen_code',
  description: '(Virtual) Retrieves a screen and downloads its HTML code content.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Required. The project ID of screen to retrieve.',
      },
      screenId: {
        type: 'string',
        description: 'Required. The name of screen to retrieve.',
      },
    },
    required: ['projectId', 'screenId'],
  },
  execute: async (client: StitchMCPClient, args: any) => {
    const { projectId, screenId } = args;

    // 1. Get the screen details
    const screen = await client.callTool('get_screen', { projectId, screenId }) as any;

    // 2. Fetch HTML Code
    let htmlContent: string | null = null;
    if (screen.htmlCode?.downloadUrl) {
      try {
        htmlContent = await downloadText(screen.htmlCode.downloadUrl);
      } catch (e) {
        console.error(`Error downloading HTML code: ${e}`);
      }
    }

    // 3. Return screen with code content
    return {
      ...screen,
      htmlContent,
    };
  },
};
