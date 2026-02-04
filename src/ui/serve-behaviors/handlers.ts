/**
 * Serve handlers - isolated behavior implementations.
 */
import type { ServeHandler, ServeContext, ServeResult } from './types.js';
import { serveHtmlInMemory } from './server.js';

// Export dependencies for testing
export const deps = {
  serveHtmlInMemory
};

export const htmlCodeServeHandler: ServeHandler = {
  async serve(ctx: ServeContext): Promise<ServeResult> {
    try {
      // Extract URL - either from value directly or from value.downloadUrl
      let url: string;
      if (typeof ctx.value === 'string') {
        url = ctx.value;
      } else if (typeof ctx.value === 'object' && ctx.value?.downloadUrl) {
        url = ctx.value.downloadUrl;
      } else {
        return { success: false, message: 'No download URL found' };
      }

      ctx.onProgress?.('📥 Downloading HTML...');
      const response = await fetch(url);
      if (!response.ok) {
        return { success: false, message: `Download failed: ${response.status} ${response.statusText}` };
      }
      const html = await response.text();

      ctx.onProgress?.('🚀 Starting local server...');
      const { url: serveUrl } = await deps.serveHtmlInMemory(html);

      ctx.onProgress?.('🌐 Opening browser...');
      return { success: true, message: `🌐 Preview at ${serveUrl} (auto-closes in 5 min)`, url: serveUrl };
    } catch (error) {
      return { success: false, message: `Serve failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  },
};
