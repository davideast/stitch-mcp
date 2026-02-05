import { StitchMCPClient } from '../../services/mcp-client/client.js';

interface CodeScreen {
  screenId: string;
  title: string;
  codeUrl: string;
}

type ServeHandlerResult = {
  success: true;
  projectId: string;
  projectTitle: string;
  screens: CodeScreen[];
} | {
  success: false;
  error: string;
};

export class ServeHandler {
  constructor(private client: StitchMCPClient) { }

  async execute(projectId: string): Promise<ServeHandlerResult> {
    try {
      // Fetch project details
      const project = await this.client.callTool('get_project', {
        name: `projects/${projectId}`
      }) as any;

      // Fetch screens for the project
      const screensResult = await this.client.callTool('list_screens', {
        projectId
      }) as any;

      // Only include screens with code
      const screens: CodeScreen[] = (screensResult.screens || [])
        .filter((screen: any) => !!screen.htmlCode?.downloadUrl)
        .map((screen: any) => {
          const screenId = screen.name?.split('/screens/')[1] || screen.name;
          return {
            screenId,
            title: screen.title || screenId,
            codeUrl: screen.htmlCode.downloadUrl,
          };
        });

      // Sort alphabetically by title
      screens.sort((a, b) => a.title.localeCompare(b.title));

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
