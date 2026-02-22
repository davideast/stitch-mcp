import fs from 'node:fs';
import {
  type AuthenticateInput,
  type AuthResult,
} from './spec.js';
import { getGcloudConfigPath } from '../../platform/detector.js';
import { joinPath } from '../../platform/paths.js';
import { theme } from '../../ui/theme.js';
import { GcloudExecutor } from './core.js';

export class GcloudAuthService {
  constructor(private executor: GcloudExecutor) {}

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
      const result = await this.runAuthFlow(['auth', 'login']);

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
      const result = await this.runAuthFlow(['auth', 'application-default', 'login']);

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
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const result = await this.executor.exec(['auth', 'application-default', 'print-access-token']);

      if (result.success) {
        return result.stdout.trim();
      }

      // Build the correct login command with config prefix for bundled gcloud
      const loginCmd = await this.getLoginCommand();
      console.error(`[Gcloud] Token fetch failed. Please run:\n\n  ${loginCmd}\n\nto obtain new credentials.`);
      return null;
    } catch (e) {
      console.error('[Gcloud] Token fetch exception:', e);
      return null;
    }
  }

  async getActiveAccount(): Promise<string | null> {
    // Only check bundled stitch config - we need credentials there
    const result = await this.executor.exec(
      ['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)']
    );

    if (result.success && result.stdout.trim()) {
      return result.stdout.trim().split('\n')[0] || null;
    }

    return null;
  }

  async hasADC(): Promise<boolean> {
    // Actually verify ADC credentials work by attempting to get an access token.
    // Just checking if the file exists is not enough - tokens can be expired or revoked.

    // First, quick check if credential file exists
    let fileExists = false;
    if (!this.executor.isSystemGcloud() && !process.env.STITCH_USE_SYSTEM_GCLOUD) {
      const stitchConfigPath = getGcloudConfigPath();
      const stitchAdcPath = joinPath(stitchConfigPath, 'application_default_credentials.json');
      try {
        await fs.promises.access(stitchAdcPath, fs.constants.F_OK);
        fileExists = true;
      } catch {
        fileExists = false;
      }
    } else {
      // For system gcloud, check via gcloud info
      try {
        const result = await this.executor.exec(
          ['info', '--format=value(config.paths.global_config_dir)']
        );

        if (result.success && result.stdout.trim()) {
          const configDir = result.stdout.trim();
          const adcPath = joinPath(configDir, 'application_default_credentials.json');
          try {
            await fs.promises.access(adcPath, fs.constants.F_OK);
            fileExists = true;
          } catch {
            fileExists = false;
          }
        }
      } catch {
        // Fallback - file doesn't exist
      }
    }

    // If no file, definitely no ADC
    if (!fileExists) {
      return false;
    }

    // File exists, but verify the credentials are actually valid by trying to get a token
    try {
      const result = await this.executor.exec(
        ['auth', 'application-default', 'print-access-token']
      );

      // Only return true if we successfully got a token
      return result.success && !!result.stdout.trim();
    } catch {
      return false;
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Run the gcloud authentication flow (URL extraction followed by actual login)
   */
  private async runAuthFlow(authArgs: string[]) {
    console.log(theme.gray("  Opening browser for authentication..."));

    // CRITICAL: Always extract and print the URL before attempting browser launch
    // This ensures users can authenticate even if browser opening fails
    // Use a 5-second timeout to prevent hanging
    const noBrowserResult = await this.executor.exec(
      [...authArgs, '--no-launch-browser'],
      { timeout: 5000 }
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

    return this.executor.exec([...authArgs, '--quiet']);
  }

  /**
   * Get the correct login command with config prefix if using bundled gcloud
   */
  private async getLoginCommand(): Promise<string> {
    const gcloudCmd = await this.executor.getGcloudCommand();

    // If using system gcloud, no config prefix needed
    if (this.executor.isSystemGcloud() || process.env.STITCH_USE_SYSTEM_GCLOUD) {
      return `${gcloudCmd} auth application-default login`;
    }

    // For bundled gcloud, include the CLOUDSDK_CONFIG prefix
    const configPath = getGcloudConfigPath();
    return `CLOUDSDK_CONFIG="${configPath}" ${gcloudCmd} auth application-default login`;
  }
}
