import { describe, it, expect } from 'bun:test';
import { SiteService } from '../../../../src/lib/services/site/SiteService';
import { RemoteScreen } from '../../../../src/lib/services/site/types';

describe('SiteService Stacking', () => {
  it('should group identical titles into a single stack', () => {
    const screens: RemoteScreen[] = Array.from({ length: 30 }, (_, i) => ({
      name: `screen-${i}`,
      title: 'Editorial Course Guide v1',
      htmlCode: { downloadUrl: 'http://example.com' },
    }));

    const stacks = SiteService.stackScreens(screens);

    expect(stacks).toHaveLength(1);
    expect(stacks[0].title).toBe('Editorial Course Guide v1');
    expect(stacks[0].versions).toHaveLength(30);
    expect(stacks[0].isObsolete).toBe(false);
  });

  it('should mark lower versions as obsolete', () => {
    const screens: RemoteScreen[] = [
      { name: 's1', title: 'Home v1', htmlCode: { downloadUrl: 'url' } },
      { name: 's2', title: 'Home v2', htmlCode: { downloadUrl: 'url' } },
    ];

    const stacks = SiteService.stackScreens(screens);
    // Sort stacks to ensure order for assertion
    stacks.sort((a, b) => a.title.localeCompare(b.title));

    expect(stacks).toHaveLength(2);

    const v1Stack = stacks.find(s => s.title === 'Home v1');
    const v2Stack = stacks.find(s => s.title === 'Home v2');

    expect(v1Stack).toBeDefined();
    expect(v2Stack).toBeDefined();

    expect(v1Stack?.isObsolete).toBe(true);
    expect(v2Stack?.isObsolete).toBe(false);
  });

  it('should identify artifacts', () => {
     const screens: RemoteScreen[] = [
      { name: 's1', title: 'image.png', htmlCode: { downloadUrl: 'url' } },
      { name: 's2', title: 'localhost_test', htmlCode: { downloadUrl: 'url' } },
      { name: 's3', title: 'Normal Screen', htmlCode: { downloadUrl: 'url' } },
    ];

    const stacks = SiteService.stackScreens(screens);

    const pngStack = stacks.find(s => s.title === 'image.png');
    const localStack = stacks.find(s => s.title === 'localhost_test');
    const normalStack = stacks.find(s => s.title === 'Normal Screen');

    expect(pngStack?.isArtifact).toBe(true);
    expect(localStack?.isArtifact).toBe(true);
    expect(normalStack?.isArtifact).toBe(false);
  });
});
