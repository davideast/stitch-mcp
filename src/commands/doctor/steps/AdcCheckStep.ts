import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type DoctorContext } from '../context.js';

export class AdcCheckStep implements CommandStep<DoctorContext> {
  id = 'adc-check';
  name = 'Checking application credentials...';

  async shouldRun(context: DoctorContext): Promise<boolean> {
    return true;
  }

  async run(context: DoctorContext): Promise<StepResult> {
    const adcResult = await context.gcloudService.authenticateADC({ skipIfActive: true });

    if (adcResult.success) {
      const message = 'Present';
      context.checks.push({
        name: 'Application Credentials',
        passed: true,
        message,
      });
      return { success: true, detail: message };
    } else {
      const message = 'Not configured';
      context.checks.push({
        name: 'Application Credentials',
        passed: false,
        message,
        suggestion: 'Run: gcloud auth application-default login',
      });
      return { success: false, error: new Error(message) };
    }
  }
}
