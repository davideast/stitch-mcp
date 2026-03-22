import type { Stitch } from '@google/stitch-sdk';
import pLimit from 'p-limit';
import type { ServeSpec, ServeResult } from './spec.js';

export class ServeHandler implements ServeSpec {
  constructor(private readonly stitch: Stitch) {}

  async execute(projectId: string): Promise<ServeResult> {
    try {
      const project = this.stitch.project(projectId);
      const screens = await project.screens();

      const limit = pLimit(3);
      const withHtml = await Promise.all(
        screens.map((s: any) => limit(async () => {
          const codeUrl = await s.getHtml().catch(() => null);
          return { screenId: s.screenId, title: s.title ?? s.screenId, codeUrl };
        }))
      );

      const filtered = withHtml
        .filter(s => s.codeUrl !== null)
        .sort((a, b) => a.title.localeCompare(b.title));

      return {
        success: true,
        projectId,
        projectTitle: project.data?.title ?? projectId,
        screens: filtered,
      };
    } catch (e: any) {
      return {
        success: false,
        error: { code: 'SCREENS_FETCH_FAILED', message: e.message, recoverable: false },
      };
    }
  }
}
