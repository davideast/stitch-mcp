/**
 * In-memory HTTP server using node:http for cross-runtime compatibility.
 */
import { createServer, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { openUrl } from '../../platform/browser.js';

export interface ServeInstance {
  url: string;
  stop: () => void;
}

export async function serveHtmlInMemory(
  html: string,
  options?: { timeout?: number; openBrowser?: boolean }
): Promise<ServeInstance> {
  const timeout = options?.timeout ?? 5 * 60 * 1000;
  const openBrowser = options?.openBrowser ?? true;

  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      const nonce = randomBytes(16).toString('base64');
      const csp = [
        "default-src 'self' data: https:;",
        `script-src 'self' 'nonce-${nonce}';`,
        "style-src 'self' 'unsafe-inline';",
        "object-src 'none';",
        "base-uri 'self';",
      ].join(' ');

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': csp,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      });

      // Inject nonce into all script tags in the HTML
      const htmlWithNonces = html.replace(/<script(\b[^>]*)>/gi, `<script$1 nonce="${nonce}">`);
      res.end(htmlWithNonces);
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to get server address'));
        return;
      }

      const url = `http://127.0.0.1:${address.port}`;
      const timer = setTimeout(() => server.close(), timeout);
      const stop = () => { clearTimeout(timer); server.close(); };

      if (openBrowser) {
        openUrl(url);
      }

      resolve({ url, stop });
    });

    server.on('error', reject);
  });
}
