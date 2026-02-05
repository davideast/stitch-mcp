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

// Single server state per project
let serverState: {
  port: number;
  projectId: string;
} | null = null;

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
  const screensWithCode = screens.filter(s => s.hasCode);

  // Start or get the single server for this project
  async function ensureServer(): Promise<number> {
    if (serverState && serverState.projectId === projectId) {
      return serverState.port;
    }

    const fs = await import('fs/promises');
    const fsSync = await import('fs');
    const pathMod = await import('path');
    const http = await import('http');

    // Create temp directory for all screens
    const tempDir = `/tmp/stitch-server/${projectId}`;
    await fs.mkdir(tempDir, { recursive: true });

    // Download and write all screens with code
    for (const screen of screensWithCode) {
      if (screen.codeUrl) {
        try {
          const code = await downloadText(screen.codeUrl);
          await fs.writeFile(pathMod.join(tempDir, `${screen.screenId}.html`), code);
        } catch (e) {
          console.error(`Failed to download ${screen.screenId}:`, e);
        }
      }
    }

    // Generate index page
    const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${projectTitle}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; }
    ul { list-style: none; padding: 0; }
    li { margin: 12px 0; }
    a { color: #0066cc; text-decoration: none; font-size: 18px; }
    a:hover { text-decoration: underline; }
    .id { color: #999; font-size: 12px; font-family: monospace; }
  </style>
</head>
<body>
  <h1>${projectTitle}</h1>
  <p>${screensWithCode.length} screens with code</p>
  <ul>
    ${screensWithCode.map(s => `<li>
      <a href="/${s.screenId}">${s.title}</a>
      <div class="id">${s.screenId}</div>
    </li>`).join('\n    ')}
  </ul>
</body>
</html>`;
    await fs.writeFile(pathMod.join(tempDir, 'index.html'), indexHtml);

    // Pick a random port
    const port = 3000 + Math.floor(Math.random() * 6000);

    // Start server directly in this process
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      // Skip favicon
      if (url.pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }

      const filePath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1) + '.html';
      const fullPath = pathMod.join(tempDir, filePath);

      // Check if file exists
      if (!fsSync.existsSync(fullPath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      fsSync.createReadStream(fullPath).pipe(res);
    });

    server.listen(port);

    serverState = { port, projectId };
    return port;
  }

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
      if (screen?.hasCode) {
        setStatus('Starting server...');
        ensureServer()
          .then(async (port) => {
            const { spawn } = await import('child_process');
            // Open browser to the specific screen route
            spawn('open', [`http://localhost:${port}/${screen.screenId}`]);
            setStatus(`http://localhost:${port}/${screen.screenId}`);
          })
          .catch((e) => setStatus(`Failed: ${e}`));
      } else {
        setStatus('No code available');
      }
    }

    if (input === 'p') {
      if (!serverState || serverState.projectId !== projectId) {
        setStatus('Server not running. Press s to start.');
      } else {
        setStatus(`http://localhost:${serverState.port}/`);
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
      <Text dimColor>[c]opy  [i]mage  [s]erver  [p]orts  [q]uit</Text>
      {status && <Text color="yellow">{status}</Text>}
    </Box>
  );
}
