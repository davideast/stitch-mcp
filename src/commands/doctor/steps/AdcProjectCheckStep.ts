import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type DoctorContext } from '../context.js';
import fs from 'node:fs';
import { getGcloudConfigPath } from '../../../platform/detector.js';
import { joinPath } from '../../../platform/paths.js';

export class AdcProjectCheckStep implements CommandStep<DoctorContext> {
  id = 'adc-project-check';
  name = 'Checking ADC quota project...';

  async shouldRun(context: DoctorContext): Promise<boolean> {
    return context.authMode === 'oauth';
  }

  async run(context: DoctorContext): Promise<StepResult> {
    try {
      const configPath = getGcloudConfigPath();
      const adcPath = joinPath(configPath, 'application_default_credentials.json');

      let adcContent: string;
      try {
        adcContent = await fs.promises.readFile(adcPath, 'utf-8');
      } catch {
        context.checks.push({
          name: 'ADC Quota Project',
          passed: true,
          message: 'Skipped (no ADC file)',
        });
        return { success: true, detail: 'Skipped (no ADC file)', status: 'SKIPPED' };
      }

      const adc = JSON.parse(adcContent);
      const quotaProject = adc.quota_project_id;

      if (quotaProject) {
        const message = `Set: ${quotaProject}`;
        context.checks.push({
          name: 'ADC Quota Project',
          passed: true,
          message,
        });
        return { success: true, detail: message };
      }

      const projectId = await context.gcloudService.getProjectId();
      const suggestion = projectId
        ? `Run: gcloud auth application-default set-quota-project ${projectId}`
        : 'Run: gcloud auth application-default set-quota-project YOUR_PROJECT_ID';

      const message = 'Missing quota_project_id in ADC credentials';
      context.checks.push({
        name: 'ADC Quota Project',
        passed: false,
        message,
        suggestion,
        details: `The file at ${adcPath} is missing the "quota_project_id" field. ` +
          'Google APIs require this to bill quota correctly. Without it, API calls will fail ' +
          'with a quota project error even though authentication succeeds.',
      });

      return {
        success: false,
        error: new Error(message),
        detail: message,
      };
    } catch (error) {
      const message = `Failed to check ADC: ${error instanceof Error ? error.message : String(error)}`;
      context.checks.push({
        name: 'ADC Quota Project',
        passed: false,
        message,
      });
      return { success: false, error: new Error(message) };
    }
  }
}
