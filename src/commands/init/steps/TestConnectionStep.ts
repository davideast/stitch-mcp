import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type InitContext } from '../context.js';
import { theme, icons } from '../../../ui/theme.js';

export class TestConnectionStep implements CommandStep<InitContext> {
  id = 'connection-test';
  name = 'Test connection';

  async shouldRun(context: InitContext): Promise<boolean> {
    return context.authMode === 'oauth';
  }

  async run(context: InitContext): Promise<StepResult> {
      if (context.authMode !== 'oauth') {
          return { success: true, status: 'SKIPPED', reason: 'Not supported for API Key yet' };
      }
      if (!context.accessToken) {
          // Should have been caught before
          return { success: false, status: 'SKIPPED', reason: 'No access token' };
      }

      const testResult = await context.stitchService.testConnection({
          projectId: context.projectId!,
          accessToken: context.accessToken,
      });

      if (!testResult.success) {
          const error = (testResult as any).error || { message: 'Unknown error', suggestion: '' };
          context.ui.log(theme.red(`\n  ${icons.error} Error: ${error.message}`));
          context.ui.warn(`  ${error.suggestion}`);
          return {
              success: false,
              detail: error.message,
              error: new Error(error.message)
          };
      }

      return { success: true, detail: `${testResult.data.statusCode} OK` };
  }
}
