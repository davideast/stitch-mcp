import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme } from '../../ui/theme.js';

export const command: CommandDefinition = {
  name: 'snapshot',
  description: 'Create a UI snapshot given a data state',
  options: [
    { flags: '-c, --command <command>', description: 'The command to snapshot (e.g. init)' },
    { flags: '-d, --data <file>', description: 'Path to JSON data file' },
    { flags: '-s, --schema', description: 'Print the data schema for the command', defaultValue: false },
  ],
  action: async (_args, options) => {
    try {
      const { SnapshotHandler } = await import('./handler.js');
      const handler = new SnapshotHandler();
      const result = await handler.execute({
        command: options.command,
        data: options.data,
        schema: options.schema,
      });

      if (!result.success) {
        console.error(theme.red(`Error: ${result.error?.message || 'Snapshot failed'}`));
        process.exit(1);
      }
      process.exit(0);
    } catch (error) {
      console.error(theme.red('Unexpected error:'), error);
      process.exit(1);
    }
  }
};
