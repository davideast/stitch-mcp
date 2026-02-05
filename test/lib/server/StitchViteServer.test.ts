import { describe, it, expect, afterEach, beforeAll, afterAll, mock } from 'bun:test';
import { StitchViteServer } from '../../../src/lib/server/vite/StitchViteServer';

describe('StitchViteServer', () => {
  let server: StitchViteServer;
  const originalFetch = global.fetch;

  beforeAll(() => {
    global.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
       const url = input.toString();
       if (url.includes('example.com')) {
           return Promise.resolve(new Response('fake-image'));
       }
       return originalFetch(input, init);
    }) as any;
  });

  afterAll(() => {
      global.fetch = originalFetch;
  });

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
      server = new StitchViteServer();
      const url = await server.start(0);

      const html = '<img src="http://example.com/image.png" />';
      server.mount('/image-test', html);

      const res = await fetch(`${url}/image-test`);
      const text = await res.text();

      expect(text).toContain('/_stitch/asset?url=');
      expect(text).toContain(encodeURIComponent('http://example.com/image.png'));
  });
});
