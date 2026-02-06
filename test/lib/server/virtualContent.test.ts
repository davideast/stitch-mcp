import { describe, it, expect, mock } from 'bun:test';
import { virtualContent } from '../../../src/lib/server/vite/plugins/virtualContent';
import { AssetGateway } from '../../../src/lib/server/AssetGateway';

describe('virtualContent plugin', () => {
  describe('transformIndexHtml', () => {
    it('should inject virtual module script in head tag', async () => {
      const mockAssetGateway = {
        rewriteHtmlForPreview: mock(async (html: string) => html),
        rewriteHtmlForBuild: mock(async (html: string) => ({ html, assets: [] })),
        fetchAsset: mock()
      } as unknown as AssetGateway;

      const htmlMap = new Map<string, string>();
      const plugin = virtualContent({ assetGateway: mockAssetGateway, htmlMap });

      const html = '<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>';

      // Call transformIndexHtml hook
      const transformHook = plugin.transformIndexHtml as (html: string) => Promise<string>;
      const result = await transformHook(html);

      // Script should be injected before </head> with /@id/ prefix for Vite virtual modules
      expect(result).toContain('<script type="module" src="/@id/virtual:stitch-nav"></script>');
      // Script should end before </head>
      expect(result).toMatch(/<\/script>\s*<\/head>/);
    });

    it('should append script if no head tag exists', async () => {
      const mockAssetGateway = {
        rewriteHtmlForPreview: mock(async (html: string) => html),
        rewriteHtmlForBuild: mock(async (html: string) => ({ html, assets: [] })),
        fetchAsset: mock()
      } as unknown as AssetGateway;

      const htmlMap = new Map<string, string>();
      const plugin = virtualContent({ assetGateway: mockAssetGateway, htmlMap });

      // HTML without head tag
      const html = '<body><h1>Hello</h1></body>';

      const transformHook = plugin.transformIndexHtml as (html: string) => Promise<string>;
      const result = await transformHook(html);

      // Script should be appended at the end with /@id/ prefix
      expect(result).toContain('<script type="module" src="/@id/virtual:stitch-nav"></script>');
    });
  });

  describe('virtual module', () => {
    it('should resolve virtual:stitch-nav module', () => {
      const mockAssetGateway = {
        rewriteHtmlForPreview: mock(async (html: string) => html),
        fetchAsset: mock()
      } as unknown as AssetGateway;

      const htmlMap = new Map<string, string>();
      const plugin = virtualContent({ assetGateway: mockAssetGateway, htmlMap });

      const resolveId = plugin.resolveId as (id: string) => string | undefined;

      // Should resolve virtual:stitch-nav
      expect(resolveId('virtual:stitch-nav')).toBe('\0virtual:stitch-nav');

      // Should not resolve other modules
      expect(resolveId('some-other-module')).toBeUndefined();
    });

    it('should load virtual module with HMR navigation code', () => {
      const mockAssetGateway = {
        rewriteHtmlForPreview: mock(async (html: string) => html),
        fetchAsset: mock()
      } as unknown as AssetGateway;

      const htmlMap = new Map<string, string>();
      const plugin = virtualContent({ assetGateway: mockAssetGateway, htmlMap });

      const load = plugin.load as (id: string) => string | undefined;

      // Should load the virtual module
      const content = load('\0virtual:stitch-nav');
      expect(content).toContain("import.meta.hot.on('stitch:navigate'");
      expect(content).toContain("import.meta.hot.on('vite:ws:connect'");
      expect(content).toContain('[stitch] Navigation handler registered');

      // Should not load other modules
      expect(load('some-other-module')).toBeUndefined();
    });
  });
});
