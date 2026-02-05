import { describe, it, expect } from 'bun:test';
import { SiteConfigSchema } from '../../../../src/lib/services/site/schemas';

describe('SiteConfigSchema', () => {
  it('should validate valid config', () => {
    const config = {
      projectId: 'p1',
      routes: [
        { screenId: 's1', route: '/', status: 'included' },
        { screenId: 's2', route: '/about', status: 'included' },
      ],
    };
    expect(() => SiteConfigSchema.parse(config)).not.toThrow();
  });

  it('should throw on duplicate active routes', () => {
    const config = {
      projectId: 'p1',
      routes: [
        { screenId: 's1', route: '/about', status: 'included' },
        { screenId: 's2', route: '/about', status: 'included' },
      ],
    };
    expect(() => SiteConfigSchema.parse(config)).toThrow(/Duplicate routes found/);
  });

  it('should allow duplicate ignored routes', () => {
      const config = {
      projectId: 'p1',
      routes: [
        { screenId: 's1', route: '/about', status: 'ignored' },
        { screenId: 's2', route: '/about', status: 'ignored' },
      ],
    };
    expect(() => SiteConfigSchema.parse(config)).not.toThrow();
  });
});
