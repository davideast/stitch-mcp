import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type DoctorContext } from '../context.js';

export class ProjectCheckStep implements CommandStep<DoctorContext> {
  id = 'project-check';
  name = 'Checking active project...';

  async shouldRun(context: DoctorContext): Promise<boolean> {
    return true;
  }

  async run(context: DoctorContext): Promise<StepResult> {
    const projectId = await context.gcloudService.getProjectId();

    if (projectId) {
      const message = `Set: ${projectId}`;
      context.checks.push({
        name: 'Active Project',
        passed: true,
        message,
      });
      return { success: true, detail: message };
    } else {
      const message = 'No project configured';
      context.checks.push({
        name: 'Active Project',
        passed: false,
        message,
        suggestion: 'Run: npx @_davideast/stitch-mcp init',
      });
      return { success: false, error: new Error(message) };
    }
  }
}
