import { join } from 'node:path';
import { appendEvent } from './append.js';
import { BlobStoreHandler } from './blob-store/handler.js';
import { CaptureHandler } from './capture/handler.js';
import type { CaptureSpec } from './capture/spec.js';

export const DEFAULT_LOG_ROOT = '.stitch-mcp/log';

export function isLogEnabled(): boolean {
  return process.env.STITCH_MCP_LOG === '1';
}

export function createCaptureHandler(root: string = DEFAULT_LOG_ROOT): CaptureSpec {
  const blobs = new BlobStoreHandler(join(root, 'blobs'));
  const eventsPath = join(root, 'events.jsonl');
  return new CaptureHandler({
    blobs,
    append: (event) => appendEvent(eventsPath, event),
  });
}
