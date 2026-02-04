/**
 * Copy behavior types for the JSON viewer.
 * Handlers implement this interface to provide custom copy behaviors.
 */

export interface CopyContext {
  /** The key name of the property */
  key: string;
  /** The value of the property */
  value: any;
  /** Full dot-notation path (e.g., "projects.0.thumbnailScreenshot.downloadUrl") */
  path: string;
  /** Optional callback to show progress during async operations */
  onProgress?: (message: string) => void;
}

export interface CopyResult {
  success: boolean;
  message: string;
}

export interface CopyHandler {
  /** Handle "c" - single copy (typically just the value) */
  copy(ctx: CopyContext): Promise<CopyResult>;
  /** Handle "cc" - extended copy (typically key+value or special action) */
  copyExtended(ctx: CopyContext): Promise<CopyResult>;
}

/** Check if a path matches a pattern (supports glob-like segments) */
export type PathMatcher = (path: string) => boolean;
