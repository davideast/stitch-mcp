import { StitchMCPClient } from './client.js';

export class MockStitchMCPClient extends StitchMCPClient {
  private mockScreens: any[] = [];

  constructor(mockScreens: any[]) {
    // Pass empty config to parent, assuming it won't fail if we don't connect
    super({ projectId: 'mock-project' });
    this.mockScreens = mockScreens;
  }

  async connect() {
    // No-op for mock
  }

  async callTool<T>(name: string, args: Record<string, any>): Promise<T> {
    if (name === 'list_screens') {
      return { screens: this.mockScreens } as unknown as T;
    }
    console.warn(`MockStitchMCPClient: Unknown tool call '${name}'`);
    return {} as T;
  }
}
