import type { Stitch } from '@google/stitch-sdk';
import pLimit from 'p-limit';
import type { GenerateSpec, GenerateInput, GenerateResult } from './spec.js';
import { GenerateSiteHandler } from '../generate-site/handler.js';
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


      // Delegate to GenerateSiteHandler
      const generateSiteHandler = new GenerateSiteHandler(this.client);
      const result = await generateSiteHandler.execute({
        projectId: input.projectId,
        routes: input.routesJson,
        outputDir: input.outputDir,
      });

      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'GENERATE_FAILED',
            message: result.error.message,
            recoverable: result.error.recoverable,
          },
        };
      }

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
