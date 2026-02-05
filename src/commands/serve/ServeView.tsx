import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { downloadText } from '../../ui/copy-behaviors/clipboard.js';

interface CodeScreen {
  screenId: string;
  title: string;
  codeUrl: string;
}

interface ServeViewProps {
  projectId: string;
  projectTitle: string;
  screens: CodeScreen[];
}

export function ServeView({ projectId, projectTitle, screens }: ServeViewProps) {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState('Starting server...');
  const [serverPort, setServerPort] = useState<number | null>(null);

  screens = [
    { screenId: '', title: 'index', codeUrl: '' },
    ...screens,
  ]

  // Auto-start server on mount
  useEffect(() => {
    startServer();
  }, []);

  async function startServer() {
    const fs = await import('fs/promises');
    const fsSync = await import('fs');
    const pathMod = await import('path');
    const http = await import('http');

    // Create temp directory
    const tempDir = `/tmp/stitch-serve/${projectId}`;
    await fs.mkdir(tempDir, { recursive: true });

    // Download all code files
    for (const screen of screens) {
      try {
        const code = await downloadText(screen.codeUrl);
        await fs.writeFile(pathMod.join(tempDir, `${screen.screenId}.html`), code);
      } catch (e) {
        // Skip failed downloads
      }
    }

    // Generate index page
    const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${projectTitle}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; background: #1a1a1a; color: #fff; }
    h1 { color: #fff; border-bottom: 1px solid #333; padding-bottom: 16px; }
    ul { list-style: none; padding: 0; }
    li { margin: 12px 0; padding: 16px; background: #252525; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    a { color: #4fc3f7; text-decoration: none; font-size: 18px; }
    a:hover { text-decoration: underline; }
    .route { color: #888; font-family: monospace; font-size: 14px; }
  </style>
</head>
<body>
  <h1>${projectTitle}</h1>
  <ul>
    ${screens.map(s => `<li>
      <a href="/${s.screenId.slice(0, 8)}">${s.title}</a>
      <span class="route">/${s.screenId.slice(0, 8)}</span>
    </li>`).join('\n    ')}
  </ul>
</body>
</html>`;
    await fs.writeFile(pathMod.join(tempDir, 'index.html'), indexHtml);

    // Pick a port
    const port = 3000 + Math.floor(Math.random() * 6000);

    // Start server
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Match short route to full screenId
      const routeId = url.pathname.slice(1);
      let filePath = 'index.html';

      if (routeId) {
        const matchedScreen = screens.find(s => s.screenId.startsWith(routeId));
        if (matchedScreen) {
          filePath = `${matchedScreen.screenId}.html`;
        }
      }

      const fullPath = pathMod.join(tempDir, filePath);

      if (!fsSync.existsSync(fullPath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      fsSync.createReadStream(fullPath).pipe(res);
    });

    server.listen(port, () => {
      setServerPort(port);
      setStatus('');
    });
  }

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    if (key.upArrow || input === 'k') {
      setSelectedIndex(i => Math.max(0, i - 1));
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex(i => Math.min(screens.length - 1, i + 1));
    }

    // Enter to open in browser
    if (key.return) {
      const screen = screens[selectedIndex];
      if (screen && serverPort) {
        import('child_process').then(({ spawn }) => {
          const shortId = screen.screenId.slice(0, 8);
          spawn('open', [`http://localhost:${serverPort}/${shortId}`]);
          setStatus(`Opened /${shortId}`);
        });
      }
    }

    // Open index page
    if (input === 'i') {
      if (serverPort) {
        import('child_process').then(({ spawn }) => {
          spawn('open', [`http://localhost:${serverPort}/`]);
          setStatus('Opened index');
        });
      }
    }
  });

  const serverUrl = serverPort ? `http://localhost:${serverPort}` : 'starting...';

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Text dimColor>────────────────────────────────────────────────────────────</Text>
      <Text bold>  {projectTitle}</Text>
      <Text color={serverPort ? 'green' : 'yellow'}>  {serverUrl}</Text>
      <Text dimColor>────────────────────────────────────────────────────────────</Text>
      <Text> </Text>

      {/* Index route */}
      <Text dimColor> all routes</Text>
      <Text> </Text>

      {/* Routes */}
      {screens.map((screen, index) => {
        const isSelected = index === selectedIndex;
        const num = String(index + 1).padStart(2, ' ');
        const shortId = screen.screenId.slice(0, 8);
        const route = `/${shortId}`.padEnd(25);

        return (
          <Box key={screen.screenId}>
            <Text dimColor>{num} </Text>
            <Text color={isSelected ? 'cyan' : undefined}>{isSelected ? '▸' : ' '} </Text>
            <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>{route}</Text>
            <Text dimColor>→ {screen.title.slice(0, 30)}</Text>
          </Box>
        );
      })}

      <Text> </Text>
      <Text dimColor>────────────────────────────────────────────────────────────</Text>
      <Text dimColor>  [enter] open  [i]ndex  [q]uit</Text>
      {status && <Text color="yellow">  {status}</Text>}
    </Box>
  );
}
