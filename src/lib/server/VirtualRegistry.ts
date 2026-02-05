import fs from 'fs-extra';

export type ContentSource =
  | { type: 'file'; path: string }
  | { type: 'memory'; content: string };

export class VirtualRegistry {
  private routes = new Map<string, ContentSource>();

  /**
   * Register a route to a content source.
   * @param route e.g., "/about" or "/screens/855b..."
   * @param source File path or raw HTML string
   */
  mount(route: string, source: ContentSource) {
    this.routes.set(route, source);
  }

  unmount(route: string) {
    this.routes.delete(route);
  }

  /**
   * Retrieve content. If file-based, reads from disk on-demand (ensures fresh edits).
   */
  async get(route: string): Promise<string | null> {
    const source = this.routes.get(route);
    if (!source) return null;

    if (source.type === 'memory') {
      return source.content;
    } else {
      try {
        return await fs.readFile(source.path, 'utf-8');
      } catch (e) {
        console.error(`Failed to read file for route ${route}:`, e);
        return null;
      }
    }
  }
}
