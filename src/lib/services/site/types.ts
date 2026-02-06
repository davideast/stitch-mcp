import { z } from 'zod';
import { RemoteScreenSchema, ScreenStackSchema, SiteConfigSchema, SiteRouteSchema } from './schemas.js';

export type RemoteScreen = z.infer<typeof RemoteScreenSchema>;
export type ScreenStack = z.infer<typeof ScreenStackSchema>;
export type SiteRoute = z.infer<typeof SiteRouteSchema>;
export type SiteConfig = z.infer<typeof SiteConfigSchema>;

export interface IAssetGateway {
  rewriteHtmlForBuild(html: string): Promise<{ html: string; assets: { url: string; filename: string }[] }>;
  copyAssetTo(url: string, destPath: string): Promise<boolean>;
}
