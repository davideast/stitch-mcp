import { downloadImage } from '../../../ui/copy-behaviors/clipboard.js';
import type { VirtualTool } from '../spec.js';
import { stitch } from '@google/stitch-sdk';

export const getScreenImageTool: VirtualTool = {
  name: 'get_screen_image',
  description: '(Virtual) Retrieves a screen and downloads its screenshot image content.',
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
  execute: async (client: any, args: any) => {
    const { projectId, screenId } = args;

    // 1. Get the screen details using the SDK
    const screen = await stitch.project(projectId).getScreen(screenId);

    // 2. Fetch Image Content
    let imageContent: string | null = null;
    try {
      const imageUrl = await screen.getImage();
      if (imageUrl) {
        // downloadImage doesn't take arguments in the current implementation, it grabs from clipboard
        // Actually, this file was passing a URL to downloadImage, but let's just fetch it as a buffer
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        imageContent = buffer.toString('base64');
      }
    } catch (e) {
      console.error(`Error downloading screenshot: ${e}`);
    }

    // 3. Return screen with image content (as base64 or raw buffer, adjusting for specific agent uses)
    return {
      screenId: screen.screenId,
      projectId: screen.projectId,
      imageContent,
    };
  },
};
