import type { StitchToolClient, Stitch } from '@google/stitch-sdk';
import type { VirtualTool } from '../spec.js';
import pLimit from 'p-limit';
import { fetchWithRetry } from '../../site/utils/fetchWithRetry.js';

export const buildSiteTool: VirtualTool = {
  name: 'build_site',
  description: '(Virtual) Builds a site from a Stitch project by mapping screens to routes. Returns the design HTML for each page to use as context for code generation.',
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
    },
    required: ['projectId', 'routes'],
  },
  execute: async (client: StitchToolClient, args: any, stitch?: Stitch) => {
    if (!stitch) throw new Error('build_site requires a Stitch instance');
    const { projectId, routes } = args;

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

    // Fetch project screens via injected SDK instance
    const project = stitch.project(projectId);
    const sdkScreens = await project.screens();
    const screenMap = new Map(sdkScreens.map((s: any) => [s.screenId, s]));

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
            const htmlUrl = await screen.getHtml();
            if (htmlUrl) {
              const html = await fetchWithRetry(htmlUrl);
              htmlContent.set(r.screenId, html);
            } else {
               htmlContent.set(r.screenId, '');
            }
          } catch (e: any) {
            errors.push(`${r.screenId}: ${e.message}`);
          }
        })
      )
    );

    if (errors.length > 0) {
      throw new Error(`Failed to fetch HTML for screens: ${errors.join('; ')}`);
    }

    // Return raw HTML content for each page
    const pages = routes.map((r: any) => ({
      screenId: r.screenId,
      route: r.route,
      title: screenMap.get(r.screenId)!.title ?? r.screenId,
      html: htmlContent.get(r.screenId)!,
    }));

    return {
      success: true,
      pages,
      message: `Built ${pages.length} page(s) with design HTML`,
    };
  },
};
