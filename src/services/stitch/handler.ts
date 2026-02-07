import {
  type StitchService,
  type ConfigureIAMInput,
  type EnableAPIInput,
  type TestConnectionInput,
  type IAMConfigResult,
  type APIEnableResult,
  type ConnectionTestResult,
} from './spec.js';
import fs from 'node:fs';
import { execCommand } from '../../platform/shell.js';
import { getGcloudConfigPath, getGcloudSdkPath, detectPlatform } from '../../platform/detector.js';
import { joinPath } from '../../platform/paths.js';

export class StitchHandler implements StitchService {
  private getGcloudEnv(): Record<string, string> {
    return {
      ...process.env,
      CLOUDSDK_CONFIG: getGcloudConfigPath(),
      CLOUDSDK_CORE_DISABLE_PROMPTS: '1',
    } as Record<string, string>;
  }

  private gcloudBinaryPromise: Promise<string> | null = null;

  private async getGcloudBinary(): Promise<string> {
    if (this.gcloudBinaryPromise) {
      return this.gcloudBinaryPromise;
    }

    this.gcloudBinaryPromise = (async () => {
      const platform = detectPlatform();
      const localSdkPath = getGcloudSdkPath();
      const localBinaryPath = joinPath(localSdkPath, 'bin', platform.gcloudBinaryName);

      try {
        await fs.promises.access(localBinaryPath, fs.constants.F_OK);
        return localBinaryPath;
      } catch {
        return 'gcloud';
      }
    })();

    return this.gcloudBinaryPromise;
  }

  async configureIAM(input: ConfigureIAMInput): Promise<IAMConfigResult> {
    try {
      const role = 'roles/serviceusage.serviceUsageConsumer';
      const member = `user:${input.userEmail}`;

      const result = await execCommand(
        [
          await this.getGcloudBinary(),
          'projects',
          'add-iam-policy-binding',
          input.projectId,
          `--member=${member}`,
          `--role=${role}`,
          '--condition=None',
          '--quiet',
        ],
        { env: this.getGcloudEnv() }
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

  async enableAPI(input: EnableAPIInput): Promise<APIEnableResult> {
    try {
      const api = 'stitch.googleapis.com';

      const env = this.getGcloudEnv();
      env.CLOUDSDK_CORE_PROJECT = input.projectId;

      const result = await execCommand(
        [await this.getGcloudBinary(), 'beta', 'services', 'mcp', 'enable', api, `--project=${input.projectId}`, '--quiet'],
        { env }
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

  async checkIAMRole(input: { projectId: string; userEmail: string }): Promise<boolean> {
    try {
      const role = 'roles/serviceusage.serviceUsageConsumer';
      const member = `user:${input.userEmail}`;
      const result = await execCommand(
        [
          await this.getGcloudBinary(),
          'projects',
          'get-iam-policy',
          input.projectId,
          `--flatten=bindings[].members`,
          `--filter=bindings.role=${role} AND bindings.members=${member}`,
          '--format=value(bindings.members)',
        ],
        { env: this.getGcloudEnv() }
      );
      return result.success && result.stdout.trim().includes(member);
    } catch {
      return false;
    }
  }

  async checkAPIEnabled(input: { projectId: string }): Promise<boolean> {
    try {
      const result = await execCommand(
        [
          await this.getGcloudBinary(),
          'services',
          'list',
          `--project=${input.projectId}`,
          '--enabled',
          '--filter=name:stitch.googleapis.com',
          '--format=value(name)',
        ],
        { env: this.getGcloudEnv() }
      );
      return result.success && result.stdout.trim().includes('stitch.googleapis.com');
    } catch {
      return false;
    }
  }

  async testConnection(input: TestConnectionInput): Promise<ConnectionTestResult> {
    try {
      const url = process.env.STITCH_HOST || 'https://stitch.googleapis.com/mcp';

      const payload = {
        method: 'tools/call',
        jsonrpc: '2.0',
        params: {
          name: 'list_projects',
          arguments: {},
        },
        id: 1,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${input.accessToken}`,
          'X-Goog-User-Project': input.projectId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Capture full error response which may contain helpful URLs
        let errorDetails = '';
        let errorMessage = `API request failed with status ${response.status}`;

        try {
          const errorBody = await response.json() as any;
          errorDetails = JSON.stringify(errorBody, null, 2);

          // Extract error message if available
          if (errorBody?.error?.message) {
            errorMessage = errorBody.error.message;
          }
        } catch {
          // If response isn't JSON, try to get text
          try {
            errorDetails = await response.text();
          } catch {
            errorDetails = `Status ${response.status}: ${response.statusText}`;
          }
        }

        return {
          success: false,
          error: {
            code: response.status === 403 ? 'PERMISSION_DENIED' : 'CONNECTION_TEST_FAILED',
            message: errorMessage,
            suggestion:
              response.status === 403
                ? 'Check IAM permissions and ensure API is enabled'
                : 'Verify project configuration and try again',
            recoverable: true,
            details: errorDetails,
          },
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          connected: true,
          statusCode: response.status,
          url,
          response: data,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_TEST_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }
}
