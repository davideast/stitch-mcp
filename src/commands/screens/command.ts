import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';

export const command: CommandDefinition = {
  name: 'screens',
  description: 'Explore all screens in a project',
  requiredOptions: [
    { flags: '-p, --project <id>', description: 'Project ID' }
  ],
  action: async (_args, options) => {
    try {
      const { ScreensHandler } = await import('./handler.js');
      const { ScreensView } = await import('./ScreensView.js');
      const { StitchMCPClient } = await import('../../services/mcp-client/client.js');
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
  }
};
