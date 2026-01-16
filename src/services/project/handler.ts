import {
  type ProjectService,
  type SelectProjectInput,
  type GetProjectDetailsInput,
  type ProjectSelectionResult,
} from './spec.js';
import { type GcloudService } from '../gcloud/spec.js';
import { promptSelect, promptInput, promptConfirm } from '../../ui/wizard.js';
import { theme } from '../../ui/theme.js';

export class ProjectHandler implements ProjectService {
  constructor(private gcloudService: GcloudService) { }

  async selectProject(input: SelectProjectInput): Promise<ProjectSelectionResult> {
    try {
      // Get recent projects
      const projectsResult = await this.gcloudService.listProjects({
        limit: input.limit,
        sortBy: '~createTime',
      });

      if (!projectsResult.success) {
        return {
          success: false,
          error: {
            code: 'SEARCH_FAILED',
            message: 'Failed to fetch projects',
            suggestion: 'Ensure you are authenticated and have access to GCP projects',
            recoverable: true,
          },
        };
      }

      const projects = projectsResult.data.projects;

      if (projects.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_PROJECTS_FOUND',
            message: 'No projects found in your account',
            suggestion: 'Create a project at https://console.cloud.google.com',
            recoverable: false,
          },
        };
      }

      // Build menu choices
      const choices = [
        ...(input.allowSearch ? [{ name: theme.gray('🔍 Search for a project...'), value: '__SEARCH__' }] : []),
        ...projects.map((p) => ({
          name: `${p.name} ${theme.gray(`(${p.projectId})`)}`,
          value: p.projectId,
        })),
      ];

      const selected = await promptSelect('Select a project', choices);

      if (selected === '__SEARCH__') {
        return await this.searchAndSelect();
      }

      const selectedProject = projects.find((p) => p.projectId === selected);

      if (!selectedProject) {
        return {
          success: false,
          error: {
            code: 'SELECTION_CANCELLED',
            message: 'Project selection failed',
            recoverable: true,
          },
        };
      }

      return {
        success: true,
        data: {
          projectId: selectedProject.projectId,
          name: selectedProject.name,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  async getProjectDetails(input: GetProjectDetailsInput): Promise<ProjectSelectionResult> {
    try {
      const projectsResult = await this.gcloudService.listProjects({
        filter: `projectId:${input.projectId}`,
        limit: 1,
      });

      if (!projectsResult.success || projectsResult.data.projects.length === 0) {
        return {
          success: false,
          error: {
            code: 'DETAILS_FAILED',
            message: `Could not find project with ID: ${input.projectId}`,
            recoverable: false,
          },
        };
      }

      const project = projectsResult.data.projects[0];
      return {
        success: true,
        data: {
          projectId: project.projectId,
          name: project.name,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  private async searchAndSelect(): Promise<ProjectSelectionResult> {
    try {
      const query = await promptInput('Enter project name or ID to search (press Enter)');

      if (!query.trim()) {
        return {
          success: false,
          error: {
            code: 'SELECTION_CANCELLED',
            message: 'Search cancelled',
            recoverable: true,
          },
        };
      }

      // Search for projects
      const searchResult = await this.gcloudService.listProjects({
        filter: `name:*${query}* OR projectId:*${query}*`,
        limit: 5,
      });

      if (!searchResult.success) {
        return {
          success: false,
          error: {
            code: 'SEARCH_FAILED',
            message: `Search failed: ${searchResult.error.message}`,
            recoverable: true,
          },
        };
      }

      const projects = searchResult.data.projects;

      if (projects.length === 0) {
        // Offer to use query as manual project ID
        const useManual = await promptConfirm(
          `No projects found matching "${query}". Use "${query}" as project ID?`,
          false
        );

        if (useManual) {
          return {
            success: true,
            data: {
              projectId: query,
              name: query,
            },
          };
        }

        return {
          success: false,
          error: {
            code: 'NO_PROJECTS_FOUND',
            message: `No projects found matching "${query}"`,
            suggestion: 'Try a different search term or select from recent projects',
            recoverable: true,
          },
        };
      }

      // Show search results
      const choices = projects.map((p) => ({
        name: `${p.name} ${theme.gray(`(${p.projectId})`)}`,
        value: p.projectId,
      }));

      const selected = await promptSelect(`Search results for "${query}"`, choices);

      const selectedProject = projects.find((p) => p.projectId === selected);

      if (!selectedProject) {
        return {
          success: false,
          error: {
            code: 'SELECTION_CANCELLED',
            message: 'Selection cancelled',
            recoverable: true,
          },
        };
      }

      return {
        success: true,
        data: {
          projectId: selectedProject.projectId,
          name: selectedProject.name,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }
}
