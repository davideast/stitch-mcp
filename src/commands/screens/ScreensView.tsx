import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { StitchMCPClient } from '../../services/mcp-client/client.js';
import { downloadText } from '../../ui/copy-behaviors/clipboard.js';
import clipboard from 'clipboardy';
import { StitchViteServer } from '../../lib/server/vite/StitchViteServer.js';
import { spawn } from 'child_process';

interface Screen {
  screenId: string;
  title: string;
  hasCode: boolean;
  codeUrl: string | null;
  hasImage: boolean;
}

interface ScreensViewProps {
  projectId: string;
  projectTitle: string;
  screens: Screen[];
  client: StitchMCPClient;
}

export function ScreensView({ projectId, projectTitle, screens, client }: ScreensViewProps) {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [windowStart, setWindowStart] = useState(0);
  const [status, setStatus] = useState('');
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  const serverRef = useRef<StitchViteServer | null>(null);

  const VIEW_HEIGHT = 10;

  // Helper to sync window with selection
  React.useEffect(() => {
    if (selectedIndex < windowStart) {
      setWindowStart(selectedIndex);
    } else if (selectedIndex >= windowStart + VIEW_HEIGHT) {
      setWindowStart(selectedIndex - VIEW_HEIGHT + 1);
    }
  }, [selectedIndex, windowStart, VIEW_HEIGHT]);

  useEffect(() => {
      return () => {
          if (serverRef.current) serverRef.current.stop();
      };
  }, []);

  async function serveScreen(screen: Screen) {
      if (!screen.hasCode || !screen.codeUrl) {
          setStatus('No HTML to serve');
          return;
      }

      setStatus('Preparing server...');
      let srv = serverRef.current;
      let url = serverUrl;
      let justStarted = false;

      if (!srv) {
          srv = new StitchViteServer();
          url = await srv.start(0);
          serverRef.current = srv;
          setServerUrl(url);
          justStarted = true;
      }

      if (!url) return; // Should not happen

      try {
          const html = await downloadText(screen.codeUrl);
          const route = `/screens/${screen.screenId}`;
          srv.mount(route, html);

          const fullUrl = `${url}${route}`;

          if (justStarted) {
               const start = (process.platform == 'darwin'? 'open': process.platform == 'win32'? 'start': 'xdg-open');
               if (process.platform === 'win32') {
                   spawn('cmd', ['/c', 'start', fullUrl], { detached: true, stdio: 'ignore' }).unref();
               } else {
                   spawn(start, [fullUrl], { detached: true, stdio: 'ignore' }).unref();
               }
          } else {
              srv.navigate(fullUrl);
          }
          setStatus(`Serving at ${fullUrl}`);
      } catch (e) {
          setStatus('Error serving screen');
      }
  }

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    if (key.upArrow || input === 'k') {
      setSelectedIndex(prev => Math.max(0, prev - 1));
      setStatus('');
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex(prev => Math.min(screens.length - 1, prev + 1));
      setStatus('');
    }

    // Copy code
    if (input === 'c') {
      const screen = screens[selectedIndex];
      if (screen?.hasCode && screen.codeUrl) {
        setStatus('Copying...');
        downloadText(screen.codeUrl)
          .then(code => {
            clipboard.write(code);
            setStatus('HTML copied!');
          })
          .catch(() => setStatus('Failed to copy'));
      } else {
        setStatus('No HTML available');
      }
    }

    // Copy image (placeholder)
    if (input === 'i') {
      const screen = screens[selectedIndex];
      if (screen?.hasImage) {
        setStatus('Image copy not implemented');
      } else {
        setStatus('No image available');
      }
    }

    // Serve
    if (input === 's') {
      const screen = screens[selectedIndex];
      if (screen) {
          serveScreen(screen);
      }
    }
  });

  const visibleScreens = screens.slice(windowStart, windowStart + VIEW_HEIGHT);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Text bold>{projectTitle} ({screens.length} screens)</Text>
      <Text dimColor>projectId: {projectId}</Text>
      {serverUrl && <Text dimColor>Server: <Text color="green">{serverUrl}</Text></Text>}
      <Text> </Text>

      {/* Screen List */}
      <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
        {windowStart > 0 && <Text dimColor>... {windowStart} more above ...</Text>}

        {visibleScreens.map((screen, index) => {
          // Adjust index for absolute position
          const absoluteIndex = windowStart + index;
          const isSelected = absoluteIndex === selectedIndex;
          const num = String(absoluteIndex + 1).padStart(2, ' ');
          const selector = isSelected ? '▸' : ' ';

          return (
            <Box key={screen.screenId} flexDirection="column">
              {/* Row 1: Title + Checkboxes */}
              <Box justifyContent="space-between">
                <Box>
                  <Text dimColor>{num}</Text>
                  <Text color={isSelected ? 'cyan' : undefined}> {selector} </Text>
                  <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                    {screen.title.slice(0, 28)}
                  </Text>
                </Box>
                <Box>
                  <Text dimColor>html</Text>
                  <Text color={screen.hasCode ? 'green' : 'gray'}>
                    {screen.hasCode ? '[✓]' : '[ ]'}
                  </Text>
                  <Text>  </Text>
                  <Text dimColor>img</Text>
                  <Text color={screen.hasImage ? 'green' : 'gray'}>
                    {screen.hasImage ? '[✓]' : '[ ]'}
                  </Text>
                </Box>
              </Box>
              {/* Row 2: screenId */}
              <Text dimColor color="gray">     screenId: {screen.screenId}</Text>
              <Text> </Text>
            </Box>
          );
        })}

        {windowStart + VIEW_HEIGHT < screens.length && (
          <Text dimColor>... {screens.length - (windowStart + VIEW_HEIGHT)} more below ...</Text>
        )}
      </Box>

      {/* Footer */}
      <Text dimColor>[c]opy html  [i]mage  [s]erve  [q]uit</Text>
      {status && <Text color="yellow">{status}</Text>}
    </Box>
  );
}
