import type { StitchMCPClient } from '../../../services/mcp-client/client.js';
import { downloadImage } from '../../../ui/copy-behaviors/clipboard.js';
import type { VirtualTool } from '../spec.js';

export const getScreenImageTool: VirtualTool = {
  name: 'get_screen_image',
  description: '(Virtual) Retrieves a screen and downloads its screenshot image as base64.',
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

    // 2. Fetch Screenshot (as base64)
    let screenshotBase64: string | null = null;
    if (screen.screenshot?.downloadUrl) {
      try {
        const buffer = await downloadImage(screen.screenshot.downloadUrl);
        screenshotBase64 = Buffer.from(buffer).toString('base64');
      } catch (e) {
        console.error(`Error downloading screenshot: ${e}`);
      }
    }

    // 3. Return screen with image content
    return {
      ...screen,
      screenshotBase64,
    };
  },
};
