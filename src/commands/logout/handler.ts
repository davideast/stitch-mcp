import { type LogoutCommand, type LogoutInput, type LogoutResult } from './spec.js';
import { GcloudHandler } from '../../services/gcloud/handler.js';
import { type GcloudService } from '../../services/gcloud/spec.js';
import { theme, icons } from '../../ui/theme.js';
import { promptConfirm } from '../../ui/wizard.js';
import { execCommand } from '../../platform/shell.js';
import { getGcloudConfigPath } from '../../platform/detector.js';
import fs from 'node:fs';

export class LogoutHandler implements LogoutCommand {
  constructor(private readonly gcloudService: GcloudService = new GcloudHandler()) { }

  async execute(input: LogoutInput): Promise<LogoutResult> {
    try {
      console.log(`\n${theme.blue('Logout from Google Cloud')}\n`);

      // Check if gcloud is available
      const gcloudCmd = await this.getGcloudCommand();
      if (!gcloudCmd) {
        return {
          success: false,
          error: {
            code: 'GCLOUD_NOT_FOUND',
            message: 'Google Cloud CLI not found',
            recoverable: true,
          },
        };
      }

      // Confirm logout unless --force is used
      if (!input.force) {
        const shouldLogout = await promptConfirm(
          'Are you sure you want to log out? This will revoke all credentials.',
          false
        );

        if (!shouldLogout) {
          console.log(theme.gray('\nLogout cancelled.\n'));
          return {
            success: true,
            data: {
              userRevoked: false,
              adcRevoked: false,
              configCleared: false,
            },
          };
        }
      }

      let userRevoked = false;
      let adcRevoked = false;
      let configCleared = false;

      // Check if currently authenticated
      const activeAccount = await this.gcloudService.getActiveAccount();

      // Revoke user authentication
      if (activeAccount) {
        console.log(theme.gray('Revoking user authentication...'));
        const userResult = await execCommand(
          [gcloudCmd, 'auth', 'revoke', '--all'],
          { env: this.getEnvironment() }
        );

        if (userResult.success || userResult.stderr?.includes('No credentialed accounts')) {
          console.log(theme.green(`${icons.success} User authentication revoked`));
          userRevoked = true;
        } else {
          console.log(theme.yellow(`${icons.warning} Failed to revoke user authentication`));
        }
      } else {
        console.log(theme.gray('No active user authentication found'));
        userRevoked = true; // Consider it success if already logged out
      }

      // Revoke Application Default Credentials
      const hasADC = await this.gcloudService.hasADC();
      if (hasADC) {
        console.log(theme.gray('Revoking Application Default Credentials...'));
        const adcResult = await execCommand(
          [gcloudCmd, 'auth', 'application-default', 'revoke'],
          { env: this.getEnvironment() }
        );

        if (adcResult.success || adcResult.stderr?.includes('No credentials')) {
          console.log(theme.green(`${icons.success} Application Default Credentials revoked`));
          adcRevoked = true;
        } else {
          console.log(theme.yellow(`${icons.warning} Failed to revoke Application Default Credentials`));
        }
      } else {
        console.log(theme.gray('No Application Default Credentials found'));
        adcRevoked = true; // Consider it success if already logged out
      }

      // Clear config directory if requested
      if (input.clearConfig) {
        console.log(theme.gray('Clearing gcloud configuration directory...'));
        const configPath = getGcloudConfigPath();

        try {
          if (fs.existsSync(configPath)) {
            fs.rmSync(configPath, { recursive: true, force: true });
            console.log(theme.green(`${icons.success} Configuration directory cleared`));
            configCleared = true;
          } else {
            console.log(theme.gray('Configuration directory does not exist'));
            configCleared = true;
          }
        } catch (error) {
          console.log(theme.yellow(`${icons.warning} Failed to clear configuration directory`));
          console.log(theme.gray(`  ${error instanceof Error ? error.message : String(error)}`));
        }
      }

      // Display success message
      console.log(`\n${theme.green('Successfully logged out!')}\n`);
      console.log(theme.gray('To log back in, run:'));
      console.log(theme.cyan('  stitch-mcp init\n'));

      return {
        success: true,
        data: {
          userRevoked,
          adcRevoked,
          configCleared,
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

  private async getGcloudCommand(): Promise<string | null> {
    // Try to get gcloud path from the service
    const result = await this.gcloudService.ensureInstalled({
      minVersion: '400.0.0',
      forceLocal: false,
    });

    if (result.success) {
      return result.data.path;
    }

    return null;
  }

  private getEnvironment(): Record<string, string> {
    const configPath = getGcloudConfigPath();
    const env: Record<string, string> = {};

    // Copy existing env vars
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    // Set gcloud config path
    env.CLOUDSDK_CONFIG = configPath;
    env.CLOUDSDK_CORE_DISABLE_PROMPTS = '1';

    return env;
  }
}
