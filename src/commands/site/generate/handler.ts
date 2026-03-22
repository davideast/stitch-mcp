import type { Stitch } from '@google/stitch-sdk';
import pLimit from 'p-limit';
import type { GenerateSpec, GenerateInput, GenerateResult } from './spec.js';
import { SiteService } from '../../../lib/services/site/SiteService.js';
import { AssetGateway } from '../../../lib/server/AssetGateway.js';
import { fetchWithRetry } from '../utils/fetchWithRetry.js';

export class GenerateHandler implements GenerateSpec {
  constructor(
    private readonly client: Stitch,
    private readonly fetchHtml: (url: string) => Promise<string> = fetchWithRetry,
  ) {}

  async execute(input: GenerateInput): Promise<GenerateResult> {
    try {
      const project = this.client.project(input.projectId);
      const sdkScreens = await project.screens();
      const screenMap = new Map(sdkScreens.map((s: any) => [s.screenId, s]));

      // Validate all requested screenIds exist
      const missingIds = input.routesJson
        .map(r => r.screenId)
        .filter(id => !screenMap.has(id));

      if (missingIds.length > 0) {
        return {
          success: false,
          error: {
            code: 'SCREEN_NOT_FOUND',
            message: `Screen IDs not found in project: ${missingIds.join(', ')}`,
            hint: `Run stitch site -p ${input.projectId} --list-screens to see available screen IDs.`,
            recoverable: true,
          },
        };
      }

      // Fetch HTML for each screen
      const limit = pLimit(3);
      const htmlContent = new Map<string, string>();
      const errors: string[] = [];

      await Promise.all(
        input.routesJson.map(r => limit(async () => {
          const screen = screenMap.get(r.screenId)!;
          try {
            const htmlUrl = await screen.getHtml();
            const html = htmlUrl ? await this.fetchHtml(htmlUrl) : '';
            htmlContent.set(r.screenId, html);
          } catch (e: any) {
            errors.push(`${r.screenId}: ${e.message}`);
          }
        }))
      );

      if (errors.length > 0) {
        return {
          success: false,
          error: {
            code: 'HTML_FETCH_FAILED',
            message: `Failed to fetch HTML for screens: ${errors.join('; ')}`,
            recoverable: false,
          },
        };
      }

      const config = {
        projectId: input.projectId,
        routes: input.routesJson.map(r => ({ screenId: r.screenId, route: r.route, status: 'included' as const })),
      };

      const assetGateway = new AssetGateway();
      await SiteService.generateSite(config, htmlContent, assetGateway, input.outputDir);

      return {
        success: true,
        outputDir: input.outputDir,
        pages: input.routesJson.map(r => ({ screenId: r.screenId, route: r.route })),
      };
    } catch (e: any) {
      return {
        success: false,
        error: {
          code: 'GENERATE_FAILED',
          message: e.message,
          recoverable: false,
        },
      };
    }
  }
}
