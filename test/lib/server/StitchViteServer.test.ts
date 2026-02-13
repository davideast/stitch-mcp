import { describe, it, expect, afterEach, mock, beforeAll } from 'bun:test';
import { Readable } from 'stream';

// Create mock vite server instance for reuse
const mockViteWsSend = mock();
const mockViteServer = {
    listen: mock().mockResolvedValue(undefined),
    close: mock().mockResolvedValue(undefined),
    httpServer: {
        address: () => ({ port: 3000 })
    },
    ws: {
        send: mockViteWsSend
    },
    middlewares: {
        use: mock()
    },
    transformIndexHtml: mock(async (_url: string, html: string) => {
        return html.replace('</body>', '<script>vite</script></body>');
    })
};

// Mock vite before any imports that depend on it
mock.module('vite', () => ({
    createServer: mock(async () => mockViteServer),
    Plugin: class { },
    ViteDevServer: class { }
}));

describe('StitchViteServer', () => {
    let mod: any;
    let server: any;

    beforeAll(async () => {
        // Dynamic import AFTER mock.module is registered
        mod = await import('../../../src/lib/server/vite/StitchViteServer');
    });

    afterEach(async () => {
        if (server) await server.stop();
        mockViteWsSend.mockClear();
    });

    it('should start and stop the server', async () => {
        server = new mod.StitchViteServer();
        const url = await server.start(0);
        expect(url).toContain('http://localhost:3000');
    });

    it('should mount content', async () => {
        const mockAssetGateway = {
            fetchAsset: mock().mockResolvedValue({
                stream: Readable.from(['fake-image-content']),
                contentType: 'image/png'
            }),
            rewriteHtmlForPreview: mock(async (html: string) => html)
        };

        server = new mod.StitchViteServer(process.cwd(), mockAssetGateway);
        await server.start(0);
        server.mount('/test', '<h1>Hello</h1>');
    });

    it('should send navigate event via WebSocket', async () => {
        server = new mod.StitchViteServer();
        await server.start(0);
        server.navigate('/_preview/test-screen-id');
        expect(mockViteWsSend).toHaveBeenCalled();
    });
});
