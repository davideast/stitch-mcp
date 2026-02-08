import { StitchMCPClient } from '../../../services/mcp-client/client.js';
import type { RemoteScreen } from '../../../lib/services/site/types.js';

export class ProjectSyncer {
  private client: StitchMCPClient;

  constructor(client: StitchMCPClient) {
    this.client = client;
  }

  async fetchManifest(projectId: string): Promise<RemoteScreen[]> {
      const response = await this.client.callTool<{ screens: RemoteScreen[] }>('list_screens', {
        projectId
      });
      return response.screens || [];
  }

  async fetchContent(url: string): Promise<string> {
      const maxRetries = 4;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const response = await fetch(url);
        if (response.ok) return await response.text();
        if (response.status === 429 && attempt < maxRetries) {
          const backoff = Math.min(1000 * 2 ** attempt, 8000);
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        throw new Error(`Failed to fetch content: ${response.statusText}`);
      }
      throw new Error(`Failed to fetch content after ${maxRetries + 1} attempts`);
  }
}
