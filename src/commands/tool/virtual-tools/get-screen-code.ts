import type { StitchToolClient, Stitch } from '@google/stitch-sdk';
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
  execute: async (client: StitchToolClient, args: any, stitch?: Stitch) => {
    if (!stitch) throw new Error('get_screen_code requires a Stitch instance');
    const { projectId, screenId } = args;

    // 1. Get the screen details using the injected SDK instance
    const screen = await stitch.project(projectId).getScreen(screenId);

    // 2. Fetch HTML Code
    let htmlContent: string | null = null;
    try {
      const htmlUrl = await screen.getHtml();
      if (htmlUrl) {
        htmlContent = await downloadText(htmlUrl);
      }
    } catch (e) {
      console.error(`Error downloading HTML code: ${e}`);
    }

    // 3. Return screen with code content
    return {
      screenId: screen.screenId,
      projectId: screen.projectId,
      htmlContent,
    };
  },
};
