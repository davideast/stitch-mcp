import type { RemoteScreen, SiteConfig, IAssetGateway, UIScreen } from './types.js';
import fs from 'fs-extra';
import path from 'path';

export class SiteService {
  static toUIScreens(screens: RemoteScreen[]): UIScreen[] {
    return screens
      .filter((s) => s.htmlCode && s.htmlCode.downloadUrl)
      .map((s) => ({
        id: s.name,
        title: s.title,
        downloadUrl: s.htmlCode!.downloadUrl!,
        status: 'ignored',
        route: '',
      }));
  }

  static async generateSite(
    config: SiteConfig,
    htmlContent: Map<string, string>,
    assetGateway: IAssetGateway,
    outputDir: string = '.'
  ): Promise<void> {
    // Scaffold
    await fs.ensureDir(path.join(outputDir, 'src/pages'));
    await fs.ensureDir(path.join(outputDir, 'src/layouts'));
    await fs.ensureDir(path.join(outputDir, 'public/assets'));

    // package.json
    const pkgJson = {
      name: "stitch-site",
      type: "module",
      version: "0.0.1",
      scripts: {
        "dev": "astro dev",
        "start": "astro dev",
        "build": "astro build",
        "preview": "astro preview",
        "astro": "astro"
      },
      dependencies: {
        "astro": "^5.0.0"
      }
    };
    await fs.writeJson(path.join(outputDir, 'package.json'), pkgJson, { spaces: 2 });

    // astro.config.mjs
    const astroConfig = `import { defineConfig } from 'astro/config';
export default defineConfig({});`;
    await fs.writeFile(path.join(outputDir, 'astro.config.mjs'), astroConfig);

    // src/layouts/Layout.astro
    const layout = `---
interface Props {
	title: string;
}

const { title } = Astro.props;
---

<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="description" content="Astro description" />
		<meta name="viewport" content="width=device-width" />
		<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
		<meta name="generator" content={Astro.generator} />
		<title>{title}</title>
	</head>
	<body>
		<slot />
	</body>
</html>
`;
    await fs.writeFile(path.join(outputDir, 'src/layouts/Layout.astro'), layout);

    // Process routes
    for (const route of config.routes) {
      if (route.status !== 'included') continue;

      const html = htmlContent.get(route.screenId);
      if (!html) {
        console.warn(`No HTML content found for screen ${route.screenId}`);
        continue;
      }

      // Rewrite
      const { html: rewrittenHtml, assets } = await assetGateway.rewriteHtmlForBuild(html);

      // Copy assets
      const assetsDir = path.join(outputDir, 'public/assets');
      for (const asset of assets) {
        await assetGateway.copyAssetTo(asset.url, path.join(assetsDir, asset.filename));
      }

      let filePath = route.route;
      if (filePath === '/') {
        filePath = 'index';
      } else {
        // Remove leading slash
        if (filePath.startsWith('/')) filePath = filePath.substring(1);
      }

      const fullPath = path.join(outputDir, 'src/pages', `${filePath}.astro`);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, rewrittenHtml);
    }
  }

  static slugify(text: string): string {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }
}
