import { describe, it, expect } from 'bun:test';
import { SiteService } from '../../../../src/lib/services/site/SiteService';
import { ScreenStack } from '../../../../src/lib/services/site/types';

describe('SiteService Heuristics', () => {
  it('should map Home/Index/Landing to /', () => {
    const stacks: ScreenStack[] = [
      { id: '1', title: 'Home', versions: [], isArtifact: false, isObsolete: false },
    ];
    const config = SiteService.generateDraftConfig('p1', stacks);
    expect(config.routes[0].route).toBe('/');
  });

  it('should handle collisions with slug fallback', () => {
    const stacks: ScreenStack[] = [
      { id: '1', title: 'Home', versions: [], isArtifact: false, isObsolete: false },
      { id: '2', title: 'Index', versions: [], isArtifact: false, isObsolete: false },
    ];

    const config = SiteService.generateDraftConfig('p1', stacks);
    const routes = config.routes.map(r => r.route).sort();

    expect(routes).toContain('/');
    expect(routes).toContain('/index');
  });

  it('should handle collisions with increment', () => {
    const stacks: ScreenStack[] = [
      { id: '1', title: 'Foo', versions: [], isArtifact: false, isObsolete: false },
      { id: '2', title: 'Foo!', versions: [], isArtifact: false, isObsolete: false },
    ];

    const config = SiteService.generateDraftConfig('p1', stacks);
    const routes = config.routes.map(r => r.route);

    expect(routes).toContain('/foo');
    expect(routes).toContain('/foo-1');

    const collisionRoute = config.routes.find(r => r.route === '/foo-1');
    expect(collisionRoute?.warning).toBeDefined();
  });
});
