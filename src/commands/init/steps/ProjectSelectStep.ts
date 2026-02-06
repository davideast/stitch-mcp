import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type InitContext } from '../context.js';
import { type ProjectSelectionResult } from '../../../services/project/spec.js';

export class ProjectSelectStep implements CommandStep<InitContext> {
  id = 'project-selection';
  name = 'Select Google Cloud project';

  async shouldRun(context: InitContext): Promise<boolean> {
    return context.authMode !== 'apiKey';
  }

  async run(context: InitContext): Promise<StepResult> {
    if (context.authMode === 'apiKey') {
        return { success: true, status: 'SKIPPED', reason: 'Not required for API Key' };
    }

    let projectResult: ProjectSelectionResult | null = null;
    const activeProjectId = await context.gcloudService.getProjectId();

    if (activeProjectId) {
      const detailsResult = await context.projectService.getProjectDetails({ projectId: activeProjectId });
      if (detailsResult.success) {
        const useActive = (context.input.defaults || context.input.autoVerify) ? true : await context.ui.promptConfirm(
          `Use active project: ${detailsResult.data.name} (${detailsResult.data.projectId})?`,
          true
        );
        if (useActive) {
          projectResult = detailsResult;
        }
      }
    }

    if (!projectResult) {
      projectResult = await context.projectService.selectProject({
        allowSearch: true,
        limit: 5,
      });
    }

    if (!projectResult.success) {
        const error = (projectResult as any).error || { message: 'Unknown error' };
        return { success: false, error: new Error(error.message) };
    }

    // Set active project
    const setProjectResult = await context.gcloudService.setProject({
      projectId: projectResult.data.projectId,
    });

    if (!setProjectResult.success) {
        const error = (setProjectResult as any).error || { message: 'Unknown error' };
        return { success: false, error: new Error(error.message) };
    }

    context.projectId = projectResult.data.projectId;
    return {
        success: true,
        detail: context.projectId
    };
  }
}
