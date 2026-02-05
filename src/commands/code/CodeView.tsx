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

interface CodeViewProps {
  projectId: string;
  projectTitle: string;
  screens: Screen[];
  client: StitchMCPClient;
}

export function CodeView({ projectId, projectTitle, screens, client }: CodeViewProps) {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState('Starting server...');
  const [serverPort, setServerPort] = useState<number | null>(null);

  const codeCount = screens.filter(s => s.hasCode).length;
  const screensWithCode = screens.filter(s => s.hasCode);

  // Auto-start server on mount
  useEffect(() => {
    startServer();
  }, []);

  async function startServer() {
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
          // Silently skip failed downloads
        }
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
    .stats { color: #888; margin-bottom: 24px; }
    ul { list-style: none; padding: 0; }
    li { margin: 16px 0; padding: 16px; background: #252525; border-radius: 8px; }
    a { color: #4fc3f7; text-decoration: none; font-size: 18px; }
    a:hover { text-decoration: underline; }
    .id { color: #666; font-size: 12px; font-family: monospace; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>${projectTitle}</h1>
  <p class="stats">${screensWithCode.length} screens with code</p>
  <ul>
    ${screensWithCode.map(s => `<li>
      <a href="/${s.screenId}">${s.title}</a>
      <div class="id">/${s.screenId}</div>
    </li>`).join('\n    ')}
  </ul>
</body>
</html>`;
    await fs.writeFile(pathMod.join(tempDir, 'index.html'), indexHtml);

    // Pick a random port
    const port = 3000 + Math.floor(Math.random() * 6000);

    // Start server
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

    server.listen(port, () => {
      setServerPort(port);
      setStatus(`Server ready`);
    });
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

    // Enter to open in browser
    if (key.return) {
      const screen = screens[selectedIndex];
      if (screen?.hasCode && serverPort) {
        import('child_process').then(({ spawn }) => {
          spawn('open', [`http://localhost:${serverPort}/${screen.screenId}`]);
          setStatus(`Opened /${screen.screenId.slice(0, 8)}...`);
        });
      } else if (!serverPort) {
        setStatus('Server not ready');
      } else {
        setStatus('No code to preview');
      }
    }

    // Copy code
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

    // Copy image (placeholder)
    if (input === 'i') {
      const screen = screens[selectedIndex];
      if (screen?.hasImage) {
        setStatus('Image copy not implemented yet');
      } else {
        setStatus('No image available');
      }
    }

    // Open in browser
    if (input === 'o') {
      const screen = screens[selectedIndex];
      if (screen?.hasCode && serverPort) {
        import('child_process').then(({ spawn }) => {
          spawn('open', [`http://localhost:${serverPort}/${screen.screenId}`]);
          setStatus(`Opened /${screen.screenId.slice(0, 8)}...`);
        });
      } else if (!serverPort) {
        setStatus('Server not ready');
      } else {
        setStatus('No code to preview');
      }
    }

    // Open index page (shift+O)
    if (input === 'O') {
      if (serverPort) {
        import('child_process').then(({ spawn }) => {
          spawn('open', [`http://localhost:${serverPort}/`]);
          setStatus('Opened index page');
        });
      } else {
        setStatus('Server not ready');
      }
    }

    // Copy route to clipboard
    if (input === 'p') {
      const screen = screens[selectedIndex];
      if (screen?.hasCode && serverPort) {
        const route = `http://localhost:${serverPort}/${screen.screenId}`;
        clipboard.write(route);
        setStatus('Route copied!');
      } else if (!serverPort) {
        setStatus('Server not ready');
      } else {
        setStatus('No route for this screen');
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Text bold>{projectTitle} ({codeCount}/{screens.length} have code)</Text>
      <Text dimColor>
        Server: {serverPort ? <Text color="green">http://localhost:{serverPort}</Text> : <Text color="yellow">starting...</Text>}
      </Text>
      <Text> </Text>

      {/* Screen List */}
      <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
        {screens.map((screen, index) => {
          const isSelected = index === selectedIndex;
          const num = String(index + 1).padStart(2, ' ');
          const selector = isSelected ? '▸' : ' ';

          return (
            <Box key={screen.screenId} flexDirection="column">
              <Box>
                <Text dimColor>{num}</Text>
                <Text color={isSelected ? 'cyan' : undefined}> {selector} </Text>
                <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                  {screen.title.slice(0, 30).padEnd(30)}
                </Text>
                <Text>  </Text>
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
              <Box>
                <Text dimColor>      </Text>
                {screen.hasCode && serverPort ? (
                  <Text dimColor>→ :{serverPort}/{screen.screenId.slice(0, 16)}...</Text>
                ) : (
                  <Text dimColor italic>(no route)</Text>
                )}
              </Box>
              <Text> </Text>
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      <Text dimColor>[c]opy  [i]mage  [o]pen  [O] index  [p]ath  [q]uit</Text>
      {status && <Text color="yellow">{status}</Text>}
    </Box>
  );
}
