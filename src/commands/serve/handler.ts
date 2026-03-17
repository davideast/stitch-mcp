interface CodeScreen {
  screenId: string;
  title: string;
  codeUrl: string;
}

type ServeHandlerResult = {
  success: true;
  projectId: string;
  projectTitle: string;
  screens: CodeScreen[];
} | {
  success: false;
  error: string;
};

export class ServeHandler {
  constructor(private readonly stitch: any) {} // Actually StitchSDK but imported as any since typing the singleton directly fails easily

  async execute(projectId: string): Promise<ServeHandlerResult> {
    try {
      const project = this.stitch.project(projectId);
      const screens = await project.screens();

      const withHtml = await Promise.all(
        screens.map(async (s: any) => ({
          screenId: s.screenId,
          title: s.title ?? s.screenId,
          codeUrl: await s.getHtml(),
        }))
      );

      const filtered = withHtml.filter(s => s.codeUrl !== null);

      // Sort alphabetically by title
      filtered.sort((a, b) => a.title.localeCompare(b.title));

      return {
        success: true,
        projectId,
        projectTitle: project.title ?? projectId,
        screens: filtered,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
