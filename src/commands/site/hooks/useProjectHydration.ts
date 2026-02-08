import { useState, useEffect, useRef } from 'react';
import { StitchViteServer } from '../../../lib/server/vite/StitchViteServer.js';
import { ProjectSyncer } from '../utils/ProjectSyncer.js';
import type { UIScreen } from '../../../lib/services/site/types.js';
import pLimit from 'p-limit';

export type HydrationStatus = 'idle' | 'downloading' | 'ready' | 'error';

export function useProjectHydration(
  screens: UIScreen[],
  server: StitchViteServer | null,
  syncer: ProjectSyncer,
  activeScreenId?: string
) {
  const [hydrationStatus, setHydrationStatus] = useState<HydrationStatus>('idle');
  const [progress, setProgress] = useState(0);
  const contentCache = useRef<Map<string, string>>(new Map());
  const [htmlContent, setHtmlContent] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!server || screens.length === 0) return;

    let mounted = true;

    const hydrate = async () => {
      // Determine what needs to be downloaded
      // 1. All included screens
      // 2. The active screen (for preview), even if ignored
      const toDownload = screens.filter(s => {
        if (contentCache.current.has(s.id)) return false;
        return s.status === 'included' || s.id === activeScreenId;
      });

      if (toDownload.length === 0) {
        // If nothing to download, ensure server has everything mounted
        // (Just in case activeScreenId changed to something already cached but not mounted?
        //  Actually server mount is persistent as long as server is running.
        //  But if we have cached content, we should ensure it is mounted.)

        // Also check if we should update status to ready
        if (hydrationStatus === 'idle' || hydrationStatus === 'downloading') {
             setHydrationStatus('ready');
             setHtmlContent(new Map(contentCache.current));
        }

        // Mount cached content to server if not already?
        // It's safer to re-mount or check.
        // For now, let's just mount the active one to be sure if it's cached.
        if (activeScreenId && contentCache.current.has(activeScreenId)) {
            server.mount(`/_preview/${activeScreenId}`, contentCache.current.get(activeScreenId)!);
        }

        return;
      }

      setHydrationStatus('downloading');
      const limit = pLimit(3);
      let completed = 0;
      const total = toDownload.length;

      try {
        await Promise.all(toDownload.map(screen => limit(async () => {
          if (!mounted) return;

          if (!screen.downloadUrl) return;

          try {
            const html = await syncer.fetchContent(screen.downloadUrl);
            if (mounted) {
              contentCache.current.set(screen.id, html);
              server.mount(`/_preview/${screen.id}`, html);
            }
          } catch (e) {
            console.error(`Failed to hydrate ${screen.id}`, e);
          }

          if (mounted) {
            completed++;
            setProgress(completed / total);
          }
        })));

        if (mounted) {
          setHtmlContent(new Map(contentCache.current));
          setHydrationStatus('ready');
        }
      } catch (e) {
        if (mounted) setHydrationStatus('error');
      }
    };

    hydrate();

    return () => { mounted = false; };
  }, [screens, server, syncer, activeScreenId]);

  return { hydrationStatus, progress, htmlContent };
}
