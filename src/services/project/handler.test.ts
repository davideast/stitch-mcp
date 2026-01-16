import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { ProjectHandler } from './handler';
import { GcloudService } from '../gcloud/spec';
import * as wizard from '../../ui/wizard';
import { theme } from '../../ui/theme';

// Mock GcloudService
const mockGcloudService: Pick<GcloudService, 'listProjects'> = {
  listProjects: mock(),
};

// Mock UI wizard functions
mock.module('../../ui/wizard', () => ({
  promptSelect: mock(),
  promptInput: mock(),
  promptConfirm: mock(),
}));

describe('ProjectHandler', () => {
  const handler = new ProjectHandler(mockGcloudService as GcloudService);

  beforeEach(() => {
    (mockGcloudService.listProjects as any).mockClear();
    (wizard.promptSelect as any).mockClear();
    (wizard.promptInput as any).mockClear();
    (wizard.promptConfirm as any).mockClear();
  });

  it('should select a project from the initial list', async () => {
    (mockGcloudService.listProjects as any).mockResolvedValue({
      success: true,
      data: {
        projects: [
          { projectId: 'p1', name: 'Project 1' },
          { projectId: 'p2', name: 'Project 2' },
        ],
      },
    });
    (wizard.promptSelect as any).mockResolvedValue('p1');

    const result = await handler.selectProject({ allowSearch: true, limit: 5 });

    expect(result).toEqual({
      success: true,
      data: {
        projectId: 'p1',
        name: 'Project 1',
      },
    });
    expect(mockGcloudService.listProjects).toHaveBeenCalledWith({
      limit: 5,
      sortBy: '~createTime',
    });
    expect(wizard.promptSelect).toHaveBeenCalledWith(
      'Select a project',
      expect.arrayContaining([
        { name: theme.gray('🔍 Search for a project...'), value: '__SEARCH__' },
        { name: `Project 1 ${theme.gray('(p1)')}`, value: 'p1' },
      ])
    );
  });

  it('should handle project search and selection', async () => {
    (mockGcloudService.listProjects as any)
      .mockResolvedValueOnce({
        success: true,
        data: {
          projects: [{ projectId: 'p1', name: 'Recent Project' }],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          projects: [{ projectId: 'search-result', name: 'Search Result' }],
        },
      });

    (wizard.promptSelect as any)
      .mockResolvedValueOnce('__SEARCH__')
      .mockResolvedValueOnce('search-result');
    (wizard.promptInput as any).mockResolvedValue('search-term');

    const result = await handler.selectProject({ allowSearch: true, limit: 5 });

    expect(result).toEqual({
      success: true,
      data: {
        projectId: 'search-result',
        name: 'Search Result',
      },
    });
    expect(mockGcloudService.listProjects).toHaveBeenCalledTimes(2);
    expect((mockGcloudService.listProjects as any).mock.calls[1][0]).toEqual({
      filter: 'name:*search-term* OR projectId:*search-term*',
      limit: 5,
    });
  });

  it('should handle gcloud listProjects failure', async () => {
    (mockGcloudService.listProjects as any).mockResolvedValue({
      success: false,
      error: { message: 'Auth error' },
    });

    const result = await handler.selectProject({ limit: 5 });

    expect(result).toEqual({
      success: false,
      error: {
        code: 'SEARCH_FAILED',
        message: 'Failed to fetch projects',
        suggestion: 'Ensure you are authenticated and have access to GCP projects',
        recoverable: true,
      },
    });
  });

  it('should handle no projects found', async () => {
    (mockGcloudService.listProjects as any).mockResolvedValue({
      success: true,
      data: { projects: [] },
    });

    const result = await handler.selectProject({ limit: 5 });

    expect(result).toEqual({
      success: false,
      error: {
        code: 'NO_PROJECTS_FOUND',
        message: 'No projects found in your account',
        suggestion: 'Create a project at https://console.cloud.google.com',
        recoverable: false,
      },
    });
  });

  it('should handle search with no results and allow manual entry', async () => {
    (mockGcloudService.listProjects as any)
      .mockResolvedValueOnce({
        success: true,
        data: { projects: [{ projectId: 'p1', name: 'Recent' }] },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { projects: [] },
      });

    (wizard.promptSelect as any).mockResolvedValue('__SEARCH__');
    (wizard.promptInput as any).mockResolvedValue('manual-id');
    (wizard.promptConfirm as any).mockResolvedValue(true);

    const result = await handler.selectProject({ limit: 5 });

    expect(result).toEqual({
      success: true,
      data: {
        projectId: 'manual-id',
        name: 'manual-id',
      },
    });
  });
});
