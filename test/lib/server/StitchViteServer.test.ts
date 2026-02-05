import { describe, it, expect, afterEach, mock } from 'bun:test';
import { StitchViteServer } from '../../../src/lib/server/vite/StitchViteServer';
import { AssetGateway } from '../../../src/lib/server/AssetGateway';
import { Readable } from 'stream';
import http from 'http';

// Helper to make requests using node:http to avoid global.fetch pollution
const request = (url: string): Promise<{ statusCode: number; body: string }> => {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data }));
        }).on('error', reject);
    });
};

describe('StitchViteServer', () => {
  let server: StitchViteServer;

  afterEach(async () => {
    if (server) await server.stop();
  });

  it('should serve virtual content', async () => {
    server = new StitchViteServer();
    const url = await server.start(0);

    server.mount('/test', '<h1>Hello World</h1>');

    const res = await request(`${url}/test`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Hello World');
  });

  it('should rewrite assets', async () => {
      // Mock AssetGateway to avoid real network calls
      const mockAssetGateway = {
          fetchAsset: mock().mockResolvedValue({
              stream: Readable.from(['fake-image-content']),
              contentType: 'image/png'
          }),
          rewriteHtmlForPreview: new AssetGateway().rewriteHtmlForPreview
      } as unknown as AssetGateway;

      server = new StitchViteServer(process.cwd(), mockAssetGateway);
      const url = await server.start(0);

      const html = '<img src="http://example.com/image.png" />';
      server.mount('/image-test', html);

      const res = await request(`${url}/image-test`);
      expect(res.body).toContain('/_stitch/asset?url=');
      expect(res.body).toContain(encodeURIComponent('http://example.com/image.png'));
  });
});
