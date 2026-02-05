import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';

export class AssetGateway {
  private cacheDir: string;
  private pendingDownloads = new Map<string, Promise<void>>();

  constructor(projectRoot: string) {
    // Project-local cache directory
    this.cacheDir = path.join(projectRoot, '.stitch-mcp', 'cache');
    fs.ensureDirSync(this.cacheDir);
  }

  /**
   * Scans HTML for specific remote patterns (e.g., googleusercontent)
   * Rewrites them to /_stitch/asset?url=...
   * Triggers background download.
   */
  processHtml(html: string): string {
    return html.replace(
      /(src|href)="https:\/\/(lh3\.googleusercontent|contribution\.usercontent)[^"]+"/g,
      (match, attr, domain) => {
        // Extract the full URL (remove attr="" wrapper)
        const url = match.slice(attr.length + 2, -1);
        const encoded = encodeURIComponent(url);

        // Trigger background fetch (fire and forget)
        this.fetchAsset(url).catch(e => console.error(`Background fetch failed: ${url}`));

        // Return rewritten tag
        return `${attr}="/_stitch/asset?url=${encoded}"`;
      }
    );
  }

  /**
   * Fetch, Cache, and Stream an asset.
   */
  async fetchAsset(url: string): Promise<{ stream: NodeJS.ReadableStream, type: string }> {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const localPath = path.join(this.cacheDir, hash);
    const metaPath = localPath + '.meta.json';

    // Helper to serve from cache
    const serveFromCache = async () => {
      const meta = await fs.readJson(metaPath).catch(() => ({ type: 'application/octet-stream' }));
      return {
        stream: fs.createReadStream(localPath),
        type: meta.type
      };
    };

    // 1. Cache Hit (Check metaPath to ensure completeness)
    if (await fs.pathExists(metaPath) && await fs.pathExists(localPath)) {
      return serveFromCache();
    }

    // 2. Pending Download (Deduplication)
    if (this.pendingDownloads.has(hash)) {
      await this.pendingDownloads.get(hash);
      return serveFromCache();
    }

    // 3. Cache Miss - Start Download
    const downloadPromise = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

        const type = response.headers.get('content-type') || 'application/octet-stream';
        const fileStream = fs.createWriteStream(localPath);

        if (response.body) {
          // @ts-ignore: Readable.fromWeb is available in Node 18+
          const nodeStream = Readable.fromWeb(response.body);

          await new Promise((resolve, reject) => {
            nodeStream.pipe(fileStream);
            nodeStream.on('error', reject);
            fileStream.on('finish', resolve);
          });
        } else {
          fileStream.end();
        }

        // Write meta AFTER content to signal completion
        await fs.writeJson(metaPath, { type, url });
      } finally {
        this.pendingDownloads.delete(hash);
      }
    })();

    this.pendingDownloads.set(hash, downloadPromise);

    // Wait for it to finish and then serve
    await downloadPromise;
    return serveFromCache();
  }
}
