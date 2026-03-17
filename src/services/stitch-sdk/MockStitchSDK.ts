import { mock } from 'bun:test';

export interface MockScreen {
  screenId: string;
  projectId: string;
  title?: string;
  getHtml: ReturnType<typeof mock>;
  getImage: ReturnType<typeof mock>;
}

export interface MockProject {
  id: string;
  projectId: string;
  title?: string;
  screens: ReturnType<typeof mock>;
  getScreen: ReturnType<typeof mock>;
}

export function createMockScreen(overrides: Partial<MockScreen> = {}): MockScreen {
  return {
    screenId: 'screen-1',
    projectId: 'proj-1',
    title: 'Screen One',
    getHtml: mock(() => Promise.resolve('https://cdn.example.com/html/screen-1')),
    getImage: mock(() => Promise.resolve('https://cdn.example.com/img/screen-1')),
    ...overrides,
  };
}

export function createMockProject(
  id: string,
  screens: MockScreen[] = [],
  overrides: Partial<MockProject> = {}
): MockProject {
  return {
    id,
    projectId: id,
    title: 'Mock Project',
    screens: mock(() => Promise.resolve(screens)),
    getScreen: mock((screenId: string) =>
      Promise.resolve(screens.find(s => s.screenId === screenId) ?? null)
    ),
    ...overrides,
  };
}

export function createMockStitch(project: MockProject) {
  return {
    project: mock((_id: string) => project),
    projects: mock(() => Promise.resolve([project])),
    createProject: mock((_title?: string) => Promise.resolve(project)),
    callTool: mock(() => Promise.resolve({})),
    listTools: mock(() => Promise.resolve({ tools: [] })),
  } as any;
}
