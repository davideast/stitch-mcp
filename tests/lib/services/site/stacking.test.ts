import { describe, it, expect } from 'bun:test';
import { SiteService } from '../../../../src/lib/services/site/SiteService';

// Mock Helper
const createScreen = (title: string, hasHtml = true) => ({
  name: `id_${Math.random()}`,
  title,
  htmlCode: hasHtml ? { downloadUrl: 'http://foo' } : undefined
});

describe('SiteService.stackScreens', () => {
  it('deduplicates identical titles', () => {
    const input = [
      createScreen('Home Page'),
      createScreen('Home Page'),
      createScreen('Home Page'),
    ];
    const stacks = SiteService.stackScreens(input as any);

    expect(stacks).toHaveLength(1);
    expect(stacks[0].title).toBe('Home Page');
    expect(stacks[0].count).toBe(3);
    // Should verify it picked the last one as best candidate
    expect(stacks[0].bestCandidate).toBe(input[2]);
  });

  it('filters out screens with no HTML', () => {
    const input = [
      createScreen('Valid'),
      createScreen('No HTML', false),
    ];
    const stacks = SiteService.stackScreens(input as any);
    expect(stacks).toHaveLength(1);
    expect(stacks[0].title).toBe('Valid');
  });

  it('identifies artifacts', () => {
    const input = [
      createScreen('image.png'),
      createScreen('localhost_capture'),
      createScreen('Real Page'),
    ];
    const stacks = SiteService.stackScreens(input as any);

    expect(stacks.find(s => s.title === 'image.png')?.isArtifact).toBe(true);
    expect(stacks.find(s => s.title === 'Real Page')?.isArtifact).toBe(false);
  });

  it('marks obsolete versions', () => {
    const input = [
      createScreen('Dashboard v1'),
      createScreen('Dashboard v2'),
      createScreen('Settings v1'), // No v2 exists
    ];
    const stacks = SiteService.stackScreens(input as any);

    const v1 = stacks.find(s => s.title === 'Dashboard v1');
    const v2 = stacks.find(s => s.title === 'Dashboard v2');
    const settings = stacks.find(s => s.title === 'Settings v1');

    expect(v1?.isObsolete).toBe(true);
    expect(v2?.isObsolete).toBe(false);
    expect(settings?.isObsolete).toBe(false);
  });
});
