import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { StitchMCPClient } from '../../services/mcp-client/client.js';
import { downloadText } from '../../ui/copy-behaviors/clipboard.js';
import clipboard from 'clipboardy';

interface Screen {
  screenId: string;
  title: string;
  hasCode: boolean;
  codeUrl: string | null;
  hasImage: boolean;
}

// Track running servers: screenId -> port
const runningServers = new Map<string, number>();
const usedPorts = new Set<number>();

function getOrCreatePort(screenId: string): { port: number; isNew: boolean } {
  // Check if this screen already has a server
  const existingPort = runningServers.get(screenId);
  if (existingPort) {
    return { port: existingPort, isNew: false };
  }

  // Find a new available port
  let port: number;
  do {
    port = 3000 + Math.floor(Math.random() * 6000);
  } while (usedPorts.has(port));

  usedPorts.add(port);
  runningServers.set(screenId, port);
  return { port, isNew: true };
}

interface CodeViewProps {
  projectId: string;
  projectTitle: string;
  screens: Screen[];
  client: StitchMCPClient;
}

export function CodeView({ projectId, projectTitle, screens, client }: CodeViewProps) {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState('');

  const codeCount = screens.filter(s => s.hasCode).length;

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    if (key.upArrow || input === 'k') {
      setSelectedIndex(i => Math.max(0, i - 1));
      setStatus('');
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex(i => Math.min(screens.length - 1, i + 1));
      setStatus('');
    }

    if (input === 'c') {
      const screen = screens[selectedIndex];
      if (screen?.hasCode && screen.codeUrl) {
        setStatus('Copying code...');
        downloadText(screen.codeUrl)
          .then(code => {
            clipboard.write(code);
            setStatus('Code copied!');
          })
          .catch(() => setStatus('Failed to copy code'));
      } else {
        setStatus('No code available');
      }
    }

    if (input === 'i') {
      const screen = screens[selectedIndex];
      if (screen?.hasImage) {
        setStatus('Image copy not implemented yet');
      } else {
        setStatus('No image available');
      }
    }

    if (input === 's') {
      const screen = screens[selectedIndex];
      if (screen?.hasCode && screen.codeUrl) {
        setStatus('Starting server...');
        // Download code, write to temp file, and serve
        downloadText(screen.codeUrl)
          .then(async (code) => {
            const fs = await import('fs/promises');
            const path = await import('path');
            const { spawn } = await import('child_process');

            // Write to temp HTML file
            const tempDir = '/tmp/stitch-server';
            await fs.mkdir(tempDir, { recursive: true });
            const htmlPath = path.join(tempDir, `${screen.screenId}.html`);
            await fs.writeFile(htmlPath, code);

            // Get or reuse port for this screen
            const { port, isNew } = getOrCreatePort(screen.screenId);

            if (isNew) {
              // Start Bun server only for new ports
              spawn('bun', ['--hot', '-e', `
                Bun.serve({
                  port: ${port},
                  fetch(req) {
                    return new Response(Bun.file('${htmlPath}'), {
                      headers: { 'Content-Type': 'text/html' }
                    });
                  }
                });
                console.log('Server running at http://localhost:${port}');
              `], { stdio: 'inherit' });
            }

            // Open browser (always)
            spawn('open', [`http://localhost:${port}`]);

            setStatus(`Server running at http://localhost:${port}${isNew ? '' : ' (reused)'}`);
          })
          .catch((e) => setStatus(`Failed to start server: ${e}`));
      } else {
        setStatus('No code available');
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Text bold>{projectTitle} ({codeCount}/{screens.length} have code)</Text>
      <Text dimColor>{projectId}</Text>
      <Text> </Text>

      {/* Screen List */}
      {screens.map((screen, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? '▸' : ' ';

        return (
          <Box key={screen.screenId} flexDirection="column">
            <Box>
              <Text color={isSelected ? 'cyan' : undefined}>
                {prefix} {screen.title.padEnd(25)}
              </Text>
              <Text color={screen.hasCode ? 'green' : 'gray'}>
                {screen.hasCode ? 'code' : '    '}
              </Text>
              <Text>  </Text>
              <Text color={screen.hasImage ? 'green' : 'gray'}>
                {screen.hasImage ? 'image' : '     '}
              </Text>
            </Box>
            <Text dimColor>  {screen.screenId}</Text>
            <Text> </Text>
          </Box>
        );
      })}

      {/* Footer */}
      <Text dimColor>[c]opy  [i]mage  [s]erver  [q]uit</Text>
      {status && <Text color="yellow">{status}</Text>}
    </Box>
  );
}
