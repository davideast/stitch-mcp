import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';

export class AssetGateway {
  private cacheDir: string;

  constructor(projectRoot: string) {
    this.cacheDir = path.join(projectRoot, '.stitch-mcp', 'cache');
    fs.ensureDirSync(this.cacheDir);
  }

  /**
   * Fetches a remote asset or serves from cache.
   * Returns a stream to be piped to the HTTP response.
   */
  async fetchAsset(url: string): Promise<{ stream: Readable; type: string }> {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const localPath = path.join(this.cacheDir, hash);
    const metaPath = `${localPath}.meta.json`;

    // 1. Cache Hit
    if ((await fs.pathExists(localPath)) && (await fs.pathExists(metaPath))) {
      const meta = await fs.readJson(metaPath);
      return {
        stream: fs.createReadStream(localPath),
        type: meta.type || 'application/octet-stream',
      };
    }

    // 2. Cache Miss - Fetch Remote
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to fetch asset: ${url} (${response.status})`);
    }

    const type = response.headers.get('content-type') || 'application/octet-stream';

    // 3. Write to Disk (Clone stream)

    const buffer = await response.arrayBuffer();
    await fs.writeFile(localPath, Buffer.from(buffer));
    await fs.writeJson(metaPath, { type, url });

    return {
      stream: fs.createReadStream(localPath),
      type,
    };
  }

  /**
   * Rewrites HTML to point to the local proxy.
   * Used during Preview (Memory -> Browser).
   */
  rewriteHtmlForPreview(html: string): string {
    // Regex for Google Storage and generic remote URLs commonly found in Stitch
    // We aggressively capture src="..." and href="..."
    return html.replace(
      /(src|href)="https:\/\/(lh3\.googleusercontent\.com|contribution\.usercontent\.google\.com|.*\.googleusercontent\.com)[^"]+"/g,
      (match, attr) => {
        const url = match.slice(attr.length + 2, -1);
        const encoded = encodeURIComponent(url);
        // Trigger background fetch to warm cache (fire and forget)
        this.fetchAsset(url).catch(() => {});
        return `${attr}="/_stitch/asset?url=${encoded}"`;
      }
    );
  }
}
