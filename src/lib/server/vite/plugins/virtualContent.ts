import { type Plugin, type ViteDevServer } from 'vite';
import { AssetGateway } from '../../AssetGateway.js';
import { IncomingMessage, ServerResponse } from 'http';

export interface VirtualContentOptions {
  assetGateway: AssetGateway;
  htmlMap: Map<string, string>;
}

// Virtual module ID for the navigation client
const VIRTUAL_NAV_ID = 'virtual:stitch-nav';
const RESOLVED_VIRTUAL_NAV_ID = '\0' + VIRTUAL_NAV_ID;

export function virtualContent({ assetGateway, htmlMap }: VirtualContentOptions): Plugin {
  return {
    name: 'stitch-virtual-content',

    // Resolve virtual module
    resolveId(id) {
      if (id === VIRTUAL_NAV_ID) {
        return RESOLVED_VIRTUAL_NAV_ID;
      }
    },

    // Load virtual module content
    load(id) {
      if (id === RESOLVED_VIRTUAL_NAV_ID) {
        return `
          if (import.meta.hot) {
            // Register navigation handler
            import.meta.hot.on('stitch:navigate', ({ url }) => {
              window.location.href = url;
            });
            
            // Log connection status for debugging
            import.meta.hot.on('vite:ws:connect', () => {
              console.log('[stitch] HMR connected');
            });
            
            console.log('[stitch] Navigation handler registered');
          } else {
            console.warn('[stitch] HMR not available');
          }
        `;
      }
    },

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

            // Infer correct Content-Type from URL extension when cached as octet-stream
            let effectiveContentType = contentType;
            if (!contentType || contentType.includes('application/octet-stream')) {
              const fontExtMap: Record<string, string> = {
                '.woff2': 'font/woff2',
                '.woff': 'font/woff',
                '.ttf': 'font/ttf',
                '.otf': 'font/otf',
                '.eot': 'application/vnd.ms-fontobject',
              };
              try {
                const ext = new URL(assetUrl).pathname.match(/\.[^.]+$/)?.[0]?.toLowerCase();
                if (ext && fontExtMap[ext]) {
                  effectiveContentType = fontExtMap[ext];
                }
              } catch { /* leave as-is */ }
            }

            if (effectiveContentType) {
              res.setHeader('Content-Type', effectiveContentType);
            }

            const isCss = effectiveContentType?.includes('text/css');
            // CSS is transformed (url rewriting), so use no-cache to force
            // revalidation. Other assets (fonts, images, JS) are static.
            res.setHeader('Cache-Control', isCss ? 'no-cache' : 'public, max-age=31536000');

            if (isCss) {
              // Buffer CSS to rewrite url() references for sub-resources (fonts, images)
              const chunks: Buffer[] = [];
              stream.on('data', (chunk: Buffer) => chunks.push(chunk));
              stream.on('end', () => {
                const css = Buffer.concat(chunks).toString('utf-8');
                const rewritten = assetGateway.rewriteCssUrls(css, assetUrl);
                res.end(rewritten);
              });
              stream.on('error', (err) => {
                console.error('CSS stream error:', err);
                res.statusCode = 500;
                res.end('Internal Server Error');
              });
            } else {
              stream.pipe(res);
            }
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

        // Handle preview URLs that aren't hydrated yet
        // Return a loading page that auto-refreshes
        if (url.pathname.startsWith('/_preview/')) {
          const loadingHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="1">
  <title>Loading...</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #1a1a1a;
      color: #fff;
    }
    .loader {
      text-align: center;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #333;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Loading preview...</p>
  </div>
</body>
</html>`;
          res.setHeader('Content-Type', 'text/html');
          res.end(loadingHtml);
          return;
        }

        next();
      });
    },

    async transformIndexHtml(html) {
      // Rewrite assets for preview
      const rewritten = await assetGateway.rewriteHtmlForPreview(html);

      // Inject import for the virtual navigation module
      // Use /@id/ prefix which is how Vite exposes virtual modules to the browser
      const script = `<script type="module" src="/@id/${VIRTUAL_NAV_ID}"></script>`;

      // Insert script in head for proper loading order
      if (rewritten.includes('</head>')) {
        return rewritten.replace('</head>', script + '</head>');
      }

      // Fallback: append if no head tag
      return rewritten + script;
    }
  };
}

