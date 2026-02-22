import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';
import { InitOptionsSchema, type InitOptions } from './spec.js';

export const command: CommandDefinition<any, InitOptions> = {
  name: 'init',
  description: 'Initialize authentication and MCP configuration',
  options: [
    { flags: '--local', description: 'Install gcloud locally to project directory instead of user home', defaultValue: false },
    { flags: '-y, --yes', description: 'Auto-approve verification commands', defaultValue: false },
    { flags: '--defaults', description: 'Use default values for prompts', defaultValue: false },
    { flags: '-c, --client <client>', description: 'MCP client to configure' },
    { flags: '-t, --transport <transport>', description: 'Transport type (http or stdio)' },
  ],
  action: async (_args, options) => {
    try {
      const parsedOptions = InitOptionsSchema.parse(options);
      const { InitHandler } = await import('./handler.js');
      const handler = new InitHandler();
      const result = await handler.execute({
        local: parsedOptions.local,
        defaults: parsedOptions.defaults,
        autoVerify: parsedOptions.yes,
        client: parsedOptions.client,
        transport: parsedOptions.transport,
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
  }
};
