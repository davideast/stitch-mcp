import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';

export const command: CommandDefinition = {
  name: 'serve',
  description: 'Serve project HTML screens via local web server',
  requiredOptions: [
    { flags: '-p, --project <id>', description: 'Project ID' }
  ],
  action: async (_args, options) => {
    try {
      const { ServeHandler } = await import('./handler.js');
      const { ServeView } = await import('./ServeView.js');
      const { StitchMCPClient } = await import('../../services/mcp-client/client.js');
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
  }
};
