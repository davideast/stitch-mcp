import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { SiteManifest } from './SiteManifest.js';

const TEST_PROJECT_ID = 'test-project-manifest';
const baseDir = path.join(os.homedir(), '.stitch-mcp', 'site', TEST_PROJECT_ID);
const manifestPath = path.join(baseDir, 'site-manifest.json');
const legacyPath = path.join(baseDir, 'discarded.json');

beforeEach(async () => {
  await fs.remove(baseDir);
});

afterEach(async () => {
  await fs.remove(baseDir);
});

describe('SiteManifest', () => {
  it('load() returns empty Map when no file exists', async () => {
    const manifest = new SiteManifest(TEST_PROJECT_ID);
    const result = await manifest.load();
    expect(result.size).toBe(0);
  });

  it('save() then load() round-trips screen state', async () => {
    const manifest = new SiteManifest(TEST_PROJECT_ID);
    const screens = [
      { id: 'a', status: 'included', route: '/about' },
      { id: 'b', status: 'discarded', route: '' },
      { id: 'c', status: 'ignored', route: '/contact' },
    ];
    await manifest.save(screens);
    const result = await manifest.load();

    expect(result.get('a')).toEqual({ status: 'included', route: '/about' });
    expect(result.get('b')).toEqual({ status: 'discarded' });
    expect(result.get('c')).toEqual({ route: '/contact' });
  });

  it('only non-default state is persisted', async () => {
    const manifest = new SiteManifest(TEST_PROJECT_ID);
    const screens = [
      { id: 'default', status: 'ignored', route: '' },
      { id: 'included', status: 'included', route: '' },
    ];
    await manifest.save(screens);

    const raw = await fs.readJson(manifestPath);
    expect(raw.screens['default']).toBeUndefined();
    expect(raw.screens['included']).toEqual({ status: 'included' });
  });

  it('included status persists', async () => {
    const manifest = new SiteManifest(TEST_PROJECT_ID);
    await manifest.save([{ id: 's1', status: 'included', route: '' }]);
    const result = await manifest.load();
    expect(result.get('s1')?.status).toBe('included');
  });

  it('discarded status persists', async () => {
    const manifest = new SiteManifest(TEST_PROJECT_ID);
    await manifest.save([{ id: 's1', status: 'discarded', route: '' }]);
    const result = await manifest.load();
    expect(result.get('s1')?.status).toBe('discarded');
  });

  it('routes persist', async () => {
    const manifest = new SiteManifest(TEST_PROJECT_ID);
    await manifest.save([{ id: 's1', status: 'included', route: '/home' }]);
    const result = await manifest.load();
    expect(result.get('s1')?.route).toBe('/home');
  });

  it('screen with only a route (status ignored) persists', async () => {
    const manifest = new SiteManifest(TEST_PROJECT_ID);
    await manifest.save([{ id: 's1', status: 'ignored', route: '/page' }]);
    const result = await manifest.load();
    expect(result.get('s1')).toEqual({ route: '/page' });
    expect(result.get('s1')?.status).toBeUndefined();
  });

  it('legacy discarded.json migration works', async () => {
    await fs.ensureDir(baseDir);
    await fs.writeJson(legacyPath, { discardedScreenIds: ['x', 'y'] });

    const manifest = new SiteManifest(TEST_PROJECT_ID);
    const result = await manifest.load();
    expect(result.get('x')).toEqual({ status: 'discarded' });
    expect(result.get('y')).toEqual({ status: 'discarded' });
    expect(result.size).toBe(2);
  });

  it('legacy migration only runs when site-manifest.json is missing', async () => {
    await fs.ensureDir(baseDir);
    // Write both files — manifest should take precedence
    await fs.writeJson(manifestPath, {
      screens: { 'a': { status: 'included', route: '/real' } }
    });
    await fs.writeJson(legacyPath, { discardedScreenIds: ['a'] });

    const manifest = new SiteManifest(TEST_PROJECT_ID);
    const result = await manifest.load();
    expect(result.get('a')).toEqual({ status: 'included', route: '/real' });
  });

  it('save() creates parent directories', async () => {
    // Ensure the directory doesn't exist
    await fs.remove(baseDir);
    const manifest = new SiteManifest(TEST_PROJECT_ID);
    await manifest.save([{ id: 's1', status: 'included', route: '/test' }]);

    const exists = await fs.pathExists(manifestPath);
    expect(exists).toBe(true);
  });

  it('load() handles corrupted JSON gracefully', async () => {
    await fs.ensureDir(baseDir);
    await fs.writeFile(manifestPath, '{not valid json!!!');

    const manifest = new SiteManifest(TEST_PROJECT_ID);
    const result = await manifest.load();
    // Falls through to legacy check, which also doesn't exist → empty map
    expect(result.size).toBe(0);
  });
});
