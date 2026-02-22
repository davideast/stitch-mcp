import fs from 'node:fs';
import AdmZip from 'adm-zip';
import {
  type EnsureGcloudInput,
  type GcloudResult,
} from './spec.js';
import { getGcloudSdkPath, getStitchDir } from '../../platform/detector.js';
import { joinPath } from '../../platform/paths.js';
import { GcloudExecutor } from './core.js';
import { execCommand, commandExists } from '../../platform/shell.js';

export class GcloudInstallService {
  constructor(private executor: GcloudExecutor) {}

  /**
   * Ensure gcloud is installed and available
   */
  async ensureInstalled(input: EnsureGcloudInput): Promise<GcloudResult> {
    // Priority 1: Check for system gcloud first (unless forced local)
    // This ensures we respect the user's existing environment if available
    if (!input.forceLocal) {
      const globalPath = await this.findGlobalGcloud();
      if (globalPath) {
        const version = await this.getVersionFromPath(globalPath);
        if (version && this.isVersionValid(version, input.minVersion)) {
          this.executor.setGcloudPath(globalPath, true);
          return {
            success: true,
            data: {
              version,
              location: 'system',
              path: globalPath,
            },
          };
        }
      }
    }

    // Fast path: Check if local installation already exists (just a file check)
    const localSdkPath = getGcloudSdkPath();
    const localBinaryPath = joinPath(localSdkPath, 'bin', this.executor.platform.gcloudBinaryName);

    let localExists = false;
    try {
      await fs.promises.access(localBinaryPath, fs.constants.F_OK);
      localExists = true;
    } catch {
      // file doesn't exist
    }

    if (localExists) {
      const version = await this.getVersionFromPath(localBinaryPath);
      if (version) {
        this.executor.setGcloudPath(localBinaryPath, false);
        return {
          success: true,
          data: {
            version,
            location: 'bundled',
            path: localBinaryPath,
          },
        };
      }
    }

    // Only check global installation if local doesn't exist and not forced local
    if (!input.forceLocal) {
      const globalPath = await this.findGlobalGcloud();
      if (globalPath) {
        const version = await this.getVersionFromPath(globalPath);
        if (version && this.isVersionValid(version, input.minVersion)) {
          this.executor.setGcloudPath(globalPath, true);
          return {
            success: true,
            data: {
              version,
              location: 'system',
              path: globalPath,
            },
          };
        }
      }
    }

    // Install locally to ~/.stitch-mcp
    const localPath = await this.installLocal();
    if (!localPath) {
      return {
        success: false,
        error: {
          code: 'DOWNLOAD_FAILED',
          message: 'Failed to install gcloud locally',
          suggestion: 'Check your internet connection and try again',
          recoverable: true,
        },
      };
    }

    const version = await this.getVersionFromPath(localPath);
    if (!version) {
      return {
        success: false,
        error: {
          code: 'VERSION_CHECK_FAILED',
          message: 'Could not determine gcloud version',
          recoverable: false,
        },
      };
    }

    this.executor.setGcloudPath(localPath, false);

    return {
      success: true,
      data: {
        version,
        location: 'bundled',
        path: localPath,
      },
    };
  }

  /**
   * Install beta components
   */
  async installBetaComponents(): Promise<{ success: boolean; error?: { message: string } }> {
    try {
      const result = await this.executor.exec(
        ['components', 'install', 'beta', '--quiet']
      );

      if (!result.success) {
        return {
          success: false,
          error: {
            message: `Failed to install beta components: ${result.stderr || result.error || 'Unknown error'}`,
          },
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private async findGlobalGcloud(): Promise<string | null> {
    const exists = await commandExists(this.executor.platform.gcloudBinaryName);
    if (!exists) {
      return null;
    }

    // Get path to gcloud
    const result = await execCommand(
      this.executor.platform.isWindows
        ? ['where', this.executor.platform.gcloudBinaryName]
        : ['which', this.executor.platform.gcloudBinaryName]
    );

    if (result.success) {
      return result.stdout.trim().split('\n')[0] || null;
    }

    return null;
  }

  private async getVersionFromPath(gcloudPath: string): Promise<string | null> {
    const result = await execCommand([gcloudPath, 'version', '--format=json']);

    if (result.success) {
      try {
        const versionData = JSON.parse(result.stdout);
        return versionData['Google Cloud SDK'] || null;
      } catch {
        // Fallback: try to parse from text output
        const match = result.stdout.match(/Google Cloud SDK ([\d.]+)/);
        return match?.[1] || null;
      }
    }

    return null;
  }

  private isVersionValid(current: string, minimum: string): boolean {
    const currentParts = current.split('.').map(Number);
    const minimumParts = minimum.split('.').map(Number);

    for (let i = 0; i < Math.max(currentParts.length, minimumParts.length); i++) {
      const cur = currentParts[i] || 0;
      const min = minimumParts[i] || 0;

      if (cur > min) return true;
      if (cur < min) return false;
    }

    return true;
  }

  private async installLocal(): Promise<string | null> {
    const sdkPath = getGcloudSdkPath();
    const stitchDir = getStitchDir();

    // Create directories
    if (!fs.existsSync(stitchDir)) {
      fs.mkdirSync(stitchDir, { recursive: true });
    }

    // Download gcloud
    const downloadUrl = this.executor.platform.gcloudDownloadUrl;
    const downloadPath = joinPath(stitchDir, this.executor.platform.isWindows ? 'gcloud.zip' : 'gcloud.tar.gz');

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        return null;
      }

      const buffer = await response.arrayBuffer();
      await fs.promises.writeFile(downloadPath, Buffer.from(buffer));

      // Extract
      if (this.executor.platform.isWindows) {
        // Extract ZIP
        const zip = new AdmZip(downloadPath);
        await new Promise<void>((resolve, reject) => {
          zip.extractAllToAsync(stitchDir, true, false, (err: Error | null | undefined) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      } else {
        // Extract tar.gz
        await execCommand(['tar', '-xzf', downloadPath, '-C', stitchDir]);
      }

      // Clean up download
      await fs.promises.unlink(downloadPath);

      // Return path to gcloud binary
      return joinPath(sdkPath, 'bin', this.executor.platform.gcloudBinaryName);
    } catch {
      return null;
    }
  }
}
