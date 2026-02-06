import { type Plugin, type ViteDevServer } from 'vite';
import { AssetGateway } from '../../AssetGateway.js';
import { IncomingMessage, ServerResponse } from 'http';

export interface VirtualContentOptions {
  assetGateway: AssetGateway;
  htmlMap: Map<string, string>;
}

export function virtualContent({ assetGateway, htmlMap }: VirtualContentOptions): Plugin {
  return {
    name: 'stitch-virtual-content',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url) return next();

        // TODO: Consider a better configuration to support hosted URLs
        // such as GitHub Codespaces and other cloud IDEs
        const url = new URL(req.url, 'http://localhost');

        // Asset Proxy
        if (url.pathname === '/_stitch/asset') {
          const assetUrl = url.searchParams.get('url');
          if (!assetUrl) {
            res.statusCode = 400;
            res.end('Missing url parameter');
            return;
          }

          try {
            const result = await assetGateway.fetchAsset(assetUrl);
            if (!result) {
              res.statusCode = 404;
              res.end('Asset not found');
              return;
            }

            const { stream, contentType } = result;
            if (contentType) {
              res.setHeader('Content-Type', contentType);
            }
            // Add cache headers
            res.setHeader('Cache-Control', 'public, max-age=31536000');

            stream.pipe(res);
          } catch (error) {
            console.error('Asset proxy error:', error);
            res.statusCode = 500;
            res.end('Internal Server Error');
          }
          return;
        }

        // Virtual Routes
        const content = htmlMap.get(url.pathname);
        if (content) {
            try {
                // Transform HTML (injects Vite client, etc.)
                const transformed = await server.transformIndexHtml(req.url, content);
                res.setHeader('Content-Type', 'text/html');
                res.end(transformed);
            } catch (e) {
                console.error('Transform error:', e);
                next();
            }
            return;
        }

        next();
      });
    },

    async transformIndexHtml(html) {
      // Rewrite assets for preview
      const rewritten = await assetGateway.rewriteHtmlForPreview(html);

      // Inject Client Script
      const script = `
        <script type="module">
          if (import.meta.hot) {
            import.meta.hot.on('stitch:navigate', ({ url }) => {
              window.location.href = url;
            });
          }
        </script>
      `;

      return rewritten + script;
    }
  };
}
