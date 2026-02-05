import { Command } from 'commander';
import { InitHandler } from './commands/init/handler.js';
import { DoctorHandler } from './commands/doctor/handler.js';
import { LogoutHandler } from './commands/logout/handler.js';
import { ToolCommandHandler } from './commands/tool/handler.js';
import { theme, icons } from './ui/theme.js';

const program = new Command();

program
  .name('stitch-mcp')
  .description('Stitch MCP OAuth setup assistant')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize authentication and MCP configuration')
  .option('--local', 'Install gcloud locally to project directory instead of user home', false)
  .option('-y, --yes', 'Auto-approve verification commands', false)
  .option('--defaults', 'Use default values for prompts', false)
  .option('-c, --client <client>', 'MCP client to configure')
  .option('-t, --transport <transport>', 'Transport type (http or stdio)')
  .action(async (options) => {
    try {
      const handler = new InitHandler();
      const result = await handler.execute({
        local: options.local,
        defaults: options.defaults,
        autoVerify: options.yes,
        client: options.client,
        transport: options.transport,
      });

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Setup failed: ${result.error.message}`));
        if (result.error.suggestion) {
          console.error(theme.gray(`  ${result.error.suggestion}`));
        }
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  });

program
  .command('view')
  .description('Interactively view Stitch resources')
  .option('--projects', 'List all projects', false)
  .option('--name <name>', 'Resource name to view')
  .option('--sourceScreen <name>', 'Source screen resource name')
  .option('--project <id>', 'Project ID')
  .option('--screen <id>', 'Screen ID')
  .option('--serve', 'Serve the screen via local server', false)
  .action(async (options) => {
    try {
      const { ViewHandler } = await import('./services/view/handler.js');

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

          const { StitchViteServer } = await import('./lib/server/vite/StitchViteServer.js');
          const { downloadText } = await import('./ui/copy-behaviors/clipboard.js');

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
      const { InteractiveViewer } = await import('./ui/InteractiveViewer.js');

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

      // Determine rootLabel based on what we're viewing
      let rootLabel: string | undefined;
      if (options.sourceScreen) {
        rootLabel = 'screen';
      } else if (options.name) {
        rootLabel = 'resource';
      }

      // Fetch function for navigation
      const fetchResource = async (resourceName: string): Promise<any> => {
        // Determine the type based on the resource name
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

      // Build parent history for back navigation
      const initialHistory: Array<{ data: any; rootLabel?: string; resourcePath?: string }> = [];

      // If viewing a screen, add the projects list and project to history
      if (options.sourceScreen) {
        // Extract project ID from screen path (e.g., "projects/123/screens/abc")
        const projectMatch = options.sourceScreen.match(/^(projects\/\d+)/);
        if (projectMatch) {
          const projectName = projectMatch[1];

          // Fetch projects list for the first level
          try {
            const projectsResult = await handler.execute({ projects: true });
            if (projectsResult.success) {
              initialHistory.push({ data: projectsResult.data, rootLabel: undefined });
            }
          } catch (e) {
            // Ignore - just won't have projects in history
          }

          // Fetch the project for the second level
          try {
            const projectResult = await handler.execute({ projects: false, name: projectName });
            if (projectResult.success) {
              initialHistory.push({ data: projectResult.data, rootLabel: 'resource', resourcePath: projectName });
            }
          } catch (e) {
            // Ignore - just won't have project in history
          }
        }
      }

      // If viewing a project (via --name), add projects list to history
      if (options.name && !options.sourceScreen) {
        try {
          const projectsResult = await handler.execute({ projects: true });
          if (projectsResult.success) {
            initialHistory.push({ data: projectsResult.data, rootLabel: undefined });
          }
        } catch (e) {
          // Ignore - just won't have projects in history
        }
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
  });

program
  .command('doctor')
  .description('Verify configuration health')
  .option('--verbose', 'Show detailed error information', false)
  .action(async (options) => {
    try {
      const handler = new DoctorHandler();
      const result = await handler.execute({
        verbose: options.verbose,
      });

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Health check failed: ${result.error.message}`));
        process.exit(1);
      }

      // Exit with error code if any checks failed
      if (!result.data.allPassed) {
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  });

program
  .command('logout')
  .description('Log out of Google Cloud and revoke credentials')
  .option('--force', 'Skip confirmation prompts', false)
  .option('--clear-config', 'Delete entire gcloud config directory', false)
  .action(async (options) => {
    try {
      const handler = new LogoutHandler();
      const result = await handler.execute({
        force: options.force,
        clearConfig: options.clearConfig,
      });

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Logout failed: ${result.error.message}`));
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  });

program
  .command('proxy')
  .description('Start the Stitch MCP proxy server')
  .option('--transport <type>', 'Transport type (stdio or sse)', 'stdio')
  .option('--port <number>', 'Port number (required for sse)', (val) => parseInt(val, 10))
  .option('--debug', 'Enable debug logging to file', false)
  .action(async (options) => {
    try {
      // Lazy import to avoid loading server dependencies for simple commands
      const { ProxyCommandHandler } = await import('./commands/proxy/handler.js');
      const handler = new ProxyCommandHandler();

      const result = await handler.execute({
        transport: options.transport as 'stdio' | 'sse',
        port: options.port,
        debug: options.debug,
      });

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Proxy server error: ${result.error.message}`));
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  });

program
  .command('tool [toolName]')
  .description('Invoke MCP tools directly')
  .option('-s, --schema', 'Show tool arguments and schema')
  .option('-d, --data <json>', 'JSON data (like curl -d)')
  .option('-f, --data-file <path>', 'Read JSON from file (like curl -d @file)')
  .option('-o, --output <format>', 'Output format: json, pretty, raw', 'pretty')
  .action(async (toolName, options) => {
    try {
      const handler = new ToolCommandHandler();
      const result = await handler.execute({
        toolName,
        showSchema: options.schema,
        data: options.data,
        dataFile: options.dataFile,
        output: options.output,
      });

      if (!result.success) {
        console.error(result.error);
        process.exit(1);
      }

      if (options.output === 'json') {
        console.log(JSON.stringify(result.data));
      } else if (options.output === 'raw') {
        console.log(result.data);
      } else {
        console.log(JSON.stringify(result.data, null, 2));
      }

      process.exit(0);
    } catch (error) {
      console.error('Unexpected error:', error);
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Serve project HTML screens via local web server')
  .requiredOption('-p, --project <id>', 'Project ID')
  .action(async (options) => {
    try {
      const { ServeHandler } = await import('./commands/serve/handler.js');
      const { ServeView } = await import('./commands/serve/ServeView.js');
      const { StitchMCPClient } = await import('./services/mcp-client/client.js');
      const { render } = await import('ink');
      const React = await import('react');

      const client = new StitchMCPClient();
      const handler = new ServeHandler(client);
      const result = await handler.execute(options.project);

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Failed: ${result.error}`));
        process.exit(1);
      }

      if (result.screens.length === 0) {
        console.log(theme.yellow(`\n${icons.warning} No screens with HTML code found in this project.`));
        process.exit(0);
      }

      const createElement = React.createElement || (React.default as any).createElement;
      const instance = render(createElement(ServeView, {
        projectId: result.projectId,
        projectTitle: result.projectTitle,
        screens: result.screens,
      }));
      await instance.waitUntilExit();

      process.exit(0);
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  });

program
  .command('screens')
  .description('Explore all screens in a project')
  .requiredOption('-p, --project <id>', 'Project ID')
  .action(async (options) => {
    try {
      const { ScreensHandler } = await import('./commands/screens/handler.js');
      const { ScreensView } = await import('./commands/screens/ScreensView.js');
      const { StitchMCPClient } = await import('./services/mcp-client/client.js');
      const { render } = await import('ink');
      const React = await import('react');

      const client = new StitchMCPClient();
      const handler = new ScreensHandler(client);
      const result = await handler.execute(options.project);

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Failed: ${result.error}`));
        process.exit(1);
      }

      const createElement = React.createElement || (React.default as any).createElement;
      const instance = render(createElement(ScreensView, {
        projectId: result.projectId,
        projectTitle: result.projectTitle,
        screens: result.screens,
        client,
      }));
      await instance.waitUntilExit();

      process.exit(0);
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  });

program
  .command('site')
  .description('Build a structured site from Stitch screens')
  .requiredOption('-p, --project <id>', 'Project ID')
  .option('-o, --output <dir>', 'Output directory', '.')
  .action(async (options) => {
    try {
      const { SiteCommandHandler } = await import('./commands/site/index.js');
      const handler = new SiteCommandHandler();
      await handler.execute({
          projectId: options.project,
          outputDir: options.output
      });
      process.exit(0);
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  });

program.parse();

