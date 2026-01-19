import { GcloudService } from '../gcloud/spec';
import { ResolveContextResult, ConfigService } from './spec';
import * as path from 'node:path';
import * as fs from 'node:fs';

// Define a minimal FS interface for testing
export interface FileSystem {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: BufferEncoding): string;
}

export class ConfigHandler implements ConfigService {
  constructor(
    private gcloud: GcloudService,
    private fs: FileSystem = fs
  ) {}

  async resolveContext(): Promise<ResolveContextResult> {
    // 1. Env Var Override
    if (process.env.STITCH_PROJECT_ID) {
      return {
        success: true,
        data: { projectId: process.env.STITCH_PROJECT_ID, source: 'env' }
      };
    }

    // 2. Package.json
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      if (this.fs.existsSync(pkgPath)) {
         const content = this.fs.readFileSync(pkgPath, 'utf-8');
         const pkg = JSON.parse(content);
         if (pkg.stitch?.projectId) {
            return {
                success: true,
                data: { projectId: pkg.stitch.projectId, source: 'package.json' }
            };
         }
      }
    } catch (e) {
      // Ignore parse errors, fall through
    }

    // 3. Gcloud Fallback
    const gcloudProject = await this.gcloud.getProjectId();
    if (gcloudProject) {
      return {
        success: true,
        data: { projectId: gcloudProject, source: 'gcloud' }
      };
    }

    return {
      success: false,
      error: { code: 'MISSING_PROJECT_ID', message: 'Could not resolve project ID', recoverable: true }
    };
  }
}
