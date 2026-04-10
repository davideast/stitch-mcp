import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import * as cheerio from 'cheerio';
import { Readable } from 'stream';
import { parse } from '@astrojs/compiler';
import { is, serialize } from '@astrojs/compiler/utils';

export class AssetGateway {
  private cacheDir: string;

  /**
   * Allowlist of hostname patterns for asset fetching.
   * Only HTTPS URLs matching these patterns are permitted.
   * Expand as needed for additional CDNs used in Stitch designs.
   */
  private static ALLOWED_HOST_PATTERNS: RegExp[] = [
    /\.googleapis\.com$/,
    /\.googleusercontent\.com$/,
    /\.gstatic\.com$/,
    /^cdnjs\.cloudflare\.com$/,
  ];

  /**
   * Validates that a URL is safe to fetch:
   * - Must be HTTPS
   * - Hostname must match the allowlist
   */
  static validateAssetUrl(url: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }

    if (parsed.protocol !== 'https:') {
      return false;
    }

    return AssetGateway.ALLOWED_HOST_PATTERNS.some(pattern => pattern.test(parsed.hostname));
  }

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

    if (!AssetGateway.validateAssetUrl(url)) {
      console.warn(`Blocked asset fetch for disallowed URL: ${url}`);
      return null;
    }

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
      try {
        const stream = fs.createReadStream(cachePath);
        // Suppress unhandled errors (e.g. file deletion race conditions)
        stream.on('error', () => {});
        return { stream, contentType };
      } catch (e) {
        // Fallback to fetch if opening stream fails (e.g. race condition/deletion)
        console.warn(`Failed to open cached asset: ${url}`, e);
      }
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
      
      const tempFilename = `.tmp-${crypto.randomBytes(8).toString('hex')}`;
      const tempPath = path.join(this.cacheDir, tempFilename);

      await fs.writeFile(tempPath, Buffer.from(buffer), { flag: 'wx' });
      await fs.move(tempPath, cachePath, { overwrite: true });

      if (contentType) {
        await fs.writeJson(metadataPath, { contentType });
      }

      const stream = fs.createReadStream(cachePath);
      // Suppress unhandled errors
      stream.on('error', () => {});
      return { stream, contentType };
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

    // Optimistic prefetch: fire-and-forget parallel cache warming.
    // rewriteCssUrls is synchronous; prefetching is a side-effect that does
    // not need to complete before the rewritten CSS is returned.
    Promise.all(discovered.map(url => this.fetchAsset(url).catch(() => {})));

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
    await Promise.all(Array.from(assets).map(url => this.fetchAsset(url).catch(console.error)));

    return $.html();
  }

}

