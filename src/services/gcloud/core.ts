import { detectPlatform, getGcloudConfigPath, getGcloudSdkPath } from '../../platform/detector.js';
import { execCommand, type ShellResult } from '../../platform/shell.js';
import { joinPath } from '../../platform/paths.js';
import fs from 'node:fs';

export class GcloudExecutor {
  public platform = detectPlatform();
  private gcloudPath: string | null = null;
  private useSystemGcloud = false;

  constructor() {
    // Attempt to locate bundled gcloud or system gcloud on init?
    // No, GcloudHandler does this lazily or via ensureInstalled.
    // We should keep it lazy/configurable.
  }

  setGcloudPath(path: string, isSystem: boolean) {
    this.gcloudPath = path;
    this.useSystemGcloud = isSystem;
    this.setupEnvironment();
  }

  getGcloudPath(): string | null {
    return this.gcloudPath;
  }

  isSystemGcloud(): boolean {
    return this.useSystemGcloud;
  }

  private setupEnvironment(): void {
    if (this.gcloudPath && !this.useSystemGcloud && !process.env.STITCH_USE_SYSTEM_GCLOUD) {
      const sdkPath = getGcloudSdkPath();
      const binPath = joinPath(sdkPath, 'bin');
      process.env.PATH = `${binPath}:${process.env.PATH}`;

      const configPath = getGcloudConfigPath();
      process.env.CLOUDSDK_CONFIG = configPath;
      process.env.CLOUDSDK_CORE_DISABLE_PROMPTS = '1';
      process.env.CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK = '1';
      process.env.CLOUDSDK_CORE_DISABLE_USAGE_REPORTING = 'true';
    }
  }

  getEnvironment(useSystem?: boolean): Record<string, string> {
    // CHECK: If system mode is requested via flag or env var
    if (useSystem || this.useSystemGcloud || process.env.STITCH_USE_SYSTEM_GCLOUD) {
      // Return empty object to use default process.env in execCommand
      return {};
    }

    const configPath = getGcloudConfigPath();
    // Return only overrides
    return {
      CLOUDSDK_CONFIG: configPath,
      CLOUDSDK_CORE_DISABLE_PROMPTS: '1',
      CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK: '1',
      CLOUDSDK_CORE_DISABLE_USAGE_REPORTING: 'true',
    };
  }

  async getGcloudCommand(): Promise<string> {
    if (this.gcloudPath) {
      return this.gcloudPath;
    }

    // If configured to use system gcloud, prefer PATH lookup
    if (this.useSystemGcloud || process.env.STITCH_USE_SYSTEM_GCLOUD) {
      return this.platform.gcloudBinaryName;
    }

    // Check if local SDK exists (fallback)
    const sdkPath = getGcloudSdkPath();
    const localBinaryPath = joinPath(sdkPath, 'bin', this.platform.gcloudBinaryName);

    try {
      await fs.promises.access(localBinaryPath, fs.constants.F_OK);
      this.gcloudPath = localBinaryPath;
      this.setupEnvironment();
      return localBinaryPath;
    } catch {
      // Fallback to command in PATH
      return this.platform.gcloudBinaryName;
    }
  }

  async exec(args: string[], options?: { timeout?: number; env?: Record<string, string> }): Promise<ShellResult> {
    const cmd = await this.getGcloudCommand();
    const env = { ...this.getEnvironment(), ...(options?.env || {}) };
    return execCommand([cmd, ...args], { ...options, env });
  }

  async execRaw(command: string[], options?: { timeout?: number; env?: Record<string, string> }): Promise<ShellResult> {
    // Execute a raw command (e.g. 'where', 'which', 'tar') without gcloud prefix
    const env = { ...this.getEnvironment(), ...(options?.env || {}) };
    return execCommand(command, { ...options, env });
  }
}
