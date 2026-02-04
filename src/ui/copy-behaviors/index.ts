/**
 * Copy behaviors for JSON viewer.
 * Provides isolated, reusable copy handlers.
 */
export type { CopyHandler, CopyContext, CopyResult, PathMatcher } from './types.js';
export { copyText, copyJson, downloadAndCopyImage } from './clipboard.js';
export { defaultCopyHandler, imageUrlCopyHandler } from './handlers.js';
export { registerHandler, getHandler, endsWith, contains } from './registry.js';
