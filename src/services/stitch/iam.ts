import {
  type IAMConfigResult,
  type ConfigureIAMInput,
} from './spec.js';
import type { GcloudExecutor } from '../gcloud/core.js';

export class StitchIamService {
  constructor(private executor: GcloudExecutor) {}

  async configureIAM(input: ConfigureIAMInput): Promise<IAMConfigResult> {
    try {
      const role = 'roles/serviceusage.serviceUsageConsumer';
      const member = `user:${input.userEmail}`;

      const result = await this.executor.exec(
        [
          'projects',
          'add-iam-policy-binding',
          input.projectId,
          `--member=${member}`,
          `--role=${role}`,
          '--condition=None',
          '--quiet',
        ]
      );

      if (!result.success) {
        const errorMsg = result.stderr || result.error || result.stdout || 'Unknown error';
        return {
          success: false,
          error: {
            code: 'IAM_CONFIG_FAILED',
            message: `Failed to configure IAM permissions: ${errorMsg}`,
            suggestion: 'Ensure you have Owner or Editor role on the project',
            recoverable: true,
            details: `Exit code: ${result.exitCode}\nStderr: ${result.stderr}\nStdout: ${result.stdout}`,
          },
        };
      }

      return {
        success: true,
        data: {
          role,
          member,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'IAM_CONFIG_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  async checkIAMRole(input: { projectId: string; userEmail: string }): Promise<boolean> {
    try {
      const role = 'roles/serviceusage.serviceUsageConsumer';
      const member = `user:${input.userEmail}`;
      const result = await this.executor.exec(
        [
          'projects',
          'get-iam-policy',
          input.projectId,
          `--flatten=bindings[].members`,
          `--filter=bindings.role=${role} AND bindings.members=${member}`,
          '--format=value(bindings.members)',
        ]
      );
      return result.success && result.stdout.trim().includes(member);
    } catch {
      return false;
    }
  }
}
