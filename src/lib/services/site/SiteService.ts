import type { RemoteScreen, ScreenStack, SiteConfig, SiteRoute, IAssetGateway } from './types.js';
import fs from 'fs-extra';
import path from 'path';

export class SiteService {
  /**
   * Groups screens into stacks, identifying artifacts and obsolete versions.
   */
  static stackScreens(screens: RemoteScreen[]): ScreenStack[] {
    // 1. Filter: Discard screens where !htmlCode
    const validScreens = screens.filter((s) => s.htmlCode && s.htmlCode.downloadUrl);

    // 2. Group: Map by title.trim()
    const groups = new Map<string, RemoteScreen[]>();
    for (const screen of validScreens) {
      const title = screen.title.trim();
      if (!groups.has(title)) {
        groups.set(title, []);
      }
      groups.get(title)!.push(screen);
    }

    const stacks: ScreenStack[] = [];

    // 3. Create Stacks
    for (const [title, versions] of groups) {
      // "Select: Pick the last item in the version list as the bestCandidate."
      const bestCandidate = versions[versions.length - 1];
      if (!bestCandidate) continue;

      // Classify: Artifacts
      const isArtifact = /\.(png|jpg|jpeg)$/i.test(title) || title.startsWith('localhost_');

      stacks.push({
        id: bestCandidate.name,
        title,
        versions,
        isArtifact,
        isObsolete: false, // Default
      });
    }

    // 4. Classify: Obsolete
    // Regex v(\d+)$
    const versionRegex = /v(\d+)$/;

    // Map of baseName -> List of { version: number, stack: ScreenStack }
    const versionedStacks = new Map<string, Array<{ version: number; stack: ScreenStack }>>();

    for (const stack of stacks) {
      const match = stack.title.match(versionRegex);
      if (match && match[1]) {
        const version = parseInt(match[1], 10);
        const baseName = stack.title.replace(versionRegex, '').trim();

        if (!versionedStacks.has(baseName)) {
          versionedStacks.set(baseName, []);
        }
        const entries = versionedStacks.get(baseName);
        if (entries) {
          entries.push({ version, stack });
        }
      }
    }

    // Mark lower versions as obsolete
    for (const [_baseName, entries] of versionedStacks) {
      if (entries.length > 1) {
        // Sort by version descending
        entries.sort((a, b) => b.version - a.version);

        // The first one is the latest (keep isObsolete=false)
        // All others are obsolete
        for (let i = 1; i < entries.length; i++) {
          const entry = entries[i];
          if (entry) {
            entry.stack.isObsolete = true;
          }
        }
      }
    }

    return stacks;
  }

  static generateDraftConfig(projectId: string, stacks: ScreenStack[]): SiteConfig {
    const routes: SiteRoute[] = [];
    const usedRoutes = new Map<string, string>();

    // Sort stacks by title to be deterministic
    const sortedStacks = [...stacks].sort((a, b) => a.title.localeCompare(b.title));

    for (const stack of sortedStacks) {
      const status = (stack.isArtifact || stack.isObsolete) ? 'ignored' : 'included';

      let preferredRoute = '/';
      const titleLower = stack.title.trim().toLowerCase();

      if (['home', 'index', 'landing'].includes(titleLower)) {
        preferredRoute = '/';
      } else {
        preferredRoute = '/' + this.slugify(stack.title);
      }

      let finalRoute = preferredRoute;
      let warning: string | undefined;

      // Collision detection logic
      if (usedRoutes.has(finalRoute)) {
        if (preferredRoute === '/') {
          finalRoute = '/' + this.slugify(stack.title);
        }

        if (usedRoutes.has(finalRoute)) {
          let counter = 1;
          // Determine base route for incrementing
          let baseRoute = finalRoute;
          if (baseRoute === '/') baseRoute = '/home';

          while (usedRoutes.has(`${baseRoute}-${counter}`)) {
            counter++;
          }
          finalRoute = `${baseRoute}-${counter}`;
        }

        warning = 'Potential collision detected. Route was modified.';
      }

      usedRoutes.set(finalRoute, stack.id);

      routes.push({
        screenId: stack.id,
        route: finalRoute,
        status,
        warning
      });
    }

    return {
      projectId,
      routes
    };
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
