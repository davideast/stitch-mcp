import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { StitchViteServer } from '../../lib/server/vite/StitchViteServer.js';
import { downloadText } from '../../ui/copy-behaviors/clipboard.js';
import { spawn } from 'child_process';

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
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('Starting server...');
  const [server, setServer] = useState<StitchViteServer | null>(null);

  useEffect(() => {
    const srv = new StitchViteServer();
    setServer(srv);
    let mounted = true;

    async function init() {
      try {
        const url = await srv.start(0);
        if (mounted) setServerUrl(url);

        // Fetch and mount screens
        await Promise.all(screens.map(async (screen) => {
             try {
                 const html = await downloadText(screen.codeUrl);
                 srv.mount(`/screens/${screen.screenId}`, html);
             } catch (e) {
                 console.error(`Failed to load ${screen.screenId}`);
             }
        }));

        // Generate Index
        const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${projectTitle}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; background: #1a1a1a; color: #fff; }
    ul { list-style: none; padding: 0; }
    li { margin: 12px 0; padding: 16px; background: #252525; border-radius: 8px; }
    a { color: #4fc3f7; text-decoration: none; font-size: 18px; display: block; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>${projectTitle}</h1>
  <ul>
    ${screens.map(s => `<li>
      <a href="/screens/${s.screenId}">${s.title}</a>
    </li>`).join('\n')}
  </ul>
</body>
</html>`;
        srv.mount('/', indexHtml);

        if (mounted) setStatus('Ready');
      } catch (e: any) {
        if (mounted) setStatus(`Error: ${e.message}`);
      }
    }

    init();

    return () => {
        mounted = false;
        srv.stop();
    };
  }, []);

  useInput((input, key) => {
      if (input === 'q') {
          exit();
          return;
      }

      if (key.upArrow || input === 'k') {
          setSelectedIndex(prev => Math.max(0, prev - 1));
      }
      if (key.downArrow || input === 'j') {
          setSelectedIndex(prev => Math.min(screens.length, prev + 1));
      }

      if (key.return && serverUrl) {
          const start = (process.platform == 'darwin'? 'open': process.platform == 'win32'? 'start': 'xdg-open');
          let target = serverUrl;
          if (selectedIndex > 0) {
              const screen = screens[selectedIndex - 1];
              if (screen) {
                  target = `${serverUrl}/screens/${screen.screenId}`;
              }
          }
          if (process.platform === 'win32') {
             spawn('cmd', ['/c', 'start', target], { detached: true, stdio: 'ignore' }).unref();
          } else {
             spawn(start, [target], { detached: true, stdio: 'ignore' }).unref();
          }
      }
  });

  return (
    <Box flexDirection="column" padding={1}>
        <Text bold>{projectTitle}</Text>
        <Text color="green">{serverUrl || 'Starting...'}</Text>
        <Text>{status}</Text>
        <Box marginTop={1} flexDirection="column">
            <Text color={selectedIndex === 0 ? 'cyan' : undefined}>
                {selectedIndex === 0 ? '> ' : '  '} Index (/)
            </Text>
            {screens.map((s, i) => (
                <Text key={s.screenId} color={selectedIndex === i + 1 ? 'cyan' : undefined}>
                    {selectedIndex === i + 1 ? '> ' : '  '} {s.title} (/screens/{s.screenId})
                </Text>
            ))}
        </Box>
        <Box marginTop={1}>
            <Text dimColor>[Enter] Open | [q] Quit</Text>
        </Box>
    </Box>
  );
}
