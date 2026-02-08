import type { StitchMCPClient } from '../../../services/mcp-client/client.js';
import { ProjectSyncer } from '../../site/utils/ProjectSyncer.js';
import { SiteService } from '../../../lib/services/site/SiteService.js';
import { AssetGateway } from '../../../lib/server/AssetGateway.js';
import type { SiteConfig } from '../../../lib/services/site/types.js';
import type { VirtualTool } from '../spec.js';
import pLimit from 'p-limit';

export const buildSiteTool: VirtualTool = {
  name: 'build_site',
  description: '(Virtual) Generates an Astro site from a Stitch project by specifying screen-to-route mappings.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Required. The project ID to build a site from.',
      },
      routes: {
        type: 'array',
        description: 'Required. Array of screen-to-route mappings.',
        items: {
          type: 'object',
          properties: {
            screenId: {
              type: 'string',
              description: 'The screen ID to use for this route.',
            },
            route: {
              type: 'string',
              description: 'The route path (e.g. "/" or "/about").',
            },
          },
          required: ['screenId', 'route'],
        },
      },
      outputDir: {
        type: 'string',
        description: 'Optional. Output directory for the generated site. Defaults to ".".',
      },
    },
    required: ['projectId', 'routes'],
  },
  execute: async (client: StitchMCPClient, args: any) => {
    const { projectId, routes, outputDir = '.' } = args;

    // Validate routes
    if (!Array.isArray(routes)) {
      throw new Error('routes must be an array');
    }
    if (routes.length === 0) {
      throw new Error('routes must be a non-empty array');
    }
    for (const entry of routes) {
      if (!entry.screenId || typeof entry.screenId !== 'string') {
        throw new Error('Each route entry must have a "screenId" string');
      }
      if (!entry.route || typeof entry.route !== 'string') {
        throw new Error('Each route entry must have a "route" string');
      }
    }

    // Check for duplicate routes
    const routePaths = routes.map((r: any) => r.route);
    const uniqueRoutes = new Set(routePaths);
    if (uniqueRoutes.size !== routePaths.length) {
      const duplicates = routePaths.filter((r: string, i: number) => routePaths.indexOf(r) !== i);
      throw new Error(`Duplicate route paths found: ${[...new Set(duplicates)].join(', ')}`);
    }

    // Fetch project screens
    const syncer = new ProjectSyncer(client);
    const remoteScreens = await syncer.fetchManifest(projectId);
    const uiScreens = SiteService.toUIScreens(remoteScreens);

    // Build lookup map
    const screenMap = new Map(uiScreens.map(s => [s.id, s]));

    // Validate all requested screenIds exist
    const missingIds = routes
      .map((r: any) => r.screenId)
      .filter((id: string) => !screenMap.has(id));
    if (missingIds.length > 0) {
      throw new Error(`Screen IDs not found in project: ${missingIds.join(', ')}`);
    }

    // Fetch HTML for each screen with concurrency limit
    const limit = pLimit(3);
    const htmlContent = new Map<string, string>();
    const errors: string[] = [];

    await Promise.all(
      routes.map((r: any) =>
        limit(async () => {
          const screen = screenMap.get(r.screenId)!;
          try {
            const html = await syncer.fetchContent(screen.downloadUrl);
            htmlContent.set(r.screenId, html);
          } catch (e: any) {
            errors.push(`${r.screenId}: ${e.message}`);
          }
        })
      )
    );

    if (errors.length > 0) {
      throw new Error(`Failed to fetch HTML for screens: ${errors.join('; ')}`);
    }

    // Construct SiteConfig
    const siteConfig: SiteConfig = {
      projectId,
      routes: routes.map((r: any) => ({
        screenId: r.screenId,
        route: r.route,
        status: 'included' as const,
      })),
    };

    // Generate site
    await SiteService.generateSite(siteConfig, htmlContent, new AssetGateway(), outputDir);

    // Return result
    const pages = routes.map((r: any) => ({
      screenId: r.screenId,
      route: r.route,
      title: screenMap.get(r.screenId)!.title,
    }));

    return {
      success: true,
      outputDir,
      pages,
      message: `Site generated with ${pages.length} page(s) at ${outputDir}`,
    };
  },
};
