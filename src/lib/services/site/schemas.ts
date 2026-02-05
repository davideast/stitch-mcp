import { z } from 'zod';

// 1. Raw Input from Stitch API
export const RemoteScreenSchema = z.object({
  name: z.string(), // Stitch ID (e.g. projects/.../screens/123)
  title: z.string(),
  htmlCode: z.object({
    downloadUrl: z.string().url(),
  }).optional(),
  // Allow other fields to pass through if needed, or use .passthrough()
});

// 2. Intermediate "Stack" State (Deduplicated)
export const ScreenStackSchema = z.object({
  id: z.string(),          // ID of the 'bestCandidate'
  stackId: z.string(),     // Grouping key (The Title)
  title: z.string(),
  count: z.number().int().min(1),
  versions: z.array(RemoteScreenSchema),
  bestCandidate: RemoteScreenSchema,
  isArtifact: z.boolean(),
  isObsolete: z.boolean(), // e.g. "v1" when "v2" exists
});

// 3. Final Operation Config (TUI Output / Generator Input)
export const SiteConfigSchema = z.object({
  projectId: z.string(),
  routes: z.array(z.object({
    screenId: z.string(),
    route: z.string().regex(/^\//, "Route must start with /"),
    status: z.enum(['included', 'ignored']),
  })),
}).refine(data => {
  // CRITICAL: Ensure no two 'included' screens share the same route
  const activeRoutes = data.routes
    .filter(r => r.status === 'included')
    .map(r => r.route);
  const uniqueRoutes = new Set(activeRoutes);
  return uniqueRoutes.size === activeRoutes.length;
}, {
  message: "Duplicate active routes detected. Collisions must be resolved."
});

export type RemoteScreen = z.infer<typeof RemoteScreenSchema>;
export type ScreenStack = z.infer<typeof ScreenStackSchema>;
export type SiteConfig = z.infer<typeof SiteConfigSchema>;
