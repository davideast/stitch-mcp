/**
 * Tests for copy handlers.
 */
import { test, expect, describe, mock } from 'bun:test';
import { defaultCopyHandler, imageUrlCopyHandler, htmlCodeCopyHandler } from './handlers.js';
import type { CopyContext } from './types.js';

// Mock clipboard functions
mock.module('./clipboard.js', () => ({
  copyJson: mock(() => Promise.resolve()),
  copyText: mock(() => Promise.resolve()),
  downloadAndCopyImage: mock(() => Promise.resolve()),
  downloadAndCopyText: mock(() => Promise.resolve()),
}));

describe('defaultCopyHandler', () => {
  describe('copy()', () => {
    test('copies string value and returns preview', async () => {
      const ctx: CopyContext = {
        key: 'name',
        value: 'Test Project',
        path: 'projects.0.name',
      };

      const result = await defaultCopyHandler.copy(ctx);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Copied:');
      expect(result.message).toContain('Test Project');
    });

    test('copies object value and returns JSON preview', async () => {
      const ctx: CopyContext = {
        key: 'config',
        value: { foo: 'bar', count: 42 },
        path: 'projects.0.config',
      };

      const result = await defaultCopyHandler.copy(ctx);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Copied:');
    });

    test('truncates long string values', async () => {
      const longValue = 'a'.repeat(100);
      const ctx: CopyContext = {
        key: 'description',
        value: longValue,
        path: 'projects.0.description',
      };

      const result = await defaultCopyHandler.copy(ctx);

      expect(result.success).toBe(true);
      expect(result.message).toContain('...');
    });
  });

  describe('copyExtended()', () => {
    test('copies key-value object', async () => {
      const ctx: CopyContext = {
        key: 'title',
        value: 'My Project',
        path: 'projects.0.title',
      };

      const result = await defaultCopyHandler.copyExtended(ctx);

      expect(result.success).toBe(true);
      expect(result.message).toContain('title');
    });
  });
});

describe('imageUrlCopyHandler', () => {
  describe('copy()', () => {
    test('copies URL string', async () => {
      const ctx: CopyContext = {
        key: 'downloadUrl',
        value: 'https://example.com/image.png',
        path: 'projects.0.thumbnailScreenshot.downloadUrl',
      };

      const result = await imageUrlCopyHandler.copy(ctx);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Copied URL');
    });

    test('fails if value is not a string', async () => {
      const ctx: CopyContext = {
        key: 'downloadUrl',
        value: { url: 'https://example.com' },
        path: 'projects.0.thumbnailScreenshot.downloadUrl',
      };

      const result = await imageUrlCopyHandler.copy(ctx);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not a URL string');
    });
  });

  describe('copyExtended()', () => {
    test('calls onProgress callback before download', async () => {
      let progressMessage = '';
      const ctx: CopyContext = {
        key: 'downloadUrl',
        value: 'https://example.com/image.png',
        path: 'projects.0.thumbnailScreenshot.downloadUrl',
        onProgress: (msg) => { progressMessage = msg; },
      };

      await imageUrlCopyHandler.copyExtended(ctx);

      expect(progressMessage).toContain('Downloading');
    });

    test('returns success message after download', async () => {
      const ctx: CopyContext = {
        key: 'downloadUrl',
        value: 'https://example.com/image.png',
        path: 'projects.0.thumbnailScreenshot.downloadUrl',
      };

      const result = await imageUrlCopyHandler.copyExtended(ctx);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Image copied');
    });

    test('fails if value is not a string', async () => {
      const ctx: CopyContext = {
        key: 'downloadUrl',
        value: 12345,
        path: 'projects.0.thumbnailScreenshot.downloadUrl',
      };

      const result = await imageUrlCopyHandler.copyExtended(ctx);

      expect(result.success).toBe(false);
    });
  });
});

describe('htmlCodeCopyHandler', () => {
  describe('copy()', () => {
    test('copies URL string', async () => {
      const ctx: CopyContext = {
        key: 'downloadUrl',
        value: 'https://example.com/code.html',
        path: 'screen.htmlCode.downloadUrl',
      };

      const result = await htmlCodeCopyHandler.copy(ctx);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Copied URL');
    });

    test('fails if value is not a string', async () => {
      const ctx: CopyContext = {
        key: 'downloadUrl',
        value: { url: 'https://example.com' },
        path: 'screen.htmlCode.downloadUrl',
      };

      const result = await htmlCodeCopyHandler.copy(ctx);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not a URL string');
    });
  });

  describe('copyExtended()', () => {
    test('calls onProgress callback before download', async () => {
      let progressMessage = '';
      const ctx: CopyContext = {
        key: 'downloadUrl',
        value: 'https://example.com/code.html',
        path: 'screen.htmlCode.downloadUrl',
        onProgress: (msg) => { progressMessage = msg; },
      };

      await htmlCodeCopyHandler.copyExtended(ctx);

      expect(progressMessage).toContain('HTML');
    });

    test('returns success message after download', async () => {
      const ctx: CopyContext = {
        key: 'downloadUrl',
        value: 'https://example.com/code.html',
        path: 'screen.htmlCode.downloadUrl',
      };

      const result = await htmlCodeCopyHandler.copyExtended(ctx);

      expect(result.success).toBe(true);
      expect(result.message).toContain('HTML code copied');
    });

    test('fails if value is not a string', async () => {
      const ctx: CopyContext = {
        key: 'downloadUrl',
        value: 12345,
        path: 'screen.htmlCode.downloadUrl',
      };

      const result = await htmlCodeCopyHandler.copyExtended(ctx);

      expect(result.success).toBe(false);
    });
  });
});
