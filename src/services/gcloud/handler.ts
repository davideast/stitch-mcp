import fs from 'node:fs';

import AdmZip from 'adm-zip';
import {
  type GcloudService,
  type EnsureGcloudInput,
  type AuthenticateInput,
  type ListProjectsInput,
  type SetProjectInput,
  type GcloudResult,
  type AuthResult,
  type ProjectListResult,
  type ProjectSetResult,
  type ProjectSchema,
} from './spec.js';
import { detectPlatform, getGcloudSdkPath, getGcloudConfigPath, getStitchDir } from '../../platform/detector.js';
import { execCommand, commandExists } from '../../platform/shell.js';
import { joinPath } from '../../platform/paths.js';
import { theme } from '../../ui/theme.js';

export class GcloudHandler implements GcloudService {
  private platform = detectPlatform();
  private gcloudPath: string | null = null;

  /**
   * Ensure gcloud is installed and available
   */
  async ensureInstalled(input: EnsureGcloudInput): Promise<GcloudResult> {
    try {
      // Fast path: Check if local installation already exists (just a file check)
      const localSdkPath = getGcloudSdkPath();
      const localBinaryPath = joinPath(localSdkPath, 'bin', this.platform.gcloudBinaryName);

      if (fs.existsSync(localBinaryPath)) {
        const version = await this.getVersionFromPath(localBinaryPath);
        if (version) {
          this.gcloudPath = localBinaryPath;
          this.setupEnvironment();
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
            this.gcloudPath = globalPath;
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

      this.gcloudPath = localPath;
      this.setupEnvironment();

      return {
        success: true,
        data: {
          version,
          location: 'bundled',
          path: localPath,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  /**
   * Authenticate user
   */
  async authenticate(input: AuthenticateInput): Promise<AuthResult> {
    try {
      // Check if already authenticated
      if (input.skipIfActive) {
        const activeAccount = await this.getActiveAccount();
        if (activeAccount) {
          return {
            success: true,
            data: {
              account: activeAccount,
              type: 'user',
            },
          };
        }
      }

      // Run gcloud auth login
      const gcloudCmd = this.getGcloudCommand();
      console.log(theme.gray("  Opening browser for authentication..."));

      // CRITICAL: Always extract and print the URL before attempting browser launch
      // This ensures users can authenticate even if browser opening fails
      // Use a 5-second timeout to prevent hanging
      const noBrowserResult = await execCommand(
        [gcloudCmd, 'auth', 'login', '--no-launch-browser'],
        { env: this.getEnvironment(), timeout: 5000 }
      );

      // Extract URL from both stdout and stderr
      const outputText = noBrowserResult.stderr || noBrowserResult.stdout || '';
      const urlMatch = outputText.match(/https:\/\/accounts\.google\.com[^\s]+/);

      if (urlMatch) {
        // ALWAYS print the URL to stdout for user visibility
        console.log(theme.gray(`  If it doesn't open automatically, visit this URL: ${theme.cyan(urlMatch[0])}\n`));
      } else {
        // Warn if URL extraction failed, but continue (backward compatibility)
        console.log(theme.gray("  Note: Could not extract authentication URL from gcloud output\n"));
      }

      const result = await execCommand([gcloudCmd, 'auth', 'login', '--quiet'], {
        env: this.getEnvironment(),
      });

      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: 'Failed to authenticate with gcloud',
            suggestion: 'Complete the browser authentication flow',
            recoverable: true,
          },
        };
      }

      const account = await this.getActiveAccount();
      if (!account) {
        return {
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: 'Authentication appeared to succeed but no active account found',
            recoverable: false,
          },
        };
      }

      return {
        success: true,
        data: {
          account,
          type: 'user',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  /**
   * Authenticate application default credentials
   */
  async authenticateADC(input: AuthenticateInput): Promise<AuthResult> {
    try {
      // Check if ADC already exists
      if (input.skipIfActive) {
        const hasADC = await this.hasADC();
        if (hasADC) {
          const account = await this.getActiveAccount();
          return {
            success: true,
            data: {
              account: account || 'unknown',
              type: 'adc',
            },
          };
        }
      }

      // Run gcloud auth application-default login
      const gcloudCmd = this.getGcloudCommand();
      console.log(theme.gray("  Opening browser for authentication..."));

      // CRITICAL: Always extract and print the URL before attempting browser launch
      // This ensures users can authenticate even if browser opening fails
      // Use a 5-second timeout to prevent hanging
      const noBrowserResult = await execCommand(
        [gcloudCmd, 'auth', 'application-default', 'login', '--no-launch-browser'],
        { env: this.getEnvironment(), timeout: 5000 }
      );

      // Extract URL from both stdout and stderr
      const outputText = noBrowserResult.stderr || noBrowserResult.stdout || '';
      const urlMatch = outputText.match(/https:\/\/accounts\.google\.com[^\s]+/);

      if (urlMatch) {
        // ALWAYS print the URL to stdout for user visibility
        console.log(theme.gray(`  If it doesn't open automatically, visit this URL: ${theme.cyan(urlMatch[0])}\n`));
      } else {
        // Warn if URL extraction failed, but continue (backward compatibility)
        console.log(theme.gray("  Note: Could not extract authentication URL from gcloud output\n"));
      }

      const result = await execCommand([gcloudCmd, 'auth', 'application-default', 'login', '--quiet'], {
        env: this.getEnvironment(),
      });

      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'ADC_FAILED',
            message: 'Failed to authenticate application default credentials',
            suggestion: 'Complete the browser authentication flow',
            recoverable: true,
          },
        };
      }

      const account = await this.getActiveAccount();

      return {
        success: true,
        data: {
          account: account || 'unknown',
          type: 'adc',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ADC_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  /**
   * List projects
   */
  async listProjects(input: ListProjectsInput): Promise<ProjectListResult> {
    try {
      const gcloudCmd = this.getGcloudCommand();
      const args = [gcloudCmd, 'projects', 'list', '--format=json'];

      if (input.limit) {
        args.push(`--limit=${input.limit}`);
      }

      if (input.filter) {
        args.push(`--filter=${input.filter}`);
      }

      if (input.sortBy) {
        args.push(`--sort-by=${input.sortBy}`);
      }

      const result = await execCommand(args, {
        env: this.getEnvironment(),
      });

      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'PROJECT_LIST_FAILED',
            message: 'Failed to list projects',
            suggestion: 'Ensure you are authenticated and have access to projects',
            recoverable: true,
          },
        };
      }

      const projects = JSON.parse(result.stdout) as Array<{
        projectId: string;
        name: string;
        projectNumber?: string;
        createTime?: string;
      }>;

      return {
        success: true,
        data: {
          projects: projects.map((p) => ({
            projectId: p.projectId,
            name: p.name,
            projectNumber: p.projectNumber,
            createTime: p.createTime,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROJECT_LIST_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  /**
   * Set active project
   */
  async setProject(input: SetProjectInput): Promise<ProjectSetResult> {
    try {
      const gcloudCmd = this.getGcloudCommand();
      const result = await execCommand([gcloudCmd, 'config', 'set', 'project', input.projectId, '--quiet'], {
        env: this.getEnvironment(),
      });

      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'PROJECT_SET_FAILED',
            message: `Failed to set project: ${input.projectId}`,
            suggestion: 'Verify the project ID is correct',
            recoverable: true,
          },
        };
      }

      return {
        success: true,
        data: {
          projectId: input.projectId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROJECT_SET_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const gcloudCmd = this.getGcloudCommand();
      const result = await execCommand([gcloudCmd, 'auth', 'application-default', 'print-access-token'], {
        env: this.getEnvironment(),
      });

      if (result.success) {
        return result.stdout.trim();
      }

      console.error('[Gcloud] Token fetch failed:', result.stderr || result.error);
      return null;
    } catch (e) {
      console.error('[Gcloud] Token fetch exception:', e);
      return null;
    }
  }

  async getProjectId(): Promise<string | null> {
    // Check environment variables first
    if (process.env.STITCH_PROJECT_ID) {
      return process.env.STITCH_PROJECT_ID;
    }
    if (process.env.GOOGLE_CLOUD_PROJECT) {
      return process.env.GOOGLE_CLOUD_PROJECT;
    }

    try {
      const gcloudCmd = this.getGcloudCommand();
      const result = await execCommand([gcloudCmd, 'config', 'get-value', 'project'], {
        env: this.getEnvironment(),
      });

      if (result.success && result.stdout.trim()) {
        return result.stdout.trim();
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Install beta components
   */
  async installBetaComponents(): Promise<{ success: boolean; error?: { message: string } }> {
    try {
      const gcloudCmd = this.getGcloudCommand();
      const result = await execCommand(
        [gcloudCmd, 'components', 'install', 'beta', '--quiet'],
        { env: this.getEnvironment() }
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

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async findGlobalGcloud(): Promise<string | null> {
    const exists = await commandExists(this.platform.gcloudBinaryName);
    if (!exists) {
      return null;
    }

    // Get path to gcloud
    const result = await execCommand(
      this.platform.isWindows
        ? ['where', this.platform.gcloudBinaryName]
        : ['which', this.platform.gcloudBinaryName]
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
    const downloadUrl = this.platform.gcloudDownloadUrl;
    const downloadPath = joinPath(stitchDir, this.platform.isWindows ? 'gcloud.zip' : 'gcloud.tar.gz');

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        return null;
      }

      const buffer = await response.arrayBuffer();
      await fs.promises.writeFile(downloadPath, Buffer.from(buffer));

      // Extract
      if (this.platform.isWindows) {
        // Extract ZIP
        const zip = new AdmZip(downloadPath);
        zip.extractAllTo(stitchDir, true);
      } else {
        // Extract tar.gz
        await execCommand(['tar', '-xzf', downloadPath, '-C', stitchDir]);
      }

      // Clean up download
      fs.unlinkSync(downloadPath);

      // Return path to gcloud binary
      return joinPath(sdkPath, 'bin', this.platform.gcloudBinaryName);
    } catch {
      return null;
    }
  }

  private setupEnvironment(): void {
    const sdkPath = getGcloudSdkPath();
    const configPath = getGcloudConfigPath();
    const binPath = joinPath(sdkPath, 'bin');

    process.env.PATH = `${binPath}:${process.env.PATH}`;
    process.env.CLOUDSDK_CONFIG = configPath;
    process.env.CLOUDSDK_CORE_DISABLE_PROMPTS = '1';
    process.env.CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK = '1';
    process.env.CLOUDSDK_CORE_DISABLE_USAGE_REPORTING = 'true';
  }

  private getEnvironment(): Record<string, string> {
    const configPath = getGcloudConfigPath();
    const env: Record<string, string> = {};

    // Copy existing env vars, filtering out undefined
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    // Override with our config
    env.CLOUDSDK_CONFIG = configPath;
    env.CLOUDSDK_CORE_DISABLE_PROMPTS = '1';
    env.CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK = '1';
    env.CLOUDSDK_CORE_DISABLE_USAGE_REPORTING = 'true';

    return env;
  }

  private getGcloudCommand(): string {
    if (this.gcloudPath) {
      return this.gcloudPath;
    }

    // Check if local SDK exists
    const localSdkPath = getGcloudSdkPath();
    const localBinaryPath = joinPath(localSdkPath, 'bin', this.platform.gcloudBinaryName);

    if (fs.existsSync(localBinaryPath)) {
      this.gcloudPath = localBinaryPath;
      this.setupEnvironment();
      return localBinaryPath;
    }

    // Fallback to command in PATH
    return this.platform.gcloudBinaryName;
  }

  async getActiveAccount(): Promise<string | null> {
    const gcloudCmd = this.getGcloudCommand();
    const result = await execCommand(
      [gcloudCmd, 'auth', 'list', '--filter=status:ACTIVE', '--format=value(account)'],
      { env: this.getEnvironment() }
    );

    if (result.success && result.stdout.trim()) {
      return result.stdout.trim().split('\n')[0] || null;
    }

    return null;
  }

  async hasADC(): Promise<boolean> {
    const configPath = getGcloudConfigPath();
    const adcPath = joinPath(configPath, 'application_default_credentials.json');
    return fs.existsSync(adcPath);
  }
}
