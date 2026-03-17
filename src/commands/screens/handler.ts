import type { Stitch } from '@google/stitch-sdk';
import pLimit from 'p-limit';

interface Screen {
  screenId: string;
  title: string;
  hasCode: boolean;
  codeUrl: string | null;
  hasImage: boolean;
}

type ScreensResult = {
  success: true;
  projectId: string;
  projectTitle: string;
  screens: Screen[];
} | {
  success: false;
  error: string;
};

export class ScreensHandler {
  constructor(private readonly stitch: Stitch) {}

  async execute(projectId: string): Promise<ScreensResult> {
    try {
      const project = this.stitch.project(projectId);
      const screens = await project.screens();

      // Throttle concurrent API calls to avoid overwhelming the backend
      const limit = pLimit(3);
      const mapped = await Promise.all(screens.map((s: any) => limit(async () => {
        const codeUrl = await s.getHtml().catch(() => null);
        const imageUrl = await s.getImage().catch(() => null);
        return {
          screenId: s.screenId,
          title: s.title ?? s.screenId,
          hasCode: codeUrl !== null,
          codeUrl,
          hasImage: imageUrl !== null,
        };
      })));

      const sorted = mapped.sort((a, b) => {
        if (a.hasCode !== b.hasCode) return a.hasCode ? -1 : 1;
        return a.title.localeCompare(b.title);
      });

      return { success: true, projectId, projectTitle: project.data?.title ?? projectId, screens: sorted };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
