import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';
import { ServeOptionsSchema, type ServeOptions } from './spec.js';
import { ListScreensInputSchema } from './list-screens/spec.js';
import { JsonServerInputSchema } from './json-server/spec.js';

export const command: CommandDefinition<any, ServeOptions> = {
  name: 'serve',
  description: 'Serve project HTML screens via local web server',
  requiredOptions: [
    { flags: '-p, --project <id>', description: 'Project ID' }
  ],
  options: [
    { flags: '-l, --list-screens', description: 'List all screens with their server paths as JSON', defaultValue: false },
    { flags: '--json', description: 'Start server in non-interactive mode and output JSON when ready', defaultValue: false },
  ],
  action: async (_args, options) => {
    try {
      const parsedOptions = ServeOptionsSchema.parse(options);
      const { stitch } = await import('@google/stitch-sdk');

      if (parsedOptions.listScreens) {
        const input = ListScreensInputSchema.safeParse({ projectId: parsedOptions.project });
        if (!input.success) {
          console.log(JSON.stringify({ success: false, error: { code: 'INVALID_INPUT', message: input.error.issues[0]?.message } }, null, 2));
          process.exit(1);
        }
        const { ListScreensHandler } = await import('./list-screens/handler.js');
        const result = await new ListScreensHandler(stitch).execute(input.data);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.success ? 0 : 1);
      }

      if (parsedOptions.json) {
        const input = JsonServerInputSchema.safeParse({ projectId: parsedOptions.project });
        if (!input.success) {
          console.log(JSON.stringify({ success: false, error: { code: 'INVALID_INPUT', message: input.error.issues[0]?.message } }, null, 2));
          process.exit(1);
        }
        const { JsonServerHandler } = await import('./json-server/handler.js');
        const result = await new JsonServerHandler(stitch).execute(input.data);
        console.log(JSON.stringify(result, null, 2));
        if (!result.success) process.exit(1);
        // Keep process alive — server runs until killed
        await new Promise(() => {});
        return;
      }

      const { ServeHandler } = await import('./handler.js');
      const { ServeView } = await import('./ServeView.js');
      const { render } = await import('ink');
      const React = await import('react');

      const handler = new ServeHandler(stitch);
      const result = await handler.execute(parsedOptions.project);

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Failed: ${result.error.message}`));
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
