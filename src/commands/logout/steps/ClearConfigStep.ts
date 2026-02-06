import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type LogoutContext } from '../context.js';
import { theme, icons } from '../../../ui/theme.js';
import { getGcloudConfigPath } from '../../../platform/detector.js';
import fs from 'node:fs';

export class ClearConfigStep implements CommandStep<LogoutContext> {
  id = 'clear-config';
  name = 'Clear configuration directory';

  async shouldRun(context: LogoutContext): Promise<boolean> {
    return context.input.clearConfig;
  }

  async run(context: LogoutContext): Promise<StepResult> {
    context.ui.log(theme.gray('Clearing gcloud configuration directory...'));
    const configPath = getGcloudConfigPath();

    try {
      if (fs.existsSync(configPath)) {
        fs.rmSync(configPath, { recursive: true, force: true });
        context.ui.log(theme.green(`${icons.success} Configuration directory cleared`));
        context.configCleared = true;
      } else {
        context.ui.log(theme.gray('Configuration directory does not exist'));
        context.configCleared = true;
      }
    } catch (error) {
      context.ui.log(theme.yellow(`${icons.warning} Failed to clear configuration directory`));
      context.ui.log(theme.gray(`  ${error instanceof Error ? error.message : String(error)}`));
    }
    return { success: true };
  }
}
