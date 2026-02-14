import { describe, it, expect, afterEach, mock } from 'bun:test';
import { Readable } from 'stream';
import { StitchViteServer } from '../../../src/lib/server/vite/StitchViteServer';

// Mock vite's createServer via dynamic import interception
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

// mock.module still intercepts the dynamic import('vite') inside start()
mock.module('vite', () => ({
    createServer: mock(async () => mockViteServer),
}));

describe('StitchViteServer', () => {
    let server: StitchViteServer;

    afterEach(async () => {
        if (server) await server.stop();
        mockViteWsSend.mockClear();
    });

    it('should start and stop the server', async () => {
        server = new StitchViteServer();
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

        server = new StitchViteServer(process.cwd(), mockAssetGateway as any);
        await server.start(0);
        server.mount('/test', '<h1>Hello</h1>');
    });

    it('should send navigate event via WebSocket', async () => {
        server = new StitchViteServer();
        await server.start(0);
        server.navigate('/_preview/test-screen-id');
        expect(mockViteWsSend).toHaveBeenCalled();
    });
});
