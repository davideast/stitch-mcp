import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type DoctorContext } from '../context.js';

export class GcloudCheckStep implements CommandStep<DoctorContext> {
  id = 'gcloud-check';
  name = 'Checking Google Cloud CLI...';

  async shouldRun(context: DoctorContext): Promise<boolean> {
    return true;
  }

  async run(context: DoctorContext): Promise<StepResult> {
    const gcloudResult = await context.gcloudService.ensureInstalled({
      minVersion: '400.0.0',
      forceLocal: false,
    });

    if (gcloudResult.success) {
      const message = `Installed (${gcloudResult.data.location}): v${gcloudResult.data.version}\n   Path: ${gcloudResult.data.path}`;
      context.checks.push({
        name: 'Google Cloud CLI',
        passed: true,
        message,
      });
      return { success: true, detail: message };
    } else {
      const message = 'Not found or invalid version';
      context.checks.push({
        name: 'Google Cloud CLI',
        passed: false,
        message,
        suggestion: 'Run: npx @_davideast/stitch-mcp init',
      });
      return { success: false, error: new Error(message) };
    }
  }
}
