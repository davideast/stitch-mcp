import type { Stitch } from '@google/stitch-sdk';
import pLimit from 'p-limit';
import type { ListScreensSpec, ListScreensInput, ListScreensResult } from './spec.js';
import { suggestRoute } from '../utils/suggestRoute.js';

export class ListScreensHandler implements ListScreensSpec {
  constructor(private readonly client: Stitch) {}

  async execute(input: ListScreensInput): Promise<ListScreensResult> {
    try {
      const project = this.client.project(input.projectId);
      const sdkScreens = await project.screens();

      const limit = pLimit(3);
      const screens = await Promise.all(
        sdkScreens.map((s: any) => limit(async () => {
          const htmlUrl = await s.getHtml().catch(() => null);
          return {
            screenId: s.screenId,
            title: s.title ?? s.screenId,
            suggestedRoute: suggestRoute(s.title ?? s.screenId),
            hasHtml: htmlUrl !== null,
          };
        }))
      );

      return { success: true, projectId: input.projectId, screens };
    } catch (e: any) {
      return {
        success: false,
        error: {
          code: 'SCREENS_FETCH_FAILED',
          message: e.message,
          recoverable: false,
        },
      };
    }
  }
}
