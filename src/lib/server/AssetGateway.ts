import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import * as cheerio from 'cheerio';
import { Readable } from 'stream';
import { parse } from '@astrojs/compiler';
import { is, serialize } from '@astrojs/compiler/utils';

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

  rewriteCssUrls(css: string, baseUrl: string): string {
    const discovered: string[] = [];

    // First pass: rewrite bare-string @import (not @import url() which is handled below)
    // Matches: @import '../reset.css'; and @import "https://fonts.googleapis.com/...";
    const importRewritten = css.replace(
      /@import\s+(['"])([^'"]+)\1\s*;/g,
      (match, quote, rawUrl) => {
        const trimmed = rawUrl.trim();

        if (
          !trimmed ||
          trimmed.startsWith('data:') ||
          trimmed.startsWith('/_stitch/')
        ) {
          return match;
        }

        let resolved: string;
        try {
          if (trimmed.startsWith('//')) {
            resolved = new URL(trimmed, baseUrl).href;
          } else if (/^https?:\/\//.test(trimmed)) {
            resolved = trimmed;
          } else {
            resolved = new URL(trimmed, baseUrl).href;
          }
        } catch {
          return match;
        }

        discovered.push(resolved);
        return `@import ${quote}/_stitch/asset?url=${encodeURIComponent(resolved)}${quote};`;
      },
    );

    // Second pass: rewrite url() references (covers @import url(), font src, background, etc.)
    const rewritten = importRewritten.replace(
      /url\(\s*(['"]?)([^)]*?)\1\s*\)/g,
      (match, quote, rawUrl) => {
        const trimmed = rawUrl.trim();

        // Skip empty, data URIs, fragment-only refs, and already-proxied URLs
        if (
          !trimmed ||
          trimmed.startsWith('data:') ||
          (trimmed.startsWith('#') && !trimmed.startsWith('#/')) ||
          trimmed.startsWith('/_stitch/')
        ) {
          return match;
        }

        let resolved: string;
        try {
          if (trimmed.startsWith('//')) {
            // Protocol-relative URL — resolve against base to get full URL
            resolved = new URL(trimmed, baseUrl).href;
          } else if (/^https?:\/\//.test(trimmed)) {
            // Already absolute HTTP URL
            resolved = trimmed;
          } else {
            // Relative URL — resolve against baseUrl
            resolved = new URL(trimmed, baseUrl).href;
          }
        } catch {
          // Malformed URL — leave unchanged
          return match;
        }

        discovered.push(resolved);
        return `url(${quote}/_stitch/asset?url=${encodeURIComponent(resolved)}${quote})`;
      },
    );

    // Optimistic prefetch for discovered URLs
    for (const url of discovered) {
      this.fetchAsset(url).catch(() => {});
    }

    return rewritten;
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

    // Use AST-based escaping for curly braces
    // This escapes {...} only in text nodes that are NOT inside <script> or <style> elements
    // Making the output compatible with Astro, React, and other JSX-like frameworks

    // Remove DOCTYPE declaration using Cheerio's DOM API (more robust than regex)
    // Astro adds DOCTYPE during build, and the Astro compiler's serialize function
    // incorrectly outputs just "html" for DOCTYPE nodes
    $.root().contents().filter((_, el) => el.type === 'directive' && el.name === '!doctype').remove();

    let outputHtml = $.html();

    // Add Astro frontmatter fences first to make it parseable
    const astroContent = `---\n---\n${outputHtml}`;

    // Parse with Astro compiler to get AST
    const parseResult = await parse(astroContent, { position: false });

    // Elements whose content should not be escaped
    const skipElements = new Set(['script', 'style']);

    // Recursive function to walk and escape expression nodes
    // The Astro parser converts {foo} into expression nodes, so we need to
    // convert them back to escaped text like {'{'}foo{'}'}
    const escapeExpressions = (node: any, insideSkipElement: boolean): void => {
      // Check if this is a skip element
      const isSkipElement = is.element(node) && skipElements.has(node.name.toLowerCase());
      const shouldSkip = insideSkipElement || isSkipElement;

      // Process children and convert expression nodes to escaped text
      if (is.parent(node) && !shouldSkip) {
        const newChildren: any[] = [];
        for (const child of node.children) {
          // Convert expression nodes to escaped text
          if (child.type === 'expression') {
            // Get the expression content
            const exprContent = child.children
              ?.filter((c: any) => is.text(c))
              .map((c: any) => c.value)
              .join('') || '';
            // Replace with escaped text: {'{'}content{'}'}
            newChildren.push({
              type: 'text',
              value: `{'{'}${exprContent}{'}'}`
            });
          } else {
            newChildren.push(child);
            escapeExpressions(child, shouldSkip);
          }
        }
        node.children = newChildren;
      } else if (is.parent(node)) {
        // Inside skip element, just recurse without escaping
        for (const child of node.children) {
          escapeExpressions(child, shouldSkip);
        }
      }
    };

    // Start walking from the root
    escapeExpressions(parseResult.ast, false);

    const astroOutput = serialize(parseResult.ast);

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
