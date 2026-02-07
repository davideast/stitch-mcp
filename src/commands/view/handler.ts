import { theme, icons } from '../../ui/theme.js';

interface ViewOptions {
  projects: boolean;
  name?: string;
  sourceScreen?: string;
  project?: string;
  screen?: string;
  serve: boolean;
}

export class ViewCommandHandler {
  async execute(options: ViewOptions): Promise<void> {
    if (options.serve) {
      await this.executeServeMode(options);
    } else {
      await this.executeInteractiveMode(options);
    }
  }

  private async executeServeMode(options: ViewOptions): Promise<void> {
    if (!options.screen && !options.sourceScreen && !options.name) {
      console.error(theme.red('Error: --serve requires a screen to be specified via --screen, --sourceScreen, or --name'));
      process.exit(1);
    }

    const { ViewHandler } = await import('../../services/view/handler.js');
    const handler = new ViewHandler();

    const execOptions: any = { projects: false };
    if (options.project) execOptions.project = options.project;
    if (options.screen) execOptions.screen = options.screen;
    if (options.sourceScreen) execOptions.sourceScreen = options.sourceScreen;
    if (options.name) execOptions.name = options.name;

    const res = await handler.execute(execOptions);
    if (!res.success) throw new Error(res.error.message);

    const resource = res.data;
    if (!resource) {
      throw new Error('Could not find resource');
    }

    if (!resource.htmlCode || !resource.htmlCode.downloadUrl) {
      console.error(theme.red('Error: The specified resource is not a screen or has no HTML code.'));
      process.exit(1);
    }

    const { StitchViteServer } = await import('../../lib/server/vite/StitchViteServer.js');
    const { downloadText } = await import('../../ui/copy-behaviors/clipboard.js');

    const server = new StitchViteServer();
    const url = await server.start(0);
    console.log(theme.green(`Starting server at ${url}`));

    console.log('Downloading content...');
    const html = await downloadText(resource.htmlCode.downloadUrl);
    server.mount('/', html);

    console.log(theme.green(`Serving screen "${resource.title || 'Screen'}" at ${url}/`));
    console.log('Press Ctrl+C to stop.');

    await new Promise(() => {});
  }

  private async executeInteractiveMode(options: ViewOptions): Promise<void> {
    const { render } = await import('ink');
    const React = await import('react');
    const { InteractiveViewer } = await import('../../ui/InteractiveViewer.js');
    const { ViewHandler } = await import('../../services/view/handler.js');

    const handler = new ViewHandler();
    const result = await handler.execute({
      projects: options.projects,
      name: options.name,
      sourceScreen: options.sourceScreen,
      project: options.project,
      screen: options.screen,
    });

    if (!result.success) {
      console.error(theme.red(`\n${icons.error} View failed: ${result.error.message}`));
      process.exit(1);
    }

    const createElement = React.createElement || (React.default as any).createElement;

    let rootLabel: string | undefined;
    if (options.sourceScreen) {
      rootLabel = 'screen';
    } else if (options.name) {
      rootLabel = 'resource';
    }

    const fetchResource = async (resourceName: string): Promise<any> => {
      if (resourceName.includes('/screens/')) {
        const navResult = await handler.execute({ projects: false, sourceScreen: resourceName });
        if (!navResult.success) throw new Error(navResult.error.message);
        return navResult.data;
      } else {
        const navResult = await handler.execute({ projects: false, name: resourceName });
        if (!navResult.success) throw new Error(navResult.error.message);
        return navResult.data;
      }
    };

    const initialHistory: Array<{ data: any; rootLabel?: string; resourcePath?: string }> = [];

    if (options.sourceScreen) {
      const projectMatch = options.sourceScreen.match(/^(projects\/\d+)/);
      if (projectMatch) {
        const projectName = projectMatch[1];
        try {
          const projectsResult = await handler.execute({ projects: true });
          if (projectsResult.success) {
            initialHistory.push({ data: projectsResult.data, rootLabel: undefined });
          }
        } catch (e) {}

        try {
          const projectResult = await handler.execute({ projects: false, name: projectName });
          if (projectResult.success) {
            initialHistory.push({ data: projectResult.data, rootLabel: 'resource', resourcePath: projectName });
          }
        } catch (e) {}
      }
    }

    if (options.name && !options.sourceScreen) {
      try {
        const projectsResult = await handler.execute({ projects: true });
        if (projectsResult.success) {
          initialHistory.push({ data: projectsResult.data, rootLabel: undefined });
        }
      } catch (e) {}
    }

    const instance = render(createElement(InteractiveViewer, {
      initialData: result.data,
      initialRootLabel: rootLabel,
      initialHistory: initialHistory.length > 0 ? initialHistory : undefined,
      onFetch: fetchResource,
    }));
    await instance.waitUntilExit();
    process.exit(0);
  }
}
