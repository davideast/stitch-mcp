import fastify, { FastifyInstance } from 'fastify';
import getPort from 'get-port';
import open from 'open';
import { VirtualRegistry } from './VirtualRegistry.js';
import { AssetGateway } from './AssetGateway.js';

interface ServerConfig {
  projectRoot: string;
}

export class StitchPreviewServer {
  public app: FastifyInstance;
  public port: number = 0;

  private registry: VirtualRegistry;
  private assets: AssetGateway;
  private clients: Set<any> = new Set(); // SSE Clients

  constructor(config: ServerConfig) {
    this.app = fastify({ logger: false }); // Disable logger for CLI cleanliness
    this.registry = new VirtualRegistry();
    this.assets = new AssetGateway(config.projectRoot);
    this.setupRoutes();
  }

  // --- Internal Routing ---
  private setupRoutes() {
    // 1. Asset Proxy
    this.app.get('/_stitch/asset', async (req: any, reply) => {
      try {
        const { stream, type } = await this.assets.fetchAsset(req.query.url);
        reply.type(type).send(stream);
      } catch (e) {
        reply.status(404).send('Asset not found');
      }
    });

    // 2. SSE Endpoint (The "Control Plane")
    this.app.get('/_stitch/events', (req, reply) => {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      this.clients.add(reply.raw);

      // Send initial ping to establish connection
      reply.raw.write(': ping\n\n');

      reply.raw.on('close', () => this.clients.delete(reply.raw));
    });

    // 3. Client Runtime (Injected Script)
    this.app.get('/_stitch/client.js', (req, reply) => {
      const script = `
        const evt = new EventSource('/_stitch/events');
        evt.onmessage = (e) => {
          const data = JSON.parse(e.data);
          if (data.type === 'navigate') {
             // Passive Navigation (doesn't steal focus)
             window.location.href = data.url;
          }
          if (data.type === 'reload') {
             // Content Refresh
             window.location.reload();
          }
        };
      `;
      reply.type('text/javascript').send(script);
    });

    // 4. Wildcard Handler (Virtual Pages)
    this.app.get('/*', async (req, reply) => {
      // Logic: exact match first, then try appending .html
      let content = await this.registry.get(req.url) || await this.registry.get(`${req.url}.html`);

      if (!content) return reply.status(404).send(`Route not found: ${req.url}`);

      // Transform Pipeline
      content = this.assets.processHtml(content);
      // Inject Client Runtime just before body close
      content = content.replace('</body>', '<script src="/_stitch/client.js"></script></body>');

      reply.type('text/html').send(content);
    });
  }

  // --- Public API ---

  async start(preferredPort = 3000): Promise<string> {
    this.port = await getPort({ port: preferredPort });
    // Use 0.0.0.0 to ensure binding to all interfaces, avoiding connectivity issues in CI/containers
    await this.app.listen({ port: this.port, host: '0.0.0.0' });
    return `http://127.0.0.1:${this.port}`;
  }

  async stop() {
    await this.app.close();
  }

  /**
   * Mounts content to a route.
   * Triggers a 'reload' event if the route was already being viewed.
   */
  mount(route: string, content: string | { path: string }) {
    if (typeof content === 'string') {
      this.registry.mount(route, { type: 'memory', content });
    } else {
      this.registry.mount(route, { type: 'file', path: content.path });
    }
  }

  /**
   * Directs the connected browser to a new URL.
   * Use this for "Follow Mode" in TUIs.
   */
  navigate(url: string) {
    this.broadcast({ type: 'navigate', url });
  }

  private broadcast(data: any) {
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
        try {
            client.write(msg);
        } catch (e) {
            this.clients.delete(client);
        }
    }
  }
}
