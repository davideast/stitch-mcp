import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type InitContext } from '../context.js';

export class GcloudInstallStep implements CommandStep<InitContext> {
  id = 'gcloud-cli';
  name = 'Install Google Cloud CLI';

  async shouldRun(context: InitContext): Promise<boolean> {
    return context.authMode !== 'apiKey';
  }

  async run(context: InitContext): Promise<StepResult> {
    if (context.authMode === 'apiKey') {
        return { success: true, status: 'SKIPPED', reason: 'Not required for API Key' };
    }

    const gcloudResult = await context.gcloudService.ensureInstalled({
      minVersion: '400.0.0',
      forceLocal: context.input.local,
    });

    if (!gcloudResult.success) {
      return {
        success: false,
        error: new Error(gcloudResult.error.message),
        detail: gcloudResult.error.message
      };
    }

    return {
      success: true,
      detail: `v${gcloudResult.data.version} (${gcloudResult.data.location})`
    };
  }
}
