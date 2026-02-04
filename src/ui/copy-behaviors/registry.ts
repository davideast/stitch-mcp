/**
 * Registry for path-based copy handler selection.
 */
import type { CopyHandler, PathMatcher } from './types.js';
import { defaultCopyHandler, imageUrlCopyHandler, htmlCodeCopyHandler } from './handlers.js';

interface HandlerRegistration {
  matcher: PathMatcher;
  handler: CopyHandler;
}

const registrations: HandlerRegistration[] = [];

/**
 * Register a handler for paths matching the given pattern.
 * Later registrations take precedence over earlier ones.
 */
export function registerHandler(matcher: PathMatcher, handler: CopyHandler): void {
  registrations.push({ matcher, handler });
}

/**
 * Get the appropriate handler for a given path.
 * Returns the most recently registered matching handler, or default.
 */
export function getHandler(path: string): CopyHandler {
  // Check in reverse order (most recent first)
  for (let i = registrations.length - 1; i >= 0; i--) {
    const registration = registrations[i];
    if (registration && registration.matcher(path)) {
      return registration.handler;
    }
  }
  return defaultCopyHandler;
}

/**
 * Create a matcher that checks if path ends with the given suffix.
 */
export function endsWith(suffix: string): PathMatcher {
  return (path: string) => path.endsWith(suffix);
}

/**
 * Create a matcher that checks if path contains the given segment.
 */
export function contains(segment: string): PathMatcher {
  return (path: string) => path.includes(segment);
}

// ============================================================================
// Default registrations
// ============================================================================

// Register image URL handler for thumbnailScreenshot.downloadUrl
registerHandler(endsWith('.thumbnailScreenshot.downloadUrl'), imageUrlCopyHandler);

// Register image URL handler for screenshot.downloadUrl (in screen view)
registerHandler(endsWith('.screenshot.downloadUrl'), imageUrlCopyHandler);

// Register HTML code handler for htmlCode.downloadUrl
registerHandler(endsWith('.htmlCode.downloadUrl'), htmlCodeCopyHandler);

// Export for convenience
export { defaultCopyHandler, imageUrlCopyHandler, htmlCodeCopyHandler };
