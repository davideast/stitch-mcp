import { describe, it, expect, afterEach } from 'bun:test';
import { serveHtmlInMemory } from './server';
import { get } from 'node:http';

describe('serveHtmlInMemory', () => {
  let stopServer: (() => void) | undefined;

  afterEach(() => {
    if (stopServer) {
      stopServer();
      stopServer = undefined;
    }
  });

  it('serves html content', async () => {
    const html = '<h1>Hello World</h1>';
    const instance = await serveHtmlInMemory(html, { openBrowser: false });
    stopServer = instance.stop;

    // Use node:http to avoid global fetch mock pollution from other tests
    const { statusCode, headers, body } = await new Promise<{ statusCode: number | undefined; headers: any; body: string }>((resolve, reject) => {
      get(instance.url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        }));
        res.on('error', reject);
      });
    });

    expect(statusCode).toBe(200);
    expect(headers['content-type']).toContain('text/html');
    expect(body).toBe(html);
  });
});
