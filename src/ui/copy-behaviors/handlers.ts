/**
 * Copy handlers - isolated behavior implementations.
 */
import type { CopyHandler, CopyContext, CopyResult } from './types.js';
import { copyJson, copyText, downloadAndCopyImage } from './clipboard.js';

/**
 * Default handler: copies value on "c", copies {key: value} on "cc"
 */
export const defaultCopyHandler: CopyHandler = {
  async copy(ctx: CopyContext): Promise<CopyResult> {
    try {
      await copyJson(ctx.value);
      const preview = typeof ctx.value === 'string'
        ? `"${ctx.value.slice(0, 50)}${ctx.value.length > 50 ? '...' : ''}"`
        : JSON.stringify(ctx.value).slice(0, 50);
      return { success: true, message: `Copied: ${preview}` };
    } catch (error) {
      return { success: false, message: `Copy failed: ${error}` };
    }
  },

  async copyExtended(ctx: CopyContext): Promise<CopyResult> {
    try {
      const obj = { [ctx.key]: ctx.value };
      await copyJson(obj);
      return { success: true, message: `Copied: { ${ctx.key}: ... }` };
    } catch (error) {
      return { success: false, message: `Copy failed: ${error}` };
    }
  },
};

/**
 * Image URL handler: copies URL on "c", downloads and copies image on "cc"
 */
export const imageUrlCopyHandler: CopyHandler = {
  async copy(ctx: CopyContext): Promise<CopyResult> {
    try {
      if (typeof ctx.value !== 'string') {
        return { success: false, message: 'Value is not a URL string' };
      }
      await copyText(ctx.value);
      return { success: true, message: `Copied URL: ${ctx.value.slice(0, 60)}...` };
    } catch (error) {
      return { success: false, message: `Copy failed: ${error}` };
    }
  },

  async copyExtended(ctx: CopyContext): Promise<CopyResult> {
    try {
      if (typeof ctx.value !== 'string') {
        return { success: false, message: 'Value is not a URL string' };
      }
      // Show immediate progress feedback
      ctx.onProgress?.('📷 Downloading image...');
      await downloadAndCopyImage(ctx.value);
      return { success: true, message: '📷 Image copied to clipboard!' };
    } catch (error) {
      return { success: false, message: `Image copy failed: ${error}` };
    }
  },
};
