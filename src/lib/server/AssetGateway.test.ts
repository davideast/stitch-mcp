import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { AssetGateway } from './AssetGateway.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('AssetGateway', () => {
  let gateway: AssetGateway;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `asset-gateway-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    gateway = new AssetGateway(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('getExtensionFromContentType', () => {
    test('maps text/css to .css', () => {
      // Access private method via any cast
      const ext = (gateway as any).getExtensionFromContentType('text/css');
      expect(ext).toBe('.css');
    });

    test('maps text/css with charset to .css', () => {
      const ext = (gateway as any).getExtensionFromContentType('text/css; charset=utf-8');
      expect(ext).toBe('.css');
    });

    test('maps text/javascript to .js', () => {
      const ext = (gateway as any).getExtensionFromContentType('text/javascript');
      expect(ext).toBe('.js');
    });

    test('maps application/javascript to .js', () => {
      const ext = (gateway as any).getExtensionFromContentType('application/javascript');
      expect(ext).toBe('.js');
    });

    test('maps image/png to .png', () => {
      const ext = (gateway as any).getExtensionFromContentType('image/png');
      expect(ext).toBe('.png');
    });

    test('maps image/jpeg to .jpg', () => {
      const ext = (gateway as any).getExtensionFromContentType('image/jpeg');
      expect(ext).toBe('.jpg');
    });

    test('maps font/woff2 to .woff2', () => {
      const ext = (gateway as any).getExtensionFromContentType('font/woff2');
      expect(ext).toBe('.woff2');
    });

    test('returns empty string for unknown MIME type', () => {
      const ext = (gateway as any).getExtensionFromContentType('application/octet-stream');
      expect(ext).toBe('');
    });

    test('returns empty string for undefined', () => {
      const ext = (gateway as any).getExtensionFromContentType(undefined);
      expect(ext).toBe('');
    });
  });

  describe('fetchAsset', () => {
    test('returns null for failed fetch (non-ok response)', async () => {
      // Mock fetch to return 404
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => new Response('Not Found', { status: 404 })) as any;

      try {
        const result = await gateway.fetchAsset('https://example.com/missing.png');
        expect(result).toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('returns null for network error', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        throw new Error('Network error');
      }) as any;

      try {
        const result = await gateway.fetchAsset('https://example.com/error.png');
        expect(result).toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('caches successful fetches', async () => {
      const originalFetch = globalThis.fetch;
      let fetchCount = 0;
      globalThis.fetch = (async () => {
        fetchCount++;
        return new Response('test content', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }) as any;

      try {
        // First fetch
        const result1 = await gateway.fetchAsset('https://example.com/test.txt');
        expect(result1).not.toBeNull();
        expect(fetchCount).toBe(1);

        // Second fetch should use cache
        const result2 = await gateway.fetchAsset('https://example.com/test.txt');
        expect(result2).not.toBeNull();
        expect(fetchCount).toBe(1); // Still 1, used cache
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('includes User-Agent header for Google Fonts compatibility', async () => {
      const originalFetch = globalThis.fetch;
      let capturedHeaders: Headers | undefined;

      globalThis.fetch = (async (url: any, init?: RequestInit) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response('test', { status: 200 });
      }) as any;

      try {
        await gateway.fetchAsset('https://fonts.googleapis.com/css2?family=Roboto');
        expect(capturedHeaders?.get('User-Agent')).toContain('Mozilla');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('rewriteHtmlForBuild', () => {
    test('rewrites external URLs to local asset paths', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => new Response('content', {
        status: 200,
        headers: { 'Content-Type': 'text/css' }
      })) as any;

      try {
        const html = '<html><head><link rel="stylesheet" href="https://example.com/style.css"></head></html>';
        const { html: rewritten, assets } = await gateway.rewriteHtmlForBuild(html);

        expect(rewritten).toContain('/assets/');
        expect(rewritten).not.toContain('https://example.com');
        expect(assets.length).toBe(1);
        expect(assets[0]?.url).toBe('https://example.com/style.css');
        expect(assets[0]?.filename).toMatch(/\.css$/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('uses Content-Type for extension when URL has no extension', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => new Response('content', {
        status: 200,
        headers: { 'Content-Type': 'text/css' }
      })) as any;

      try {
        const html = '<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto"></head></html>';
        const { assets } = await gateway.rewriteHtmlForBuild(html);

        expect(assets.length).toBe(1);
        expect(assets[0]?.filename).toMatch(/\.css$/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('skips failed assets gracefully', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => new Response('Not Found', { status: 404 })) as any;

      try {
        const html = '<html><head><link rel="stylesheet" href="https://example.com/missing.css"></head></html>';
        // Should not throw
        const { html: rewritten, assets } = await gateway.rewriteHtmlForBuild(html);

        // Asset should still be in the list with fallback extension
        expect(assets.length).toBe(1);
        expect(assets[0]?.filename).toMatch(/\.css$/); // Uses default extension
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('adds is:inline attribute to script tags for Astro compatibility', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => new Response('console.log("test")', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' }
      })) as any;

      try {
        const html = '<html><head><script src="https://example.com/app.js"></script></head></html>';
        const { html: rewritten } = await gateway.rewriteHtmlForBuild(html);

        // Should have is:inline attribute for Astro compatibility
        expect(rewritten).toContain('is:inline');
        expect(rewritten).toMatch(/<script[^>]+is:inline[^>]*>/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('copyAssetTo', () => {
    test('returns false when asset fetch fails', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => new Response('Not Found', { status: 404 })) as any;

      try {
        const destPath = path.join(tempDir, 'output', 'asset.css');
        const result = await gateway.copyAssetTo('https://example.com/missing.css', destPath);
        expect(result).toBe(false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('returns true and copies file when asset exists', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => new Response('test content', {
        status: 200,
        headers: { 'Content-Type': 'text/css' }
      })) as any;

      try {
        // First fetch to cache
        await gateway.fetchAsset('https://example.com/style.css');

        const destPath = path.join(tempDir, 'output', 'style.css');
        const result = await gateway.copyAssetTo('https://example.com/style.css', destPath);

        expect(result).toBe(true);
        expect(await fs.pathExists(destPath)).toBe(true);
        expect(await fs.readFile(destPath, 'utf-8')).toBe('test content');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
