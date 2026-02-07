import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type DoctorContext } from '../context.js';

export class ApiKeyDetectedStep implements CommandStep<DoctorContext> {
  id = 'api-key-detected';
  name = 'Checking API Key...';

  async shouldRun(context: DoctorContext): Promise<boolean> {
    return context.authMode === 'apiKey';
  }

  async run(context: DoctorContext): Promise<StepResult> {
    const apiKey = context.apiKey;

    if (!apiKey || apiKey.trim().length === 0) {
      const message = 'STITCH_API_KEY is set but empty';
      context.checks.push({
        name: 'API Key',
        passed: false,
        message,
        suggestion: 'Set a valid API key in STITCH_API_KEY environment variable or in your .env file',
      });
      return { success: false, error: new Error(message) };
    }

    const masked = apiKey.length > 7
      ? `${apiKey.slice(0, 4)}...${apiKey.slice(-3)}`
      : '***';
    const message = `Detected (${masked})`;
    context.checks.push({
      name: 'API Key',
      passed: true,
      message,
    });
    return { success: true, detail: message };
  }
}
