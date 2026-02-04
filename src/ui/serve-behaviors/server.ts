/**
 * In-memory HTTP server using node:http for cross-runtime compatibility.
 */
import { createServer, type Server } from 'node:http';
import { spawn } from 'node:child_process';

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
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
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
        const cmd = process.platform === 'darwin' ? 'open' :
                    process.platform === 'win32' ? 'cmd' : 'xdg-open';
        const args = process.platform === 'win32' ? ['/c', 'start', url] : [url];
        spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
      }

      resolve({ url, stop });
    });

    server.on('error', reject);
  });
}
