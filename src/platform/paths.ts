import path from 'node:path';

/**
 * Get cross-platform path join
 */
export function joinPath(...parts: string[]): string {
  return path.join(...parts);
}

/**
 * Get the directory name from a path
 */
export function dirname(filepath: string): string {
  return path.dirname(filepath);
}

/**
 * Get the basename from a path
 */
export function basename(filepath: string): string {
  return path.basename(filepath);
}

/**
 * Normalize path separators for the current platform
 */
export function normalizePath(filepath: string): string {
  return path.normalize(filepath);
}

/**
 * Convert a path to use forward slashes (for consistency)
 */
export function toUnixPath(filepath: string): string {
  return filepath.split(path.sep).join('/');
}
