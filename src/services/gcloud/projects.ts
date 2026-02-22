import {
  type ListProjectsInput,
  type SetProjectInput,
  type ProjectListResult,
  type ProjectSetResult,
  PROJECT_ID_REGEX,
} from './spec.js';
import { GcloudExecutor } from './core.js';

export class GcloudProjectService {
  constructor(private executor: GcloudExecutor) {}

  /**
   * List projects
   */
  async listProjects(input: ListProjectsInput): Promise<ProjectListResult> {
    try {
      const args = ['projects', 'list', '--format=json'];

      if (input.limit) {
        args.push(`--limit=${input.limit}`);
      }

      if (input.filter) {
        args.push(`--filter=${input.filter}`);
      }

      if (input.sortBy) {
        args.push(`--sort-by=${input.sortBy}`);
      }

      const result = await this.executor.exec(args);

      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'PROJECT_LIST_FAILED',
            message: `Failed to list projects: ${result.stderr}`,
            suggestion: 'Ensure you are authenticated and have access to projects',
            recoverable: true,
          },
        };
      }

      const projects = JSON.parse(result.stdout) as Array<{
        projectId: string;
        name: string;
        projectNumber?: string;
        createTime?: string;
      }>;

      return {
        success: true,
        data: {
          projects: projects.map((p) => ({
            projectId: p.projectId,
            name: p.name,
            projectNumber: p.projectNumber,
            createTime: p.createTime,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROJECT_LIST_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  /**
   * Set active project
   */
  async setProject(input: SetProjectInput): Promise<ProjectSetResult> {
    // Explicit validation before command execution
    if (!PROJECT_ID_REGEX.test(input.projectId)) {
      return {
        success: false,
        error: {
          code: 'PROJECT_SET_FAILED',
          message: `Invalid project ID: ${input.projectId}. Project IDs must be 6-30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens.`,
          suggestion: 'Verify the project ID is correct',
          recoverable: false,
        },
      };
    }

    try {
      const result = await this.executor.exec(
        ['config', 'set', 'project', input.projectId, '--quiet']
      );

      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'PROJECT_SET_FAILED',
            message: `Failed to set project: ${input.projectId}`,
            suggestion: 'Verify the project ID is correct',
            recoverable: true,
          },
        };
      }

      return {
        success: true,
        data: {
          projectId: input.projectId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROJECT_SET_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  async getProjectId(): Promise<string | null> {
    // Check environment variables first
    if (process.env.STITCH_PROJECT_ID) {
      return process.env.STITCH_PROJECT_ID;
    }
    if (process.env.GOOGLE_CLOUD_PROJECT) {
      return process.env.GOOGLE_CLOUD_PROJECT;
    }

    try {
      const result = await this.executor.exec(['config', 'get-value', 'project']);

      if (result.success && result.stdout.trim()) {
        return result.stdout.trim();
      }

      return null;
    } catch (e) {
      return null;
    }
  }
}
