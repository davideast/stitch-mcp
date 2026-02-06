import { createServer, type ViteDevServer } from 'vite';
import { AssetGateway } from '../AssetGateway.js';
import { virtualContent } from './plugins/virtualContent.js';

export class StitchViteServer {
  private server: ViteDevServer | null = null;
  private htmlMap = new Map<string, string>();
  public assetGateway: AssetGateway;

  constructor(projectRoot: string = process.cwd(), assetGateway?: AssetGateway) {
    this.assetGateway = assetGateway || new AssetGateway(projectRoot);
  }

  async start(port: number = 3000): Promise<string> {
    this.server = await createServer({
      configFile: false,
      root: process.cwd(),
      server: {
        port,
        middlewareMode: false,
      },
      appType: 'custom',
      plugins: [
        virtualContent({
          assetGateway: this.assetGateway,
          htmlMap: this.htmlMap
        })
      ],
      logLevel: 'silent'
    });

    await this.server.listen();

    const address = this.server.httpServer?.address();
    if (address && typeof address === 'object') {
        return `http://localhost:${address.port}`;
    }
    return `http://localhost:${port}`;
  }

  async stop() {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
  }

  mount(route: string, html: string) {
    this.htmlMap.set(route, html);
    if (this.server) {
      this.server.ws.send({ type: 'full-reload', path: route });
    }
  }

  navigate(url: string) {
    if (this.server) {
      this.server.ws.send('stitch:navigate', { url });
    }
  }
}
