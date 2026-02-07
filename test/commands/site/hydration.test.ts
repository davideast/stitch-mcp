import { describe, it, expect, mock, beforeEach, beforeAll, afterAll } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { renderHook, waitFor } from '@testing-library/react';
import { useProjectHydration } from '../../../src/commands/site/hooks/useProjectHydration.js';
import type { StitchViteServer } from '../../../src/lib/server/vite/StitchViteServer.js';
import { ProjectSyncer } from '../../../src/commands/site/utils/ProjectSyncer.js';
import type { UIScreen } from '../../../src/lib/services/site/types.js';

describe('useProjectHydration', () => {
    let mockServer: any;
    let mockSyncer: any;

    beforeAll(() => {
        GlobalRegistrator.register();
    });

    afterAll(() => {
        GlobalRegistrator.unregister();
    });

    beforeEach(() => {
        mockServer = {
            mount: mock(() => {}),
        } as unknown as StitchViteServer;

        mockSyncer = {
            fetchContent: mock(() => Promise.resolve('<html></html>')),
        } as unknown as ProjectSyncer;
    });

    it('should hydrate included screens', async () => {
        const screens: UIScreen[] = [
            {
                id: 's1',
                title: 'Screen 1',
                downloadUrl: 'http://url',
                status: 'included',
                route: '/',
            }
        ];

        const { result } = renderHook(() => useProjectHydration(screens, mockServer, mockSyncer));

        await waitFor(() => expect(result.current.hydrationStatus).toBe('ready'));

        expect(mockServer.mount).toHaveBeenCalledWith('/_preview/s1', '<html></html>');
        expect(result.current.htmlContent.get('s1')).toBe('<html></html>');
    });

    it('should hydrate active screen even if ignored', async () => {
        const screens: UIScreen[] = [
            {
                id: 's2',
                title: 'Screen 2',
                downloadUrl: 'http://url2',
                status: 'ignored',
                route: '',
            }
        ];

        const { result } = renderHook(() => useProjectHydration(screens, mockServer, mockSyncer, 's2'));

        await waitFor(() => expect(result.current.hydrationStatus).toBe('ready'));

        expect(mockServer.mount).toHaveBeenCalledWith('/_preview/s2', '<html></html>');
        // It shouldn't necessarily be in htmlContent if ignored, or maybe it is?
        // The implementation adds everything downloaded to contentCache, and updates htmlContent from cache when ready.
        // So yes, it will be in htmlContent.
        expect(result.current.htmlContent.get('s2')).toBe('<html></html>');
    });
});
