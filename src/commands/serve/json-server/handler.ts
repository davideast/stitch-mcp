import type { Stitch } from '@google/stitch-sdk';
import pLimit from 'p-limit';
import { StitchViteServer } from '../../../lib/server/vite/StitchViteServer.js';
import { downloadText } from '../../../ui/copy-behaviors/clipboard.js';
import type { JsonServerSpec, JsonServerInput, JsonServerResult } from './spec.js';

export class JsonServerHandler implements JsonServerSpec {
  constructor(
    private readonly client: Stitch,
    private readonly downloadHtml: (url: string) => Promise<string> = downloadText,
  ) {}

  async execute(input: JsonServerInput): Promise<JsonServerResult> {
    let sdkScreens: any[];

    try {
      const project = this.client.project(input.projectId);
      sdkScreens = await project.screens();
    } catch (e: any) {
      return {
        success: false,
        error: { code: 'SCREENS_FETCH_FAILED', message: e.message, recoverable: false },
      };
    }

    const server = new StitchViteServer();
    let baseUrl: string;

    try {
      baseUrl = await server.start(0);
    } catch (e: any) {
      return {
        success: false,
        error: { code: 'SERVER_START_FAILED', message: e.message, recoverable: false },
      };
    }

    // Mount screens concurrently
    const limit = pLimit(3);
    const screens: Array<{ screenId: string; title: string; url: string }> = [];

    await Promise.all(
      sdkScreens.map((s: any) => limit(async () => {
        try {
          const codeUrl = await s.getHtml();
          if (codeUrl) {
            const html = await this.downloadHtml(codeUrl);
            server.mount(`/screens/${s.screenId}`, html);
          }
          screens.push({
            screenId: s.screenId,
            title: s.title ?? s.screenId,
            url: `${baseUrl}/screens/${s.screenId}`,
          });
        } catch {
          // Skip screens that fail to load
        }
      }))
    );

    screens.sort((a, b) => a.title.localeCompare(b.title));

    return { success: true, url: baseUrl, screens };
  }
}
