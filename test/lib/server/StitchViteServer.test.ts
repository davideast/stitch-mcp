import { describe, it, expect, afterEach, mock } from 'bun:test';
import { StitchViteServer } from '../../../src/lib/server/vite/StitchViteServer';
import { AssetGateway } from '../../../src/lib/server/AssetGateway';
import { Readable } from 'stream';

describe('StitchViteServer', () => {
  let server: StitchViteServer;

  afterEach(async () => {
    if (server) await server.stop();
  });

  it('should serve virtual content', async () => {
    server = new StitchViteServer();
    const url = await server.start(0);

    server.mount('/test', '<h1>Hello World</h1>');

    const res = await fetch(`${url}/test`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Hello World');
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

      const res = await fetch(`${url}/image-test`);
      const text = await res.text();

      expect(text).toContain('/_stitch/asset?url=');
      expect(text).toContain(encodeURIComponent('http://example.com/image.png'));
  });
});
