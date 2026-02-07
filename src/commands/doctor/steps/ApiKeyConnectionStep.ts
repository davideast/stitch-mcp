import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type DoctorContext } from '../context.js';

export class ApiKeyConnectionStep implements CommandStep<DoctorContext> {
  id = 'api-key-connection';
  name = 'Testing Stitch API...';

  async shouldRun(context: DoctorContext): Promise<boolean> {
    if (context.authMode !== 'apiKey') return false;
    const apiKeyCheck = context.checks.find(c => c.name === 'API Key');
    return !!apiKeyCheck && apiKeyCheck.passed;
  }

  async run(context: DoctorContext): Promise<StepResult> {
    const testResult = await context.stitchService.testConnectionWithApiKey({
      apiKey: context.apiKey!,
    });

    if (testResult.success) {
      const message = `Healthy (${testResult.data.statusCode})`;
      context.checks.push({
        name: 'Stitch API',
        passed: true,
        message,
      });
      return { success: true, detail: message };
    } else {
      const message = testResult.error.message;
      context.checks.push({
        name: 'Stitch API',
        passed: false,
        message,
        suggestion: testResult.error.suggestion,
        details: testResult.error.details,
      });
      return { success: false, error: new Error(message) };
    }
  }
}
