import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { BlobStoreSpec, PutResult, HasResult, GetResult } from './spec.js';

const EXT_BY_MIME: Record<string, string> = {
  'application/json': 'json',
  'text/html': 'html',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
};

function extForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? 'bin';
}

export class BlobStoreHandler implements BlobStoreSpec {
  constructor(private readonly root: string) {}

  async put(buffer: Buffer, mime: string): Promise<PutResult> {
    try {
      const sha256 = createHash('sha256').update(buffer).digest('hex');
      const existing = await this.findBySha(sha256);
      if (existing) {
        const s = await stat(existing);
        return { success: true, data: { sha256, size: s.size, mime } };
      }
      const path = join(this.root, sha256.slice(0, 2), `${sha256}.${extForMime(mime)}`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, buffer);
      return { success: true, data: { sha256, size: buffer.length, mime } };
    } catch (e) {
      return {
        success: false,
        error: {
          code: 'BLOB_WRITE_FAILED',
          message: e instanceof Error ? e.message : String(e),
          recoverable: false,
        },
      };
    }
  }

  private async findBySha(sha256: string): Promise<string | null> {
    const dir = join(this.root, sha256.slice(0, 2));
    let entries: string[];
    try { entries = await readdir(dir); } catch { return null; }
    const match = entries.find((e) => e.startsWith(`${sha256}.`));
    return match ? join(dir, match) : null;
  }

  async fetch(url: string, mimeHint?: string): Promise<PutResult> {
    let response: Response;
    try {
      response = await globalThis.fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'stitch-mcp-log/0.1 (Mozilla/5.0)' },
      });
    } catch (e) {
      return {
        success: false,
        error: {
          code: 'BLOB_FETCH_NETWORK',
          message: e instanceof Error ? e.message : String(e),
          recoverable: true,
        },
      };
    }
    if (!response.ok) {
      return {
        success: false,
        error: {
          code: 'BLOB_FETCH_HTTP_ERROR',
          message: `HTTP ${response.status} for ${url}`,
          recoverable: false,
        },
      };
    }
    const mime = (response.headers.get('content-type') ?? mimeHint ?? 'application/octet-stream').split(';')[0]!.trim();
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.put(buffer, mime);
  }
  async has(sha256: string): Promise<HasResult> {
    const path = await this.findBySha(sha256);
    return { success: true, data: path != null };
  }
  async get(sha256: string): Promise<GetResult> {
    const path = await this.findBySha(sha256);
    if (!path) return { success: true, data: null };
    const buf = await readFile(path);
    return { success: true, data: buf };
  }
}
