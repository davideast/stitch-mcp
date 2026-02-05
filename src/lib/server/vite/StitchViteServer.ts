import { createServer, type ViteDevServer } from 'vite';
import { AssetGateway } from '../AssetGateway';
import { virtualContentPlugin } from './plugins/virtualContent';

export class StitchViteServer {
  private server: ViteDevServer | null = null;
  private htmlMap = new Map<string, string>();
  private assetGateway: AssetGateway;

  constructor(projectRoot: string) {
    this.assetGateway = new AssetGateway(projectRoot);
  }

  async start(port = 3000): Promise<string> {
    this.server = await createServer({
      configFile: false,
      root: process.cwd(),
      server: {
        port,
        strictPort: false, // Auto-increment if taken
        middlewareMode: false, // We want a full server
      },
      appType: 'custom', // Disable SPA fallback logic, we control routing
      plugins: [
        virtualContentPlugin(this.htmlMap, this.assetGateway)
      ],
      logLevel: 'silent' // Keep CLI clean
    });

    await this.server.listen();

    const address = this.server.httpServer?.address();
    const actualPort = typeof address === 'object' ? address?.port : port;
    return `http://localhost:${actualPort}`;
  }

  async stop() {
    await this.server?.close();
  }

  mount(route: string, html: string) {
    this.htmlMap.set(route, html);
    // Trigger Full Page Reload so the browser fetches the new content
    this.server?.ws.send({ type: 'full-reload' });
  }

  navigate(url: string) {
    this.server?.ws.send('stitch:navigate', { url });
  }
}
