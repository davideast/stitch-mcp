import { describe, it, expect } from 'bun:test';
import { SiteService } from '../../../../src/lib/services/site/SiteService';
import { SiteConfigSchema } from '../../../../src/lib/services/site/schemas';

describe('SiteService.generateDraftConfig', () => {
  it('assigns root route to common names', () => {
    const stacks = [{
      id: '1', title: 'Landing', isArtifact: false, isObsolete: false
    }];
    const config = SiteService.generateDraftConfig('proj', stacks as any);

    expect(config.routes[0].route).toBe('/');
    expect(config.routes[0].status).toBe('included');
  });

  it('defaults artifacts to ignored', () => {
    const stacks = [{
      id: '1', title: 'image.png', isArtifact: true, isObsolete: false
    }];
    const config = SiteService.generateDraftConfig('proj', stacks as any);

    expect(config.routes[0].status).toBe('ignored');
  });

  it('handles route collisions gracefully', () => {
    const stacks = [
      { id: '1', title: 'Home', isArtifact: false },
      { id: '2', title: 'Home', isArtifact: false }, // Should not happen after stacking, but testing robustness
      { id: '3', title: 'Home Copy', isArtifact: false }, // slugifies to /home-copy
    ];

    // Better test case: "About" and "About" (if stacking failed)
    // or distinct titles that slugify to same thing: "My Page" and "My Page!"
    const collisionInput = [
      { id: '1', title: 'My Page', isArtifact: false },
      { id: '2', title: 'My Page!', isArtifact: false },
    ];

    const config = SiteService.generateDraftConfig('proj', collisionInput as any);

    expect(config.routes[0].route).toBe('/my-page');
    expect(config.routes[1].route).toBe('/my-page-1');
  });

  it('passes strict Zod validation', () => {
    const stacks = [{ id: '1', title: 'Page', isArtifact: false }];
    const config = SiteService.generateDraftConfig('proj', stacks as any);

    // Should not throw
    expect(() => SiteConfigSchema.parse(config)).not.toThrow();
  });
});
