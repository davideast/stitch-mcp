import { describe, it, expect, afterAll, beforeAll } from 'bun:test';
import { StitchViteServer } from '../../../src/lib/server/vite/StitchViteServer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('StitchViteServer', () => {
  let server: StitchViteServer;
  let baseUrl: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stitch-test-'));
    server = new StitchViteServer(tmpDir);
    baseUrl = await server.start(0);
  });

  afterAll(async () => {
    await server.stop();
    await fs.remove(tmpDir);
  });

  it('serves virtual content', async () => {
    server.mount('/virtual', '<h1>Virtual Content</h1>');

    const res = await fetch(`${baseUrl}/virtual`);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toContain('<h1>Virtual Content</h1>');
    // Verify Vite Injection happened
    expect(text).toContain('/@vite/client');
  });

  it('handles asset proxying 404', async () => {
    const res = await fetch(`${baseUrl}/_stitch/asset?url=http://bad-url`);
    // It should try to fetch bad-url from asset gateway.
    // AssetGateway will fail and return 404.
    expect(res.status).toBe(404);
  });
});
