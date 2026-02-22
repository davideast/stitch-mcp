import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';
import { ViewOptionsSchema, type ViewOptions } from './spec.js';

export const command: CommandDefinition<any, ViewOptions> = {
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
      const parsedOptions = ViewOptionsSchema.parse(options);
      const { ViewCommandHandler } = await import('./handler.js');
      const handler = new ViewCommandHandler();
      await handler.execute(parsedOptions);
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  }
};
