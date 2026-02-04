import { describe, it, expect, afterEach } from 'bun:test';
import { serveHtmlInMemory } from './server';

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

    const response = await fetch(instance.url);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(text).toBe(html);
  });
});
