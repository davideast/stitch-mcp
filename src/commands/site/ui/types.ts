import type { ScreenStack } from '../../../lib/services/site/types.js';

export interface UIStack extends ScreenStack {
  status: 'included' | 'ignored';
  route: string;
  warning?: string;
}
