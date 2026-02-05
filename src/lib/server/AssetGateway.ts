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

  async fetchAsset(url: string): Promise<{ stream: Readable; contentType?: string }> {
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
              } catch (e) {}
          }
          return { stream: fs.createReadStream(cachePath), contentType };
      }

      // Miss
      const response = await fetch(url);
      if (!response.ok) {
          throw new Error(`Failed to fetch asset: ${url} (${response.status})`);
      }

      const contentType = response.headers.get('content-type') || undefined;

      const buffer = await response.arrayBuffer();
      await fs.writeFile(cachePath, Buffer.from(buffer));

      if (contentType) {
          await fs.writeJson(metadataPath, { contentType });
      }

      return { stream: fs.createReadStream(cachePath), contentType };
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

  async rewriteHtmlForBuild(html: string): Promise<{ html: string; assets: { url: string; filename: string }[] }> {
      const $ = cheerio.load(html);
      const assets: { url: string; filename: string }[] = [];

      const processElement = (el: any, attr: string) => {
          const url = $(el).attr(attr);
          if (url && url.startsWith('http')) {
              try {
                  const urlObj = new URL(url);
                  let ext = path.extname(urlObj.pathname);
                  if (!ext) ext = '.bin'; // Default
                  const hash = this.getHash(url);
                  const filename = `${hash}${ext}`;

                  $(el).attr(attr, `/assets/${filename}`);
                  assets.push({ url, filename });
              } catch (e) {
                  // Skip invalid URLs
              }
          }
      };

      $('img').each((_, el) => processElement(el, 'src'));
      $('link[rel="stylesheet"]').each((_, el) => processElement(el, 'href'));
      $('script').each((_, el) => processElement(el, 'src'));

      // Ensure they are fetched
      await Promise.all(assets.map(a => this.fetchAsset(a.url)));

      return { html: $.html(), assets };
  }

  async copyAssetTo(url: string, destPath: string): Promise<void> {
      await this.init();
      const hash = this.getHash(url);
      const cachePath = path.join(this.cacheDir, hash);

      if (await fs.pathExists(cachePath)) {
          await fs.copy(cachePath, destPath);
      } else {
          // Should not happen if fetchAsset was called before, but safe to retry
          await this.fetchAsset(url);
          await fs.copy(cachePath, destPath);
      }
  }
}
