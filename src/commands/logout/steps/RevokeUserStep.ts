import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type LogoutContext } from '../context.js';
import { execCommand } from '../../../platform/shell.js';
import { theme, icons } from '../../../ui/theme.js';
import { getGcloudConfigPath } from '../../../platform/detector.js';

export class RevokeUserStep implements CommandStep<LogoutContext> {
  id = 'revoke-user';
  name = 'Revoke user authentication';

  async shouldRun(context: LogoutContext): Promise<boolean> {
     // If force is true, we might not have set gcloudPath yet in ConfirmStep
     if (!context.gcloudPath) {
         const result = await context.gcloudService.ensureInstalled({ minVersion: '400.0.0', forceLocal: false });
         if (result.success) context.gcloudPath = result.data.path;
         else return false;
     }
     return true;
  }

  async run(context: LogoutContext): Promise<StepResult> {
    const activeAccount = await context.gcloudService.getActiveAccount();

    if (activeAccount) {
        context.ui.log(theme.gray('Revoking user authentication...'));
        const userResult = await execCommand(
          [context.gcloudPath!, 'auth', 'revoke', '--all'],
          { env: this.getEnvironment() }
        );

        if (userResult.success || userResult.stderr?.includes('No credentialed accounts')) {
          context.ui.log(theme.green(`${icons.success} User authentication revoked`));
          context.userRevoked = true;
        } else {
          context.ui.log(theme.yellow(`${icons.warning} Failed to revoke user authentication`));
        }
    } else {
        context.ui.log(theme.gray('No active user authentication found'));
        context.userRevoked = true;
    }

    return { success: true };
  }

  private getEnvironment(): Record<string, string> {
    const configPath = getGcloudConfigPath();
    const env: Record<string, string> = { ...process.env as Record<string, string> };
    env.CLOUDSDK_CONFIG = configPath;
    env.CLOUDSDK_CORE_DISABLE_PROMPTS = '1';
    return env;
  }
}
