import {
  type APIEnableResult,
  type EnableAPIInput,
} from './spec.js';
import type { GcloudExecutor } from '../gcloud/core.js';

export class StitchApiService {
  constructor(private executor: GcloudExecutor) {}

  async enableAPI(input: EnableAPIInput): Promise<APIEnableResult> {
    try {
      const api = 'stitch.googleapis.com';

      const result = await this.executor.exec(
        ['beta', 'services', 'mcp', 'enable', api, `--project=${input.projectId}`, '--quiet']
      );

      if (!result.success) {
        const errorMsg = result.stderr || result.error || result.stdout || 'Unknown error';
        return {
          success: false,
          error: {
            code: 'API_ENABLE_FAILED',
            message: `Failed to enable Stitch API: ${errorMsg}`,
            suggestion: 'Ensure the project has billing enabled',
            recoverable: true,
            details: `Exit code: ${result.exitCode}\nStderr: ${result.stderr}\nStdout: ${result.stdout}`,
          },
        };
      }

      return {
        success: true,
        data: {
          api,
          enabled: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'API_ENABLE_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  async checkAPIEnabled(input: { projectId: string }): Promise<boolean> {
    try {
      const result = await this.executor.exec(
        [
          'services',
          'list',
          `--project=${input.projectId}`,
          '--enabled',
          '--filter=name:stitch.googleapis.com',
          '--format=value(name)',
        ]
      );
      return result.success && result.stdout.trim().includes('stitch.googleapis.com');
    } catch {
      return false;
    }
  }
}
