/**
 * Registry for path-based serve handler selection.
 */
import type { ServeHandler, PathMatcher } from './types.js';
import { htmlCodeServeHandler } from './handlers.js';

interface HandlerRegistration { matcher: PathMatcher; handler: ServeHandler; }
const registrations: HandlerRegistration[] = [];

export function registerServeHandler(matcher: PathMatcher, handler: ServeHandler): void {
  registrations.push({ matcher, handler });
}

export function getServeHandler(path: string): ServeHandler | null {
  for (let i = registrations.length - 1; i >= 0; i--) {
    const reg = registrations[i];
    if (reg && reg.matcher(path)) return reg.handler;
  }
  return null;
}

export function endsWith(suffix: string): PathMatcher {
  return (path: string) => path.endsWith(suffix);
}

export function contains(segment: string): PathMatcher {
  return (path: string) => path.includes(segment);
}

// Default registrations
registerServeHandler(endsWith('.htmlCode'), htmlCodeServeHandler);
registerServeHandler(endsWith('.htmlCode.downloadUrl'), htmlCodeServeHandler);

export { htmlCodeServeHandler };
