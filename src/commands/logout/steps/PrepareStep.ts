import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type LogoutContext } from '../context.js';

export class PrepareStep implements CommandStep<LogoutContext> {
  id = 'prepare';
  name = 'Preparation';

  async shouldRun(context: LogoutContext): Promise<boolean> {
    return true;
  }

  async run(context: LogoutContext): Promise<StepResult> {
    // Check for gcloud availability
    const result = await context.gcloudService.ensureInstalled({
      minVersion: '400.0.0',
      forceLocal: false,
    });

    if (!result.success) {
       return {
           success: false,
           error: new Error('Google Cloud CLI not found'),
           errorCode: 'GCLOUD_NOT_FOUND',
           shouldExit: true
       };
    }
    context.gcloudPath = result.data.path;

    if (!context.input.force) {
        const shouldLogout = await context.ui.promptConfirm(
        'Are you sure you want to log out? This will revoke all credentials.',
        false
        );

        if (!shouldLogout) {
            context.ui.log('\nLogout cancelled.\n');
            return { success: true, shouldExit: true, detail: 'Cancelled' };
        }
    }

    return { success: true };
  }
}
