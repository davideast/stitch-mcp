import React, { useState } from 'react';
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
  const [serverPort, setServerPort] = useState<number | null>(null);

  const VIEW_HEIGHT = 10;
  const codeCount = screens.filter(s => s.hasCode).length;
  const screensWithCode = screens.filter(s => s.hasCode);

  // Helper to sync window with selection
  React.useEffect(() => {
    if (selectedIndex < windowStart) {
      setWindowStart(selectedIndex);
    } else if (selectedIndex >= windowStart + VIEW_HEIGHT) {
      setWindowStart(selectedIndex - VIEW_HEIGHT + 1);
    }
  }, [selectedIndex, windowStart, VIEW_HEIGHT]);

  async function startServer() {
    if (serverPort) return serverPort; // Already running

    const fs = await import('fs/promises');
    const fsSync = await import('fs');
    const pathMod = await import('path');
    const http = await import('http');

    const tempDir = `/tmp/stitch-screens/${projectId}`;
    await fs.mkdir(tempDir, { recursive: true });

    // Download all code files
    for (const screen of screensWithCode) {
      if (screen.codeUrl) {
        try {
          const code = await downloadText(screen.codeUrl);
          await fs.writeFile(pathMod.join(tempDir, `${screen.screenId}.html`), code);
        } catch (e) {
          // Skip failed downloads
        }
      }
    }

    // Generate index
    const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${projectTitle}</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 20px; background: #1a1a1a; color: #fff; }
    h1 { border-bottom: 1px solid #333; padding-bottom: 16px; }
    ul { list-style: none; padding: 0; }
    li { margin: 12px 0; padding: 12px; background: #252525; border-radius: 6px; }
    a { color: #4fc3f7; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>${projectTitle}</h1>
  <ul>
    ${screensWithCode.map(s => `<li><a href="/${s.screenId}">${s.title}</a></li>`).join('\n    ')}
  </ul>
</body>
</html>`;
    await fs.writeFile(pathMod.join(tempDir, 'index.html'), indexHtml);

    const port = 3000 + Math.floor(Math.random() * 6000);

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }

      const filePath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1) + '.html';
      const fullPath = pathMod.join(tempDir, filePath);

      if (!fsSync.existsSync(fullPath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      fsSync.createReadStream(fullPath).pipe(res);
    });

    server.listen(port);
    setServerPort(port);
    return port;
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

    // Start server and open (lazy serve)
    if (input === 's') {
      const screen = screens[selectedIndex];
      if (screen?.hasCode) {
        setStatus('Starting server...');
        startServer().then(port => {
          import('child_process').then(({ spawn }) => {
            spawn('open', [`http://localhost:${port}/${screen.screenId}`]);
            setStatus(`Serving at :${port}`);
          });
        });
      } else {
        setStatus('No HTML to serve');
      }
    }
  });

  const visibleScreens = screens.slice(windowStart, windowStart + VIEW_HEIGHT);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Text bold>{projectTitle} ({screens.length} screens)</Text>
      <Text dimColor>projectId: {projectId}</Text>
      {serverPort && <Text dimColor>Server: <Text color="green">http://localhost:{serverPort}</Text></Text>}
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
