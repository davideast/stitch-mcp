import slugify from '@sindresorhus/slugify';
import { RemoteScreen, ScreenStack, SiteConfig } from './schemas';

export class SiteService {

  /**
   * Phase 1: Deduplication
   * Groups screens by title, identifies artifacts, and marks obsolete versions.
   */
  static stackScreens(screens: RemoteScreen[]): ScreenStack[] {
    // 1. Hard Filter: Must have HTML capability
    const validScreens = screens.filter(s => s.htmlCode?.downloadUrl);

    // 2. Grouping Map
    const groups = new Map<string, RemoteScreen[]>();
    for (const s of validScreens) {
      const key = s.title.trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }

    const stacks: ScreenStack[] = [];

    for (const [title, versions] of groups) {
      // Artifact Detection
      const isArtifact =
        /\.(png|jpg|jpeg|gif)$/i.test(title) ||
        /^localhost_/.test(title) ||
        /^image\.png/i.test(title);

      // Best Candidate: Assume the last one in the list is latest
      const bestCandidate = versions[versions.length - 1];

      stacks.push({
        id: bestCandidate.name,
        stackId: title,
        title,
        count: versions.length,
        versions,
        bestCandidate,
        isArtifact,
        isObsolete: false, // Calculated in next pass
      });
    }

    // 3. Mark Obsolete Versions (e.g. "Home v1" vs "Home v2")
    // Naive Check: If title ends in v[Digits], look for same base with higher number
    for (const stack of stacks) {
      if (stack.isArtifact) continue;

      const match = stack.title.match(/ v(\d+)$/i);
      if (match) {
        const version = parseInt(match[1]);
        const baseTitle = stack.title.substring(0, match.index); // "Home"

        const hasNewer = stacks.some(s => {
          if (s === stack) return false;
          const otherMatch = s.title.match(/ v(\d+)$/i);
          return s.title.startsWith(baseTitle) &&
                 otherMatch &&
                 parseInt(otherMatch[1]) > version;
        });

        if (hasNewer) stack.isObsolete = true;
      }
    }

    return stacks;
  }

  /**
   * Phase 2: Heuristic Routing
   * Generates a draft config with "Smart Defaults" and collision handling.
   */
  static generateDraftConfig(projectId: string, stacks: ScreenStack[]): SiteConfig {
    const routeFrequency = new Map<string, number>();
    const routes = [];

    // Helper to register a route and handle collisions
    const registerRoute = (baseRoute: string) => {
      let route = baseRoute;
      if (routeFrequency.has(route)) {
        const count = routeFrequency.get(route)! + 1;
        routeFrequency.set(route, count);
        // Collision strategy: /home -> /home-1 -> /home-2
        route = route === '/' ? `/home-${count}` : `${route}-${count}`;
      } else {
        routeFrequency.set(route, 0);
      }
      return route;
    };

    for (const stack of stacks) {
      let status: 'included' | 'ignored' = 'included';

      // Default Ignored Rules
      if (stack.isArtifact || stack.isObsolete) status = 'ignored';

      // Route Guessing
      const lowerTitle = stack.title.toLowerCase();
      let baseRoute = `/${slugify(stack.title)}`;

      if (['home', 'landing', 'index', 'main'].includes(lowerTitle)) {
        baseRoute = '/';
      }
      // Handle "Dataprompt Landing Page" -> /dataprompt-landing-page
      // (slugify handles this well by default)

      const finalRoute = registerRoute(baseRoute);

      routes.push({
        screenId: stack.id,
        route: finalRoute,
        status
      });
    }

    // Note: We return a config that MIGHT fail strict validation if the user
    // manually messed it up later, but here we guarantee uniqueness via the registerRoute logic.
    return { projectId, routes };
  }
}
