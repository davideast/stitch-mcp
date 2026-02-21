import { describe, it, expect, afterEach } from 'bun:test';
import { serveHtmlInMemory } from './server';
import { get } from 'node:http';

describe('serveHtmlInMemory Security', () => {
  let stopServer: (() => void) | undefined;

  afterEach(() => {
    if (stopServer) {
      stopServer();
      stopServer = undefined;
    }
  });

  it('serves html content with security headers', async () => {
    const html = '<h1>Hello World</h1>';
    const instance = await serveHtmlInMemory(html, { openBrowser: false });
    stopServer = instance.stop;

    const { headers } = await new Promise<{ headers: any }>((resolve, reject) => {
      get(instance.url, (res) => {
        resolve({ headers: res.headers });
        res.resume(); // consume the stream
      }).on('error', reject);
    });

    // Check for CSP headers
    expect(headers['content-security-policy']).toBeDefined();
    // Default CSP should be reasonably strict but functional for previews
    expect(headers['content-security-policy']).toContain("default-src 'self'");

    // Check for X-Content-Type-Options
    expect(headers['x-content-type-options']).toBe('nosniff');

    // Check for Referrer-Policy
    expect(headers['referrer-policy']).toBe('no-referrer');
  });
});
