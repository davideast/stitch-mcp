import { z } from 'zod';

export const RemoteScreenSchema = z.object({
  name: z.string(),
  title: z.string(),
  htmlCode: z.object({
    downloadUrl: z.string(),
  }).optional(), // Making optional to handle screens without htmlCode, though filtering should happen later
});

export const ScreenStackSchema = z.object({
  id: z.string(),
  title: z.string(),
  versions: z.array(RemoteScreenSchema),
  isArtifact: z.boolean(),
  isObsolete: z.boolean(),
});

export const SiteRouteSchema = z.object({
  screenId: z.string(),
  route: z.string(),
  status: z.enum(['included', 'ignored']),
  warning: z.string().optional(),
});

export const SiteConfigSchema = z.object({
  projectId: z.string(),
  routes: z.array(SiteRouteSchema),
}).refine(
  (data) => {
    const includedRoutes = data.routes.filter((r) => r.status === 'included');
    const routePaths = includedRoutes.map((r) => r.route);
    const uniqueRoutes = new Set(routePaths);
    return uniqueRoutes.size === routePaths.length;
  },
  {
    message: 'Active routes must be unique. Duplicate routes found.',
    path: ['routes'],
  }
);
