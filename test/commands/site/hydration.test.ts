// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { useProjectHydration } from '../../../src/commands/site/hooks/useProjectHydration';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StitchViteServer } from '../../../src/lib/server/vite/StitchViteServer'; // Type only
import { ProjectSyncer } from '../../../src/commands/site/utils/ProjectSyncer';
import { UIStack } from '../../../src/commands/site/ui/types';

// Mock the module to avoid loading Vite/esbuild in jsdom
vi.mock('../../../src/lib/server/vite/StitchViteServer', () => ({
    StitchViteServer: class {}
}));

describe('useProjectHydration', () => {
    let mockServer: any;
    let mockSyncer: any;

    beforeEach(() => {
        mockServer = {
            mount: vi.fn(),
        } as unknown as StitchViteServer;

        mockSyncer = {
            fetchContent: vi.fn().mockResolvedValue('<html></html>'),
        } as unknown as ProjectSyncer;
    });

    it('should hydrate included stacks', async () => {
        const stacks: UIStack[] = [
            {
                id: 's1',
                title: 'Screen 1',
                versions: [{ name: 's1', title: 'Screen 1', htmlCode: { downloadUrl: 'http://url' } }],
                status: 'included',
                route: '/',
                isArtifact: false,
                isObsolete: false,
            } as any
        ];

        const { result } = renderHook(() => useProjectHydration(stacks, mockServer, mockSyncer));

        await waitFor(() => expect(result.current.hydrationStatus).toBe('ready'));

        expect(mockServer.mount).toHaveBeenCalledWith('/_preview/s1', '<html></html>');
        expect(result.current.htmlContent.get('s1')).toBe('<html></html>');
    });
});
