import { describe, it, expect, mock, afterEach } from 'bun:test';
import fs from 'fs-extra';
import path from 'path';
import { SiteService } from '../../../src/lib/services/site/SiteService';
import { AssetGateway } from '../../../src/lib/server/AssetGateway';

describe('SiteService Generator', () => {
    const outputDir = 'test-output';

    afterEach(async () => {
        await fs.remove(outputDir);
    });

    it('should generate a site', async () => {
        const config = {
            projectId: 'p1',
            routes: [
                { screenId: 's1', route: '/index', status: 'included' }
            ]
        } as any;

        const htmlContent = new Map<string, string>();
        htmlContent.set('s1', '<html><body><img src="http://img.png"/></body></html>');

        const mockAssetGateway = {
            rewriteHtmlForBuild: mock().mockResolvedValue({
                html: '<html><body><img src="./assets/hash.png"/></body></html>',
                assets: [{ url: 'http://img.png', filename: 'hash.png' }]
            }),
            copyAssetTo: mock().mockResolvedValue(undefined),
        } as unknown as AssetGateway;

        await SiteService.generateSite(config, htmlContent, mockAssetGateway, outputDir);

        expect(await fs.pathExists(path.join(outputDir, 'package.json'))).toBe(true);
        expect(await fs.pathExists(path.join(outputDir, 'src/pages/index.astro'))).toBe(true);
        expect(await fs.pathExists(path.join(outputDir, 'src/layouts/Layout.astro'))).toBe(true);

        // Check content of index.astro
        const content = await fs.readFile(path.join(outputDir, 'src/pages/index.astro'), 'utf-8');
        expect(content).toContain('./assets/hash.png');

        // Check asset copy called
        expect(mockAssetGateway.copyAssetTo).toHaveBeenCalledWith(
            'http://img.png',
            expect.stringContaining(path.join('public', 'assets', 'hash.png'))
        );
    });
});
