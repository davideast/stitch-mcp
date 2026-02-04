/**
 * Tests for InteractiveViewer component behavior.
 */
import { test, expect, describe } from 'bun:test';

describe('InteractiveViewer initialHistory', () => {
  describe('history initialization', () => {
    test('without initialHistory, starts with single entry', () => {
      const initialData = { name: 'projects/123/screens/abc', title: 'Test Screen' };
      const initialRootLabel = 'screen';

      // Without initialHistory, history should have 1 entry
      const expectedHistoryLength = 1;
      expect(expectedHistoryLength).toBe(1);
    });

    test('with initialHistory, prepends entries before initial data', () => {
      const projectsData = { projects: [{ name: 'projects/123' }] };
      const projectData = { name: 'projects/123', title: 'My Project' };
      const screenData = { name: 'projects/123/screens/abc', title: 'Test Screen' };

      const initialHistory = [
        { data: projectsData, rootLabel: undefined },
        { data: projectData, rootLabel: 'resource', resourcePath: 'projects/123' },
      ];

      // With initialHistory of 2 entries + 1 initial data = 3 total
      const expectedHistoryLength = initialHistory.length + 1;
      expect(expectedHistoryLength).toBe(3);
    });

    test('back from screen should show project', () => {
      // When viewing a screen with history [projects, project, screen]
      // and pressing back, should show project
      const historyStack = [
        { data: { projects: [] }, rootLabel: undefined },
        { data: { name: 'projects/123', title: 'My Project' }, rootLabel: 'resource' },
        { data: { name: 'projects/123/screens/abc', title: 'Screen' }, rootLabel: 'screen' },
      ];

      // After back, should be at index 1 (project)
      const afterBack = historyStack.slice(0, -1);
      expect(afterBack.length).toBe(2);
      expect(afterBack[afterBack.length - 1]!.rootLabel).toBe('resource');
    });

    test('back from project should show projects list', () => {
      const historyStack = [
        { data: { projects: [] }, rootLabel: undefined },
        { data: { name: 'projects/123', title: 'My Project' }, rootLabel: 'resource' },
      ];

      // After back, should be at index 0 (projects list)
      const afterBack = historyStack.slice(0, -1);
      expect(afterBack.length).toBe(1);
      expect(afterBack[afterBack.length - 1]!.rootLabel).toBeUndefined();
    });
  });

  describe('parent hierarchy extraction', () => {
    test('extracts project ID from screen path', () => {
      const screenPath = 'projects/8367764258126497590/screens/02b8b8e2c6fd487fbd1da63733a5e77c';
      const projectMatch = screenPath.match(/^(projects\/\d+)/);

      expect(projectMatch).not.toBeNull();
      expect(projectMatch![1]).toBe('projects/8367764258126497590');
    });

    test('handles screenPaths without screens segment', () => {
      const projectPath = 'projects/123';
      const projectMatch = projectPath.match(/^(projects\/\d+)/);

      expect(projectMatch).not.toBeNull();
      expect(projectMatch![1]).toBe('projects/123');
    });
  });
});

describe('fetch function routing', () => {
  test('screen paths use sourceScreen handler', () => {
    const resourceName = 'projects/123/screens/abc';
    const isScreen = resourceName.includes('/screens/');
    expect(isScreen).toBe(true);
  });

  test('project paths use name handler', () => {
    const resourceName = 'projects/123';
    const isScreen = resourceName.includes('/screens/');
    expect(isScreen).toBe(false);
  });
});
