import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { StitchMCPClient } from '../../../services/mcp-client/client.js';
import { SiteService } from '../../../lib/services/site/SiteService.js';
import { StitchViteServer } from '../../../lib/server/vite/StitchViteServer.js';
import { ProjectSyncer } from '../utils/ProjectSyncer.js';
import { ScreenList } from './ScreenList.js';
import { DetailPane } from './DetailPane.js';
import { useProjectHydration } from '../hooks/useProjectHydration.js';
import type { UIStack } from './types.js';
import type { SiteConfig } from '../../../lib/services/site/types.js';
import { spawn } from 'child_process';

interface SiteBuilderProps {
  projectId: string;
  client: StitchMCPClient;
  onExit: (config: SiteConfig | null, htmlContent?: Map<string, string>) => void;
}

export const SiteBuilder: React.FC<SiteBuilderProps> = ({ projectId, client, onExit }) => {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stacks, setStacks] = useState<UIStack[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  const syncer = useMemo(() => new ProjectSyncer(client), [client]);

  const [server, setServer] = useState<StitchViteServer | null>(null);

  useEffect(() => {
    let mounted = true;
    const srv = new StitchViteServer();
    setServer(srv);

    const init = async () => {
        try {
            // Start server
            const url = await srv.start(0);
            if (mounted) setServerUrl(url);

            // Fetch screens
            const screens = await syncer.fetchManifest(projectId);

            // Stack
            const screenStacks = SiteService.stackScreens(screens);

            // Draft Config
            const config = SiteService.generateDraftConfig(projectId, screenStacks);

            // Merge to UIStack
            const merged: UIStack[] = screenStacks.map(stack => {
                const routeConfig = config.routes.find(r => r.screenId === stack.id);
                return {
                    ...stack,
                    status: routeConfig?.status || 'ignored',
                    route: routeConfig?.route || '/',
                    warning: routeConfig?.warning
                };
            });

            if (mounted) {
                setStacks(merged);
                setLoading(false);
            }
        } catch (e: any) {
            if (mounted) setError(e.message);
        }
    };

    init();

    return () => {
        mounted = false;
        srv.stop();
    };
  }, [projectId, syncer]);

  // Hydration hook
  const { hydrationStatus, progress, htmlContent } = useProjectHydration(stacks, server, syncer);

  // Navigate effect (Follow Mode)
  useEffect(() => {
      if (server && followMode && stacks[activeIndex]) {
          const stack = stacks[activeIndex];
          server.navigate(`/_preview/${stack.id}`);
      }
  }, [activeIndex, followMode, server, stacks]);

  useInput((input, key) => {
      if (loading || error) return;

      if (isEditing) {
          if (key.escape) {
              setIsEditing(false);
          }
          return;
      }

      if (key.upArrow) {
          setActiveIndex(prev => Math.max(0, prev - 1));
      }
      if (key.downArrow) {
          setActiveIndex(prev => Math.min(stacks.length - 1, prev + 1));
      }
      if (input === ' ') {
          setStacks(prev => {
              const next = [...prev];
              const current = next[activeIndex];
              if (current) {
                  current.status = current.status === 'included' ? 'ignored' : 'included';
              }
              return next;
          });
      }
      if (key.return) {
          setIsEditing(true);
      }
      if (input === 'f') {
          setFollowMode(prev => !prev);
      }
      if (input === 'o') {
          if (serverUrl) {
              const stack = stacks[activeIndex];
              if (stack) {
                  // const target = `/_preview/${stack.id}`;
                  // Open root so user can navigate? Or target?
                  // The directive just says 'o': Open browser.
                  // Assuming opening the server root or preview.
                  const start = (process.platform == 'darwin'? 'open': process.platform == 'win32'? 'start': 'xdg-open');
                  const target = `${serverUrl}/_preview/${stack.id}`;
                  if (process.platform === 'win32') {
                     spawn('cmd', ['/c', 'start', target], { detached: true, stdio: 'ignore' }).unref();
                  } else {
                     spawn(start, [target], { detached: true, stdio: 'ignore' }).unref();
                  }
              }
          }
      }
      if (input === 'g') {
          // Generate
          const finalConfig: SiteConfig = {
              projectId,
              routes: stacks.map(s => ({
                  screenId: s.id,
                  route: s.route,
                  status: s.status,
                  warning: s.warning
              }))
          };
          onExit(finalConfig, htmlContent);
          exit();
      }
      if (key.escape) {
          onExit(null);
          exit();
      }
  });

  const handleRouteUpdate = (val: string) => {
      setStacks(prev => {
          const next = [...prev];
          const current = next[activeIndex];
          if (current) {
              current.route = val;
          }
          return next;
      });
  };

  if (error) {
      return <Text color="red">Error: {error}</Text>;
  }

  if (loading) {
      return (
          <Box>
              <Text color="green"><Spinner type="dots" /> Loading project...</Text>
          </Box>
      );
  }

  const activeStack = stacks[activeIndex];

  return (
    <Box flexDirection="column" height="100%">
        <Box borderStyle="single" borderColor="cyan" paddingX={1}>
            <Text>Stitch Site Builder</Text>
            <Box marginLeft={2}>
                <Text color="gray">{serverUrl}</Text>
            </Box>
            <Box marginLeft={2}>
                 {hydrationStatus === 'downloading' && (
                     <Text color="yellow">
                         <Spinner type="dots" /> Downloading... {Math.round(progress * 100)}%
                     </Text>
                 )}
                 {hydrationStatus === 'ready' && <Text color="green">Ready</Text>}
            </Box>
        </Box>

        <Box flexDirection="row" flexGrow={1}>
            <ScreenList stacks={stacks} activeIndex={activeIndex} />
            <DetailPane
                stack={activeStack}
                isEditing={isEditing}
                onRouteChanged={handleRouteUpdate}
                onSubmit={() => setIsEditing(false)}
            />
        </Box>

        <Box borderStyle="single" borderColor="gray" paddingX={1}>
            <Text dimColor>
                Keymap: [↑/↓] Navigate | [Space] Toggle | [Enter] Edit Route | [f] Follow: {followMode ? 'ON' : 'OFF'} | [g] Generate | [Esc] Quit
            </Text>
        </Box>
    </Box>
  );
};
