import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import * as cheerio from 'cheerio';
import { Readable } from 'stream';

export class AssetGateway {
  private cacheDir: string;

  constructor(projectRoot: string = process.cwd()) {
    this.cacheDir = path.join(projectRoot, '.stitch-mcp', 'cache');
  }

  async init() {
    await fs.ensureDir(this.cacheDir);
  }

  private getHash(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  async fetchAsset(url: string): Promise<{ stream: Readable; contentType?: string } | null> {
    await this.init();
    const hash = this.getHash(url);
    const cachePath = path.join(this.cacheDir, hash);
    const metadataPath = cachePath + '.meta.json';

    if (await fs.pathExists(cachePath)) {
      let contentType: string | undefined;
      if (await fs.pathExists(metadataPath)) {
        try {
          const meta = await fs.readJson(metadataPath);
          contentType = meta.contentType;
        } catch (e) { }
      }
      return { stream: fs.createReadStream(cachePath), contentType };
    }

    // Miss - fetch with User-Agent for Google Fonts compatibility
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        console.warn(`Failed to fetch asset: ${url} (${response.status})`);
        return null;
      }

      const contentType = response.headers.get('content-type') || undefined;

      const buffer = await response.arrayBuffer();
      await fs.writeFile(cachePath, Buffer.from(buffer));

      if (contentType) {
        await fs.writeJson(metadataPath, { contentType });
      }

      return { stream: fs.createReadStream(cachePath), contentType };
    } catch (e) {
      console.warn(`Failed to fetch asset: ${url}`, e);
      return null;
    }
  }

  async rewriteHtmlForPreview(html: string): Promise<string> {
    const $ = cheerio.load(html);
    const assets = new Set<string>();

    const process = (el: any, attr: string) => {
      const url = $(el).attr(attr);
      if (url && url.startsWith('http')) {
        assets.add(url);
        $(el).attr(attr, `/_stitch/asset?url=${encodeURIComponent(url)}`);
      }
    };

    $('img').each((_, el) => process(el, 'src'));
    $('link[rel="stylesheet"]').each((_, el) => process(el, 'href'));
    $('script').each((_, el) => process(el, 'src'));

    // Optimistic fetch
    for (const url of assets) {
      this.fetchAsset(url).catch(console.error);
    }

    return $.html();
  }

  /**
   * Maps common MIME types to file extensions.
   */
  private getExtensionFromContentType(contentType: string | undefined): string {
    if (!contentType) return '';

    // Extract the base MIME type (ignore charset and other params)
    const mimeType = contentType.split(';')[0]?.trim().toLowerCase();

    const mimeToExt: Record<string, string> = {
      // Stylesheets
      'text/css': '.css',
      // JavaScript
      'text/javascript': '.js',
      'application/javascript': '.js',
      'application/x-javascript': '.js',
      // Images
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/x-icon': '.ico',
      'image/vnd.microsoft.icon': '.ico',
      // Fonts
      'font/woff': '.woff',
      'font/woff2': '.woff2',
      'font/ttf': '.ttf',
      'font/otf': '.otf',
      'application/font-woff': '.woff',
      'application/font-woff2': '.woff2',
      // Other
      'application/json': '.json',
      'text/html': '.html',
      'text/plain': '.txt',
    };

    return mimeToExt[mimeType || ''] || '';
  }

  async rewriteHtmlForBuild(html: string): Promise<{ html: string; assets: { url: string; filename: string }[] }> {
    const $ = cheerio.load(html);
    const assetUrls: string[] = [];

    // Collect all asset URLs
    const collectUrl = (el: any, attr: string) => {
      const url = $(el).attr(attr);
      if (url && url.startsWith('http')) {
        assetUrls.push(url);
      }
    };

    $('img').each((_, el) => collectUrl(el, 'src'));
    $('link[rel="stylesheet"]').each((_, el) => collectUrl(el, 'href'));
    $('script').each((_, el) => collectUrl(el, 'src'));

    // Fetch all assets to get Content-Type headers
    const urlToFilename = new Map<string, string>();

    await Promise.all(assetUrls.map(async (url) => {
      try {
        const result = await this.fetchAsset(url);
        if (!result) return; // Skip failed assets

        const { contentType } = result;
        const hash = this.getHash(url);

        // Try URL extension first, fall back to Content-Type
        const urlObj = new URL(url);
        let ext = path.extname(urlObj.pathname);

        if (!ext) {
          ext = this.getExtensionFromContentType(contentType);
        }

        // If still no extension, use a sensible default based on element type
        // (handled below when rewriting)
        const filename = `${hash}${ext}`;
        urlToFilename.set(url, filename);
      } catch (e) {
        // Skip failed assets
      }
    }));

    // Rewrite URLs in HTML
    const assets: { url: string; filename: string }[] = [];

    const rewriteUrl = (el: any, attr: string, defaultExt: string) => {
      const url = $(el).attr(attr);
      if (url && url.startsWith('http')) {
        let filename = urlToFilename.get(url);
        if (!filename) {
          // Fallback if fetch failed
          const hash = this.getHash(url);
          filename = `${hash}${defaultExt}`;
        }
        $(el).attr(attr, `/assets/${filename}`);
        assets.push({ url, filename });
      }
    };

    $('img').each((_, el) => rewriteUrl(el, 'src', '.png'));
    $('link[rel="stylesheet"]').each((_, el) => rewriteUrl(el, 'href', '.css'));
    $('script').each((_, el) => {
      rewriteUrl(el, 'src', '.js');
      // Add is:inline for Astro compatibility - prevents bundling of public/ assets
      if ($(el).attr('src')?.startsWith('/assets/')) {
        $(el).attr('is:inline', '');
      }
    });

    // Escape curly braces for Astro compatibility
    // Astro interprets {...} as template expressions, so we need to escape them
    // Replace { with {'{'} and } with {'}'}
    let outputHtml = $.html();
    outputHtml = outputHtml.replace(/[{}]/g, (match) => {
      return match === '{' ? "{'{'}" : "{'}'}";
    });

    // Add Astro frontmatter fences to make this a valid .astro file
    const astroOutput = `---
---
${outputHtml}`;

    return { html: astroOutput, assets };
  }

  async copyAssetTo(url: string, destPath: string): Promise<boolean> {
    await this.init();
    const hash = this.getHash(url);
    const cachePath = path.join(this.cacheDir, hash);

    if (await fs.pathExists(cachePath)) {
      await fs.copy(cachePath, destPath);
      return true;
    } else {
      // Try to fetch if not cached
      const result = await this.fetchAsset(url);
      if (!result) {
        console.warn(`Skipping asset copy, fetch failed: ${url}`);
        return false;
      }
      await fs.copy(cachePath, destPath);
      return true;
    }
  }
}
