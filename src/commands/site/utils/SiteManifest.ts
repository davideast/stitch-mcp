import fs from 'fs-extra';
import path from 'path';
import os from 'os';

interface ScreenState {
  status?: 'included' | 'ignored' | 'discarded';
  route?: string;
}

interface SiteManifestData {
  screens: Record<string, ScreenState>;
}

interface LegacyDiscardData {
  discardedScreenIds: string[];
}

export class SiteManifest {
  private filePath: string;
  private legacyPath: string;

  constructor(projectId: string) {
    const dir = path.join(os.homedir(), '.stitch-mcp', 'site', projectId);
    this.filePath = path.join(dir, 'site-manifest.json');
    this.legacyPath = path.join(dir, 'discarded.json');
  }

  async load(): Promise<Map<string, ScreenState>> {
    try {
      const data: SiteManifestData = await fs.readJson(this.filePath);
      return new Map(Object.entries(data.screens || {}));
    } catch {
      // site-manifest.json doesn't exist or is corrupted — try legacy migration
    }

    try {
      const legacy: LegacyDiscardData = await fs.readJson(this.legacyPath);
      const map = new Map<string, ScreenState>();
      for (const id of legacy.discardedScreenIds || []) {
        map.set(id, { status: 'discarded' });
      }
      return map;
    } catch {
      return new Map();
    }
  }

  async save(screens: { id: string; status: string; route: string }[]): Promise<void> {
    const record: Record<string, ScreenState> = {};
    for (const screen of screens) {
      const entry: ScreenState = {};
      if (screen.status !== 'ignored') {
        entry.status = screen.status as ScreenState['status'];
      }
      if (screen.route !== '') {
        entry.route = screen.route;
      }
      if (entry.status || entry.route) {
        record[screen.id] = entry;
      }
    }
    await fs.ensureDir(path.dirname(this.filePath));
    const data: SiteManifestData = { screens: record };
    await fs.writeJson(this.filePath, data, { spaces: 2 });
  }
}
