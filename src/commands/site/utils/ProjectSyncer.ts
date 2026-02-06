import { StitchMCPClient } from '../../../services/mcp-client/client.js';
import type { RemoteScreen } from '../../../lib/services/site/types.js';

export class ProjectSyncer {
  private client: StitchMCPClient;

  constructor(client: StitchMCPClient) {
    this.client = client;
  }

  async fetchManifest(projectId: string): Promise<RemoteScreen[]> {
      const response = await this.client.callTool<{ screens: RemoteScreen[] }>('list_screens', {
          projectId,
          pageSize: 1000
      });
      return response.screens || [];
  }

  async fetchContent(url: string): Promise<string> {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch content: ${response.statusText}`);
      return await response.text();
  }
}
