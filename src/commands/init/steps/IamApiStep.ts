import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type InitContext } from '../context.js';

export class IamApiStep implements CommandStep<InitContext> {
  id = 'iam-and-api';
  name = 'Configure IAM & enable API';

  async shouldRun(context: InitContext): Promise<boolean> {
    return context.authMode !== 'apiKey';
  }

  async run(context: InitContext): Promise<StepResult> {
     if (context.authMode === 'apiKey') {
        return { success: true, status: 'SKIPPED', reason: 'Not required for API Key' };
    }

    if (!context.projectId || !context.authAccount) {
         return { success: false, error: new Error('Project ID or Auth Account missing') };
    }

    // Check IAM
    const hasIAMRole = await context.stitchService.checkIAMRole({
      projectId: context.projectId,
      userEmail: context.authAccount,
    });

    if (!hasIAMRole) {
      const shouldConfigureIam = context.input.autoVerify || await context.ui.promptConfirm(
        'Add the required IAM role to your account?',
        true
      );

      if (shouldConfigureIam) {
        await context.stitchService.configureIAM({
          projectId: context.projectId,
          userEmail: context.authAccount,
        });
      }
    }

    await context.gcloudService.installBetaComponents();

    const isApiEnabled = await context.stitchService.checkAPIEnabled({
      projectId: context.projectId,
    });

    if (!isApiEnabled) {
      await context.stitchService.enableAPI({
        projectId: context.projectId,
      });
    }

    context.accessToken = await context.gcloudService.getAccessToken() || undefined;
    if (!context.accessToken) {
         return { success: false, error: new Error('Could not obtain access token') };
    }

    return { success: true, detail: 'Ready' };
  }
}
