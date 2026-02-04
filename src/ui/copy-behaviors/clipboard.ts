/**
 * Clipboard utilities using clipboardy for cross-platform support.
 */
import clipboard from 'clipboardy';

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

  // Write to temp file
  await Bun.write(tempPath, buffer);

  // Copy image to clipboard using platform command
  const platform = process.platform;

  if (platform === 'darwin') {
    // macOS: use osascript to copy image
    const proc = Bun.spawn(['osascript', '-e', `set the clipboard to (read (POSIX file "${tempPath}") as TIFF picture)`]);
    await proc.exited;
  } else if (platform === 'linux') {
    // Linux: use xclip
    const proc = Bun.spawn(['xclip', '-selection', 'clipboard', '-t', 'image/png', '-i', tempPath]);
    await proc.exited;
  } else if (platform === 'win32') {
    // Windows: PowerShell
    const proc = Bun.spawn(['powershell', '-command', `Set-Clipboard -Path "${tempPath}"`]);
    await proc.exited;
  }

  // Cleanup temp file
  await Bun.file(tempPath).exists() && await Bun.$`rm ${tempPath}`.quiet();
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
