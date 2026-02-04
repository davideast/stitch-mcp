/**
 * Clipboard utilities using clipboardy for cross-platform support.
 */
import clipboard from 'clipboardy';
import { writeFile, unlink } from 'fs/promises';
import { spawn } from 'child_process';

/**
 * Copy text to clipboard
 */
export async function copyText(text: string): Promise<void> {
  await clipboard.write(text);
}

/**
 * Copy JSON-serialized value to clipboard
 */
export async function copyJson(value: any): Promise<void> {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  await clipboard.write(text);
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
 * Download an image from URL and copy to clipboard.
 * Uses platform-specific commands for image clipboard.
 */
export async function downloadAndCopyImage(url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const tempPath = `/tmp/stitch-clipboard-${Date.now()}.png`;

  // Write to temp file using Node.js fs
  await writeFile(tempPath, Buffer.from(buffer));

  // Copy image to clipboard using platform command
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
    // macOS: use osascript to copy image
      await spawnAndWait('osascript', ['-e', `set the clipboard to (read (POSIX file "${tempPath}") as TIFF picture)`]);
    } else if (platform === 'linux') {
      // Linux: use xclip
      await spawnAndWait('xclip', ['-selection', 'clipboard', '-t', 'image/png', '-i', tempPath]);
    } else if (platform === 'win32') {
      // Windows: PowerShell
      await spawnAndWait('powershell', ['-command', `Set-Clipboard -Path "${tempPath}"`]);
    }
  } finally {
  // Cleanup temp file
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Download text content from URL and copy to clipboard.
 */
export async function downloadAndCopyText(url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  const text = await response.text();
  await clipboard.write(text);
}
