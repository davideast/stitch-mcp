import React from 'react';
import { render } from 'ink';
import { StitchMCPClient } from '../../services/mcp-client/client.js';
import { SiteBuilder } from './ui/SiteBuilder.js';
import { SiteService } from '../../lib/services/site/SiteService.js';
import { AssetGateway } from '../../lib/server/AssetGateway.js';
import { ProjectSyncer } from './utils/ProjectSyncer.js';
import { SiteManifest } from './utils/SiteManifest.js';
import type { SiteConfig } from '../../lib/services/site/types.js';

interface SiteCommandOptions {
  projectId: string;
  outputDir?: string;
  export?: boolean;
}

export class SiteCommandHandler {
  constructor(private client?: StitchMCPClient) {}

  async execute(options: SiteCommandOptions) {
    const client = this.client || new StitchMCPClient();

    if (options.export) {
      const syncer = new ProjectSyncer(client);
      const remoteScreens = await syncer.fetchManifest(options.projectId);
      const uiScreens = SiteService.toUIScreens(remoteScreens);

      const siteManifest = new SiteManifest(options.projectId);
      const saved = await siteManifest.load();
      for (const screen of uiScreens) {
        const state = saved.get(screen.id);
        if (state?.status) screen.status = state.status;
        if (state?.route) screen.route = state.route;
      }

      const included = uiScreens.filter(s => s.status === 'included');
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
        client={client}
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
