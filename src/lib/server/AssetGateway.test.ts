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



  describe('fetchAsset', () => {
    test('returns null for failed fetch (non-ok response)', async () => {
      // Mock fetch to return 404
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => new Response('Not Found', { status: 404 })) as any;

      try {
        const result = await gateway.fetchAsset('https://storage.googleapis.com/missing.png');
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
        const result = await gateway.fetchAsset('https://storage.googleapis.com/error.png');
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
        const result1 = await gateway.fetchAsset('https://storage.googleapis.com/test.txt');
        expect(result1).not.toBeNull();
        result1?.stream.destroy();
        expect(fetchCount).toBe(1);

        // Second fetch should use cache
        const result2 = await gateway.fetchAsset('https://storage.googleapis.com/test.txt');
        expect(result2).not.toBeNull();
        result2?.stream.destroy();
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
        const result = await gateway.fetchAsset('https://fonts.googleapis.com/css2?family=Roboto');
        result?.stream.destroy();
        expect(capturedHeaders?.get('User-Agent')).toContain('Mozilla');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('rewriteCssUrls', () => {
    // Stub fetchAsset to prevent optimistic prefetch from making real
    // network/filesystem calls that leak async operations between tests
    let fetchAssetSpy: ReturnType<typeof spyOn>;
    beforeEach(() => {
      fetchAssetSpy = spyOn(gateway, 'fetchAsset').mockResolvedValue(null);
    });
    afterEach(() => {
      fetchAssetSpy.mockRestore();
    });

    test('rewrites relative font URLs resolved against base URL', () => {
      const css = `@font-face { src: url('../webfonts/fa-solid-900.woff2'); }`;
      const base = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
      const result = gateway.rewriteCssUrls(css, base);

      const expected = encodeURIComponent('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2');
      expect(result).toContain(`/_stitch/asset?url=${expected}`);
    });

    test('rewrites absolute HTTP URLs to proxy', () => {
      const css = `@font-face { src: url('https://cdn.example.com/fonts/font.woff2'); }`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      const expected = encodeURIComponent('https://cdn.example.com/fonts/font.woff2');
      expect(result).toContain(`/_stitch/asset?url=${expected}`);
    });

    test('preserves data URIs', () => {
      const css = `background: url('data:image/svg+xml;base64,PHN2Zz4=');`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      expect(result).toBe(css);
    });

    test('preserves fragment-only refs', () => {
      const css = `filter: url('#blur');`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      expect(result).toBe(css);
    });

    test('preserves already-proxied URLs', () => {
      const css = `background: url('/_stitch/asset?url=https%3A%2F%2Fexample.com%2Fimg.png');`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      expect(result).toBe(css);
    });

    test('handles unquoted url()', () => {
      const css = `background: url(../images/bg.png);`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      const expected = encodeURIComponent('https://storage.googleapis.com/images/bg.png');
      expect(result).toContain(`/_stitch/asset?url=${expected}`);
    });

    test('handles single-quoted url()', () => {
      const css = `background: url('../images/bg.png');`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      const expected = encodeURIComponent('https://storage.googleapis.com/images/bg.png');
      expect(result).toContain(`url('/_stitch/asset?url=${expected}')`);
    });

    test('handles double-quoted url()', () => {
      const css = `background: url("../images/bg.png");`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      const expected = encodeURIComponent('https://storage.googleapis.com/images/bg.png');
      expect(result).toContain(`url("/_stitch/asset?url=${expected}")`);
    });

    test('rewrites multiple URLs in one CSS string', () => {
      const css = [
        `@font-face { src: url('../webfonts/fa-solid-900.woff2'); }`,
        `@font-face { src: url('../webfonts/fa-regular-400.ttf'); }`,
        `body { background: url('https://cdn.example.com/bg.png'); }`,
      ].join('\n');
      const base = 'https://cdn.example.com/css/all.min.css';
      const result = gateway.rewriteCssUrls(css, base);

      expect(result).toContain(encodeURIComponent('https://cdn.example.com/webfonts/fa-solid-900.woff2'));
      expect(result).toContain(encodeURIComponent('https://cdn.example.com/webfonts/fa-regular-400.ttf'));
      expect(result).toContain(encodeURIComponent('https://cdn.example.com/bg.png'));
      // No un-rewritten http URLs should remain
      expect(result).not.toMatch(/url\(['"]?https?:\/\//);
    });

    test('handles protocol-relative URLs', () => {
      const css = `background: url('//fonts.example.com/font.woff2');`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      const expected = encodeURIComponent('https://fonts.example.com/font.woff2');
      expect(result).toContain(`/_stitch/asset?url=${expected}`);
    });

    test('triggers optimistic prefetch for discovered URLs', () => {
      const css = `@font-face { src: url('../webfonts/fa-solid-900.woff2'); }`;
      const base = 'https://cdn.example.com/css/all.min.css';
      gateway.rewriteCssUrls(css, base);

      // fetchAsset spy (from beforeEach) should have been called for the discovered URL
      expect(fetchAssetSpy).toHaveBeenCalledWith(
        'https://cdn.example.com/webfonts/fa-solid-900.woff2'
      );
    });

    test('preserves empty url()', () => {
      const css = `background: url('');`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      expect(result).toBe(css);
    });

    test('preserves url() with only whitespace', () => {
      const css = `background: url('  ');`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      expect(result).toBe(css);
    });

    test('handles url() with whitespace around the value', () => {
      const css = `background: url(  ../images/bg.png  );`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      const expected = encodeURIComponent('https://storage.googleapis.com/images/bg.png');
      expect(result).toContain(`/_stitch/asset?url=${expected}`);
    });

    test('@import bare single-quoted is rewritten', () => {
      const css = `@import '../reset.css';`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      const expected = encodeURIComponent('https://storage.googleapis.com/reset.css');
      expect(result).toBe(`@import '/_stitch/asset?url=${expected}';`);
    });

    test('@import bare double-quoted is rewritten', () => {
      const css = `@import "https://fonts.googleapis.com/css2?family=Roboto";`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      const expected = encodeURIComponent('https://fonts.googleapis.com/css2?family=Roboto');
      expect(result).toBe(`@import "/_stitch/asset?url=${expected}";`);
    });

    test('@import url() form is rewritten by url() regex', () => {
      const css = `@import url('https://fonts.googleapis.com/css2?family=Roboto');`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      const expected = encodeURIComponent('https://fonts.googleapis.com/css2?family=Roboto');
      expect(result).toContain(`/_stitch/asset?url=${expected}`);
    });

    test('@import already-proxied is unchanged', () => {
      const css = `@import '/_stitch/asset?url=https%3A%2F%2Fexample.com%2Freset.css';`;
      const base = 'https://storage.googleapis.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      expect(result).toBe(css);
    });

    test('mixed @import and url() are both rewritten', () => {
      const css = [
        `@import '../reset.css';`,
        `@font-face { src: url('../fonts/font.woff2'); }`,
      ].join('\n');
      const base = 'https://cdn.example.com/css/style.css';
      const result = gateway.rewriteCssUrls(css, base);

      expect(result).toContain(encodeURIComponent('https://cdn.example.com/reset.css'));
      expect(result).toContain(encodeURIComponent('https://cdn.example.com/fonts/font.woff2'));
      // No raw external URLs should remain
      expect(result).not.toMatch(/'https?:\/\/cdn\.example\.com/);
    });

    test('Google Fonts real-world @font-face pattern', () => {
      const css = `
@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2) format('woff2');
}`;
      const base = 'https://fonts.googleapis.com/css2?family=Roboto';
      const result = gateway.rewriteCssUrls(css, base);

      const expected = encodeURIComponent('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2');
      expect(result).toContain(`/_stitch/asset?url=${expected}`);
      // The original absolute URL should be gone
      expect(result).not.toContain('https://fonts.gstatic.com');
    });
  });


});
