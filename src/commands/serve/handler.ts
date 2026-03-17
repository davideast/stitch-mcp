import type { Stitch } from '@google/stitch-sdk';
import pLimit from 'p-limit';

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
  constructor(private readonly stitch: Stitch) {}

  async execute(projectId: string): Promise<ServeHandlerResult> {
    try {
      const project = this.stitch.project(projectId);
      const screens = await project.screens();

      // Throttle concurrent API calls
      const limit = pLimit(3);
      const withHtml = await Promise.all(
        screens.map((s: any) => limit(async () => ({
          screenId: s.screenId,
          title: s.title ?? s.screenId,
          codeUrl: await s.getHtml(),
        })))
      );

      const filtered = withHtml.filter(s => s.codeUrl !== null);

      // Sort alphabetically by title
      filtered.sort((a, b) => a.title.localeCompare(b.title));

      return {
        success: true,
        projectId,
        projectTitle: project.data?.title ?? projectId,
        screens: filtered,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
