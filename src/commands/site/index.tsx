import React from 'react';
import { render } from 'ink';
import { StitchMCPClient } from '../../services/mcp-client/client.js';
import { SiteBuilder } from './ui/SiteBuilder.js';
import { SiteService } from '../../lib/services/site/SiteService.js';
import { AssetGateway } from '../../lib/server/AssetGateway.js';
import type { SiteConfig } from '../../lib/services/site/types.js';

interface SiteCommandOptions {
  projectId: string;
  outputDir?: string;
}

export class SiteCommandHandler {
  async execute(options: SiteCommandOptions) {
    const client = new StitchMCPClient();

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
