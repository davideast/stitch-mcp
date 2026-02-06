import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';

export const command: CommandDefinition = {
  name: 'view',
  description: 'Interactively view Stitch resources',
  options: [
    { flags: '--projects', description: 'List all projects', defaultValue: false },
    { flags: '--name <name>', description: 'Resource name to view' },
    { flags: '--sourceScreen <name>', description: 'Source screen resource name' },
    { flags: '--project <id>', description: 'Project ID' },
    { flags: '--screen <id>', description: 'Screen ID' },
    { flags: '--serve', description: 'Serve the screen via local server', defaultValue: false },
  ],
  action: async (_args, options) => {
    try {
      const { ViewHandler } = await import('../../services/view/handler.js');

      if (options.serve) {
          if (!options.screen && !options.sourceScreen && !options.name) {
             console.error(theme.red('Error: --serve requires a screen to be specified via --screen, --sourceScreen, or --name'));
             process.exit(1);
          }

          const handler = new ViewHandler();
          let resource = null;

          const execOptions: any = { projects: false };
          if (options.project) execOptions.project = options.project;
          if (options.screen) execOptions.screen = options.screen;
          if (options.sourceScreen) execOptions.sourceScreen = options.sourceScreen;
          if (options.name) execOptions.name = options.name;

          const res = await handler.execute(execOptions);
          if (res.success) resource = res.data;
          else throw new Error(res.error.message);

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
          return;
      }

      const { render } = await import('ink');
      const React = await import('react');
      const { InteractiveViewer } = await import('../../ui/InteractiveViewer.js');

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

    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  }
};
