import type { StitchToolClient, Stitch } from '@google/stitch-sdk';
import type { VirtualTool } from '../spec.js';

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
  execute: async (client: StitchToolClient, args: any, stitch?: Stitch) => {
    if (!stitch) throw new Error('get_screen_image requires a Stitch instance');
    const { projectId, screenId } = args;

    // 1. Get the screen details using the injected SDK instance
    const screen = await stitch.project(projectId).getScreen(screenId);

    // 2. Fetch Image Content
    let imageContent: string | null = null;
    try {
      const imageUrl = await screen.getImage();
      if (imageUrl) {
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        imageContent = buffer.toString('base64');
      }
    } catch (e) {
      console.error(`Error downloading screenshot: ${e}`);
    }

    // 3. Return screen with image content
    return {
      screenId: screen.screenId,
      projectId: screen.projectId,
      imageContent,
    };
  },
};
