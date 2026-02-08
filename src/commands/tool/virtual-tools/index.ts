export type { VirtualTool } from '../spec.js';
export { getScreenCodeTool } from './get-screen-code.js';
export { getScreenImageTool } from './get-screen-image.js';
export { buildSiteTool } from './build-site.js';

import { getScreenCodeTool } from './get-screen-code.js';
import { getScreenImageTool } from './get-screen-image.js';
import { buildSiteTool } from './build-site.js';
import type { VirtualTool } from '../spec.js';

export const virtualTools: VirtualTool[] = [
  getScreenCodeTool,
  getScreenImageTool,
  buildSiteTool,
];
