import { useState, useEffect, useRef } from 'react';
import { StitchViteServer } from '../../../lib/server/vite/StitchViteServer.js';
import { ProjectSyncer } from '../utils/ProjectSyncer.js';
import type { UIStack } from '../ui/types.js';
import pLimit from 'p-limit';

export type HydrationStatus = 'idle' | 'downloading' | 'ready' | 'error';

export function useProjectHydration(
  stacks: UIStack[],
  server: StitchViteServer | null,
  syncer: ProjectSyncer
) {
  const [hydrationStatus, setHydrationStatus] = useState<HydrationStatus>('idle');
  const [progress, setProgress] = useState(0);
  const contentCache = useRef<Map<string, string>>(new Map());
  const [htmlContent, setHtmlContent] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!server || stacks.length === 0) return;

    let mounted = true;

    const hydrate = async () => {
      const toDownload = stacks.filter(s =>
        s.status === 'included' && !contentCache.current.has(s.id)
      );

      if (toDownload.length === 0) {
        // Ensure we update state if we have content but status was idle
        if (hydrationStatus === 'idle' && stacks.some(s => s.status === 'included')) {
          setHydrationStatus('ready');
          setHtmlContent(new Map(contentCache.current));
        }
        // If we have content in cache, make sure it is mounted?
        // If the server was just initialized, cache might be empty or server maps empty.
        // We should probably re-mount everything in cache to server if server changed?
        // But server is in dependency array.
        // If server changed, we should re-mount all cached content.
        // But we don't track if server is "fresh".
        // We can iterate cache and mount?
        for (const [id, html] of contentCache.current) {
          server.mount(`/_preview/${id}`, html);
        }
        return;
      }

      setHydrationStatus('downloading');
      const limit = pLimit(5);
      let completed = 0;
      const total = toDownload.length;

      try {
        await Promise.all(toDownload.map(stack => limit(async () => {
          if (!mounted) return;

          const latest = stack.versions[stack.versions.length - 1];
          if (!latest?.htmlCode?.downloadUrl) return;

          try {
            const html = await syncer.fetchContent(latest.htmlCode.downloadUrl);
            if (mounted) {
              contentCache.current.set(stack.id, html);
              server.mount(`/_preview/${stack.id}`, html);
            }
          } catch (e) {
            console.error(`Failed to hydrate ${stack.id}`, e);
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
  }, [stacks, server, syncer]);

  return { hydrationStatus, progress, htmlContent };
}
