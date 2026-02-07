import { z } from 'zod';
import { RemoteScreenSchema, SiteConfigSchema, SiteRouteSchema } from './schemas.js';

export type RemoteScreen = z.infer<typeof RemoteScreenSchema>;
export type SiteRoute = z.infer<typeof SiteRouteSchema>;
export type SiteConfig = z.infer<typeof SiteConfigSchema>;

export interface UIScreen {
  id: string;          // RemoteScreen.name
  title: string;       // RemoteScreen.title
  downloadUrl: string; // RemoteScreen.htmlCode.downloadUrl
  status: 'included' | 'ignored' | 'discarded';
  route: string;       // empty by default
}

export interface IAssetGateway {
  rewriteHtmlForBuild(html: string): Promise<{ html: string; assets: { url: string; filename: string }[] }>;
  copyAssetTo(url: string, destPath: string): Promise<boolean>;
}
