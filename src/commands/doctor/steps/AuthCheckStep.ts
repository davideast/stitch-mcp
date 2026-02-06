import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type DoctorContext } from '../context.js';

export class AuthCheckStep implements CommandStep<DoctorContext> {
  id = 'auth-check';
  name = 'Checking user authentication...';

  async shouldRun(context: DoctorContext): Promise<boolean> {
    return true;
  }

  async run(context: DoctorContext): Promise<StepResult> {
    const authResult = await context.gcloudService.authenticate({ skipIfActive: true });

    if (authResult.success) {
      const message = `Authenticated: ${authResult.data.account}`;
      context.checks.push({
        name: 'User Authentication',
        passed: true,
        message,
      });
      return { success: true, detail: message };
    } else {
      const message = 'Not authenticated';
      context.checks.push({
        name: 'User Authentication',
        passed: false,
        message,
        suggestion: 'Run: gcloud auth login',
      });
      return { success: false, error: new Error(message) };
    }
  }
}
