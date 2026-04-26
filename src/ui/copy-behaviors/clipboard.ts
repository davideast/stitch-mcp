/**
 * Clipboard utilities using platform-native commands.
 * Avoids bundled binaries (e.g. clipboardy's clipboard_*.exe) so the
 * package does not trigger enterprise threat-intel scanners on Windows.
 */
import { writeFile, unlink } from 'fs/promises';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';

interface NativeWriter {
  command: string;
  args: string[];
}

function getTextWriters(): NativeWriter[] {
  switch (process.platform) {
    case 'darwin':
      return [{ command: 'pbcopy', args: [] }];
    case 'win32':
      return [
        { command: 'clip.exe', args: [] },
        { command: 'clip', args: [] },
      ];
    default:
      return [
        { command: 'wl-copy', args: [] },
        { command: 'xclip', args: ['-selection', 'clipboard'] },
        { command: 'xsel', args: ['--clipboard', '--input'] },
      ];
  }
}

function pipeToCommand(writer: NativeWriter, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(writer.command, writer.args, {
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${writer.command} exited with code ${code}`));
    });
    proc.stdin.end(text, 'utf8');
  });
}

async function writeTextToClipboard(text: string): Promise<void> {
  const writers = getTextWriters();
  let lastError: unknown;
  for (const writer of writers) {
    try {
      await pipeToCommand(writer, text);
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('No clipboard utility available');
}

/**
 * Copy text to clipboard
 */
export async function copyText(text: string): Promise<void> {
  await writeTextToClipboard(text);
}

/**
 * Copy JSON-serialized value to clipboard
 */
export async function copyJson(value: any): Promise<void> {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  await writeTextToClipboard(text);
}

/**
 * Spawn a process and wait for it to exit.
 * Cross-runtime compatible replacement for Bun.spawn().
 */
function spawnAndWait(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'ignore' });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

/**
 * Download an image from URL.
 */
export async function downloadImage(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  return response.arrayBuffer();
}

/**
 * Download an image from URL and copy to clipboard.
 * Uses platform-specific commands for image clipboard.
 */
export async function downloadAndCopyImage(url: string): Promise<void> {
  const buffer = await downloadImage(url);
  const tempPath = join(tmpdir(), `stitch-clipboard-${Date.now()}.png`);

  await writeFile(tempPath, Buffer.from(buffer));

  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      await spawnAndWait('osascript', ['-e', `set the clipboard to (read (POSIX file "${tempPath}") as TIFF picture)`]);
    } else if (platform === 'linux') {
      await spawnAndWait('xclip', ['-selection', 'clipboard', '-t', 'image/png', '-i', tempPath]);
    } else if (platform === 'win32') {
      await spawnAndWait('powershell', ['-command', `Set-Clipboard -Path "${tempPath}"`]);
    }
  } finally {
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Download text content from URL.
 */
export async function downloadText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  return response.text();
}

/**
 * Download text content from URL and copy to clipboard.
 */
export async function downloadAndCopyText(url: string): Promise<void> {
  const text = await downloadText(url);
  await writeTextToClipboard(text);
}
