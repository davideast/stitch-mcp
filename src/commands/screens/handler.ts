import { StitchMCPClient } from '../../services/mcp-client/client.js';

interface Screen {
  screenId: string;
  title: string;
  hasCode: boolean;
  codeUrl: string | null;
  hasImage: boolean;
}

type ScreensHandlerResult = {
  success: true;
  projectId: string;
  projectTitle: string;
  screens: Screen[];
} | {
  success: false;
  error: string;
};

export class ScreensHandler {
  constructor(private client: StitchMCPClient) { }

  async execute(projectId: string): Promise<ScreensHandlerResult> {
    try {
      // Fetch project details
      const project = await this.client.callTool('get_project', {
        name: `projects/${projectId}`
      }) as any;

      // Fetch screens for the project
      const screensResult = await this.client.callTool('list_screens', {
        projectId
      }) as any;

      const screens: Screen[] = (screensResult.screens || []).map((screen: any) => {
        // Extract screen ID from the name (projects/{projectId}/screens/{screenId})
        const screenId = screen.name?.split('/screens/')[1] || screen.name;

        return {
          screenId,
          title: screen.title || screenId,
          hasCode: !!screen.htmlCode?.downloadUrl,
          codeUrl: screen.htmlCode?.downloadUrl || null,
          hasImage: !!screen.screenshot?.downloadUrl,
        };
      });

      // Sort: screens with HTML first, then alphabetically by title
      screens.sort((a, b) => {
        if (a.hasCode !== b.hasCode) {
          return a.hasCode ? -1 : 1;
        }
        return a.title.localeCompare(b.title);
      });

      return {
        success: true,
        projectId,
        projectTitle: project.title || projectId,
        screens,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  getClient(): StitchMCPClient {
    return this.client;
  }
}
