import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';

export const command: CommandDefinition = {
  name: 'proxy',
  description: 'Start the Stitch MCP proxy server',
  options: [
    { flags: '--transport <type>', description: 'Transport type (stdio or sse)', defaultValue: 'stdio' },
    { flags: '--port <number>', description: 'Port number (required for sse)', fn: (val) => parseInt(val, 10) },
    { flags: '--debug', description: 'Enable debug logging to file', defaultValue: false },
  ],
  action: async (_args, options) => {
    try {
      const { ProxyCommandHandler } = await import('./handler.js');
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
  }
};
