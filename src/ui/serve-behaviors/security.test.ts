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
    const csp = headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");

    // Check for X-Content-Type-Options
    expect(headers['x-content-type-options']).toBe('nosniff');

    // Check for Referrer-Policy
    expect(headers['referrer-policy']).toBe('no-referrer');
  });

  it('injects nonces into script tags', async () => {
    const html = '<html><body><script>console.log("hi")</script><script src="app.js"></script></body></html>';
    const instance = await serveHtmlInMemory(html, { openBrowser: false });
    stopServer = instance.stop;

    const { body, headers } = await new Promise<{ body: string; headers: any }>((resolve, reject) => {
      get(instance.url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ body: data, headers: res.headers }));
      }).on('error', reject);
    });

    const csp = headers['content-security-policy'];
    const nonceMatch = csp.match(/'nonce-([^']+)'/);
    expect(nonceMatch).not.toBeNull();
    const nonce = nonceMatch[1];

    expect(body).toContain(`<script nonce="${nonce}">console.log("hi")</script>`);
    expect(body).toContain(`<script src="app.js" nonce="${nonce}"></script>`);
  });
});
