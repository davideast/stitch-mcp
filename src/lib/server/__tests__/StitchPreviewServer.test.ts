import { describe, it, expect, beforeAll, afterAll, mock, spyOn } from 'bun:test';
import { StitchPreviewServer } from '../StitchPreviewServer.js';
import fs from 'fs-extra';
import path from 'path';

// Mock fs-extra to avoid writing to real project root
const TEMP_DIR = path.join('/tmp', 'stitch-test-' + Date.now());

describe('StitchPreviewServer', () => {
  let server: StitchPreviewServer;
  let baseUrl: string;

  beforeAll(async () => {
    await fs.ensureDir(TEMP_DIR);
    server = new StitchPreviewServer({ projectRoot: TEMP_DIR });
    baseUrl = await server.start(0); // Random port
  });

  afterAll(async () => {
    await server.stop();
    await fs.remove(TEMP_DIR);
  });

  it('serves mounted content from memory', async () => {
    server.mount('/hello', '<html><body><h1>Hello World</h1></body></html>');

    const res = await fetch(`${baseUrl}/hello`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<h1>Hello World</h1>');
    // Verify script injection
    expect(text).toContain('<script src="/_stitch/client.js"></script>');
  });

  it('serves mounted content from file', async () => {
    const filePath = path.join(TEMP_DIR, 'test.html');
    await fs.writeFile(filePath, '<h1>File Content</h1>');

    server.mount('/file', { path: filePath });

    const res = await fetch(`${baseUrl}/file`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<h1>File Content</h1>');
  });

  it('serves client runtime', async () => {
    const res = await fetch(`${baseUrl}/_stitch/client.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
  });

  it('rewrites assets and proxies them', async () => {
    // Mock global fetch for the asset gateway
    const originalFetch = global.fetch;
    const mockFetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const actualUrl = url instanceof Request ? url.url : url.toString();

      if (actualUrl.includes('googleusercontent')) {
        return new Response('fake-image-data', {
          headers: { 'content-type': 'image/png' }
        });
      }
      return originalFetch(url, init);
    });
    global.fetch = mockFetch;

    try {
      const html = '<html><body><img src="https://lh3.googleusercontent.com/xyz" /></body></html>';
      server.mount('/asset-test', html);

      const res = await fetch(`${baseUrl}/asset-test`);
      const text = await res.text();

      // Check rewrite
      expect(text).toContain('/_stitch/asset?url=');
      expect(text).toContain(encodeURIComponent('https://lh3.googleusercontent.com/xyz'));

      // Now call the proxy endpoint to verify caching/fetching
      const assetUrl = `${baseUrl}/_stitch/asset?url=${encodeURIComponent('https://lh3.googleusercontent.com/xyz')}`;

      const assetRes = await fetch(assetUrl);
      expect(assetRes.status).toBe(200);
      const assetBody = await assetRes.text();
      expect(assetBody).toBe('fake-image-data');

    } finally {
      global.fetch = originalFetch;
    }
  });
});
