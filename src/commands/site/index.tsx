import React from 'react';
import { render } from 'ink';
import { stitch } from '@google/stitch-sdk';
import type { Stitch } from '@google/stitch-sdk';
import { SiteBuilder } from './ui/SiteBuilder.js';
import { SiteService } from '../../lib/services/site/SiteService.js';
import { AssetGateway } from '../../lib/server/AssetGateway.js';
import { SiteManifest } from './utils/SiteManifest.js';
import { ListScreensHandler } from './list-screens/handler.js';
import { ListScreensInputSchema } from './list-screens/spec.js';
import { GenerateHandler } from './generate/handler.js';
import { GenerateInputSchema } from './generate/spec.js';
import type { SiteConfig, UIScreen } from '../../lib/services/site/types.js';

interface SiteCommandOptions {
  projectId: string;
  outputDir?: string;
  export?: boolean;
  listScreens?: boolean;
  routes?: string;
}

export class SiteCommandHandler {
  constructor(private client: Stitch = stitch) {}

  async execute(options: SiteCommandOptions) {
    if (options.listScreens) {
      const input = ListScreensInputSchema.safeParse({ projectId: options.projectId });
      if (!input.success) {
        console.log(JSON.stringify({ success: false, error: { code: 'INVALID_INPUT', message: input.error.issues[0]?.message } }, null, 2));
        return;
      }
      const result = await new ListScreensHandler(this.client).execute(input.data);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (options.routes !== undefined) {
      const input = GenerateInputSchema.safeParse({
        projectId: options.projectId,
        routesJson: options.routes,
        outputDir: options.outputDir,
      });
      if (!input.success) {
        console.log(JSON.stringify({ success: false, error: { code: 'INVALID_INPUT', message: input.error.issues[0]?.message } }, null, 2));
        return;
      }
      const result = await new GenerateHandler(this.client).execute(input.data);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (options.export) {
      const project = this.client.project(options.projectId);
      const sdkScreens = await project.screens();

      const uiScreens = await Promise.all(
        sdkScreens.map(async (s: any) => ({
          id: s.screenId,
          title: s.title ?? s.screenId,
          status: 'ignored' as const,
          route: '',
          downloadUrl: await s.getHtml().catch(() => null)
        }))
      ) as UIScreen[];

      const validScreens = uiScreens.filter(s => !!s.downloadUrl);

      const siteManifest = new SiteManifest(options.projectId);
      const saved = await siteManifest.load();
      for (const screen of validScreens) {
        const state = saved.get(screen.id);
        if (state?.status) screen.status = state.status;
        if (state?.route) screen.route = state.route;
      }

      const included = validScreens.filter(s => s.status === 'included');
      const exportData = {
        projectId: options.projectId,
        routes: included.map(s => ({
          screenId: s.id,
          route: s.route,
        })),
      };
      console.log(JSON.stringify(exportData, null, 2));
      return;
    }

    let resultConfig: SiteConfig | null = null;
    let resultHtml: Map<string, string> | undefined;

    const { waitUntilExit } = render(
      <SiteBuilder
        projectId={options.projectId}
        client={this.client}
        onExit={(config, html) => {
          resultConfig = config;
          resultHtml = html;
        }}
      />
    );

    await waitUntilExit();

    if (resultConfig && resultHtml) {
      console.log('Generating site...');
      const assetGateway = new AssetGateway();
      const outputDir = options.outputDir || '.';

      await SiteService.generateSite(
        resultConfig,
        resultHtml,
        assetGateway,
        outputDir
      );
      console.log('Site generated successfully!');
    } else {
      // console.log('Cancelled.');
    }
  }
}
