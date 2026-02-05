import type { Plugin } from 'vite';
import { AssetGateway } from '../../AssetGateway';

export function virtualContentPlugin(
  htmlMap: Map<string, string>,
  assetGateway: AssetGateway
): Plugin {
  return {
    name: 'stitch-virtual-content',
    enforce: 'pre', // Run before core Vite plugins

    // 1. Middleware: Handle Virtual Routes & Asset Proxy
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];

        // A. Asset Proxy
        if (url === '/_stitch/asset') {
          const queryUrl = new URL(req.url!, `http://${req.headers.host}`).searchParams.get('url');
          if (queryUrl) {
            try {
              const { stream, type } = await assetGateway.fetchAsset(queryUrl);
              res.setHeader('Content-Type', type);
              stream.pipe(res);
              return;
            } catch (e) {
              console.error(e);
              res.statusCode = 404;
              res.end('Asset not found');
              return;
            }
          }
        }

        // B. Virtual HTML Serving
        // Vite handles "/" automatically if index.html exists, but we are virtual.
        // We intercept any route that matches our map.
        const lookupUrl = url === '/' ? '/' : url;

        if (lookupUrl && htmlMap.has(lookupUrl)) {
          let html = htmlMap.get(lookupUrl)!;

          // Critical: Apply Vite's HTML transform (injects HMR client)
          html = await server.transformIndexHtml(url!, html);

          res.setHeader('Content-Type', 'text/html');
          res.end(html);
          return;
        }

        next();
      });
    },

    // 2. Transform: Rewrite Assets & Inject Navigation Logic
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => {
        // Rewrite remote URLs to local proxy
        let newHtml = assetGateway.rewriteHtmlForPreview(html);

        // Inject Navigation Listener
        // We inject this script to listen for TUI events
        const script = `
          <script type="module">
            if (import.meta.hot) {
              import.meta.hot.on('stitch:navigate', (data) => {
                window.location.href = data.url;
              });
            }
          </script>
        `;
        return newHtml + script;
      },
    },
  };
}
