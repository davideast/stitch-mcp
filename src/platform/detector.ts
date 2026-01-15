import os from 'node:os';

export type OS = 'macos' | 'linux' | 'windows';
export type Arch = 'arm64' | 'x86_64';

export interface Platform {
  os: OS;
  arch: Arch;
  gcloudDownloadUrl: string;
  gcloudBinaryName: string;
  isWindows: boolean;
}

/**
 * Detect the current platform and architecture
 */
export function detectPlatform(): Platform {
  const platform = process.platform;
  const arch = process.arch;

  const detectedOS: OS = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : 'linux';
  const detectedArch: Arch = arch === 'arm64' ? 'arm64' : 'x86_64';

  return {
    os: detectedOS,
    arch: detectedArch,
    gcloudDownloadUrl: getGcloudDownloadUrl(detectedOS, detectedArch),
    gcloudBinaryName: platform === 'win32' ? 'gcloud.cmd' : 'gcloud',
    isWindows: platform === 'win32',
  };
}

/**
 * Get the gcloud download URL for the current platform
 */
function getGcloudDownloadUrl(os: OS, arch: Arch): string {
  const baseUrl = 'https://dl.google.com/dl/cloudsdk/channels/rapid/downloads';

  if (os === 'macos') {
    if (arch === 'arm64') {
      return `${baseUrl}/google-cloud-cli-darwin-arm.tar.gz`;
    }
    return `${baseUrl}/google-cloud-cli-darwin-x86_64.tar.gz`;
  }

  if (os === 'linux') {
    return `${baseUrl}/google-cloud-cli-linux-x86_64.tar.gz`;
  }

  if (os === 'windows') {
    return `${baseUrl}/google-cloud-cli-windows-x86_64-bundled-python.zip`;
  }

  throw new Error(`Unsupported platform: ${os} ${arch}`);
}

/**
 * Get the user's home directory
 */
export function getHomeDir(): string {
  return os.homedir();
}

/**
 * Get the Stitch MCP directory path
 */
export function getStitchDir(): string {
  return `${getHomeDir()}/.stitch-mcp`;
}

/**
 * Get the gcloud SDK installation path
 */
export function getGcloudSdkPath(): string {
  return `${getStitchDir()}/google-cloud-sdk`;
}

/**
 * Get the gcloud config directory path
 */
export function getGcloudConfigPath(): string {
  return `${getStitchDir()}/config`;
}
