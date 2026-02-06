import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type DoctorContext } from '../context.js';

export class ApiCheckStep implements CommandStep<DoctorContext> {
  id = 'api-check';
  name = 'Testing Stitch API...';

  async shouldRun(context: DoctorContext): Promise<boolean> {
    // Only run if we have a project
    const projectCheck = context.checks.find(c => c.name === 'Active Project');
    return !!projectCheck && projectCheck.passed;
  }

  async run(context: DoctorContext): Promise<StepResult> {
     // We need to re-fetch project ID because it's not stored in context state (only in checks array)
    const projectId = await context.gcloudService.getProjectId();
    const accessToken = await context.gcloudService.getAccessToken();

    if (projectId && accessToken) {
        const testResult = await context.stitchService.testConnection({
            projectId,
            accessToken,
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
    } else {
        const message = 'Could not obtain access token';
        context.checks.push({
            name: 'Stitch API',
            passed: false,
            message,
            suggestion: 'Re-run authentication',
        });
        return { success: false, error: new Error(message) };
    }
  }
}
