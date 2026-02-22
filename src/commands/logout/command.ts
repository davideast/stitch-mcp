import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';
import { LogoutOptionsSchema, type LogoutOptions } from './spec.js';

export const command: CommandDefinition<any, LogoutOptions> = {
  name: 'logout',
  description: 'Log out of Google Cloud and revoke credentials',
  options: [
    { flags: '--force', description: 'Skip confirmation prompts', defaultValue: false },
    { flags: '--clear-config', description: 'Delete entire gcloud config directory', defaultValue: false },
  ],
  action: async (_args, options) => {
    try {
      const parsedOptions = LogoutOptionsSchema.parse(options);
      const { LogoutHandler } = await import('./handler.js');
      const handler = new LogoutHandler();
      const result = await handler.execute({
        force: parsedOptions.force,
        clearConfig: parsedOptions.clearConfig,
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
  }
};
