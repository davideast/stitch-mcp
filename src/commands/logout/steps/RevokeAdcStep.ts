import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type LogoutContext } from '../context.js';
import { execCommand } from '../../../platform/shell.js';
import { theme, icons } from '../../../ui/theme.js';
import { getGcloudConfigPath } from '../../../platform/detector.js';

export class RevokeAdcStep implements CommandStep<LogoutContext> {
  id = 'revoke-adc';
  name = 'Revoke Application Default Credentials';

  async shouldRun(context: LogoutContext): Promise<boolean> {
      if (!context.gcloudPath) {
         const result = await context.gcloudService.ensureInstalled({ minVersion: '400.0.0', forceLocal: false });
         if (result.success) context.gcloudPath = result.data.path;
         else return false;
      }
      return true;
  }

  async run(context: LogoutContext): Promise<StepResult> {
    const hasADC = await context.gcloudService.hasADC();
    if (hasADC) {
        context.ui.log(theme.gray('Revoking Application Default Credentials...'));
        const adcResult = await execCommand(
          [context.gcloudPath!, 'auth', 'application-default', 'revoke'],
          { env: this.getEnvironment() }
        );

        if (adcResult.success || adcResult.stderr?.includes('No credentials')) {
          context.ui.log(theme.green(`${icons.success} Application Default Credentials revoked`));
          context.adcRevoked = true;
        } else {
          context.ui.log(theme.yellow(`${icons.warning} Failed to revoke Application Default Credentials`));
        }
    } else {
        context.ui.log(theme.gray('No Application Default Credentials found'));
        context.adcRevoked = true;
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
