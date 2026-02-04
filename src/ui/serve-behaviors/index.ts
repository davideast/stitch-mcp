/**
 * Serve behaviors for JSON viewer.
 */
export type { ServeHandler, ServeContext, ServeResult, PathMatcher } from './types.js';
export { serveHtmlInMemory } from './server.js';
export { htmlCodeServeHandler } from './handlers.js';
export { registerServeHandler, getServeHandler, endsWith, contains } from './registry.js';
