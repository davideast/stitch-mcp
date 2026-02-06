import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';

export const command: CommandDefinition = {
  name: 'doctor',
  description: 'Verify configuration health',
  options: [
    { flags: '--verbose', description: 'Show detailed error information', defaultValue: false },
  ],
  action: async (_args, options) => {
    try {
      const { DoctorHandler } = await import('./handler.js');
      const handler = new DoctorHandler();
      const result = await handler.execute({
        verbose: options.verbose,
      });

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Health check failed: ${result.error.message}`));
        process.exit(1);
      }
      if (!result.data.allPassed) {
        process.exit(1);
      }
      process.exit(0);
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  }
};
